<?php
/**
 * Issue 10 under GENUINE concurrency: separate PHP processes against one real
 * WordPress + MySQL, released together at a barrier so they overlap.
 *
 *   php wordpress-plugin/tests/real-wordpress-concurrency.php <wordpress dir> <plugin file> <plugin 1.5.0 file>
 *
 * The WordPress dir must be a DISPOSABLE install (install-wordpress.php).
 * RepGet is faked inside every worker (concurrency/worker.php); nothing is
 * sent anywhere and nothing is published.
 *
 * Asserts, per scenario: the number of posts, each post's publication
 * identity (guid and meta), the acknowledgement state (the fake RepGet queue,
 * the ack log, the plugin's pending acks) and who owns the lock.
 */

if ($argc < 4) {
    fwrite(STDERR, "usage: php real-wordpress-concurrency.php <wordpress dir> <plugin file> <plugin 1.5.0 file>\n");
    exit(2);
}
[$script, $wpdir, $pluginFile, $legacyPluginFile] = $argv;
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
require rtrim($wpdir, '/\\') . '/wp-load.php';
require $pluginFile;

global $wpdb;
$STATE = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'repget-concurrency-' . getmypid();
$WORKER = __DIR__ . DIRECTORY_SEPARATOR . 'concurrency' . DIRECTORY_SEPARATOR . 'worker.php';
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
function lock_value() {
    global $wpdb;
    return $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", REPGET_LOCK));
}
function repget_posts() {
    global $wpdb;
    // Every post RepGet made, whichever version made it: by identity guid or by meta.
    return array_map('intval', $wpdb->get_col($wpdb->prepare(
        "SELECT DISTINCT p.ID FROM {$wpdb->posts} p
         LEFT JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = %s
         WHERE p.post_type NOT IN ('revision', 'attachment')
           AND (p.guid LIKE 'https://repget.invalid/articles/%%' OR m.meta_id IS NOT NULL)
         ORDER BY p.ID",
        REPGET_META_ARTICLE
    )));
}
function posts_for($articleId) {
    return array_values(array_filter(repget_posts(), function ($id) use ($articleId) {
        return get_post_meta($id, REPGET_META_ARTICLE, true) === $articleId
            || get_post_field('guid', $id) === repget_identity_guid($articleId);
    }));
}
function reset_world(array $queue, $ackFailures = 0) {
    global $wpdb, $STATE;
    foreach (repget_posts() as $id) wp_delete_post($id, true);
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s", REPGET_LOCK));
    delete_option(REPGET_OPTION_PENDING_ACK);
    delete_transient('repget_sync_running');
    update_option(REPGET_OPTION_KEY, 'test-key-not-real');
    wp_cache_flush();
    if (is_dir($STATE)) {
        foreach (glob($STATE . DIRECTORY_SEPARATOR . '*') as $file) unlink($file);
    } else {
        mkdir($STATE, 0777, true);
    }
    $articles = array();
    foreach ($queue as $id) $articles[$id] = array('id' => $id, 'title' => "Article {$id}", 'html' => '<p>x</p>', 'status' => 'publish');
    file_put_contents(state('queue.json'), json_encode($articles));
    if ($ackFailures > 0) file_put_contents(state('ack-fail'), (string) $ackFailures);
}
function spawn($id, $scenario, array $env = array(), $plugin = null) {
    global $WORKER, $wpdir, $pluginFile, $STATE;
    $cmd = array(PHP_BINARY, $WORKER, $wpdir, $plugin ?: $pluginFile, $STATE, (string) $id, $scenario);
    $environment = array_merge(getenv(), $env);
    $proc = proc_open($cmd, array(
        0 => array('pipe', 'r'),
        1 => array('file', state("out-{$id}.txt"), 'w'),
        2 => array('file', state("err-{$id}.txt"), 'w'),
    ), $pipes, null, $environment);
    fclose($pipes[0]);
    return $proc;
}
function wait_file($name, $timeout = 60) {
    $deadline = microtime(true) + $timeout;
    while (!file_exists(state($name))) {
        if (microtime(true) > $deadline) return false;
        usleep(2000);
    }
    return true;
}
function release_together(array $ids) {
    foreach ($ids as $id) {
        if (!wait_file("ready-{$id}")) return false;
    }
    touch(state('go'));
    return true;
}
function finish(array $procs, $timeout = 90) {
    $deadline = microtime(true) + $timeout;
    foreach ($procs as $id => $proc) {
        while (proc_get_status($proc)['running']) {
            if (microtime(true) > $deadline) {
                proc_terminate($proc, 9);
                break;
            }
            usleep(5000);
        }
        proc_close($proc);
    }
}
function result($id) {
    $file = state("result-{$id}.json");
    return file_exists($file) ? json_decode(file_get_contents($file), true) : null;
}
function acks() {
    $file = state('acks.log');
    return file_exists($file) ? array_map(function ($line) { return json_decode($line, true); },
        array_filter(explode("\n", file_get_contents($file)))) : array();
}
function queue_left() {
    return array_keys(json_decode(file_get_contents(state('queue.json')), true) ?: array());
}
function age_lock() {
    global $wpdb;
    list($token) = repget_lock_parse(lock_value());
    $wpdb->query($wpdb->prepare(
        "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s",
        $token . '|' . (time() - REPGET_LOCK_TTL - 5), REPGET_LOCK
    ));
    wp_cache_flush();
}

echo "\nWordPress " . get_bloginfo('version') . ', MySQL ' . $wpdb->db_version() . ', PHP ' . PHP_VERSION . "\n";

// ---------------------------------------------------------------------------
echo "\n1. EIGHT processes race for the lock at once\n";
reset_world(array());
$procs = array();
foreach (range(1, 8) as $id) $procs[$id] = spawn($id, 'acquire');
check('all eight reached the barrier', release_together(array_keys($procs)));
finish($procs);
$won = array_filter(range(1, 8), function ($id) { $r = result($id); return $r && $r['acquired']; });
check('exactly one acquired it', count($won) === 1, '(' . count($won) . ')');
check('every process answered', count(array_filter(range(1, 8), 'result')) === 8);
check('the winner released it', lock_value() === null);

// ---------------------------------------------------------------------------
echo "\n2. SAME-SECOND renewals by the owner while four others try to take the lock\n";
reset_world(array());
$procs = array('h' => spawn('h', 'renew-loop'));
check('holder took the lock first', wait_file('holder-ready'));
foreach (range(1, 4) as $id) $procs[$id] = spawn($id, 'acquire');
check('all released together', release_together(array('h', 1, 2, 3, 4)));
finish($procs);
$holder = result('h');
check('the holder renewed many times, every answer owned',
    $holder && $holder['total'] > 10 && array_keys($holder['answers']) === array('owned'),
    json_encode($holder));
check('none of the four took it', count(array_filter(range(1, 4), function ($id) { return result($id)['acquired']; })) === 0);
check('released at the end', lock_value() === null);

// ---------------------------------------------------------------------------
echo "\n3. OVERLAPPING entry points: remote nudge, cron and two manual checks\n";
reset_world(array('o1', 'o2', 'o3', 'o4'));
$slow = array('REPGET_TEST_SLOW_MS' => '300');
$procs = array('remote' => spawn('remote', 'remote', $slow), 'cron' => spawn('cron', 'cron', $slow),
    'm1' => spawn('m1', 'manual', $slow), 'm2' => spawn('m2', 'manual', $slow));
check('all released together', release_together(array_keys($procs)));
finish($procs);
$writers = array_unique(array_map(function ($a) { return $a['worker']; }, acks()));
check('exactly one process did the work', count($writers) === 1, json_encode($writers));
foreach (array('o1', 'o2', 'o3', 'o4') as $article) {
    $ids = posts_for($article);
    check("one post for {$article}, carrying its identity",
        count($ids) === 1 && get_post_field('guid', $ids[0]) === repget_identity_guid($article)
            && get_post_meta($ids[0], REPGET_META_ARTICLE, true) === $article,
        '(' . count($ids) . ')');
}
check('all acknowledged, nothing left queued', queue_left() === array() && count(acks()) === 4);
$refused = array_filter(array('m1', 'm2'), function ($id) { $r = result($id); return isset($r['error']) && $r['error'] === 'repget_busy'; });
$remote = result('remote');
check('the others were refused as busy', count($refused) + (isset($remote['response']['data']['error']) && $remote['response']['data']['error'] === 'busy' ? 1 : 0) >= 2,
    json_encode(array('manual' => array(result('m1'), result('m2')), 'remote' => $remote)));
check('lock released', lock_value() === null);

// ---------------------------------------------------------------------------
echo "\n4. LEASE TAKEOVER: a stalled owner cannot renew or release the new owner's lock\n";
reset_world(array('t1', 't2'));
$stale = spawn('A', 'hold');
check('A holds the lock', wait_file('held-token-A'));
age_lock(); // A stalls past its lease
$takeover = spawn('B', 'manual');
touch(state('go'));
finish(array('B' => $takeover));
check('B stole the expired lease and published', count(posts_for('t1')) === 1 && count(posts_for('t2')) === 1 && queue_left() === array(), json_encode(result('B')));
$new = spawn('C', 'hold');
check('C now holds the lock', wait_file('held-token-C'));
$cToken = file_get_contents(state('held-token-C'));
touch(state('resume-A'));
finish(array('A' => $stale));
check('A learns it lost the lease', (result('A')['renewal'] ?? null) === 'lost', json_encode(result('A')));
check("A's release left C's lock in place", strpos((string) lock_value(), $cToken . '|') === 0);
touch(state('resume-C'));
finish(array('C' => $new));
check('C still owned it', (result('C')['renewal'] ?? null) === 'owned');
check('and released it', lock_value() === null);

// ---------------------------------------------------------------------------
echo "\n5. A PROCESS KILLED between the post row and its meta\n";
reset_world(array('k1'));
$doomed = spawn('K', 'crash');
check('it reached the point between row and meta', wait_file('at-crash'));
proc_terminate($doomed, 9);
finish(array('K' => $doomed));
wp_cache_flush();
$rows = $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE guid = %s", repget_identity_guid('k1')));
check('the row exists with its identity guid', count($rows) === 1);
check('its meta was never written', $rows && get_post_meta((int) $rows[0], REPGET_META_ARTICLE, true) === '');
check('the dead process still holds the lock (no clean-up ran)', lock_value() !== null);
age_lock();
$recover = spawn('R', 'manual');
touch(state('go'));
finish(array('R' => $recover));
wp_cache_flush();
check('recovery published into the SAME post', posts_for('k1') === array((int) $rows[0]), json_encode(posts_for('k1')));
check('meta repaired', get_post_meta((int) $rows[0], REPGET_META_ARTICLE, true) === 'k1');
check('acknowledged, lock released', queue_left() === array() && lock_value() === null);

// ---------------------------------------------------------------------------
echo "\n6. ACKNOWLEDGEMENTS FAIL, then two processes retry together\n";
reset_world(array('a1', 'a2', 'a3'), 3);
$first = spawn('F', 'manual');
touch(state('go'));
finish(array('F' => $first));
wp_cache_flush();
check('three posts made', count(repget_posts()) === 3);
check('all three acks failed and were parked', count(get_option(REPGET_OPTION_PENDING_ACK, array())) === 3 && count(queue_left()) === 3);
unlink(state('go'));
$procs = array('x' => spawn('x', 'manual', $slow), 'y' => spawn('y', 'cron', $slow));
check('released together', release_together(array('x', 'y')));
finish($procs);
wp_cache_flush();
check('still three posts', count(repget_posts()) === 3, '(' . count(repget_posts()) . ')');
check('parked acks delivered, nothing queued', queue_left() === array() && count(get_option(REPGET_OPTION_PENDING_ACK, array())) === 0);
check('lock released', lock_value() === null);

// ---------------------------------------------------------------------------
echo "\n7. UPGRADE: posts made by plugin 1.5.0 are updated, not duplicated\n";
reset_world(array('u1', 'u2'), 2);
$legacy = spawn('L', 'legacy-150', array(), $legacyPluginFile);
touch(state('go'));
finish(array('L' => $legacy));
wp_cache_flush();
$old = repget_posts();
check('1.5.0 made two posts', count($old) === 2, json_encode(result('L')));
check('with meta and an ordinary permalink guid', count(array_filter($old, function ($id) {
    return get_post_meta($id, REPGET_META_ARTICLE, true) !== '' && strpos(get_post_field('guid', $id), 'repget.invalid') === false;
})) === 2);
unlink(state('go'));
$current = spawn('N', 'manual');
touch(state('go'));
finish(array('N' => $current));
wp_cache_flush();
check('the current plugin updated the same two posts', repget_posts() === $old, json_encode(repget_posts()));
check('acknowledged against the existing post ids', queue_left() === array()
    && count(array_filter(acks(), function ($a) use ($old) { return !$a['failed'] && in_array((int) $a['post'], $old, true); })) === 2);
check('lock released', lock_value() === null);

reset_world(array());
echo "\n" . ($failures === 0 ? 'ALL PASSED' : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
