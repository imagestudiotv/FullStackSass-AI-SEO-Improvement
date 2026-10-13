<?php
/**
 * Limits on anonymous "Get Featured" requests (includes/featured.php): who a
 * visitor is, and an atomic reservation against the limits.
 *
 * Who is asking. A forwarding header (CF-Connecting-IP, X-Forwarded-For) is
 * text any client can send, so before 2.2.0 a script could reset its own
 * per-visitor limit by sending a new address with every request. Now:
 *  - by default only REMOTE_ADDR counts - the address that actually
 *    connected to the server;
 *  - a header is believed only when REMOTE_ADDR is one of the TRUSTED
 *    PROXIES in the settings (for example Cloudflare's ranges), and only the
 *    header chosen there;
 *  - X-Forwarded-For is read from the right: each proxy appends the address
 *    it received the request from, so the first address from the right that
 *    is not a trusted proxy is the visitor. What a client wrote further left
 *    is never reached;
 *  - every address must be a valid IP; IPv6 visitors are counted per /64
 *    (one subscriber's block), so rotating through their own block does not
 *    give them new limits;
 *  - no usable address: one shared "unknown" bucket (fails closed).
 *
 * The reservation. Before 2.2.0 each limit was COUNTED and the request
 * INSERTED afterwards, so requests arriving together all saw the same count
 * and all got in. isb_reserve_request() decides and records in one InnoDB
 * transaction, serialised on one row lock (every request takes the same row,
 * so a decision always sees every earlier one). WordPress options and
 * transients are not used for this: add_option() is a read followed by an
 * upsert, and transients may live in an object cache, so neither is a lock.
 * Anything that goes wrong refuses the request (fails closed).
 */

defined('ABSPATH') || exit;

/** Bump when the tables below change. */
const ISB_DB_VERSION = '1';

/** Limits on anonymous requests: per visitor, per email, and overall. */
const ISB_LIMITS = array(
    'visitor_hour' => 5,
    'visitor_day' => 20,
    'email_hour' => 5,
    'all_day' => 100,
);

/** The headers a trusted proxy may carry the visitor's address in, and where PHP puts each. */
function isb_client_ip_headers() {
    return array(
        'cf-connecting-ip' => 'HTTP_CF_CONNECTING_IP',
        'x-forwarded-for' => 'HTTP_X_FORWARDED_FOR',
        'x-real-ip' => 'HTTP_X_REAL_IP',
    );
}

/** A valid IP address in canonical form, or null. "[2001:db8::1]:443" and "203.0.113.5:8080" lose the port; an IPv4-mapped IPv6 address becomes IPv4. */
function isb_clean_ip($value) {
    $value = trim((string) $value);
    if ($value === '' || strlen($value) > 64) return null;
    if (preg_match('~\A\[([0-9a-fA-F:.]+)\](?::\d{1,5})?\z~', $value, $m)) $value = $m[1];
    elseif (preg_match('~\A(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}\z~', $value, $m)) $value = $m[1];
    if (filter_var($value, FILTER_VALIDATE_IP) === false) return null;
    $packed = @inet_pton($value);
    if ($packed === false) return null;
    if (strlen($packed) === 16 && substr($packed, 0, 12) === str_repeat("\0", 10) . "\xff\xff") $packed = substr($packed, 12);
    return inet_ntop($packed);
}

/** An address or a range ("203.0.113.0/24", "2001:db8::/32", "198.51.100.7") in canonical form, or null when it is not one. */
function isb_clean_range($value) {
    $value = trim((string) $value);
    if (strpos($value, '/') === false) return isb_clean_ip($value);
    list($address, $bits) = explode('/', $value, 2);
    $ip = isb_clean_ip($address);
    if ($ip === null || !preg_match('~\A\d{1,3}\z~', $bits)) return null;
    $v4 = strpos($ip, ':') === false;
    // Nothing broader than a /8 (IPv4) or /16 (IPv6): "0.0.0.0/0" would trust every client's header.
    if ((int) $bits > ($v4 ? 32 : 128) || (int) $bits < ($v4 ? 8 : 16)) return null;
    return $ip . '/' . (int) $bits;
}

/** True when $ip (canonical) is one of $ranges (canonical, from isb_clean_range). */
function isb_ip_in_ranges($ip, array $ranges) {
    $packed = inet_pton($ip);
    foreach ($ranges as $range) {
        list($base, $bits) = strpos($range, '/') === false ? array($range, null) : explode('/', $range, 2);
        $net = @inet_pton($base);
        if ($net === false || strlen($net) !== strlen($packed)) continue;
        $bits = $bits === null ? strlen($net) * 8 : (int) $bits;
        $bytes = intdiv($bits, 8);
        if (substr($packed, 0, $bytes) !== substr($net, 0, $bytes)) continue;
        $rest = $bits % 8;
        if ($rest === 0) return true;
        $mask = (0xff << (8 - $rest)) & 0xff;
        if ((ord($packed[$bytes]) & $mask) === (ord($net[$bytes]) & $mask)) return true;
    }
    return false;
}

/**
 * The visitor's address under $policy, or null when there is no usable one.
 *
 * $server is $_SERVER; $policy is array('proxies' => canonical ranges,
 * 'header' => a key of isb_client_ip_headers()). See the top of this file.
 */
function isb_client_ip(array $server, array $policy) {
    $remote = isb_clean_ip($server['REMOTE_ADDR'] ?? '');
    $proxies = isset($policy['proxies']) && is_array($policy['proxies']) ? $policy['proxies'] : array();
    $header = $policy['header'] ?? '';
    if ($remote === null || !isset(isb_client_ip_headers()[$header]) || !$proxies || !isb_ip_in_ranges($remote, $proxies)) {
        return $remote;
    }
    $raw = (string) ($server[isb_client_ip_headers()[$header]] ?? '');
    if ($header !== 'x-forwarded-for') {
        // A single-address header: the trusted proxy's word, or the proxy itself when it gave none.
        return isb_clean_ip($raw) ?? $remote;
    }
    // From the right: the nearest hop first. Stop at the first address no trusted proxy vouches for.
    $client = $remote;
    foreach (array_reverse(explode(',', $raw)) as $hop) {
        $ip = isb_clean_ip($hop);
        // Unreadable: whatever is further left was written by someone we cannot vouch for.
        if ($ip === null) break;
        $client = $ip;
        if (!isb_ip_in_ranges($ip, $proxies)) break;
    }
    return $client;
}

/** What one visitor is counted as: the IPv4 address, or the IPv6 /64. */
function isb_visitor_identity($ip) {
    if ($ip === null) return 'unknown';
    if (strpos($ip, ':') === false) return $ip;
    return inet_ntop(substr(inet_pton($ip), 0, 8) . str_repeat("\0", 8)) . '/64';
}

/** The trusted-proxy policy from the settings, as isb_client_ip() takes it. Filterable for hosts that configure it in code. */
function isb_client_ip_policy() {
    $settings = isb_settings();
    $proxies = array();
    foreach (preg_split('~[\s,]+~', (string) $settings['trusted_proxies'], -1, PREG_SPLIT_NO_EMPTY) as $line) {
        $range = isb_clean_range($line);
        if ($range !== null) $proxies[] = $range;
    }
    return apply_filters('isb_client_ip_policy', array('proxies' => $proxies, 'header' => $settings['client_ip_header']));
}

/** Who is asking, as a keyed hash: the address itself is never stored. */
function isb_visitor_hash(?array $server = null) {
    $ip = isb_client_ip($server ?? $_SERVER, isb_client_ip_policy());
    return substr(hash_hmac('sha256', isb_visitor_identity($ip), wp_salt('nonce')), 0, 32);
}

/** The limits a request is checked against: array(bucket, seconds, limit) each. */
function isb_request_buckets($visitor_hash, $email) {
    $limits = apply_filters('isb_request_limits', ISB_LIMITS);
    $email_key = substr(hash_hmac('sha256', strtolower(trim($email)), wp_salt('nonce')), 0, 32);
    return array(
        array('v:' . $visitor_hash, HOUR_IN_SECONDS, (int) $limits['visitor_hour']),
        array('v:' . $visitor_hash, DAY_IN_SECONDS, (int) $limits['visitor_day']),
        array('e:' . $email_key, HOUR_IN_SECONDS, (int) $limits['email_hour']),
        array('all', DAY_IN_SECONDS, (int) $limits['all_day']),
    );
}

function isb_request_log_table() {
    global $wpdb;
    return $wpdb->prefix . 'isb_request_log';
}

function isb_request_lock_table() {
    global $wpdb;
    return $wpdb->prefix . 'isb_request_lock';
}

/**
 * Creates the two tables (both InnoDB: the reservation needs transactions
 * and row locks) and the lock row. Records ISB_DB_VERSION only when both
 * tables really are InnoDB; until then requests are refused.
 */
function isb_install_tables() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    $log = isb_request_log_table();
    $lock = isb_request_lock_table();
    $wpdb->query("CREATE TABLE IF NOT EXISTS {$log} (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        bucket varchar(40) NOT NULL,
        created int(10) unsigned NOT NULL,
        PRIMARY KEY  (id),
        KEY bucket_created (bucket, created),
        KEY created (created)
    ) ENGINE=InnoDB {$charset}");
    $wpdb->query("CREATE TABLE IF NOT EXISTS {$lock} (
        name varchar(40) NOT NULL,
        version bigint(20) unsigned NOT NULL DEFAULT 0,
        PRIMARY KEY  (name)
    ) ENGINE=InnoDB {$charset}");
    $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$lock} (name, version) VALUES (%s, 0)", 'featured'));
    $ready = true;
    foreach (array($log, $lock) as $table) {
        $status = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS LIKE %s', $wpdb->esc_like($table)));
        if (!$status || strtolower((string) $status->Engine) !== 'innodb') $ready = false;
    }
    update_option('isb_db_version', $ready ? ISB_DB_VERSION : 'not-ready', true);
    return $ready;
}

/** True when the tables are in place; installs them on first use after an update (a ZIP upload runs no activation hook). */
function isb_quota_ready() {
    if (get_option('isb_db_version') === ISB_DB_VERSION) return true;
    return isb_install_tables();
}

/**
 * Checks a request against every limit and records it, atomically.
 *
 * Returns 'ok' (recorded: it counts from now on, whatever happens next),
 * 'busy' (a limit is reached; nothing recorded) or 'unavailable' (could not
 * decide; nothing recorded - refuse).
 *
 * One transaction: lock the "featured" row (UPDATE, so it is a write - a
 * plain SELECT ... FOR UPDATE would not conflict on a multi-primary cluster),
 * count each bucket's requests in its window, insert one row per bucket,
 * commit. The lock is held until the commit, so the next request's counts
 * (its first read comes after it gets the lock) include this one.
 */
function isb_reserve_request(array $buckets, $now = null) {
    global $wpdb;
    $now = $now === null ? time() : (int) $now;
    if (!isb_quota_ready()) return 'unavailable';
    $log = isb_request_log_table();
    $lock = isb_request_lock_table();
    $suppress = $wpdb->suppress_errors(true);
    $result = 'unavailable';
    try {
        if ($wpdb->query('START TRANSACTION') === false) return 'unavailable';
        $take = $wpdb->prepare("UPDATE {$lock} SET version = version + 1 WHERE name = %s", 'featured');
        $locked = $wpdb->query($take);
        if ($locked === 0) {
            // The lock row went missing: put it back and take it.
            $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$lock} (name, version) VALUES (%s, 0)", 'featured'));
            $locked = $wpdb->query($take);
        }
        if ($locked !== 1) throw new RuntimeException('lock');
        foreach ($buckets as $bucket) {
            list($key, $seconds, $limit) = $bucket;
            $count = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$log} WHERE bucket = %s AND created > %d", $key, $now - (int) $seconds));
            if ($count === null || $wpdb->last_error !== '') throw new RuntimeException('count');
            if ((int) $count >= $limit) {
                $result = 'busy';
                throw new RuntimeException('busy');
            }
        }
        foreach (array_unique(array_column($buckets, 0)) as $key) {
            if ($wpdb->insert($log, array('bucket' => $key, 'created' => $now), array('%s', '%d')) !== 1) throw new RuntimeException('insert');
        }
        if ($wpdb->query('COMMIT') === false) throw new RuntimeException('commit');
        $result = 'ok';
    } catch (Throwable $e) {
        $wpdb->query('ROLLBACK');
    } finally {
        $wpdb->suppress_errors($suppress);
    }
    if ($result === 'ok') {
        // Nothing reads rows older than the longest window.
        $wpdb->query($wpdb->prepare("DELETE FROM {$log} WHERE created < %d LIMIT 500", $now - DAY_IN_SECONDS - HOUR_IN_SECONDS));
    }
    return $result;
}
