<?php
/**
 * 1.7.0 harness: one-click connect, disconnect, the settings page, the
 * "Publish articles as" fix, and self-updates.
 *
 *   php wordpress-plugin/tests/connect-flow.php wordpress-plugin/repget-connector/repget-connector.php
 *
 * (Also started by sync-idempotency.php, so `npm run plugin:test` runs it.)
 *
 * No WordPress here: the functions the plugin calls are stubbed the way
 * sync-idempotency.php stubs them, and where the outcome depends on what
 * core does, modelled on that:
 *
 *  - wp_redirect / wp_safe_redirect end the request (the plugin calls exit
 *    after them), so they throw Redirected - which also proves nothing after
 *    the redirect runs. wp_die throws Died.
 *  - check_admin_referer DIES on a bad nonce (core calls wp_nonce_ays), so
 *    it throws Died unless the nonce action is in $GLOBALS['valid_nonces'].
 *  - Transients expire: a clock offset ($GLOBALS['clock']) moves time on.
 *  - RepGet is a fake server (repget_server) that implements the contract in
 *    docs/wordpress-connect.md, including PKCE: a code exchanges only with
 *    the verifier whose SHA-256 was sent at start, and a wrong verifier
 *    burns the code.
 */

define('ABSPATH', __DIR__ . '/');
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);

class Redirected extends Exception {
    public $url; public $safe;
    public function __construct($url, $safe) { parent::__construct('redirect'); $this->url = $url; $this->safe = $safe; }
}
class Died extends Exception {}

// ---------------------------------------------------------------- options ---
$GLOBALS['options'] = array();
$GLOBALS['transients'] = array();       // name => array(value, expires)
$GLOBALS['site_transients'] = array();
$GLOBALS['clock'] = 0;                  // seconds added to time() for expiry
$GLOBALS['user_id'] = 7;
$GLOBALS['can'] = true;
$GLOBALS['valid_nonces'] = array();

function now() { return time() + $GLOBALS['clock']; }
function get_option($k, $d = false) { return array_key_exists($k, $GLOBALS['options']) ? $GLOBALS['options'][$k] : $d; }
function update_option($k, $v, $a = null) { $GLOBALS['options'][$k] = $v; return true; }
function add_option($k, $v, $dep = '', $a = null) { if (array_key_exists($k, $GLOBALS['options'])) return false; $GLOBALS['options'][$k] = $v; return true; }
function delete_option($k) { unset($GLOBALS['options'][$k]); return true; }
function transient_get($bag, $k) {
    if (!isset($GLOBALS[$bag][$k])) return false;
    list($v, $exp) = $GLOBALS[$bag][$k];
    if ($exp > 0 && now() >= $exp) { unset($GLOBALS[$bag][$k]); return false; }
    return $v;
}
function get_transient($k) { return transient_get('transients', $k); }
function set_transient($k, $v, $ttl = 0) { $GLOBALS['transients'][$k] = array($v, $ttl ? now() + $ttl : 0); return true; }
function delete_transient($k) { unset($GLOBALS['transients'][$k]); return true; }
function get_site_transient($k) { return transient_get('site_transients', $k); }
function set_site_transient($k, $v, $ttl = 0) { $GLOBALS['site_transients'][$k] = array($v, $ttl ? now() + $ttl : 0); return true; }
function delete_site_transient($k) { unset($GLOBALS['site_transients'][$k]); return true; }

class WP_Error {
    private $code; private $msg;
    public function __construct($code = '', $msg = '') { $this->code = $code; $this->msg = $msg; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->msg; }
}
function is_wp_error($t) { return $t instanceof WP_Error; }

// ---------------------------------------------------------- request stubs ---
function current_user_can($c) { return $GLOBALS['can']; }
function get_current_user_id() { return $GLOBALS['user_id']; }
function check_admin_referer($action) {
    if (!in_array($action, $GLOBALS['valid_nonces'], true)) throw new Died("nonce {$action}");
    return 1;
}
function wp_die($m = '', $t = '', $a = array()) { throw new Died((string) $m); }
function wp_redirect($url) { throw new Redirected($url, false); }
function wp_safe_redirect($url) { throw new Redirected($url, true); }
function wp_nonce_field($action) { echo '<input type="hidden" name="_wpnonce" value="nonce-' . $action . '" />'; }

function __($t, $d = null) { return $t; }
function _n($s, $p, $n, $d = null) { return $n === 1 ? $s : $p; }
function esc_html($v) { return htmlspecialchars((string) $v, ENT_QUOTES); }
function esc_attr($v) { return htmlspecialchars((string) $v, ENT_QUOTES); }
function esc_url($v) { return htmlspecialchars((string) $v, ENT_QUOTES); }
function esc_js($v) { return htmlspecialchars(addslashes((string) $v), ENT_QUOTES); }
function esc_html__($t, $d = null) { return esc_html($t); }
function esc_html_e($t, $d = null) { echo esc_html($t); }
function selected($a, $b) { if ((string) $a === (string) $b) echo ' selected="selected"'; }
function sanitize_text_field($v) { return is_string($v) ? trim(strip_tags($v)) : ''; }
function sanitize_key($k) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $k)); }
function wp_unslash($v) { return $v; }
function wp_json_encode($v) { return json_encode($v); }
function untrailingslashit($s) { return rtrim($s, '/'); }
function home_url($p = '') { return 'https://site.test' . $p; }
function get_site_url() { return 'https://site.test'; }
function admin_url($p = '') { return 'https://site.test/wp-admin/' . $p; }
function get_bloginfo($k) { return '6.8.3'; }
function plugin_basename($f) { return 'repget-connector/repget-connector.php'; }
function add_action() {}
function get_file_data($file, $headers) {
    // What WordPress would read from the plugin file's header; tests can pretend it was just replaced.
    if (isset($GLOBALS['disk_version'])) return array('Version' => $GLOBALS['disk_version']);
    $header = file_get_contents($file, false, null, 0, 8192);
    return array('Version' => preg_match('/^[ \t\/*#@]*Version:(.*)$/mi', $header, $m) ? trim($m[1]) : '');
}
function wp_schedule_single_event($t, $hook, $args = array()) { $GLOBALS['scheduled'][] = $hook; return true; }
function add_filter() {}
function register_activation_hook() {}
function register_deactivation_hook() {}
function get_current_screen() { return null; }
function wp_generate_password($len = 12, $s = true, $e = false) { return bin2hex(random_bytes(intdiv($len, 2))); }
function get_post_types($a = array(), $o = 'names') {
    return array(
        'post' => (object) array('name' => 'post', 'labels' => (object) array('name' => 'Posts')),
        'custom_post' => (object) array('name' => 'custom_post', 'labels' => (object) array('name' => 'Editorial')),
    );
}
function post_type_supports($t, $f) { return true; }

// ------------------------------------------------------------------ posts ---
$GLOBALS['posts'] = array();
$GLOBALS['meta'] = array();
function get_posts($args) {
    $out = array();
    foreach ($GLOBALS['meta'] as $id => $m) {
        if (isset($m[$args['meta_key']]) && (!isset($args['meta_value']) || $m[$args['meta_key']] === $args['meta_value'])) $out[] = $id;
    }
    sort($out);
    return $out;
}
function get_post_meta($id, $k, $single = false) { return isset($GLOBALS['meta'][$id][$k]) ? $GLOBALS['meta'][$id][$k] : ''; }
function update_post_meta($id, $k, $v) { $GLOBALS['meta'][$id][$k] = $v; return true; }
function get_post($id) { return isset($GLOBALS['posts'][$id]) ? (object) $GLOBALS['posts'][$id] : null; }
function set_post_type($id, $type) { $GLOBALS['posts'][$id]['post_type'] = $type; return true; }
function clean_post_cache($id) {}
function get_post_status($id) { return isset($GLOBALS['posts'][$id]) ? $GLOBALS['posts'][$id]['post_status'] : false; }
function get_permalink($id) { return 'https://site.test/' . $GLOBALS['posts'][$id]['post_type'] . '/' . $id; }

// ---------------------------------------------------------- fake RepGet ---
/*
  Every outbound request lands here. `calls` records what was sent - and
  which key the site held AT THAT MOMENT, which is how "verify the new key
  before saving it" is checked.
*/
$GLOBALS['calls'] = array();
$GLOBALS['down'] = false;               // the network fails
$GLOBALS['start_reply'] = null;         // override start's reply: array(code, body)
$GLOBALS['verify_ok'] = true;
$GLOBALS['disconnect_reply'] = null;
$GLOBALS['manifest'] = null;            // body of /repget-connector.json, or null for 404
$GLOBALS['package_bytes'] = 'zip-bytes';
$GLOBALS['downloads'] = array();
$GLOBALS['rq'] = array();               // the fake's connect requests, by id
$GLOBALS['issued'] = array();           // keys it issued

function b64url($bytes) { return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '='); }

function repget_server($method, $url, $args) {
    $headers = isset($args['headers']) ? $args['headers'] : array();
    $body = isset($args['body']) ? json_decode($args['body'], true) : null;
    $path = parse_url($url, PHP_URL_PATH);
    $GLOBALS['calls'][] = array(
        'method' => $method, 'url' => $url, 'path' => $path, 'headers' => $headers, 'body' => $body,
        'held_key' => get_option(REPGET_OPTION_KEY, ''),
    );
    if ($GLOBALS['down']) return new WP_Error('http_request_failed', 'cURL error 28: Connection timed out');
    if ($path === '/api/plugin/verify' && $GLOBALS['verify_lost'] > 0) {
        // The check reached RepGet; only the answer is lost.
        $GLOBALS['verify_lost']--;
        return new WP_Error('http_request_failed', 'cURL error 28: Operation timed out');
    }

    $key = isset($headers['X-Integration-Key']) ? $headers['X-Integration-Key'] : '';
    switch ($path) {
        case '/api/plugin/connect/start':
            if ($GLOBALS['start_reply'] !== null) return $GLOBALS['start_reply'];
            $id = b64url(random_bytes(32));
            $GLOBALS['rq'][$id] = array('challenge' => $body['challenge'], 'state' => $body['state'], 'code' => null, 'body' => $body);
            return array(200, array('ok' => true, 'authorizeUrl' => 'https://app.test/connect/wordpress?request=' . $id));
        case '/api/plugin/connect/token':
            $r = isset($GLOBALS['rq'][$body['request']]) ? $GLOBALS['rq'][$body['request']] : null;
            if ($r === null || $r['code'] === null || !hash_equals($r['code'], (string) $body['code'])
                || b64url(hash('sha256', (string) $body['verifier'], true)) !== $r['challenge']) {
                // A wrong code or verifier uses the code up.
                if ($r !== null) $GLOBALS['rq'][$body['request']]['code'] = null;
                return array(400, array('ok' => false, 'error' => 'That connection code is not valid.'));
            }
            $GLOBALS['rq'][$body['request']]['code'] = null;
            $issued = 'seo_' . b64url(random_bytes(32));
            $GLOBALS['issued'][] = $issued;
            return array(200, array('ok' => true, 'key' => $issued,
                'website' => array('id' => 'w-1', 'domain' => 'site.test', 'name' => 'Site'),
                'workspace' => array('name' => 'Acme')));
        case '/api/plugin/verify':
            $known = in_array($key, $GLOBALS['issued'], true) || $key === 'old-key';
            if (!$GLOBALS['verify_ok'] || !$known) return array(401, array('ok' => false, 'error' => 'That integration key is not valid.'));
            return array(200, array('ok' => true,
                'website' => array('id' => $key === 'old-key' ? 'w-old' : 'w-1', 'domain' => 'site.test', 'name' => 'Site'),
                'workspace' => array('name' => $key === 'old-key' ? 'Old Co' : 'Acme')));
        case '/api/plugin/disconnect':
            if ($GLOBALS['disconnect_reply'] !== null) return $GLOBALS['disconnect_reply'];
            return array(200, array('ok' => true));
        case '/api/plugin/published':
            return array(200, array('ok' => true, 'recorded' => 'moved'));
        case '/api/plugin/articles':
            return array(200, array('ok' => true, 'articles' => array(), 'sent' => array()));
        case '/repget-connector.json':
            return $GLOBALS['manifest'] === null ? array(404, 'Not found') : array(200, $GLOBALS['manifest']);
    }
    return array(404, array('ok' => false, 'error' => 'no route'));
}
/** RepGet approving request `id`: what its approve action does before redirecting back. */
function approve($id) { $code = b64url(random_bytes(32)); $GLOBALS['rq'][$id]['code'] = $code; return $code; }

function http_reply($r) {
    if (is_wp_error($r)) return $r;
    return array('response' => array('code' => $r[0]), 'body' => is_string($r[1]) ? $r[1] : json_encode($r[1]));
}
function wp_remote_request($url, $args = array()) { return http_reply(repget_server(isset($args['method']) ? $args['method'] : 'GET', $url, $args)); }
function wp_remote_get($url, $args = array()) { return http_reply(repget_server('GET', $url, $args)); }
function wp_remote_post($url, $args = array()) { return http_reply(repget_server('POST', $url, $args)); }
function wp_remote_retrieve_response_code($r) { return is_array($r) ? $r['response']['code'] : ''; }
function wp_remote_retrieve_body($r) { return is_array($r) ? $r['body'] : ''; }
function download_url($url) {
    $GLOBALS['downloads'][] = $url;
    $file = tempnam(sys_get_temp_dir(), 'repget');
    file_put_contents($file, $GLOBALS['package_bytes']);
    $GLOBALS['downloaded_files'][] = $file;
    return $file;
}
function wp_delete_file($f) { @unlink($f); }

// ------------------------------------------------------------------- load ---
$plugin_path = $argv[1];
$src = file_get_contents($plugin_path);
$header = $src;
$src = preg_replace('/^<\?php/', '', $src, 1);
$src = preg_replace("/if \\(!defined\\('ABSPATH'\\)\\) \\{\\r?\\n\\s*exit;\\r?\\n\\}/", '', $src, 1);
eval($src);

// ------------------------------------------------------------------ tests ---
$failures = 0;
function check($label, $cond, $detail = '') {
    global $failures;
    if ($cond) { echo "  ok    {$label}\n"; }
    else { echo "  FAIL  {$label} {$detail}\n"; $failures++; }
}
/** Runs a hook the way a request would: until it returns, redirects or dies. */
function run($fn) {
    ob_start();
    try { $fn(); $out = array('kind' => 'returned'); }
    catch (Redirected $r) { $out = array('kind' => 'redirect', 'url' => $r->url, 'safe' => $r->safe); }
    catch (Died $d) { $out = array('kind' => 'died', 'why' => $d->getMessage()); }
    $out['html'] = ob_get_clean();
    return $out;
}
function reset_all() {
    $GLOBALS['options'] = array(REPGET_OPTION_ENDPOINT => 'https://app.test');
    $GLOBALS['transients'] = array(); $GLOBALS['site_transients'] = array();
    $GLOBALS['clock'] = 0; $GLOBALS['user_id'] = 7; $GLOBALS['can'] = true;
    $GLOBALS['valid_nonces'] = array();
    $GLOBALS['calls'] = array(); $GLOBALS['down'] = false; $GLOBALS['start_reply'] = null;
    $GLOBALS['scheduled'] = array();
    $GLOBALS['verify_ok'] = true; $GLOBALS['disconnect_reply'] = null; $GLOBALS['verify_lost'] = 0;
    $GLOBALS['manifest'] = null; $GLOBALS['package_bytes'] = 'zip-bytes'; $GLOBALS['downloads'] = array(); $GLOBALS['downloaded_files'] = array();
    $GLOBALS['rq'] = array(); $GLOBALS['issued'] = array();
    $GLOBALS['posts'] = array(); $GLOBALS['meta'] = array();
    $_GET = array(); $_POST = array();
}
/** A site already connected with an older key, from another account. */
function connected_to_old() {
    update_option(REPGET_OPTION_KEY, 'old-key');
    update_option(REPGET_OPTION_STATUS, 'connected');
    update_option(REPGET_OPTION_CONNECTION, array('workspace' => 'Old Co', 'website' => 'Site', 'domain' => 'site.test', 'websiteId' => 'w-old', 'connected_at' => 1000));
}
function calls_to($path) { return array_values(array_filter($GLOBALS['calls'], function ($c) use ($path) { return $c['path'] === $path; })); }
/** Presses the button: returns [run result, request id]. */
function press_connect($link = null) {
    $_POST = $link === null ? array() : array('link' => $link);
    $GLOBALS['valid_nonces'] = array('repget_connect');
    $r = run('repget_connect_start');
    $id = '';
    if ($r['kind'] === 'redirect' && preg_match('/[?&]request=([^&]+)/', $r['url'], $m)) $id = $m[1];
    return array($r, $id);
}
/** RepGet redirects back to the registered return URL with these parameters. */
function come_back($params) {
    $_GET = array_merge(array('page' => 'repget'), $params);
    $_POST = array();
    return run('repget_connect_callback');
}
function flash() { $f = get_transient('repget_notice_' . $GLOBALS['user_id']); return is_array($f) ? $f : array('message' => '', 'type' => ''); }
function pending() { return get_transient('repget_connect_' . $GLOBALS['user_id']); }

echo "\nVERSION 1.7.0 everywhere, and updates only from RepGet\n";
check('REPGET_VERSION is 1.7.0', REPGET_VERSION === '1.7.0');
check('the header says 1.7.0', preg_match('/^\s*\*\s*Version:\s*1\.7\.0\s*$/m', $header) === 1);
$readme = @file_get_contents(dirname($plugin_path) . '/readme.txt');
check('the readme Stable tag is 1.7.0', is_string($readme) && preg_match('/^Stable tag:\s*1\.7\.0\s*$/m', $readme) === 1);
check('the readme has a 1.7.0 changelog entry', is_string($readme) && strpos($readme, "= 1.7.0 =") !== false);
check('an Update URI keeps WordPress.org from offering updates for this slug',
    preg_match('/^\s*\*\s*Update URI:\s*(\S+)/m', $header, $m) === 1 && stripos($m[1], 'wordpress.org') === false && stripos($m[1], 'w.org') === false);

echo "\nSTART: the button builds a PKCE request and goes to RepGet\n";
reset_all();
list($r, $id) = press_connect();
$start = calls_to('/api/plugin/connect/start');
$sent = $start ? $start[0]['body'] : array();
$p = pending();
check('redirected to RepGet\'s confirm page', $r['kind'] === 'redirect' && strpos($r['url'], 'https://app.test/connect/wordpress?request=') === 0, json_encode($r));
check('...with wp_redirect (another host), not wp_safe_redirect', $r['kind'] === 'redirect' && $r['safe'] === false);
check('start was POSTed once', count($start) === 1 && $start[0]['method'] === 'POST');
check('siteUrl is home_url()', $sent['siteUrl'] === 'https://site.test');
check('returnUrl is the callback on admin.php', $sent['returnUrl'] === 'https://site.test/wp-admin/admin.php?page=repget&repget_connect=callback');
check('state is 43 url-safe characters (32 random bytes)', preg_match('/^[A-Za-z0-9_-]{43}$/', $sent['state']) === 1);
check('challenge is 43 url-safe characters', preg_match('/^[A-Za-z0-9_-]{43}$/', $sent['challenge']) === 1);
check('pluginVersion is sent', $sent['pluginVersion'] === '1.7.0');
check('no link without one', !array_key_exists('link', $sent));
check('no key header when the site has no key', !isset($start[0]['headers']['X-Integration-Key']));
check('the verifier is NOT sent', is_array($p) && strpos(json_encode($sent), $p['verifier']) === false);
check('state and verifier are kept for this user', is_array($p) && $p['state'] === $sent['state'] && preg_match('/^[A-Za-z0-9_-]{43}$/', $p['verifier']) === 1);
check('challenge = base64url(sha256(verifier))', is_array($p) && b64url(hash('sha256', $p['verifier'], true)) === $sent['challenge']);
check('...and the request id is remembered', is_array($p) && $p['request'] === $id);
$GLOBALS['user_id'] = 8;
check('another WordPress user has no pending connect', pending() === false);
$GLOBALS['user_id'] = 7;
$GLOBALS['clock'] = REPGET_CONNECT_TTL;
check('it expires after 15 minutes', pending() === false);

reset_all();
connected_to_old();
list($r) = press_connect('lnk_ABC-123');
$start = calls_to('/api/plugin/connect/start');
check('flow A: the link is sent', $start[0]['body']['link'] === 'lnk_ABC-123');
check('the current key goes in X-Integration-Key', $start[0]['headers']['X-Integration-Key'] === 'old-key');
reset_all();
press_connect(str_repeat('a', 65));
$start = calls_to('/api/plugin/connect/start');
check('a link longer than 64 characters is dropped', count($start) === 1 && !array_key_exists('link', $start[0]['body']));
reset_all();
press_connect('bad link"><script>');
$start = calls_to('/api/plugin/connect/start');
check('a link that is not url-safe is dropped', count($start) === 1 && !array_key_exists('link', $start[0]['body']));

echo "\nSTART refuses anything but RepGet's own confirm page\n";
$foreign = array(
    'another host' => 'https://evil.test/connect/wordpress?request=abc',
    'a look-alike host' => 'https://app.test.evil.test/connect/wordpress?request=abc',
    'userinfo trick' => 'https://app.test@evil.test/connect/wordpress?request=abc',
    'another path' => 'https://app.test/sign-in?request=abc',
    'plain http' => 'http://app.test/connect/wordpress?request=abc',
    'extra parameters' => 'https://app.test/connect/wordpress?request=abc&next=https://evil.test',
    'no request id' => 'https://app.test/connect/wordpress?request=',
    'not a string' => array('x'),
);
foreach ($foreign as $label => $url) {
    reset_all();
    $GLOBALS['start_reply'] = array(200, array('ok' => true, 'authorizeUrl' => $url));
    list($r) = press_connect();
    check("refused: {$label}", $r['kind'] === 'redirect' && $r['safe'] === true
        && $r['url'] === 'https://site.test/wp-admin/admin.php?page=repget' && pending() === false
        && flash()['type'] === 'error', json_encode($r));
}

echo "\nSTART: RepGet refusing, or the network failing, changes nothing\n";
reset_all();
connected_to_old();
$GLOBALS['start_reply'] = array(429, array('ok' => false, 'error' => 'Too many connection attempts for this site.'));
list($r) = press_connect();
check('429: back to settings with RepGet\'s reason', $r['kind'] === 'redirect' && strpos(flash()['message'], 'Too many connection attempts') !== false);
check('...no pending connect', pending() === false);
reset_all();
connected_to_old();
$GLOBALS['start_reply'] = array(401, array('ok' => false, 'error' => 'no'));
press_connect();
check('a 401 from start does NOT mark the saved key rejected', get_option(REPGET_OPTION_STATUS) === 'connected');
reset_all();
$GLOBALS['down'] = true;
list($r) = press_connect();
check('network down: an error, no redirect to RepGet', $r['kind'] === 'redirect' && $r['safe'] === true && flash()['type'] === 'error');

echo "\nSTART needs manage_options and the nonce\n";
reset_all();
$GLOBALS['can'] = false;
list($r) = press_connect();
check('not an administrator: refused', $r['kind'] === 'died' && count($GLOBALS['calls']) === 0);
reset_all();
$_POST = array();
$GLOBALS['valid_nonces'] = array();
$r = run('repget_connect_start');
check('no valid nonce: refused before RepGet is called', $r['kind'] === 'died' && count($GLOBALS['calls']) === 0);

echo "\nCALLBACK with a wrong, missing or unknown state: the code is burned and nothing is saved\n";
$cases = array(
    'wrong state' => function ($id, $code, $state) { return array('state' => ($state[0] === 'x' ? 'y' : 'x') . substr($state, 1)); },
    'missing state' => function ($id, $code, $state) { return array(); },
    'state as an array' => function ($id, $code, $state) { return array('state' => array($state)); },
);
foreach ($cases as $label => $make) {
    reset_all();
    connected_to_old();
    list(, $id) = press_connect();
    $state = pending()['state'];
    $code = approve($id);
    $r = come_back(array_merge(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code), $make($id, $code, $state)));
    $token = calls_to('/api/plugin/connect/token');
    check("{$label}: token called once, with an EMPTY verifier", count($token) === 1 && $token[0]['body']['verifier'] === '' && $token[0]['body']['code'] === $code, json_encode($token));
    check("{$label}: the code is burned at RepGet", $GLOBALS['rq'][$id]['code'] === null);
    check("{$label}: no verify, key/status/connection unchanged", count(calls_to('/api/plugin/verify')) === 0
        && get_option(REPGET_OPTION_KEY) === 'old-key' && get_option(REPGET_OPTION_STATUS) === 'connected'
        && get_option(REPGET_OPTION_CONNECTION)['workspace'] === 'Old Co');
    check("{$label}: an error, back on the settings page", $r['kind'] === 'redirect' && $r['url'] === 'https://site.test/wp-admin/admin.php?page=repget' && flash()['type'] === 'error');
    check("{$label}: the real pending connect is left alone", is_array(pending()) && pending()['state'] === $state);
}

reset_all();
list(, $id) = press_connect();
$state = pending()['state'];
$code = approve($id);
$GLOBALS['user_id'] = 8; // another administrator follows the same link
come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
check('another WordPress user: code burned, nothing saved', $GLOBALS['rq'][$id]['code'] === null && get_option(REPGET_OPTION_KEY, '') === '');
$GLOBALS['user_id'] = 7;

reset_all();
list(, $id) = press_connect();
$state = pending()['state'];
$code = approve($id);
$GLOBALS['clock'] = REPGET_CONNECT_TTL + 1;
come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
check('after 15 minutes: code burned, nothing saved', $GLOBALS['rq'][$id]['code'] === null && get_option(REPGET_OPTION_KEY, '') === '');

reset_all();
list(, $id) = press_connect();
$state = pending()['state'];
list(, $other) = press_connect(); // a second press replaced the first
$state2 = pending()['state'];
$code = approve($id);
$GLOBALS['calls'] = array();
come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state2));
check('right state, but a code for ANOTHER request: burned, nothing saved', $GLOBALS['rq'][$id]['code'] === null && get_option(REPGET_OPTION_KEY, '') === '');
$token = calls_to('/api/plugin/connect/token');
check('...treated as unknown: the real verifier is never sent for it', count($token) === 1 && $token[0]['body']['verifier'] === '');

reset_all();
list(, $id) = press_connect();
$state = pending()['state'];
$code = approve($id);
$GLOBALS['can'] = false;
$r = come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
check('not an administrator: the callback does nothing at all', $r['kind'] === 'returned' && count(calls_to('/api/plugin/connect/token')) === 0);

echo "\nCALLBACK success: token, verify the NEW key, and only then save it\n";
reset_all();
connected_to_old();
list(, $id) = press_connect();
$state = pending()['state'];
$code = approve($id);
$GLOBALS['calls'] = array();
$r = come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
$token = calls_to('/api/plugin/connect/token');
$verify = calls_to('/api/plugin/verify');
$new_key = end($GLOBALS['issued']);
check('token got request, code and the stored verifier', count($token) === 1 && $token[0]['body']['request'] === $id && $token[0]['body']['code'] === $code
    && b64url(hash('sha256', $token[0]['body']['verifier'], true)) === $GLOBALS['rq'][$id]['challenge']);
check('verify was called with the NEW key', count($verify) === 1 && $verify[0]['headers']['X-Integration-Key'] === $new_key);
check('...while the site still held the OLD key', count($verify) === 1 && $verify[0]['held_key'] === 'old-key');
check('...and sent the site details', $verify[0]['body']['pluginVersion'] === '1.7.0' && $verify[0]['body']['syncUrl'] === 'https://site.test/wp-admin/admin-ajax.php');
check('the new key is saved', get_option(REPGET_OPTION_KEY) === $new_key);
check('status is connected', get_option(REPGET_OPTION_STATUS) === 'connected');
$c = get_option(REPGET_OPTION_CONNECTION);
check('repget_connection names the account and website', $c['workspace'] === 'Acme' && $c['website'] === 'Site' && $c['domain'] === 'site.test' && $c['websiteId'] === 'w-1' && $c['connected_at'] >= time() - 5, json_encode($c));
check('...and never holds the key', strpos(json_encode($c), $new_key) === false);
check('the pending connect is gone', pending() === false);
check('back on the settings page, key nowhere in the URL', $r['kind'] === 'redirect' && $r['safe'] === true && $r['url'] === 'https://site.test/wp-admin/admin.php?page=repget');
check('success notice: "Connected to Acme · site.test"', flash()['type'] === 'success' && strpos(flash()['message'], 'Connected to Acme · site.test') === 0, flash()['message']);
check('...which does not contain the key', strpos(flash()['message'], $new_key) === false);
check('a check for due articles runs now, not at the next hourly one', $GLOBALS['scheduled'] === array('repget_sync_event'), json_encode($GLOBALS['scheduled']));
$again = come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
check('replaying the same callback saves nothing new', get_option(REPGET_OPTION_KEY) === $new_key && flash()['type'] === 'error');

echo "\nCALLBACK: a new key that FAILS verification leaves the old key in place\n";
reset_all();
connected_to_old();
list(, $id) = press_connect();
$state = pending()['state'];
$code = approve($id);
$GLOBALS['verify_ok'] = false;
come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
check('the token was exchanged', count($GLOBALS['issued']) === 1);
check('the old key is kept', get_option(REPGET_OPTION_KEY) === 'old-key');
check('status is NOT marked invalid_key (the old key is fine)', get_option(REPGET_OPTION_STATUS) === 'connected');
check('the old connection is kept', get_option(REPGET_OPTION_CONNECTION)['workspace'] === 'Old Co');
check('an error explains it', flash()['type'] === 'error' && strpos(flash()['message'], 'unchanged') !== false, flash()['message']);
check('...and no extra check is scheduled', $GLOBALS['scheduled'] === array());

reset_all();
connected_to_old();
list(, $id) = press_connect();
$state = pending()['state'];
approve($id);
come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => b64url(random_bytes(32)), 'state' => $state));
check('a wrong code: RepGet refuses, nothing saved', get_option(REPGET_OPTION_KEY) === 'old-key' && count(calls_to('/api/plugin/verify')) === 0 && flash()['type'] === 'error');

reset_all();
connected_to_old();
list(, $id) = press_connect();
$state = pending()['state'];
$code = approve($id);
$GLOBALS['down'] = true;
come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
check('the network failing mid-exchange changes nothing', get_option(REPGET_OPTION_KEY) === 'old-key' && get_option(REPGET_OPTION_STATUS) === 'connected');

echo "\nCALLBACK: the new key's check gets no answer\n";
foreach (array(1 => 'once: asked again', 2 => 'twice: saved anyway') as $lost => $label) {
    reset_all();
    connected_to_old();
    list(, $id) = press_connect();
    $state = pending()['state'];
    $code = approve($id);
    $GLOBALS['calls'] = array();
    $GLOBALS['verify_lost'] = $lost;
    come_back(array('repget_connect' => 'callback', 'request' => $id, 'code' => $code, 'state' => $state));
    $new_key = end($GLOBALS['issued']);
    check("lost {$label}: verify tried twice", count(calls_to('/api/plugin/verify')) === 2);
    // RepGet may already have retired the old key: keeping it would leave a revoked key.
    check("lost {$label}: the NEW key is saved", get_option(REPGET_OPTION_KEY) === $new_key && get_option(REPGET_OPTION_STATUS) === 'connected');
    check("lost {$label}: the account comes from the token answer", get_option(REPGET_OPTION_CONNECTION)['workspace'] === 'Acme');
}

echo "\nCANCELLED\n";
reset_all();
connected_to_old();
list(, $id) = press_connect();
$state = pending()['state'];
$GLOBALS['calls'] = array();
$r = come_back(array('repget_connect' => 'cancelled', 'state' => $state));
check('"Connection cancelled. Nothing changed."', flash()['message'] === 'Connection cancelled. Nothing changed.');
check('no call to RepGet, nothing changed', count($GLOBALS['calls']) === 0 && get_option(REPGET_OPTION_KEY) === 'old-key');
check('the pending connect is dropped', pending() === false);
check('back on the clean settings URL', $r['kind'] === 'redirect' && $r['url'] === 'https://site.test/wp-admin/admin.php?page=repget');
reset_all();
list(, $id) = press_connect();
$state = pending()['state'];
come_back(array('repget_connect' => 'cancelled', 'state' => 'someone-elses-state-000000'));
check('a cancel with a foreign state leaves this user\'s pending connect alone', is_array(pending()) && pending()['state'] === $state);
reset_all();
$_GET = array('page' => 'repget', 'repget_connect' => 'something-else');
$r = run('repget_connect_callback');
check('any other repget_connect value is ignored', $r['kind'] === 'returned');
$_GET = array('page' => 'other', 'repget_connect' => 'callback');
$r = run('repget_connect_callback');
check('another page is ignored', $r['kind'] === 'returned');

echo "\nDISCONNECT\n";
reset_all();
connected_to_old();
set_transient(REPGET_VERIFY_CACHE, array('state' => 'connected'), 300);
$GLOBALS['valid_nonces'] = array('repget_disconnect');
$r = run('repget_disconnect');
$d = calls_to('/api/plugin/disconnect');
check('RepGet was told, with the key', count($d) === 1 && $d[0]['method'] === 'POST' && $d[0]['headers']['X-Integration-Key'] === 'old-key');
check('...and with this install\'s check-now address, so a staging copy cannot revoke the live site\'s key', $d[0]['body']['syncUrl'] === 'https://site.test/wp-admin/admin-ajax.php');
check('key, status, connection and cached check are cleared', get_option(REPGET_OPTION_KEY, null) === null && get_option(REPGET_OPTION_STATUS, null) === null
    && get_option(REPGET_OPTION_CONNECTION, null) === null && get_transient(REPGET_VERIFY_CACHE) === false);
check('back to settings with a notice', $r['kind'] === 'redirect' && flash()['type'] === 'success');
reset_all();
connected_to_old();
$GLOBALS['down'] = true;
$GLOBALS['valid_nonces'] = array('repget_disconnect');
run('repget_disconnect');
check('RepGet unreachable: still cleared here', get_option(REPGET_OPTION_KEY, null) === null && get_option(REPGET_OPTION_CONNECTION, null) === null);
check('...with a warning saying RepGet was not told', flash()['type'] === 'warning');
reset_all();
connected_to_old();
$GLOBALS['disconnect_reply'] = array(401, array('ok' => false, 'error' => 'That integration key is not valid.'));
$GLOBALS['valid_nonces'] = array('repget_disconnect');
run('repget_disconnect');
check('an already-revoked key: still cleared here', get_option(REPGET_OPTION_KEY, null) === null);
check('...and not told to revoke a key RepGet no longer lists', flash()['type'] === 'success' && strpos(flash()['message'], 'already stopped accepting') !== false, flash()['message']);
reset_all();
connected_to_old();
$GLOBALS['disconnect_reply'] = array(200, array('ok' => true, 'revoked' => false));
$GLOBALS['valid_nonces'] = array('repget_disconnect');
run('repget_disconnect');
check('RepGet kept the key (a copy may use it): still cleared here', get_option(REPGET_OPTION_KEY, null) === null);
check('...and says so, pointing to where it can be revoked', flash()['type'] === 'warning' && strpos(flash()['message'], 'RepGet kept the key') !== false, flash()['message']);
reset_all();
connected_to_old();
$r = run('repget_disconnect');
check('no nonce: refused, nothing cleared, RepGet not called', $r['kind'] === 'died' && get_option(REPGET_OPTION_KEY) === 'old-key' && count($GLOBALS['calls']) === 0);
reset_all();
connected_to_old();
$GLOBALS['can'] = false;
$GLOBALS['valid_nonces'] = array('repget_disconnect');
$r = run('repget_disconnect');
check('not an administrator: refused', $r['kind'] === 'died' && get_option(REPGET_OPTION_KEY) === 'old-key');

echo "\nSETTINGS PAGE\n";
reset_all();
$r = run('repget_settings_page');
$html = $r['html'];
check('not connected: a Connect to RepGet button posting to admin-post', strpos($html, 'value="repget_connect_start"') !== false && strpos($html, '>Connect to RepGet</button>') !== false);
check('...with its nonce', strpos($html, 'value="nonce-repget_connect"') !== false);
check('...and the help text', strpos($html, 'In RepGet: Integrations → WordPress plugin → Connect WordPress.') !== false);
check('...no call to RepGet', count($GLOBALS['calls']) === 0);
check('the key field is under a collapsed Advanced section', preg_match('/<details id="repget-advanced">\s*<summary>Advanced: use an Integration Key<\/summary>/', $html) === 1 && strpos($html, 'name="repget_save"') !== false);
check('"Publish articles as" is still there', strpos($html, 'name="repget_post_type"') !== false && strpos($html, 'Editorial (custom_post)') !== false);

reset_all();
$_GET = array('page' => 'repget', 'repget_link' => 'lnk_ABC-123');
$html = run('repget_settings_page')['html'];
check('?repget_link: a Finish connecting card', strpos($html, 'Finish connecting to RepGet</h2>') !== false);
check('...whose button posts the link', strpos($html, '<input type="hidden" name="link" value="lnk_ABC-123" />') !== false);
check('...and the fragment is cleared without prefilling', strpos($html, 'var hasLink = true;') !== false);
$_GET = array('page' => 'repget', 'repget_link' => '"><img src=x onerror=alert(1)>');
$html = run('repget_settings_page')['html'];
check('an invalid link is ignored and never printed', strpos($html, 'Finish connecting to RepGet</h2>') === false && strpos($html, 'onerror') === false && strpos($html, 'var hasLink = false;') !== false);
$_GET = array('page' => 'repget', 'repget_link' => str_repeat('a', 65));
$html = run('repget_settings_page')['html'];
check('a link longer than 64 characters is ignored', strpos($html, 'Finish connecting to RepGet</h2>') === false);

reset_all();
$GLOBALS['issued'][] = 'seo_live_key_1234567890';
update_option(REPGET_OPTION_KEY, 'seo_live_key_1234567890');
update_option(REPGET_OPTION_STATUS, 'connected');
$html = run('repget_settings_page')['html'];
check('connected: "Connected to Acme · site.test" from a live verify', strpos($html, 'Connected to Acme · site.test') !== false && count(calls_to('/api/plugin/verify')) === 1);
check('...with Check for articles now, Connect to a different account and Disconnect',
    strpos($html, 'name="repget_sync"') !== false && strpos($html, '>Connect to a different RepGet account</button>') !== false
    && strpos($html, 'value="repget_disconnect"') !== false && strpos($html, 'value="nonce-repget_disconnect"') !== false);
check('the key never appears in the page', strpos($html, 'seo_live_key_1234567890') === false);
run('repget_settings_page');
check('a second view within 5 minutes does not call RepGet again', count(calls_to('/api/plugin/verify')) === 1);
$GLOBALS['clock'] = 301;
run('repget_settings_page');
check('...after 5 minutes it checks again', count(calls_to('/api/plugin/verify')) === 2);

reset_all();
connected_to_old();
$GLOBALS['down'] = true;
$html = run('repget_settings_page')['html'];
check('RepGet unreachable: falls back to the stored connection', strpos($html, 'Connected to Old Co · site.test') !== false && strpos($html, 'could not be reached') !== false);
check('...and keeps the stored status', get_option(REPGET_OPTION_STATUS) === 'connected');

reset_all();
update_option(REPGET_OPTION_KEY, 'revoked-key');
update_option(REPGET_OPTION_STATUS, 'connected');
$html = run('repget_settings_page')['html'];
check('a revoked key: says so, and offers Connect to RepGet', strpos($html, 'no longer accepts') !== false && strpos($html, '>Connect to RepGet</button>') !== false);
check('...and the saved key is marked rejected (repget_request)', get_option(REPGET_OPTION_STATUS) === 'invalid_key');

reset_all();
set_transient('repget_notice_7', array('message' => '<b>Connected</b>', 'type' => 'success'), 60);
$html = run('repget_settings_page')['html'];
check('the notice left by a redirect is shown once, escaped', strpos($html, '&lt;b&gt;Connected&lt;/b&gt;') !== false && get_transient('repget_notice_7') === false);

echo "\nADVANCED: the Integration Key field still works as in 1.6\n";
reset_all();
$GLOBALS['issued'][] = 'seo_pasted_key_123456';
$_POST = array('repget_save' => '1', 'repget_key' => 'seo_pasted_key_123456');
$GLOBALS['valid_nonces'] = array('repget_save_key');
$html = run('repget_settings_page')['html'];
check('Save and connect saves the pasted key and verifies it', get_option(REPGET_OPTION_KEY) === 'seo_pasted_key_123456' && get_option(REPGET_OPTION_STATUS) === 'connected');
check('...records which account it belongs to', get_option(REPGET_OPTION_CONNECTION)['workspace'] === 'Acme');
check('...says so', strpos($html, 'Connected to Acme · site.test.') !== false);
check('...and does not print the key back', strpos($html, 'seo_pasted_key_123456') === false);
$_POST = array('repget_save' => '1', 'repget_key' => '');
run('repget_settings_page');
check('an empty field keeps the saved key', get_option(REPGET_OPTION_KEY) === 'seo_pasted_key_123456');
$_POST = array('repget_save' => '1', 'repget_key' => 'not-a-real-key');
$html = run('repget_settings_page')['html'];
check('a wrong key is saved and reported rejected, as in 1.6', get_option(REPGET_OPTION_KEY) === 'not-a-real-key' && get_option(REPGET_OPTION_STATUS) === 'invalid_key'
    && get_option(REPGET_OPTION_CONNECTION, null) === null);
$_POST = array('repget_save' => '1', 'repget_key' => 'x');
$GLOBALS['valid_nonces'] = array();
$r = run('repget_settings_page');
check('Save and connect without its nonce is refused', $r['kind'] === 'died' && get_option(REPGET_OPTION_KEY) === 'not-a-real-key');
reset_all();
$html = run('repget_settings_page')['html'];
check('the #repget_key prefill is still there when no link is present', strpos($html, 'repget_key=([^&]*)') !== false && strpos($html, 'advanced.open = true') !== false);

echo "\nPUBLISH ARTICLES AS: moves posts WITHOUT claiming due articles\n";
reset_all();
update_option(REPGET_OPTION_KEY, 'old-key');
$GLOBALS['posts'][10] = array('ID' => 10, 'post_type' => 'post', 'post_status' => 'publish');
$GLOBALS['posts'][11] = array('ID' => 11, 'post_type' => 'post', 'post_status' => 'draft');
$GLOBALS['posts'][12] = array('ID' => 12, 'post_type' => 'post', 'post_status' => 'publish'); // not RepGet's
update_post_meta(10, REPGET_META_ARTICLE, 'a10');
update_post_meta(11, REPGET_META_ARTICLE, 'a11');
set_transient(REPGET_VERIFY_CACHE, array('state' => 'connected', 'for' => repget_key_fingerprint(), 'workspace' => 'Old Co', 'domain' => 'site.test', 'website' => 'Site', 'websiteId' => 'w-old', 'connected_at' => 1), 300);
$_POST = array('repget_save_post_type' => '1', 'repget_post_type' => 'custom_post');
$GLOBALS['valid_nonces'] = array('repget_post_type');
$html = run('repget_settings_page')['html'];
check('the setting is saved', get_option(REPGET_OPTION_POST_TYPE) === 'custom_post');
check('RepGet\'s posts moved, nobody else\'s', $GLOBALS['posts'][10]['post_type'] === 'custom_post' && $GLOBALS['posts'][11]['post_type'] === 'custom_post' && $GLOBALS['posts'][12]['post_type'] === 'post');
check('GET /api/plugin/articles (the claiming call) was NOT made', count(calls_to('/api/plugin/articles')) === 0);
$reports = calls_to('/api/plugin/published');
check('new addresses reported through /api/plugin/published, not as deliveries', count($reports) === 2
    && $reports[0]['body']['url'] === 'https://site.test/custom_post/10' && !isset($reports[0]['body']['dispatchId'])
    && $reports[1]['body']['status'] === 'draft', json_encode($reports));
check('the notice says how many moved', strpos($html, 'Moved 2 existing articles to Editorial (custom_post).') !== false);
$_POST = array('repget_save_post_type' => '1', 'repget_post_type' => 'nonexistent');
run('repget_settings_page');
check('an unknown content type is refused', get_option(REPGET_OPTION_POST_TYPE) === 'custom_post');

echo "\nUPDATES: only a strictly newer version is offered\n";
$make_manifest = function ($version, $sha = null) {
    return array('version' => $version, 'package' => '/repget-connector.zip', 'sha256' => $sha ?: hash('sha256', 'zip-bytes'),
        'requires' => '5.6', 'requires_php' => '7.4', 'tested' => '6.8', 'changelog' => "* One.\n* Two,\n  wrapped.");
};
$plugin = 'repget-connector/repget-connector.php';
foreach (array('1.7.1' => true, '1.10.0' => true, '2.0' => true, '1.7.0' => false, '1.6.9' => false, '1.7.0-beta' => false) as $version => $offered) {
    reset_all();
    $GLOBALS['manifest'] = $make_manifest($version);
    $t = repget_offer_update((object) array('response' => array(), 'no_update' => array(), 'checked' => array($plugin => REPGET_VERSION)));
    $has = isset($t->response[$plugin]);
    check(($offered ? 'offered: ' : 'not offered: ') . $version, $has === $offered);
    if ($offered && $has) {
        check("...{$version} downloads from RepGet's host", $t->response[$plugin]->package === 'https://app.test/repget-connector.zip' && $t->response[$plugin]->new_version === $version && $t->response[$plugin]->slug === 'repget-connector');
    }
}
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.0');
$t = repget_offer_update((object) array('response' => array($plugin => (object) array('new_version' => '9.9.9', 'package' => 'https://elsewhere.test/x.zip')), 'no_update' => array()));
check('an offer for this plugin from anywhere else is removed', !isset($t->response[$plugin]) && isset($t->no_update[$plugin]));
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1');
// Right after updating to 1.7.1, the 1.7.0 code still in memory runs this once more.
$t = repget_offer_update((object) array('response' => array(), 'no_update' => array(), 'checked' => array($plugin => '1.7.1')));
check('the version just installed is not offered again by the old code in memory', !isset($t->response[$plugin]) && $t->no_update[$plugin]->new_version === '1.7.1');
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1');
$GLOBALS['disk_version'] = '1.7.1';
// WordPress's first save after an update starts from an empty object: no ->checked at all.
$t = repget_offer_update(new stdClass());
check('...nor on WordPress\'s first save, which carries no ->checked: the file on disk decides', !isset($t->response[$plugin]) && $t->no_update[$plugin]->new_version === '1.7.1');
unset($GLOBALS['disk_version']);
$t = repget_offer_update(new stdClass());
check('...while the file on disk is still the old version, the update is offered', isset($t->response[$plugin]) && $t->response[$plugin]->new_version === '1.7.1');
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1');
repget_offer_update(new stdClass());
repget_offer_update(new stdClass());
check('the manifest is cached (one request for two checks)', count(calls_to('/repget-connector.json')) === 1);
$GLOBALS['clock'] = 12 * HOUR_IN_SECONDS;
repget_offer_update(new stdClass());
check('...for 12 hours', count(calls_to('/repget-connector.json')) === 2);
reset_all();
$t = repget_offer_update((object) array('response' => array()));
check('no manifest (404): nothing offered', empty($t->response));
check('false passes through', repget_offer_update(false) === false);
foreach (array('bad sha' => array('version' => '9.0', 'package' => '/repget-connector.zip', 'sha256' => 'abc'),
               'protocol-relative package' => array('version' => '9.0', 'package' => '//evil.test/x.zip', 'sha256' => str_repeat('a', 64)),
               'odd version' => array('version' => '9.0; rm', 'package' => '/repget-connector.zip', 'sha256' => str_repeat('a', 64))) as $label => $bad) {
    reset_all();
    $GLOBALS['manifest'] = $bad;
    $t = repget_offer_update((object) array('response' => array()));
    check("a manifest with a {$label} is ignored", empty($t->response));
}

echo "\nUPDATES: plugin details for this slug only\n";
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1');
$info = repget_plugin_details(false, 'plugin_information', (object) array('slug' => 'repget-connector'));
check('details for repget-connector', is_object($info) && $info->version === '1.7.1' && $info->download_link === 'https://app.test/repget-connector.zip');
check('...changelog escaped into a list', is_object($info) && $info->sections['changelog'] === '<ul><li>One.</li><li>Two, wrapped.</li></ul>', is_object($info) ? $info->sections['changelog'] : '');
check('another slug passes through untouched', repget_plugin_details(false, 'plugin_information', (object) array('slug' => 'akismet')) === false);
check('another action passes through untouched', repget_plugin_details(false, 'query_plugins', (object) array('slug' => 'repget-connector')) === false);
reset_all();
check('no manifest: an error, never a WordPress.org lookup', is_wp_error(repget_plugin_details(false, 'plugin_information', (object) array('slug' => 'repget-connector'))));

echo "\nUPDATES: the download is refused unless its SHA-256 matches\n";
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1');
$file = repget_verified_download(false, 'https://app.test/repget-connector.zip', null, array());
check('matching hash: the downloaded file is handed to WordPress', is_string($file) && file_exists($file) && file_get_contents($file) === 'zip-bytes');
if (is_string($file)) @unlink($file);
check('...checked against a FRESH manifest', count(calls_to('/repget-connector.json')) === 1);
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1', hash('sha256', 'something else'));
$GLOBALS['package_bytes'] = 'tampered zip';
$result = repget_verified_download(false, 'https://app.test/repget-connector.zip', null, array());
check('mismatch: refused with a WP_Error', is_wp_error($result) && $result->get_error_code() === 'repget_package_mismatch');
check('...and the downloaded file is deleted', count($GLOBALS['downloaded_files']) === 1 && !file_exists($GLOBALS['downloaded_files'][0]));
reset_all();
check('another plugin\'s package is not touched', repget_verified_download(false, 'https://downloads.wordpress.org/plugin/akismet.zip', null, array()) === false && count($GLOBALS['downloads']) === 0 && count($GLOBALS['calls']) === 0);
check('a reply already decided by another filter is kept', repget_verified_download('/tmp/other.zip', 'https://app.test/repget-connector.zip') === '/tmp/other.zip');
reset_all();
$result = repget_verified_download(false, 'https://app.test/repget-connector.zip', null, array());
check('no manifest to check against: refused, not installed unchecked', is_wp_error($result) && count($GLOBALS['downloads']) === 0);
reset_all();
$GLOBALS['manifest'] = $make_manifest('1.7.1');
repget_update_manifest();                       // cached copy
$GLOBALS['manifest'] = null;                    // RepGet unreachable at download time
$file = repget_verified_download(false, 'https://app.test/repget-connector.zip');
check('RepGet unreachable at download: the cached manifest\'s hash is used', is_string($file) && file_exists($file));
if (is_string($file)) @unlink($file);

echo "\nTHE PUBLISHED MANIFEST describes the published zip\n";
$public = dirname(dirname(dirname(realpath($plugin_path)))) . '/public';
$json = @file_get_contents($public . '/repget-connector.json');
$zip = @file_get_contents($public . '/repget-connector.zip');
$published = is_string($json) ? json_decode($json, true) : null;
check('public/repget-connector.json exists and parses', is_array($published));
check('...its version is the plugin\'s', is_array($published) && $published['version'] === REPGET_VERSION);
check('...its sha256 is the zip\'s', is_array($published) && is_string($zip) && $published['sha256'] === hash('sha256', $zip));
check('...its package is /repget-connector.zip', is_array($published) && $published['package'] === '/repget-connector.zip');
check('...and the plugin accepts it', is_array($published) && repget_clean_manifest($published) !== null);

echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
