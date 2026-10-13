<?php
/**
 * One "Continue to PayPal" request for imagestudio-featured.php, in its own
 * PHP process (never run by hand against a real site).
 *
 *   php featured-worker.php <wordpress dir> <plugin file> <state dir> <worker id>
 *
 * Reads its request from <state dir>/scenario.json - the server variables
 * (REMOTE_ADDR and whatever forwarding headers the scenario spoofs) and the
 * email - waits at the barrier (ready-<id>, then `go`) so that workers
 * started together overlap, then runs the plugin's real request handler.
 * The handler redirects and exits; where it redirected to is written to
 * result-<id>.json. Nothing leaves the machine: the PayPal address is only
 * built, never fetched, and no email is sent.
 */

[$script, $wpdir, $pluginFile, $stateDir, $workerId] = $argv;

define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/wp-admin/admin-post.php';
require rtrim($wpdir, '/\\') . '/wp-load.php';
require $pluginFile;
isb_register_placement_type();

function state_path($name) {
    return $GLOBALS['stateDir'] . DIRECTORY_SEPARATOR . $name;
}

$scenario = json_decode(file_get_contents(state_path('scenario.json')), true);
$me = $scenario['workers'][(int) $workerId];
if (!empty($scenario['limits'])) {
    add_filter('isb_request_limits', function ($limits) use ($scenario) {
        return array_merge($limits, $scenario['limits']);
    });
}
add_filter('pre_wp_mail', '__return_true');
// Where the handler sends the visitor, instead of sending them.
add_filter('wp_redirect', function ($location) {
    $GLOBALS['redirected'] = $location;
    return false;
}, PHP_INT_MAX);
register_shutdown_function(function () {
    $location = $GLOBALS['redirected'] ?? '';
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
    $outcome = strpos($location, 'https://www.sandbox.paypal.com/') === 0 ? 'paypal' : ($query['reason'] ?? 'other');
    file_put_contents(state_path('result-' . $GLOBALS['workerId'] . '.json'), json_encode(array('outcome' => $outcome)));
});

foreach ($me['server'] as $key => $value) $_SERVER[$key] = $value;
$_POST = array(
    'action' => 'isb_featured',
    'article' => (string) $scenario['article'],
    'lang' => 'en',
    'email' => $me['email'],
    'website' => 'example.com',
    'message' => 'Please mention our studio.',
);

touch(state_path('ready-' . $workerId));
$deadline = microtime(true) + 60;
while (!file_exists(state_path('go'))) {
    if (microtime(true) > $deadline) {
        fwrite(STDERR, "barrier timeout\n");
        exit(3);
    }
    usleep(500);
}
isb_handle_request();
