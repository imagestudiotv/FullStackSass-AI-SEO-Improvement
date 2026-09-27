<?php
/**
 * Issue 10 regression harness for the RepGet connector.
 *
 * There is no WordPress here, so the WordPress functions repget_sync uses are
 * modelled - and modelled on what CORE ACTUALLY DOES where that decides the
 * outcome, not on what would be convenient:
 *
 *  - wp_insert_post (wp-includes/post.php) inserts the posts row FIRST, in one
 *    statement that includes the guid if one was given, then fills an empty
 *    guid with the permalink, and only then writes meta_input with separate
 *    update_post_meta calls. A process can die between the row and the meta.
 *    `$GLOBALS['after_row']` is called at exactly that point.
 *  - add_option (wp-includes/option.php) checks get_option() and then runs
 *    INSERT ... ON DUPLICATE KEY UPDATE - so it is NOT an atomic
 *    create-if-absent. `$GLOBALS['between_check_and_insert']` lets a second
 *    request interleave there, as it can in production.
 *  - The options and posts tables sit behind a $wpdb stub that honours the
 *    unique option_name (INSERT IGNORE) and conditional UPDATE/DELETE, and an
 *    object cache in front of options, as get_option has.
 *  - UPDATE returns MySQL's affected-rows count: rows CHANGED, not matched.
 *    Writing the value a row already holds returns 0 (wpdb does not set
 *    CLIENT_FOUND_ROWS). Queries can be made to fail ($GLOBALS['db_fail']),
 *    returning false / null with $wpdb->last_error set, as wpdb does.
 *
 * What is being proved: whatever interleaving or interruption happens, an
 * article converges on ONE post, and a lock is only ever released or renewed
 * by its owner.
 */

define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);

class ProcessDeath extends Exception {}

// ------------------------------------------------------------ the database ---
$GLOBALS['options_table'] = array();   // option_name => option_value (unique name)
$GLOBALS['opts_cache']    = array();   // the object cache in front of it
$GLOBALS['posts']   = array();          // ID => row (with 'guid')
$GLOBALS['meta']    = array();
$GLOBALS['next_id'] = 100;
$GLOBALS['insert_calls'] = 0;
$GLOBALS['update_calls'] = 0;
$GLOBALS['after_row'] = null;
$GLOBALS['before_row'] = null;
$GLOBALS['between_check_and_insert'] = null;
$GLOBALS['db_fail'] = null;

function get_option($k, $d = false) {
    if (array_key_exists($k, $GLOBALS['opts_cache'])) return $GLOBALS['opts_cache'][$k];
    if (array_key_exists($k, $GLOBALS['options_table'])) {
        $GLOBALS['opts_cache'][$k] = $GLOBALS['options_table'][$k];
        return $GLOBALS['options_table'][$k];
    }
    return $d;
}
function update_option($k, $v, $a = null) {
    $GLOBALS['options_table'][$k] = $v;
    $GLOBALS['opts_cache'][$k] = $v;
    return true;
}
/** WordPress's real shape: a check, then an upsert. Not atomic. */
function add_option($k, $v, $dep = '', $a = null) {
    if (get_option($k, false) !== false) return false;
    if (is_callable($GLOBALS['between_check_and_insert'])) {
        $hook = $GLOBALS['between_check_and_insert'];
        $GLOBALS['between_check_and_insert'] = null;
        $hook();
    }
    // INSERT ... ON DUPLICATE KEY UPDATE: overwrites a row written meanwhile.
    $GLOBALS['options_table'][$k] = $v;
    $GLOBALS['opts_cache'][$k] = $v;
    return true;
}
function delete_option($k) {
    unset($GLOBALS['options_table'][$k], $GLOBALS['opts_cache'][$k]);
    return true;
}
function wp_cache_delete($k, $g = '') { unset($GLOBALS['opts_cache'][$k]); }

class WP_Error {
    private $code; private $msg;
    public function __construct($code = '', $msg = '') { $this->code = $code; $this->msg = $msg; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->msg; }
}
function is_wp_error($t) { return $t instanceof WP_Error; }

function get_permalink($id) { return "https://site.test/?p={$id}"; }

/** Modelled on core: row (with guid) first, meta afterwards, separately. */
function wp_insert_post($data, $wp_error = false) {
    $GLOBALS['insert_calls']++;
    if (is_callable($GLOBALS['before_row'])) {
        $hook = $GLOBALS['before_row'];
        $GLOBALS['before_row'] = null;
        $hook();
    }
    $id = $GLOBALS['next_id']++;
    $row = $data;
    unset($row['meta_input']);
    $row['guid'] = isset($data['guid']) ? esc_url_raw($data['guid']) : '';
    $GLOBALS['posts'][$id] = $row;                                  // $wpdb->insert()
    if (is_callable($GLOBALS['after_row'])) {
        $hook = $GLOBALS['after_row'];
        $GLOBALS['after_row'] = null;
        $hook($id);                                                 // a process may die here
    }
    if ($GLOBALS['posts'][$id]['guid'] === '') {
        $GLOBALS['posts'][$id]['guid'] = get_permalink($id);         // only an EMPTY guid
    }
    if (!empty($data['meta_input'])) {
        foreach ($data['meta_input'] as $k => $v) update_post_meta($id, $k, $v);
    }
    return $id;
}
function wp_update_post($data, $wp_error = false) {
    $GLOBALS['update_calls']++;
    $id = (int) $data['ID'];
    $GLOBALS['posts'][$id] = array_merge($GLOBALS['posts'][$id], $data);
    return $id;
}
function wp_delete_post($id, $force = false) {
    unset($GLOBALS['posts'][$id], $GLOBALS['meta'][$id]);
    return true;
}
function update_post_meta($id, $k, $v) { $GLOBALS['meta'][$id][$k] = $v; return true; }
function get_post_meta($id, $k, $single = false) {
    return isset($GLOBALS['meta'][$id][$k]) ? $GLOBALS['meta'][$id][$k] : '';
}
/** What the post row holds, as core returns it; false for a post that does not exist. */
function get_post_status($id) {
    if (!isset($GLOBALS['posts'][$id])) return false;
    return isset($GLOBALS['posts'][$id]['post_status']) ? $GLOBALS['posts'][$id]['post_status'] : 'publish';
}
function get_posts($args) {
    $out = array();
    foreach ($GLOBALS['meta'] as $id => $m) {
        if (isset($GLOBALS['posts'][$id]) && isset($m[$args['meta_key']]) && $m[$args['meta_key']] === $args['meta_value']) {
            $out[] = $id;
        }
    }
    sort($out);
    return $out;
}

class wpdb_stub {
    public $options = 'wp_options';
    public $posts = 'wp_posts';
    public $last_error = '';
    /** wpdb clears last_error at the start of every query. */
    private function begin($q) {
        $this->last_error = '';
        if (is_callable($GLOBALS['db_fail']) && ($GLOBALS['db_fail'])($q)) {
            $this->last_error = 'MySQL server has gone away';
            return false;
        }
        return true;
    }
    public function esc_like($t) { return addcslashes($t, '_%\\'); }
    public function prepare($q, ...$args) {
        $i = 0;
        return preg_replace_callback('/%[sd]/', function ($m) use (&$i, $args) {
            $v = $args[$i++];
            return $m[0] === '%d' ? (string) (int) $v : "'" . str_replace("'", "''", (string) $v) . "'";
        }, $q);
    }
    private static function unquote($s) { return str_replace("''", "'", $s); }
    public function query($q) {
        if (!$this->begin($q)) return false;
        if (preg_match("/^INSERT IGNORE INTO wp_options \\(option_name, option_value, autoload\\) VALUES \\('((?:[^']|'')*)', '((?:[^']|'')*)', 'no'\\)$/", $q, $m)) {
            $name = self::unquote($m[1]);
            if (array_key_exists($name, $GLOBALS['options_table'])) return 0;
            $GLOBALS['options_table'][$name] = self::unquote($m[2]);
            return 1;
        }
        if (preg_match("/^UPDATE wp_options SET option_value = '((?:[^']|'')*)' WHERE option_name = '((?:[^']|'')*)' AND option_value = '((?:[^']|'')*)'$/", $q, $m)) {
            $name = self::unquote($m[2]);
            if (array_key_exists($name, $GLOBALS['options_table'])
                && (string) $GLOBALS['options_table'][$name] === self::unquote($m[3])) {
                $new = self::unquote($m[1]);
                // Matched but unchanged: MySQL reports 0 affected rows.
                if ((string) $GLOBALS['options_table'][$name] === $new) return 0;
                $GLOBALS['options_table'][$name] = $new;
                return 1;
            }
            return 0;
        }
        if (preg_match("/^DELETE FROM wp_options WHERE option_name = '((?:[^']|'')*)' AND option_value LIKE '((?:[^']|'')*)'$/", $q, $m)) {
            $name = self::unquote($m[1]);
            $prefix = stripcslashes(rtrim(self::unquote($m[2]), '%'));
            if (array_key_exists($name, $GLOBALS['options_table'])
                && strpos((string) $GLOBALS['options_table'][$name], $prefix) === 0) {
                unset($GLOBALS['options_table'][$name]);
                return 1;
            }
            return 0;
        }
        throw new Exception("unmodelled query: {$q}");
    }
    public function get_var($q) {
        if (!$this->begin($q)) return null;
        if (preg_match("/^SELECT option_value FROM wp_options WHERE option_name = '((?:[^']|'')*)' LIMIT 1$/", $q, $m)) {
            $name = self::unquote($m[1]);
            return array_key_exists($name, $GLOBALS['options_table']) ? $GLOBALS['options_table'][$name] : null;
        }
        throw new Exception("unmodelled get_var: {$q}");
    }
    public function get_col($q) {
        if (preg_match("/^SELECT ID FROM wp_posts WHERE guid = '((?:[^']|'')*)' AND post_type NOT IN/", $q, $m)) {
            $guid = self::unquote($m[1]);
            $ids = array();
            foreach ($GLOBALS['posts'] as $id => $row) {
                if ($row['guid'] === $guid) $ids[] = $id;
            }
            sort($ids);
            return $ids;
        }
        throw new Exception("unmodelled get_col: {$q}");
    }
}
$GLOBALS['wpdb'] = new wpdb_stub();
$wpdb = $GLOBALS['wpdb'];

// ------------------------------------------------------------- sanitisers ---
function sanitize_text_field($v) { return is_string($v) ? trim(strip_tags($v)) : ''; }
function wp_kses_post($v) { return $v; }
function sanitize_title($v) { return strtolower(preg_replace('/[^a-z0-9]+/i', '-', (string) $v)); }
function esc_html($v) { return htmlspecialchars((string) $v); }
function __($t, $d = null) { return $t; }
function _n($s, $p, $n, $d = null) { return $n === 1 ? $s : $p; }
function wp_json_encode($v) { return json_encode($v); }
function wp_generate_password($len = 12, $special = true, $extra = false) { return bin2hex(random_bytes(intdiv($len, 2))); }
/** Core runs guids through esc_url_raw: only allowed protocols survive. */
function esc_url_raw($v) { return preg_match('#^https?://#', (string) $v) ? (string) $v : ''; }

// --------------------------------------------------------- RepGet fixtures ---
$GLOBALS['queue'] = array();
$GLOBALS['ack_works'] = true;
$GLOBALS['ack_calls'] = 0;
$GLOBALS['ack_bodies'] = array();
$GLOBALS['http'] = array();

function repget_key() { return 'test-key'; }
function repget_post_type() { return 'post'; }
function repget_attach_image($post_id, $url, $alt) { $GLOBALS['images'][] = $post_id; }

function repget_request($path, $args = array()) {
    if ($path === '/api/plugin/articles') {
        return array('articles' => array_values($GLOBALS['queue']));
    }
    if ($path === '/api/plugin/published') {
        $GLOBALS['ack_calls']++;
        if (!$GLOBALS['ack_works']) {
            return new WP_Error('http', 'could not reach RepGet');
        }
        $body = json_decode($args['body'], true);
        $GLOBALS['ack_bodies'][] = $body;
        unset($GLOBALS['queue'][$body['articleId']]);
        return array('ok' => true);
    }
    return array();
}

function add_action() {}
function add_filter() {}
function register_activation_hook() {}
function register_deactivation_hook() {}
function wp_clear_scheduled_hook($h) {}
function wp_next_scheduled($h) { return false; }
function wp_schedule_event() {}
function is_admin() { return false; }
function plugin_basename($f) { return 'repget-connector/repget-connector.php'; }
function admin_url($p = '') { return "https://site.test/wp-admin/{$p}"; }
function wp_unslash($v) { return $v; }
function current_user_can($c) { return true; }
function wp_send_json_error($d, $s = 200) {}
function wp_send_json_success($d) {}
function check_admin_referer($a) { return true; }
function wp_verify_nonce($n, $a) { return true; }
function wp_nonce_field($a) {}
function settings_errors() {}
function get_current_screen() { return null; }
function wp_safe_redirect($u) {}
function wp_remote_post($u, $a) { return array(); }
function wp_remote_get($u, $a) { return array(); }
function wp_remote_retrieve_body($r) { return ''; }
/** The real repget_request's transport: records what would be sent. */
function wp_remote_request($u, $a) { $GLOBALS['http'][] = array($u, $a); return array(); }
function wp_remote_retrieve_response_code($r) { return 200; }
function trailingslashit($s) { return rtrim($s, '/') . '/'; }
function untrailingslashit($s) { return rtrim($s, '/'); }
function home_url($p = '') { return 'https://site.test' . $p; }
function get_bloginfo($k) { return 'Test'; }
function sanitize_key($k) { return preg_replace('/[^a-z0-9_]/', '', strtolower($k)); }
function esc_attr($v) { return htmlspecialchars((string) $v); }
function esc_url($v) { return $v; }
function selected($a, $b) { return ''; }
function number_format_i18n($n) { return (string) $n; }
function get_post_types($a = array(), $o = 'names') { return array('post' => 'post'); }
function wp_count_posts($t) { return (object) array('publish' => 0); }

// ------------------------------------------------------------------- load ---
$src = file_get_contents($argv[1]);
$src = preg_replace('/^<\?php/', '', $src, 1);
$src = str_replace("if (!defined('ABSPATH')) {\n    exit;\n}", '', $src);
foreach (array('repget_key', 'repget_post_type', 'repget_attach_image', 'repget_request') as $fn) {
    $src = preg_replace('/\nfunction ' . $fn . '\(/', "\nfunction __unused_{$fn}(", $src, 1);
}
eval($src);

// ------------------------------------------------------------------ tests ---
$failures = 0;
function check($label, $cond, $detail = '') {
    global $failures;
    if ($cond) { echo "  ok    {$label}\n"; }
    else { echo "  FAIL  {$label} {$detail}\n"; $failures++; }
}
function reset_all() {
    $GLOBALS['options_table'] = array(); $GLOBALS['opts_cache'] = array();
    $GLOBALS['posts'] = array(); $GLOBALS['meta'] = array();
    $GLOBALS['next_id'] = 100; $GLOBALS['images'] = array();
    $GLOBALS['insert_calls'] = 0; $GLOBALS['update_calls'] = 0;
    $GLOBALS['ack_calls'] = 0; $GLOBALS['ack_works'] = true; $GLOBALS['ack_bodies'] = array(); $GLOBALS['http'] = array();
    $GLOBALS['queue'] = array();
    $GLOBALS['after_row'] = null; $GLOBALS['before_row'] = null;
    $GLOBALS['between_check_and_insert'] = null;
    $GLOBALS['db_fail'] = null;
}
function article($id, $title = 'Hello', $status = 'publish', $dispatch = null) {
    $a = array('id' => $id, 'title' => $title, 'html' => '<p>x</p>', 'status' => $status,
        'image' => array('url' => 'https://img.test/a.png', 'alt' => 'a'));
    if ($dispatch !== null) $a['dispatch'] = array('id' => $dispatch, 'revision' => 'r');
    return $a;
}
function dispatch_uuid($n) { return sprintf('00000000-0000-4000-8000-%012d', $n); }
function post_count() { return count($GLOBALS['posts']); }
/** A lock left behind by a process that died, and old enough to be stolen. */
function abandoned_lock($token = 'dead') {
    $GLOBALS['options_table'][REPGET_LOCK] = $token . '|' . (time() - REPGET_LOCK_TTL - 60);
}

echo "\nrepeated polls with a WORKING acknowledgement\n";
reset_all();
$GLOBALS['queue']['a1'] = article('a1');
repget_sync_locked(); repget_sync_locked(); repget_sync_locked();
check('one post only', post_count() === 1, '(got ' . post_count() . ')');
check('one insert', $GLOBALS['insert_calls'] === 1, '(got ' . $GLOBALS['insert_calls'] . ')');

echo "\nACKNOWLEDGEMENT FAILS - the original duplicate bug\n";
reset_all();
$GLOBALS['queue']['a1'] = article('a1');
$GLOBALS['ack_works'] = false;
repget_sync_locked(); repget_sync_locked(); repget_sync_locked();
check('still one post', post_count() === 1, '(got ' . post_count() . ')');
check('one insert, rest updates', $GLOBALS['insert_calls'] === 1, '(inserts=' . $GLOBALS['insert_calls'] . ')');
check('ack was parked for retry', count(repget_pending_acks()) === 1);
$GLOBALS['ack_works'] = true;
repget_sync_locked();
check('pending ack cleared on a later run', count(repget_pending_acks()) === 0);
check('article left the queue', !isset($GLOBALS['queue']['a1']));
check('still one post', post_count() === 1);

echo "\nPROCESS DIES BETWEEN THE POST ROW AND ITS META (realistic wp_insert_post)\n";
reset_all();
$GLOBALS['queue']['a1'] = article('a1');
$GLOBALS['after_row'] = function ($id) {
    // The lock is left held, as a killed process leaves it (no finally runs).
    $GLOBALS['dying_lock'] = $GLOBALS['options_table'][REPGET_LOCK];
    throw new ProcessDeath();
};
try { repget_sync_locked(); } catch (ProcessDeath $e) {
    $GLOBALS['options_table'][REPGET_LOCK] = $GLOBALS['dying_lock'];
}
$ids = array_keys($GLOBALS['posts']);
check('the row exists', count($ids) === 1);
check('...but its meta was never written (meta_input is not atomic)', get_post_meta($ids[0], REPGET_META_ARTICLE, true) === '');
check('...and its identity guid was, in the same INSERT', $GLOBALS['posts'][$ids[0]]['guid'] === repget_identity_guid('a1'));
check('the dead lock blocks until it expires', is_wp_error(repget_sync_locked()));
abandoned_lock(explode('|', $GLOBALS['dying_lock'])[0]);
$r = repget_sync_locked();
check('recovery ran', !is_wp_error($r), is_wp_error($r) ? '(' . $r->get_error_message() . ')' : '');
check('still ONE post after recovery', post_count() === 1, '(got ' . post_count() . ')');
check('recovered by updating the post, not inserting', $GLOBALS['insert_calls'] === 1);
check('meta repaired', get_post_meta($ids[0], REPGET_META_ARTICLE, true) === 'a1');
check('acknowledged', !isset($GLOBALS['queue']['a1']));

echo "\nDRAFT status is honoured, and kept on republish\n";
reset_all();
$GLOBALS['queue']['d1'] = article('d1', 'Draft one', 'draft');
repget_sync_locked();
$ids = array_keys($GLOBALS['posts']);
check('created as draft', $GLOBALS['posts'][$ids[0]]['post_status'] === 'draft');
$GLOBALS['queue']['d1'] = article('d1', 'Draft one edited', 'publish');
repget_sync_locked();
check('status not overwritten on update', $GLOBALS['posts'][$ids[0]]['post_status'] === 'draft');
check('content did update', $GLOBALS['posts'][$ids[0]]['post_title'] === 'Draft one edited');

echo "\nEDITED ARTICLE republishes into the same post, including an older post found by meta\n";
reset_all();
$GLOBALS['queue']['e1'] = article('e1', 'First');
repget_sync_locked();
$GLOBALS['queue']['e1'] = article('e1', 'Second');
repget_sync_locked();
check('one post', post_count() === 1);
check('updated in place', $GLOBALS['update_calls'] === 1, '(updates=' . $GLOBALS['update_calls'] . ')');
// A post made by 1.5.1 or earlier: meta only, permalink guid.
$GLOBALS['posts'][500] = array('post_title' => 'Old', 'guid' => get_permalink(500), 'post_status' => 'publish');
update_post_meta(500, REPGET_META_ARTICLE, 'old1');
$GLOBALS['queue']['old1'] = article('old1', 'Old, edited');
repget_sync_locked();
check('pre-1.5.2 post updated, not duplicated', $GLOBALS['posts'][500]['post_title'] === 'Old, edited' && post_count() === 2);

echo "\nadd_option IS NOT A LOCK (why 1.5.2 does not use it)\n";
reset_all();
$GLOBALS['between_check_and_insert'] = function () { add_option('probe', 'B'); };
$first = add_option('probe', 'A');
check('two interleaved add_option calls BOTH report success', $first === true);
check('...and the second writer was silently overwritten', get_option('probe') === 'A');

echo "\nTHE LOCK is exclusive, owned, and only its owner releases it\n";
reset_all();
$a = repget_lock_acquire();
$b = repget_lock_acquire();
check('first caller takes it', is_string($a) && $a !== '');
check('second caller is refused', $b === null);
repget_lock_release('not-the-owner');
check('a non-owner cannot release it', repget_lock_read() !== null);
repget_lock_release($a);
check('the owner can', repget_lock_read() === null);

echo "\nCONCURRENT SYNC during an insert is refused\n";
reset_all();
$GLOBALS['queue']['c1'] = article('c1');
$GLOBALS['after_row'] = function ($id) { $GLOBALS['inner'] = repget_sync_locked(); };
repget_sync_locked();
check('the overlapping sync was refused as busy', is_wp_error($GLOBALS['inner']) && $GLOBALS['inner']->get_error_code() === 'repget_busy');
check('one post', post_count() === 1);

echo "\nA STALLED WORKER outlives its lease: it stops, and cannot free the new owner's lock\n";
reset_all();
$GLOBALS['queue']['z1'] = article('z1');
$GLOBALS['queue']['z2'] = article('z2');
$stale = repget_lock_acquire();
// It stalls past the TTL; another entry point steals the lock and does the work.
$GLOBALS['options_table'][REPGET_LOCK] = $stale . '|' . (time() - REPGET_LOCK_TTL - 1);
$fresh = repget_lock_acquire();
check('the lock was taken over', is_string($fresh) && $fresh !== $stale);
$zombie = repget_sync($stale);
check('the stalled worker stopped before writing', is_wp_error($zombie) && $zombie->get_error_code() === 'repget_lock_lost');
check('...and wrote nothing', post_count() === 0);
repget_lock_release($stale);
check('its release did not remove the new owner\'s lock', strpos((string) repget_lock_read(), $fresh . '|') === 0);
repget_sync($fresh);
repget_lock_release($fresh);
check('the new owner did the work', post_count() === 2);

echo "\nA STALLED WORKER inserts just after the new owner did: converges on one post\n";
reset_all();
$GLOBALS['queue']['r1'] = article('r1');
$GLOBALS['before_row'] = function () {
    // The stalled worker renewed, then stalled right before its INSERT. The
    // lease runs out, another worker takes over and creates the post.
    list($token) = repget_lock_parse(repget_lock_read());
    $GLOBALS['options_table'][REPGET_LOCK] = $token . '|' . (time() - REPGET_LOCK_TTL - 1);
    $GLOBALS['other'] = repget_sync_locked();
};
$GLOBALS['ack_works'] = false; // keep r1 in the queue for the other worker
repget_sync_locked();
check('the other worker ran', !is_wp_error($GLOBALS['other']));
check('two inserts happened...', $GLOBALS['insert_calls'] === 2);
check('...but ONE post remains', post_count() === 1, '(got ' . post_count() . ')');
$ids = array_keys($GLOBALS['posts']);
check('the oldest was kept', $ids[0] === 100);
check('its image was attached once', count($GLOBALS['images']) === 1);

echo "\nRENEWING within the same second keeps the lock (MySQL reports 0 changed rows)\n";
reset_all();
$t = repget_lock_acquire();
$renewals = array(repget_lock_renew($t), repget_lock_renew($t), repget_lock_renew($t));
check('three same-second renewals all say owned', $renewals === array('owned', 'owned', 'owned'), '(' . json_encode($renewals) . ')');
// The unchanged-value UPDATE itself, with the lock one second old.
list(, $taken) = repget_lock_parse(repget_lock_read());
$GLOBALS['options_table'][REPGET_LOCK] = $t . '|' . ($taken - 1);
check('a renewal that does change the value is owned', repget_lock_renew($t) === 'owned');
check('...and moved the timestamp on', repget_lock_parse(repget_lock_read())[1] >= $taken);
repget_lock_release($t);

echo "\nSEVERAL POSTS in one fast sync (the review's zero-posts case)\n";
reset_all();
foreach (array('f1', 'f2', 'f3', 'f4', 'f5') as $id) $GLOBALS['queue'][$id] = article($id);
$r = repget_sync_locked();
check('the sync was not stopped as lock-lost', !is_wp_error($r), is_wp_error($r) ? '(' . $r->get_error_code() . ')' : '');
check('five posts created', post_count() === 5, '(got ' . post_count() . ')');
check('all five acknowledged', count($GLOBALS['queue']) === 0);
check('lock released', repget_lock_read() === null);

echo "\nOWNERSHIP TAKEN OVER is lost, not owned\n";
reset_all();
$old = repget_lock_acquire();
$GLOBALS['options_table'][REPGET_LOCK] = $old . '|' . (time() - REPGET_LOCK_TTL - 1);
$new = repget_lock_acquire();
check('the stale holder learns it lost', repget_lock_renew($old) === 'lost');
check('the new holder still owns it', repget_lock_renew($new) === 'owned');
repget_lock_release($old);
check('the stale holder cannot release it', strpos((string) repget_lock_read(), $new . '|') === 0);
repget_lock_release($new);
check('nor renew a lock nobody holds', repget_lock_renew($new) === 'lost');

echo "\nA DATABASE ERROR is neither ownership nor a takeover\n";
reset_all();
$t = repget_lock_acquire();
$GLOBALS['options_table'][REPGET_LOCK] = $t . '|' . (time() - 1);
$GLOBALS['db_fail'] = function ($q) { return strpos($q, 'UPDATE wp_options') === 0; };
check('a failed UPDATE reports error', repget_lock_renew($t) === 'error');
$GLOBALS['db_fail'] = function ($q) { return strpos($q, 'SELECT option_value') === 0; };
check('a failed read reports error', repget_lock_renew($t) === 'error');
$GLOBALS['db_fail'] = null;
check('ownership is intact afterwards', repget_lock_renew($t) === 'owned');
repget_lock_release($t);

reset_all();
$GLOBALS['queue']['e1'] = article('e1');
$GLOBALS['db_fail'] = function ($q) { return strpos($q, 'SELECT option_value') === 0; };
$r = repget_sync_locked();
$GLOBALS['db_fail'] = null;
check('a sync that cannot confirm its lock stops', is_wp_error($r) && $r->get_error_code() === 'repget_lock_error', is_wp_error($r) ? '(' . $r->get_error_code() . ')' : '(not an error)');
check('...without writing a post', post_count() === 0);

echo "\nPROTOCOL v2 (1.6.0): the plugin announces itself and echoes the hand-over it answers\n";
reset_all();
__unused_repget_request('/api/plugin/articles', array('method' => 'GET'));
$sent_headers = $GLOBALS['http'][0][1]['headers'];
check('X-RepGet-Plugin-Version is sent', isset($sent_headers['X-RepGet-Plugin-Version']) && $sent_headers['X-RepGet-Plugin-Version'] === REPGET_VERSION);
check('...and the version is 1.6.0', REPGET_VERSION === '1.6.0');
$GLOBALS['queue']['v1'] = article('v1', 'Hello', 'publish', dispatch_uuid(1));
repget_sync_locked();
check('the report names the dispatch', isset($GLOBALS['ack_bodies'][0]['dispatchId']) && $GLOBALS['ack_bodies'][0]['dispatchId'] === dispatch_uuid(1));
check('...and the status WordPress stored', $GLOBALS['ack_bodies'][0]['status'] === 'publish');

echo "\nTWO HAND-OVERS of one article, reports failing: both are kept, each with its own dispatch\n";
reset_all();
$GLOBALS['ack_works'] = false;
$GLOBALS['queue']['t1'] = article('t1', 'Revision A', 'publish', dispatch_uuid(10));
repget_sync_locked();
$GLOBALS['queue']['t1'] = article('t1', 'Revision B', 'publish', dispatch_uuid(11));
repget_sync_locked();
$parked = repget_pending_acks();
check('two reports parked (1.5.x kept only the last)', count($parked) === 2, '(got ' . count($parked) . ')');
$GLOBALS['ack_works'] = true;
$GLOBALS['queue'] = array();
repget_sync_locked();
$ids = array_map(function ($b) { return isset($b['dispatchId']) ? $b['dispatchId'] : null; }, $GLOBALS['ack_bodies']);
$flushed = array_slice($ids, -2);
sort($flushed);
check('both flushed with their own dispatch ids', $flushed === array(dispatch_uuid(10), dispatch_uuid(11)), json_encode($ids));
check('queue empty afterwards', count(repget_pending_acks()) === 0);
check('one post', post_count() === 1);

echo "\nA REPORT PARKED BY 1.5.x (keyed by article) is still delivered, without a dispatch\n";
reset_all();
$GLOBALS['posts'][300] = array('post_title' => 'Old', 'guid' => get_permalink(300), 'post_status' => 'publish');
update_option(REPGET_OPTION_PENDING_ACK, array('legacy1' => array('post_id' => 300, 'url' => get_permalink(300), 'status' => 'publish')));
repget_sync_locked();
check('reported', count($GLOBALS['ack_bodies']) === 1 && $GLOBALS['ack_bodies'][0]['articleId'] === 'legacy1');
check('...with no dispatch id', !isset($GLOBALS['ack_bodies'][0]['dispatchId']));
check('...and cleared', count(repget_pending_acks()) === 0);

echo "\nACTUAL STATUS: an update of a post the customer keeps as a draft reports 'draft'\n";
reset_all();
$GLOBALS['queue']['s1'] = article('s1', 'One', 'draft', dispatch_uuid(20));
repget_sync_locked();
$GLOBALS['queue']['s1'] = article('s1', 'One, edited', 'publish', dispatch_uuid(21));
repget_sync_locked();
$last = end($GLOBALS['ack_bodies']);
check('requested publish, WordPress kept draft: reported draft', $last['status'] === 'draft' && $last['dispatchId'] === dispatch_uuid(21), json_encode($last));

echo "\nA MALFORMED dispatch id is not echoed\n";
reset_all();
$GLOBALS['queue']['m1'] = article('m1', 'Hello', 'publish', "x'; DROP");
repget_sync_locked();
check('reported without a dispatch id', !isset($GLOBALS['ack_bodies'][0]['dispatchId']));

echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
