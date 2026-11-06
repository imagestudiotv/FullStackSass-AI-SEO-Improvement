<?php
/**
 * One WordPress process for the concurrency tests (run by
 * real-wordpress-concurrency.php, never by hand against a real site).
 *
 *   php worker.php <wordpress dir> <plugin file> <state dir> <worker id> <scenario>
 *
 * Loads the real WordPress and the plugin, answers the plugin's calls to
 * RepGet from a fake API whose state (the article queue, the ack log, an
 * injectable ack failure count) lives in <state dir> behind a file lock so
 * every process sees the same RepGet. Nothing leaves the machine.
 *
 * Every worker waits at a barrier (ready-<id>, then `go`) so that workers
 * started together really overlap.
 */

[$script, $wpdir, $pluginFile, $stateDir, $workerId, $scenario] = $argv;
$GLOBALS['workerId'] = $workerId;
$GLOBALS['stateDir'] = $stateDir;

define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
require rtrim($wpdir, '/\\') . '/wp-load.php';
require $pluginFile;

function state_path($name) {
    return $GLOBALS['stateDir'] . DIRECTORY_SEPARATOR . $name;
}
function with_api_lock($fn) {
    $handle = fopen(state_path('api.lock'), 'c');
    flock($handle, LOCK_EX);
    try {
        return $fn();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
function queue_read() {
    $file = state_path('queue.json');
    return file_exists($file) ? (json_decode(file_get_contents($file), true) ?: array()) : array();
}
function result($data) {
    file_put_contents(state_path('result-' . $GLOBALS['workerId'] . '.json'), json_encode($data));
}
function barrier() {
    touch(state_path('ready-' . $GLOBALS['workerId']));
    $deadline = microtime(true) + 60;
    while (!file_exists(state_path('go'))) {
        if (microtime(true) > $deadline) {
            fwrite(STDERR, "barrier timeout\n");
            exit(3);
        }
        usleep(500);
    }
}
function wait_for($name) {
    $deadline = microtime(true) + 60;
    while (!file_exists(state_path($name))) {
        if (microtime(true) > $deadline) exit(4);
        usleep(1000);
    }
}

// ------------------------------------------------------------ fake RepGet --
add_filter('pre_http_request', function ($pre, $args, $url) {
    $path = parse_url($url, PHP_URL_PATH);
    $body = with_api_lock(function () use ($path, $args) {
        if ($path === '/api/plugin/articles') {
            return array('articles' => array_values(queue_read()));
        }
        if ($path === '/api/plugin/published') {
            $sent = json_decode($args['body'], true);
            $failFile = state_path('ack-fail');
            $remaining = file_exists($failFile) ? (int) file_get_contents($failFile) : 0;
            file_put_contents(state_path('acks.log'), json_encode(array(
                'worker' => $GLOBALS['workerId'],
                'article' => $sent['articleId'],
                'post' => $sent['remoteId'],
                'failed' => $remaining > 0,
            )) . PHP_EOL, FILE_APPEND);
            if ($remaining > 0) {
                file_put_contents($failFile, (string) ($remaining - 1));
                return null;
            }
            $queue = queue_read();
            unset($queue[$sent['articleId']]);
            file_put_contents(state_path('queue.json'), json_encode($queue));
            return array('ok' => true);
        }
        return array();
    });
    if ($body === null) {
        return array('headers' => array(), 'body' => '{"error":"unavailable"}',
            'response' => array('code' => 503, 'message' => 'Service Unavailable'), 'cookies' => array(), 'filename' => null);
    }
    return array('headers' => array(), 'body' => wp_json_encode($body),
        'response' => array('code' => 200, 'message' => 'OK'), 'cookies' => array(), 'filename' => null);
}, 10, 3);

// Widen the window each post write takes, so overlapping syncs really overlap.
$slow = (int) getenv('REPGET_TEST_SLOW_MS');
if ($slow > 0) {
    add_filter('wp_insert_post_data', function ($data) use ($slow) {
        usleep($slow * 1000);
        return $data;
    });
}

// ---------------------------------------------------------------- scenarios --
switch ($scenario) {
    case 'acquire':
        barrier();
        $token = repget_lock_acquire();
        result(array('acquired' => $token !== null));
        if ($token !== null) {
            usleep(1500000);
            repget_lock_release($token);
        }
        break;

    case 'renew-loop':
        // Takes the lock, then renews it as fast as it can while others try to take it.
        $token = repget_lock_acquire();
        touch(state_path('holder-ready'));
        barrier();
        $answers = array();
        $until = microtime(true) + 1.5;
        while (microtime(true) < $until) $answers[] = repget_lock_renew($token);
        repget_lock_release($token);
        result(array('answers' => array_count_values($answers), 'total' => count($answers)));
        break;

    case 'manual':
        barrier();
        $r = repget_sync_locked();
        result(is_wp_error($r) ? array('error' => $r->get_error_code()) : array('created' => $r));
        break;

    case 'cron':
        barrier();
        repget_cron_sync();
        result(array('ran' => true));
        break;

    case 'remote':
        // The signed nudge RepGet sends to admin-ajax.php.
        $_POST['ts'] = (string) time();
        $_POST['sig'] = hash_hmac('sha256', $_POST['ts'], hash('sha256', trim(repget_key())));
        add_filter('wp_die_handler', function () {
            return function ($message) {
                exit(0);
            };
        });
        ob_start(function ($out) {
            result(array('response' => json_decode($out, true)));
            return '';
        });
        barrier();
        repget_remote_sync();
        break;

    case 'hold':
        // Takes the lock, then stalls until told to continue.
        $token = repget_lock_acquire();
        file_put_contents(state_path('held-token-' . $GLOBALS['workerId']), (string) $token);
        wait_for('resume-' . $GLOBALS['workerId']);
        $renewal = repget_lock_renew($token);
        repget_lock_release($token);
        result(array('renewal' => $renewal));
        break;

    case 'crash':
        // Dies between the post row and its meta: set_object_terms fires in between.
        add_action('set_object_terms', function () {
            touch(state_path('at-crash'));
            sleep(120);
        });
        repget_sync_locked();
        break;

    case 'legacy-150':
        // The plugin as released in 1.5.0 (loaded instead of the current file).
        $r = repget_sync();
        result(is_wp_error($r) ? array('error' => $r->get_error_code()) : array('created' => $r));
        break;

    default:
        fwrite(STDERR, "unknown scenario {$scenario}\n");
        exit(2);
}
