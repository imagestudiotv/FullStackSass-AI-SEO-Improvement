<?php
/**
 * Image Studio Blog "Get Featured" request limits against a REAL WordPress
 * and a REAL MySQL (includes/limits.php, plugin 2.2.0).
 *
 *   php wordpress-plugin/tests/imagestudio-featured.php <wordpress dir> <plugin file>
 *
 * The WordPress dir must be a DISPOSABLE install (install-wordpress.php):
 * this script writes posts, options and tables. Never point it at a real
 * site. Nothing leaves the machine: PayPal is never contacted (its answer
 * to a payment notice is faked with pre_http_request) and no email is sent.
 *
 * Reproduced first (plugin 2.1.0): the limits were COUNTED and the request
 * INSERTED afterwards, and CF-Connecting-IP / X-Forwarded-For were believed
 * from anyone - so a script could send a new address with every request,
 * and requests sent together all passed the same count.
 *
 * Checks, with separate PHP processes released together at a barrier
 * (concurrency/featured-worker.php runs the plugin's real handler):
 *  - one visitor spoofing a new address in every header: exactly the
 *    per-visitor limit gets through;
 *  - one email from many visitors: exactly the per-email limit;
 *  - many visitors and emails: exactly the overall limit;
 *  - behind a configured trusted proxy: what the client writes in
 *    X-Forwarded-For does not make new visitors, the proxy's own entry does;
 * and in this process: the windows, failing closed when the tables are
 * missing or not InnoDB, and PayPal's payment notice still paying for a
 * request made this way (and only with its secret, and only once).
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php imagestudio-featured.php <wordpress dir> <plugin file>\n");
    exit(2);
}
[$script, $wpdir, $pluginFile] = $argv;
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
require rtrim($wpdir, '/\\') . '/wp-load.php';
require $pluginFile;
isb_register_placement_type();

global $wpdb;
$STATE = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'isb-featured-' . getmypid();
$WORKER = __DIR__ . DIRECTORY_SEPARATOR . 'concurrency' . DIRECTORY_SEPARATOR . 'featured-worker.php';
$WORKERS = 12;
$failures = 0;

function check($label, $cond, $detail = '') {
    global $failures;
    echo ($cond ? '  ok    ' : '  FAIL  ') . $label . ($cond ? '' : " {$detail}") . "\n";
    if (!$cond) $failures++;
}
function state($name) {
    global $STATE;
    return $STATE . DIRECTORY_SEPARATOR . $name;
}
/** Every request, whatever its status ("any" leaves out the plugin's own statuses). */
function placement_ids() {
    global $wpdb;
    return array_map('intval', $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE post_type = 'isb_placement' ORDER BY ID"));
}
function placements() {
    return count(placement_ids());
}
function ledger($bucket = null) {
    global $wpdb;
    $table = isb_request_log_table();
    return (int) ($bucket === null
        ? $wpdb->get_var("SELECT COUNT(*) FROM {$table}")
        : $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE bucket = %s", $bucket)));
}
function settings(array $extra = array()) {
    update_option('isb_settings', array_merge(array(
        'paypal_email' => 'seller@example.test',
        'show_feature' => true,
        'sandbox' => true,
        'post_type' => 'post',
        'trusted_proxies' => '',
        'client_ip_header' => '',
    ), $extra));
}
function reset_world() {
    global $wpdb, $STATE;
    foreach (placement_ids() as $id) wp_delete_post($id, true);
    $wpdb->query('DELETE FROM ' . isb_request_log_table());
    settings();
    wp_cache_flush();
    if (is_dir($STATE)) {
        foreach (glob($STATE . DIRECTORY_SEPARATOR . '*') as $file) unlink($file);
    } else {
        mkdir($STATE, 0777, true);
    }
}

/** Runs one request per entry of $requests, all released together; returns the outcomes ('paypal', 'busy', ...). */
function race(array $requests, array $limits = array()) {
    global $WORKER, $wpdir, $pluginFile, $ARTICLE, $STATE;
    file_put_contents(state('scenario.json'), json_encode(array('article' => $ARTICLE, 'limits' => $limits, 'workers' => $requests)));
    $procs = array();
    foreach (array_keys($requests) as $id) {
        $procs[$id] = proc_open(array(PHP_BINARY, $WORKER, $wpdir, $pluginFile, $STATE, (string) $id), array(
            0 => array('pipe', 'r'),
            1 => array('file', state("out-{$id}.txt"), 'w'),
            2 => array('file', state("err-{$id}.txt"), 'w'),
        ), $pipes);
        fclose($pipes[0]);
    }
    $deadline = microtime(true) + 60;
    foreach (array_keys($requests) as $id) {
        while (!file_exists(state("ready-{$id}")) && microtime(true) < $deadline) usleep(2000);
    }
    touch(state('go'));
    foreach ($procs as $proc) {
        while (proc_get_status($proc)['running'] && microtime(true) < $deadline + 60) usleep(5000);
        proc_close($proc);
    }
    $outcomes = array();
    foreach (array_keys($requests) as $id) {
        $file = state("result-{$id}.json");
        $outcomes[$id] = file_exists($file) ? json_decode(file_get_contents($file), true)['outcome'] : 'crashed: ' . trim((string) @file_get_contents(state("err-{$id}.txt")) . (string) @file_get_contents(state("out-{$id}.txt")));
    }
    unlink(state('go'));
    return $outcomes;
}
function tally(array $outcomes) {
    $counts = array_count_values($outcomes);
    ksort($counts);
    return $counts;
}

// ------------------------------------------------------------------ setup --
settings();
isb_install_tables();
check('the tables are created, as InnoDB', get_option('isb_db_version') === ISB_DB_VERSION && isb_quota_ready());
wp_salt('nonce'); // generated once here, not by racing workers
$ARTICLE = wp_insert_post(array('post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'A test article', 'post_content' => '<p>x</p>'));
check('a published article to ask about', $ARTICLE > 0);

echo "One visitor, a new spoofed address in every header, {$WORKERS} requests at once\n";
reset_world();
$requests = array();
for ($i = 0; $i < $WORKERS; $i++) {
    $requests[] = array('email' => "buyer{$i}@example.test", 'server' => array(
        'REMOTE_ADDR' => '203.0.113.9',
        'HTTP_CF_CONNECTING_IP' => '198.51.100.' . $i,
        'HTTP_X_FORWARDED_FOR' => '192.0.2.' . $i,
        'HTTP_X_REAL_IP' => '198.18.0.' . $i,
    ));
}
$outcomes = race($requests);
$visitor = isb_visitor_hash(array('REMOTE_ADDR' => '203.0.113.9'));
check('exactly 5 go on to PayPal, the rest are told to wait', tally($outcomes) === array('busy' => $WORKERS - 5, 'paypal' => 5), json_encode(tally($outcomes)));
check('5 requests recorded, 5 counted against the visitor', placements() === 5 && ledger('v:' . $visitor) === 5, placements() . '/' . ledger('v:' . $visitor));

echo "One email from {$WORKERS} visitors at once\n";
reset_world();
$requests = array();
for ($i = 0; $i < $WORKERS; $i++) {
    $requests[] = array('email' => ($i % 2 ? 'Same@Example.test' : 'same@example.test'), 'server' => array('REMOTE_ADDR' => '203.0.113.' . (20 + $i)));
}
$outcomes = race($requests);
check('exactly 5 go on to PayPal', tally($outcomes) === array('busy' => $WORKERS - 5, 'paypal' => 5), json_encode(tally($outcomes)));
check('5 requests recorded', placements() === 5, (string) placements());

echo "{$WORKERS} visitors and emails at once, overall limit 7\n";
reset_world();
$requests = array();
for ($i = 0; $i < $WORKERS; $i++) {
    $requests[] = array('email' => "other{$i}@example.test", 'server' => array('REMOTE_ADDR' => '198.51.100.' . (50 + $i)));
}
$outcomes = race($requests, array('all_day' => 7));
check('exactly 7 go on to PayPal', tally($outcomes) === array('busy' => $WORKERS - 7, 'paypal' => 7), json_encode(tally($outcomes)));
check('7 requests recorded, 7 counted overall', placements() === 7 && ledger('all') === 7, placements() . '/' . ledger('all'));

echo "Behind a trusted proxy (10.0.0.0/8, X-Forwarded-For)\n";
reset_world();
settings(array('trusted_proxies' => '10.0.0.0/8', 'client_ip_header' => 'x-forwarded-for'));
$requests = array();
for ($i = 0; $i < $WORKERS; $i++) {
    // The client wrote the first entries; the proxy appended the address it saw.
    $requests[] = array('email' => "proxied{$i}@example.test", 'server' => array('REMOTE_ADDR' => '10.0.0.' . (2 + $i % 3), 'HTTP_X_FORWARDED_FOR' => "198.51.100.{$i}, 192.0.2.{$i}, 203.0.113.50"));
}
$outcomes = race($requests);
check('one real visitor rotating what it writes: exactly 5', tally($outcomes) === array('busy' => $WORKERS - 5, 'paypal' => 5), json_encode(tally($outcomes)));
reset_world();
settings(array('trusted_proxies' => '10.0.0.0/8', 'client_ip_header' => 'x-forwarded-for'));
$requests = array();
for ($i = 0; $i < $WORKERS; $i++) {
    $requests[] = array('email' => "distinct{$i}@example.test", 'server' => array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => "203.0.113.{$i}"));
}
$outcomes = race($requests);
check("{$WORKERS} real visitors through the same proxy: all {$WORKERS}", tally($outcomes) === array('paypal' => $WORKERS), json_encode(tally($outcomes)));
reset_world();
$requests = array();
for ($i = 0; $i < $WORKERS; $i++) {
    $requests[] = array('email' => "untrusted{$i}@example.test", 'server' => array('REMOTE_ADDR' => '203.0.113.77', 'HTTP_X_FORWARDED_FOR' => "198.51.100.{$i}"));
}
$outcomes = race($requests);
check('with no proxy configured, the same forwarded headers are ignored: exactly 5', tally($outcomes) === array('busy' => $WORKERS - 5, 'paypal' => 5), json_encode(tally($outcomes)));

echo "Windows\n";
reset_world();
$buckets = isb_request_buckets('window-visitor', 'window@example.test');
$t0 = 1800000000;
$results = array();
for ($i = 0; $i < 6; $i++) $results[] = isb_reserve_request($buckets, $t0 + $i);
check('5 in an hour, then busy', $results === array('ok', 'ok', 'ok', 'ok', 'ok', 'busy'), json_encode($results));
check('a refused request is not recorded', ledger('v:window-visitor') === 5);
check('an hour later the hourly limits have room again', isb_reserve_request($buckets, $t0 + HOUR_IN_SECONDS + 5) === 'ok');
for ($h = 2; $h <= 4; $h++) {
    for ($i = 0; $i < 5; $i++) isb_reserve_request(isb_request_buckets('window-visitor', "w{$h}{$i}@example.test"), $t0 + $h * HOUR_IN_SECONDS + 10 + $i);
}
check('20 in a day per visitor, whatever the emails', ledger('v:window-visitor') === 20 && isb_reserve_request(isb_request_buckets('window-visitor', 'fresh@example.test'), $t0 + 5 * HOUR_IN_SECONDS) === 'busy');
check('a day later the visitor has room again, and old rows are cleared out', isb_reserve_request(isb_request_buckets('window-visitor', 'fresh@example.test'), $t0 + 2 * DAY_IN_SECONDS) === 'ok' && ledger('v:window-visitor') === 1);

echo "Failing closed\n";
reset_world();
$lock = isb_request_lock_table();
$wpdb->query("RENAME TABLE {$lock} TO {$lock}_away");
$suppress = $wpdb->suppress_errors(true);
check('lock table gone: refused, nothing recorded', isb_reserve_request(isb_request_buckets('closed', 'closed@example.test')) === 'unavailable' && ledger() === 0);
$wpdb->suppress_errors($suppress);
$wpdb->query("RENAME TABLE {$lock}_away TO {$lock}");
$wpdb->query($wpdb->prepare("DELETE FROM {$lock} WHERE name = %s", 'featured'));
check('lock row gone: put back, and the request decided', isb_reserve_request(isb_request_buckets('closed', 'closed@example.test')) === 'ok' && ledger('v:closed') === 1);
$log = isb_request_log_table();
$wpdb->query("DROP TABLE {$log}, {$lock}");
$wpdb->query("CREATE TABLE {$log} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, bucket varchar(40) NOT NULL, created int(10) unsigned NOT NULL, PRIMARY KEY (id)) ENGINE=MyISAM");
delete_option('isb_db_version');
check('a log table that is not InnoDB: not ready, refused', !isb_quota_ready() && get_option('isb_db_version') === 'not-ready' && isb_reserve_request(isb_request_buckets('myisam', 'm@example.test')) === 'unavailable');
$wpdb->query("DROP TABLE {$log}");
delete_option('isb_db_version');
check('tables dropped (a ZIP update runs no activation hook): created again on first use', isb_reserve_request(isb_request_buckets('again', 'a@example.test')) === 'ok' && get_option('isb_db_version') === ISB_DB_VERSION);

echo "PayPal's payment notice still pays for a request made this way\n";
reset_world();
$outcomes = race(array(array('email' => 'payer@example.test', 'server' => array('REMOTE_ADDR' => '203.0.113.200'))));
$ids = placement_ids();
check('the request went on to PayPal and was recorded, not paid', $outcomes === array('paypal') && count($ids) === 1 && get_post_status($ids[0]) === 'isb_awaiting');
check('the request remembers its price: 99.00 EUR', get_post_meta($ids[0] ?? 0, '_isb_amount', true) === '99.00' && get_post_meta($ids[0] ?? 0, '_isb_currency', true) === 'EUR');
$id = $ids[0] ?? 0;
$secret = (string) get_post_meta($id, '_isb_secret', true);
$asked = 0;
add_filter('pre_http_request', function ($pre, $args, $url) use (&$asked) {
    if (strpos($url, 'https://ipnpb.sandbox.paypal.com/') !== 0) return new WP_Error('blocked', 'no network in tests');
    $asked++;
    return array('response' => array('code' => 200, 'message' => 'OK'), 'body' => 'VERIFIED', 'headers' => array(), 'cookies' => array());
}, 10, 3);
add_filter('pre_wp_mail', '__return_true');
$notice = function ($secret_sent, $txn, $currency = 'EUR') use ($id) {
    $request = new WP_REST_Request('POST', '/imagestudio-blog/v1/paypal-ipn');
    $request->set_body(http_build_query(array(
        'custom' => $id . ':' . $secret_sent, 'payment_status' => 'Completed', 'txn_type' => 'web_accept', 'test_ipn' => '1',
        'receiver_email' => 'seller@example.test', 'business' => 'seller@example.test', 'mc_gross' => '99.00', 'mc_currency' => $currency, 'txn_id' => $txn,
    )));
    $request->set_header('content-type', 'application/x-www-form-urlencoded');
    return rest_do_request($request)->get_status();
};
check('a notice with the wrong secret: PayPal not even asked, not paid', $notice(str_repeat('z', 32), 'TXN-WRONG') === 200 && $asked === 0 && get_post_status($id) === 'isb_awaiting');
check('a USD payment for a EUR request: not paid, and the reason noted', $notice($secret, 'TXN-USD', 'USD') === 200 && get_post_status($id) === 'isb_awaiting' && get_post_meta($id, '_isb_payment_note', true) === 'PayPal notice not accepted: wrong currency');
// PayPal was asked once already: about the USD payment, refused after its VERIFIED answer.
check('the genuine notice: PayPal asked, paid', $notice($secret, 'TXN-1') === 200 && $asked === 2 && get_post_status($id) === 'isb_paid' && get_post_meta($id, '_isb_txn', true) === 'TXN-1');
check('the same notice again: nothing changes', $notice($secret, 'TXN-2') === 200 && get_post_status($id) === 'isb_paid' && get_post_meta($id, '_isb_txn', true) === 'TXN-1');

echo "A request made before 2.3.0 (no price stored) is still paid in US dollars
";
wp_update_post(array('ID' => $id, 'post_status' => 'isb_awaiting'));
delete_post_meta($id, '_isb_amount');
delete_post_meta($id, '_isb_currency');
delete_post_meta($id, '_isb_txn');
check('its 99.00 USD notice pays for it', $notice($secret, 'TXN-OLD', 'USD') === 200 && get_post_status($id) === 'isb_paid' && get_post_meta($id, '_isb_txn', true) === 'TXN-OLD');

reset_world();
delete_option('isb_settings');
wp_delete_post($ARTICLE, true);
@rmdir($STATE);
echo $failures ? "\n{$failures} FAILED\n" : "\nALL PASSED\n";
exit($failures ? 1 : 0);
