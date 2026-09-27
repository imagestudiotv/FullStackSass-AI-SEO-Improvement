<?php
/**
 * Issue 10 checks against a REAL WordPress and a REAL MySQL.
 *
 *   php wordpress-plugin/tests/real-wordpress.php <wordpress dir> <plugin file>
 *
 * The WordPress dir needs a wp-config.php pointing at a DISPOSABLE database,
 * installed with install-wordpress.php; this script writes posts and options. Never
 * point it at a real site. RepGet's API is never contacted: every outbound
 * request the plugin makes is answered by a pre_http_request filter here.
 *
 * What only real WordPress + MySQL can show, and this checks:
 *  - wp_insert_post really writes the row before meta_input, and a supplied
 *    guid survives (esc_url_raw, wp_filter_kses) inside that same INSERT;
 *  - MySQL really reports 0 affected rows for an UPDATE that changes nothing;
 *  - INSERT IGNORE on wp_options is really exclusive.
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php real-wordpress.php <wordpress dir> <plugin file>\n");
    exit(2);
}
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
require rtrim($argv[1], '/\\') . '/wp-load.php';
// Install first with install-wordpress.php: an uninstalled site redirects.
require $argv[2];

global $wpdb;
$failures = 0;
function check($label, $cond, $detail = '') {
    global $failures;
    echo ($cond ? "  ok    " : "  FAIL  ") . $label . ($cond ? '' : " {$detail}") . "\n";
    if (!$cond) $failures++;
}

// ---------------------------------------------------------- fake RepGet API --
$GLOBALS['queue'] = array();
$GLOBALS['acks'] = 0;
update_option(REPGET_OPTION_KEY, 'test-key-not-real');
add_filter('pre_http_request', function ($pre, $args, $url) {
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === '/api/plugin/articles') {
        $body = array('articles' => array_values($GLOBALS['queue']));
    } elseif ($path === '/api/plugin/published') {
        $GLOBALS['acks']++;
        $sent = json_decode($args['body'], true);
        unset($GLOBALS['queue'][$sent['articleId']]);
        $body = array('ok' => true);
    } else {
        $body = array();
    }
    return array(
        'headers' => array(), 'body' => wp_json_encode($body),
        'response' => array('code' => 200, 'message' => 'OK'), 'cookies' => array(), 'filename' => null,
    );
}, 10, 3);

function article($id, $title = 'Hello') {
    return array('id' => $id, 'title' => $title, 'html' => '<p>x</p>', 'status' => 'publish');
}
function repget_post_ids() {
    global $wpdb;
    return array_map('intval', $wpdb->get_col(
        "SELECT ID FROM {$wpdb->posts} WHERE guid LIKE 'https://repget.invalid/articles/%' ORDER BY ID"
    ));
}
function reset_state() {
    global $wpdb;
    foreach (repget_post_ids() as $id) wp_delete_post($id, true);
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s", REPGET_LOCK));
    delete_option(REPGET_OPTION_PENDING_ACK);
    $GLOBALS['queue'] = array();
}

echo "\nWordPress " . get_bloginfo('version') . ", MySQL " . $wpdb->db_version() . "\n";

echo "\nMYSQL: an UPDATE that changes nothing reports 0 rows\n";
reset_state();
$t = repget_lock_acquire();
$held = repget_lock_read();
$same = $wpdb->query($wpdb->prepare(
    "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s",
    $held, REPGET_LOCK, $held
));
check('unchanged UPDATE affected 0 rows', $same === 0, '(got ' . var_export($same, true) . ')');
check('same-second renewals stay owned', array(repget_lock_renew($t), repget_lock_renew($t)) === array('owned', 'owned'));
check('INSERT IGNORE is exclusive: a second acquire is refused', repget_lock_acquire() === null);
repget_lock_release($t);

echo "\nSEVERAL POSTS in one fast sync\n";
reset_state();
foreach (array('f1', 'f2', 'f3', 'f4', 'f5') as $id) $GLOBALS['queue'][$id] = article($id);
$r = repget_sync_locked();
check('sync completed', !is_wp_error($r), is_wp_error($r) ? '(' . $r->get_error_code() . ')' : '');
check('five posts', count(repget_post_ids()) === 5, '(got ' . count(repget_post_ids()) . ')');
$first = repget_post_ids()[0];
check('the identity guid survived WordPress sanitising', get_post_field('guid', $first) === repget_identity_guid('f1'));
check('all acknowledged, lock released', empty($GLOBALS['queue']) && repget_lock_read() === null);

echo "\nPROCESS DIES between the post row and its meta (a core hook in between)\n";
reset_state();
$GLOBALS['queue']['c1'] = article('c1');
$die = function () { throw new RuntimeException('process killed'); };
add_action('set_object_terms', $die);
try { repget_sync_locked(); check('the crash happened', false); } catch (RuntimeException $e) { check('the crash happened', true); }
remove_action('set_object_terms', $die);
$ids = repget_post_ids();
check('the row exists', count($ids) === 1);
check('its identity meta was never written', $ids && get_post_meta($ids[0], REPGET_META_ARTICLE, true) === '');
$r = repget_sync_locked();
check('the next sync ran', !is_wp_error($r), is_wp_error($r) ? '(' . $r->get_error_code() . ')' : '');
check('still ONE post', count(repget_post_ids()) === 1, '(got ' . count(repget_post_ids()) . ')');
check('meta repaired from the guid', get_post_meta($ids[0], REPGET_META_ARTICLE, true) === 'c1');

echo "\nA STALE WORKER after a takeover\n";
reset_state();
$old = repget_lock_acquire();
$wpdb->query($wpdb->prepare(
    "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s",
    $old . '|' . (time() - REPGET_LOCK_TTL - 5), REPGET_LOCK
));
$new = repget_lock_acquire();
check('the lock was taken over', is_string($new) && $new !== $old);
check('the stale worker learns it lost', repget_lock_renew($old) === 'lost');
repget_lock_release($old);
check('its release left the new owner\'s lock', strpos((string) repget_lock_read(), $new . '|') === 0);
repget_lock_release($new);

echo "\nA DUPLICATE made by a stalled worker converges on the oldest post\n";
reset_state();
$a = wp_insert_post(array('post_title' => 'A', 'post_status' => 'publish', 'guid' => repget_identity_guid('d1')));
$b = wp_insert_post(array('post_title' => 'B', 'post_status' => 'publish', 'guid' => repget_identity_guid('d1')));
check('the newer duplicate is removed', repget_keep_oldest('d1', $b) === $a && get_post($b) === null);
check('the oldest is kept and findable', repget_find_post('d1') === $a);

reset_state();
echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
