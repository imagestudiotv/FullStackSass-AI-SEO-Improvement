<?php
/**
 * A Publish press on a WordPress draft (1.10.0) against a REAL WordPress.
 *
 *   php wordpress-plugin/tests/real-wordpress-draft-publish.php <wordpress dir> <plugin file>
 *
 * The WordPress dir needs a wp-config.php pointing at a DISPOSABLE database,
 * installed with install-wordpress.php; this script writes posts and options.
 * Never point it at a real site. RepGet is never contacted: every outbound
 * request the plugin makes is answered by a pre_http_request filter here.
 *
 * What it shows, with WordPress's own saving, trash and publishing:
 *  - an unchanged draft goes live as the same post, with its text untouched,
 *    a real date and address, and WordPress's publish hooks run once;
 *  - a draft edited in any way a reader would see is refused and left exactly
 *    as it is; pressing Save with no change is not an edit;
 *  - a newer approved revision is written to the same post, only if unchanged;
 *  - a lost report, a repeated hand-over or a double press make no second post;
 *  - trashed, deleted, published and otherwise-decided posts are reported as
 *    they are and never written to;
 *  - a draft from before this plugin kept a record goes live only if it holds
 *    exactly what RepGet sends;
 *  - a real save fired between the check and the write survives, on every path
 *    that writes over a post, and the outcome says so. That proves the order, in
 *    one process: real-wordpress-concurrency.php proves it across processes.
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php real-wordpress-draft-publish.php <wordpress dir> <plugin file>\n");
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
define('STORE', 'https://store.test/storage/v1/object/public/article-images/');
$GLOBALS['jpeg'] = base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gNzAK/9sAQwAKBwcIBwYKCAgICwoKCw4YEA4NDQ4dFRYRGCMfJSQiHyIhJis3LyYpNCkhIjBBMTQ5Oz4+PiUuRElDPEg3PT47/9sAQwEKCwsODQ4cEBAcOygiKDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7/8AAEQgAEgAgAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8Amooor5U+mCiiigAooooAKKKKAP/Z');
$GLOBALS['queue'] = array();
$GLOBALS['storage'] = array();
$GLOBALS['reports'] = array();
$GLOBALS['report_works'] = true;
update_option(REPGET_OPTION_KEY, 'test-key-not-real');
add_filter('pre_http_request', function ($pre, $args, $url) {
    $reply = function ($code, $body) use ($args) {
        return array(
            'headers' => array(), 'body' => $body, 'cookies' => array(),
            'response' => array('code' => $code, 'message' => 'OK'),
            'filename' => isset($args['filename']) ? $args['filename'] : null,
        );
    };
    if (strpos($url, STORE) === 0) {
        if (!empty($args['stream']) && !empty($args['filename'])) {
            file_put_contents($args['filename'], $GLOBALS['jpeg']);
        }
        return $reply(200, '');
    }
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === '/api/plugin/articles') {
        return $reply(200, wp_json_encode(array('ok' => true, 'storage' => $GLOBALS['storage'], 'articles' => array_values($GLOBALS['queue']))));
    }
    if ($path === '/api/plugin/published') {
        if (!$GLOBALS['report_works']) {
            return new WP_Error('http', 'RepGet did not answer');
        }
        $sent = json_decode($args['body'], true);
        $GLOBALS['reports'][] = $sent;
        unset($GLOBALS['queue'][$sent['articleId']]);
        return $reply(200, wp_json_encode(array('ok' => true)));
    }
    return $reply(200, '{}');
}, 10, 3);

function uuid() { return wp_generate_uuid4(); }
const HTML = '<h2>Heading</h2><p>A <a href="https://example.com/a">link</a> &amp; some <strong>text</strong>.</p><p>Second "paragraph".</p>';
function handover($id, $revision, $extra = array()) {
    return array_merge(array(
        'id' => $id, 'title' => 'A title: with punctuation', 'slug' => "article-{$id}", 'html' => HTML,
        'excerpt' => 'An excerpt', 'status' => 'draft', 'dispatch' => array('id' => uuid(), 'revision' => $revision),
    ), $extra);
}
function press($id, $revision, $extra = array(), $delivered = true) {
    return handover($id, $revision, array_merge(array('status' => 'publish', 'existingDraft' => array('delivered' => $delivered)), $extra));
}
function sync($item) {
    $GLOBALS['queue'][$item['id']] = $item;
    $r = repget_sync_locked();
    if (is_wp_error($r)) echo '  sync: ' . $r->get_error_code() . "\n";
    return $r;
}
function last_report() { return end($GLOBALS['reports']); }
function row($id) { clean_post_cache($id); return get_post($id); }
function posts_of($id) {
    global $wpdb;
    return array_map('intval', $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} WHERE guid = %s AND post_type <> 'revision'", repget_identity_guid($id)
    )));
}
function clear_state() {
    global $wpdb;
    $ids = $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE guid LIKE 'https://repget.invalid/articles/%'");
    foreach ($ids as $id) wp_delete_post((int) $id, true);
    delete_option(REPGET_OPTION_PENDING_ACK);
    $GLOBALS['queue'] = array();
    $GLOBALS['reports'] = array();
    $GLOBALS['storage'] = array();
    $GLOBALS['report_works'] = true;
}
/** A draft as RepGet's automatic "drafts" mode leaves it. */
function delivered_draft($id, $revision = 'r1', $extra = array()) {
    sync(handover($id, $revision, $extra));
    $found = repget_find_post($id);
    check("  (setup) {$id} is a draft", get_post_status($found) === 'draft');
    return $found;
}
function refused_as($outcome, $reason) {
    $last = last_report();
    check($reason, $last['outcome'] === $outcome && $last['url'] === null, json_encode($last));
}
/** Every column of a post a press could change, to prove it did not. */
function snapshot($id) {
    $post = (array) row($id);
    unset($post['filter']);
    return wp_json_encode($post) . '|' . get_post_thumbnail_id($id);
}

$transitions = array();
add_action('transition_post_status', function ($new, $old, $post) use (&$transitions) {
    if ($new === 'publish' && $old === 'draft') $transitions[] = $post->ID;
}, 10, 3);

echo "\nWordPress " . get_bloginfo('version') . ", database " . $wpdb->db_version() . "\n";

echo "\nAN UNCHANGED DRAFT: live, the same post, the text untouched\n";
clear_state();
$post = delivered_draft('u1');
$before = row($post);
check('a draft has no GMT date yet', $before->post_date_gmt === '0000-00-00 00:00:00');
$transitions = array();
sync(press('u1', 'r1'));
$after = row($post);
check('it is live', $after->post_status === 'publish');
check('the same post, and only one', posts_of('u1') === array($post), wp_json_encode(posts_of('u1')));
check('text, title and excerpt are byte for byte what they were',
    $after->post_content === $before->post_content && $after->post_title === $before->post_title && $after->post_excerpt === $before->post_excerpt);
check('it has a real date now', $after->post_date_gmt !== '0000-00-00 00:00:00' && abs(strtotime($after->post_date_gmt . ' UTC') - time()) < 300);
check('its address is the one RepGet asked for', $after->post_name === 'article-u1');
check("WordPress's publish hooks ran once", $transitions === array($post), wp_json_encode($transitions));
$last = last_report();
check('reported live with the post id', $last['status'] === 'publish' && (int) $last['remoteId'] === $post && empty($last['error']));
check('reported with its real address, on this hand-over', $last['url'] === get_permalink($post) && !empty($last['dispatchId']));
check('nothing outstanding', count(repget_pending_acks()) === 0);

echo "\nPRESSED TWICE, OR REPLAYED AFTER IT WENT LIVE: nothing changes\n";
$snap = snapshot($post);
$transitions = array();
sync(press('u1', 'r1'));
check('still one post', posts_of('u1') === array($post));
check('not published again', $transitions === array());
check('not touched', snapshot($post) === $snap);
$last = last_report();
check('reported live, and not as if somebody else published it', $last['status'] === 'publish' && !isset($last['outcome']), json_encode($last));

echo "\nTHE REPORT IS LOST: the next check confirms it, with no second post\n";
clear_state();
$post = delivered_draft('l1');
$GLOBALS['report_works'] = false;
$transitions = array();
$first = press('l1', 'r1');
sync($first);
check('live on the site though RepGet has not heard', get_post_status($post) === 'publish');
check('the report is parked', count(repget_pending_acks()) === 1);
$GLOBALS['report_works'] = true;
$GLOBALS['reports'] = array();
sync(press('l1', 'r1'));
check('the parked report went out first, with its own hand-over', $GLOBALS['reports'][0]['dispatchId'] === $first['dispatch']['id'] && $GLOBALS['reports'][0]['status'] === 'publish');
check('nothing outstanding', count(repget_pending_acks()) === 0);
check('one post, published once', posts_of('l1') === array($post) && $transitions === array($post));

echo "\nA PROCESS KILLED AFTER THE POST WENT LIVE, BEFORE ANY REPORT\n";
clear_state();
$post = delivered_draft('k1');
$die = function () { throw new RuntimeException('process killed'); };
add_action('wp_after_insert_post', $die);
try { sync(press('k1', 'r1')); check('the crash happened', false); } catch (RuntimeException $e) { check('the crash happened', true); }
remove_action('wp_after_insert_post', $die);
repget_lock_release(explode('|', (string) repget_lock_read())[0]);
check('it is live', get_post_status($post) === 'publish');
sync(press('k1', 'r1'));
check('one post', posts_of('k1') === array($post));
$last = last_report();
check('reported live', $last['status'] === 'publish' && $last['url'] === get_permalink($post));

echo "\nAN EDITED DRAFT: not published, not overwritten\n";
$edits = array(
    'the text' => function ($id) { wp_update_post(array('ID' => $id, 'post_content' => HTML . '<p>An editor wrote this.</p>')); },
    'the title' => function ($id) { wp_update_post(array('ID' => $id, 'post_title' => 'A better title')); },
    'the excerpt' => function ($id) { wp_update_post(array('ID' => $id, 'post_excerpt' => 'A better excerpt')); },
    'the address' => function ($id) { wp_update_post(array('ID' => $id, 'post_name' => 'a-better-address')); },
    'the letter case of the text' => function ($id) { wp_update_post(array('ID' => $id, 'post_content' => str_replace('Heading', 'HEADING', HTML))); },
    'the date' => function ($id) { wp_update_post(array('ID' => $id, 'post_date' => '2040-01-01 10:00:00', 'post_date_gmt' => '2040-01-01 10:00:00', 'edit_date' => true, 'post_status' => 'draft')); },
);
foreach ($edits as $what => $edit) {
    clear_state();
    $post = delivered_draft('e1');
    $edit($post);
    $snap = snapshot($post);
    $transitions = array();
    sync(press('e1', 'r1'));
    check("{$what}: refused", last_report()['outcome'] === 'draft_changed' && last_report()['url'] === null, json_encode(last_report()));
    check("{$what}: still a draft", get_post_status($post) === 'draft' && $transitions === array());
    check("{$what}: exactly as the editor left it", snapshot($post) === $snap);
    check("{$what}: one post", posts_of('e1') === array($post));
    check("{$what}: the refusal is not parked to be retried", count(repget_pending_acks()) === 0);
}

echo "\nTHE FEATURED IMAGE CHANGED IN WORDPRESS\n";
clear_state();
$post = delivered_draft('t1');
$attachment = wp_insert_attachment(array('post_title' => 'mine', 'post_status' => 'inherit', 'post_mime_type' => 'image/jpeg'), 'mine.jpg');
set_post_thumbnail($post, $attachment);
$snap = snapshot($post);
sync(press('t1', 'r1'));
refused_as('draft_changed', 'refused');
check('left as it is', snapshot($post) === $snap);
wp_delete_attachment($attachment, true);

echo "\nPRESSING SAVE IN WORDPRESS WITH NO CHANGE is not an edit\n";
clear_state();
$post = delivered_draft('s1');
sleep(1);
wp_update_post(array('ID' => $post));
check('(WordPress moved the modified time)', row($post)->post_modified_gmt !== '0000-00-00 00:00:00');
sync(press('s1', 'r1'));
check('published', get_post_status($post) === 'publish' && last_report()['status'] === 'publish' && !isset(last_report()['outcome']), json_encode(last_report()));

echo "\nAN EDITOR SAVES WHILE THE PRESS IS BEING CHECKED\n";
clear_state();
$post = delivered_draft('r1');
$race = function ($slug) use ($post) {
    global $wpdb;
    $wpdb->update($wpdb->posts, array('post_content' => HTML . '<p>Saved just now.</p>'), array('ID' => $post));
    clean_post_cache($post);
    return $slug;
};
add_filter('wp_unique_post_slug', $race);
sync(press('r1', 'r1'));
remove_filter('wp_unique_post_slug', $race);
refused_as('draft_changed', 'refused');
check('still a draft, the save kept', get_post_status($post) === 'draft' && strpos(row($post)->post_content, 'Saved just now') !== false);

echo "\nA NEWER APPROVED REVISION: written to the same post, then live\n";
clear_state();
$post = delivered_draft('n1', 'r1');
$transitions = array();
sync(press('n1', 'r2', array('title' => 'The approved title', 'html' => '<p>The approved text.</p>')));
$after = row($post);
check('the same post, and only one', posts_of('n1') === array($post));
check('exactly that revision', $after->post_title === 'The approved title' && $after->post_content === '<p>The approved text.</p>');
check('live', $after->post_status === 'publish' && $transitions === array($post));
check('reported live', last_report()['status'] === 'publish' && !isset(last_report()['outcome']));
check('remembered as that revision', get_post_meta($post, REPGET_META_WRITTEN, true)['revision'] === 'r2');

echo "\nA NEWER APPROVED REVISION OF AN EDITED DRAFT: nothing is written\n";
clear_state();
$post = delivered_draft('n2', 'r1');
wp_update_post(array('ID' => $post, 'post_content' => '<p>An editor wrote this.</p>'));
$snap = snapshot($post);
sync(press('n2', 'r2', array('title' => 'The approved title', 'html' => '<p>The approved text.</p>')));
refused_as('draft_changed', 'refused');
check('neither published nor overwritten', snapshot($post) === $snap);

echo "\nA TRASHED POST: left in the trash, nothing created\n";
clear_state();
$post = delivered_draft('t2');
wp_trash_post($post);
$snap = snapshot($post);
sync(press('t2', 'r1'));
refused_as('post_trashed', 'reported as trashed');
check('still in the trash, untouched', get_post_status($post) === 'trash' && snapshot($post) === $snap);
check('no second post', posts_of('t2') === array($post));
wp_untrash_post($post);
wp_update_post(array('ID' => $post, 'post_status' => 'draft'));
sync(press('t2', 'r1'));
check('restored as it was, a new press publishes it', get_post_status($post) === 'publish', json_encode(last_report()));

echo "\nA DELETED POST: nothing created\n";
clear_state();
$post = delivered_draft('d1');
wp_delete_post($post, true);
sync(press('d1', 'r1'));
refused_as('post_deleted', 'reported as deleted');
check('no post was made', posts_of('d1') === array());

echo "\nPUBLISHED BY SOMEBODY IN WORDPRESS: recorded as it is, not overwritten\n";
clear_state();
$post = delivered_draft('p1');
wp_update_post(array('ID' => $post, 'post_status' => 'publish', 'post_content' => '<p>Edited, then published here.</p>'));
$snap = snapshot($post);
$transitions = array();
sync(press('p1', 'r2', array('title' => 'The approved title', 'html' => '<p>The approved text.</p>')));
$last = last_report();
check('reported live, saying who', $last['status'] === 'publish' && $last['outcome'] === 'published_in_wordpress' && $last['url'] === get_permalink($post), json_encode($last));
check('its text is theirs', snapshot($post) === $snap);
check('one post', posts_of('p1') === array($post));

echo "\nSCHEDULED, PENDING OR PRIVATE IN WORDPRESS: somebody decided, and it stays\n";
foreach (array('pending', 'private') as $state) {
    clear_state();
    $post = delivered_draft('o1');
    wp_update_post(array('ID' => $post, 'post_status' => $state));
    $snap = snapshot($post);
    sync(press('o1', 'r1'));
    refused_as('draft_changed', "{$state}: refused");
    check("{$state}: as it was", snapshot($post) === $snap);
}
clear_state();
$post = delivered_draft('o2');
wp_update_post(array('ID' => $post, 'post_status' => 'future', 'post_date' => '2040-01-01 10:00:00', 'post_date_gmt' => '2040-01-01 10:00:00', 'edit_date' => true));
check('(WordPress holds it as scheduled)', get_post_status($post) === 'future');
sync(press('o2', 'r1'));
refused_as('draft_changed', 'scheduled: refused');
check('scheduled: still scheduled', get_post_status($post) === 'future');

echo "\nA DRAFT FROM BEFORE THE RECORD (written by 1.9.0 or older)\n";
clear_state();
$post = delivered_draft('o3');
delete_post_meta($post, REPGET_META_WRITTEN);
$before = row($post);
sync(press('o3', 'r1'));
check('holds exactly what RepGet sends: published', get_post_status($post) === 'publish' && last_report()['status'] === 'publish', json_encode(last_report()));
check('the same post, its text as it was', posts_of('o3') === array($post) && row($post)->post_content === $before->post_content);

clear_state();
$post = delivered_draft('o4');
delete_post_meta($post, REPGET_META_WRITTEN);
wp_update_post(array('ID' => $post, 'post_content' => HTML . '<p>An editor wrote this.</p>'));
$snap = snapshot($post);
sync(press('o4', 'r1'));
refused_as('draft_unverified', 'differs from what RepGet sends: cannot be confirmed');
check('neither published nor overwritten', snapshot($post) === $snap);

clear_state();
$post = delivered_draft('o5');
delete_post_meta($post, REPGET_META_WRITTEN);
$attachment = wp_insert_attachment(array('post_title' => 'mine', 'post_status' => 'inherit', 'post_mime_type' => 'image/jpeg'), 'mine.jpg');
set_post_thumbnail($post, $attachment);
sync(press('o5', 'r1'));
refused_as('draft_unverified', 'a featured image RepGet did not set: cannot be confirmed');
wp_delete_attachment($attachment, true);

clear_state();
$post = delivered_draft('o6');
delete_post_meta($post, REPGET_META_WRITTEN);
$snap = snapshot($post);
sync(press('o6', 'r2', array('html' => '<p>A newer approved text.</p>')));
refused_as('draft_unverified', 'a newer revision over an unrecorded draft: refused rather than overwritten');
check('left as it is', snapshot($post) === $snap);

echo "\nTWO DRAFTS WANTING ONE ADDRESS: the second goes live under a unique one\n";
clear_state();
$a = delivered_draft('a1', 'r1', array('slug' => 'same-address'));
$b = delivered_draft('a2', 'r1', array('slug' => 'same-address'));
sync(press('a1', 'r1', array('slug' => 'same-address')));
sync(press('a2', 'r1', array('slug' => 'same-address')));
check('both live, with different addresses', get_post_status($a) === 'publish' && get_post_status($b) === 'publish' && row($a)->post_name !== row($b)->post_name, row($a)->post_name . ' ' . row($b)->post_name);
check('the second reports its real address', last_report()['url'] === get_permalink($b));

echo "\nA DRAFT WITH NO SLUG FROM REPGET goes live with one\n";
clear_state();
$post = delivered_draft('a3', 'r1', array('slug' => null));
check('(a draft may have none)', row($post)->post_name === '');
sync(press('a3', 'r1', array('slug' => null)));
check('live, named after its title', get_post_status($post) === 'publish' && row($post)->post_name === 'a-title-with-punctuation', row($post)->post_name);

echo "\nA PICTURE COPIED LATER IS THIS PLUGIN'S OWN WRITE, not an edit\n";
clear_state();
$picture = STORE . 'w/a/hero.jpg';
$post = delivered_draft('i1', 'r1', array('html' => '<p>x</p><img src="' . $picture . '" alt="A view">'));
check('(the picture still loads from RepGet)', strpos(row($post)->post_content, STORE) !== false);
$GLOBALS['storage'] = array(STORE);
sync(press('zz', 'r1', array('existingDraft' => null, 'status' => 'draft')));
check('(a later check copied it into the post)', strpos(row($post)->post_content, STORE) === false, row($post)->post_content);
$GLOBALS['queue'] = array();
sync(press('i1', 'r1', array('html' => '<p>x</p><img src="' . $picture . '" alt="A view">')));
check('still counts as unchanged: published', get_post_status($post) === 'publish' && !isset(last_report()['outcome']), json_encode(last_report()));
clear_state();
foreach (get_posts(array('post_type' => 'attachment', 'post_status' => 'any', 'posts_per_page' => 20, 'fields' => 'ids')) as $id) wp_delete_attachment($id, true);

echo "\nNO PRESS: what automatic hand-overs and new articles do is unchanged\n";
clear_state();
$post = delivered_draft('c1');
sync(handover('c1', 'r2', array('title' => 'Sent again', 'status' => 'publish')));
check('an existing draft is updated and stays a draft, as before', get_post_status($post) === 'draft' && row($post)->post_title === 'Sent again' && !isset(last_report()['outcome']));
clear_state();
sync(press('c2', 'r1', array(), false));
$made = repget_find_post('c2');
check('a press on an article never delivered creates its one post, live', $made > 0 && get_post_status($made) === 'publish' && posts_of('c2') === array($made));

// ------------------------------------------------- writing over a post (1.10.0) --
/** Runs $save once, the first time $hook fires for this post itself: never for a revision. */
function save_at($hook, $save) {
    $fired = false;
    $callback = function ($value = null, $second = null) use (&$fired, &$callback, $hook, $save) {
        $type = is_array($value) && isset($value['post_type']) ? $value['post_type'] : (is_array($second) && isset($second['post_type']) ? $second['post_type'] : 'post');
        if (!$fired && $type !== 'revision') {
            $fired = true;
            $save();
        }
        return $value;
    };
    add_filter($hook, $callback, 10, 2);
    return $callback;
}
function live_press($id, $revision, $extra = array()) {
    return handover($id, $revision, array_merge(array('status' => 'publish', 'existingPost' => array('delivered' => true), 'title' => 'The approved title', 'html' => '<p>The approved text.</p>'), $extra));
}
function live_post($id, $revision = 'r1', $extra = array()) {
    sync(handover($id, $revision, array_merge(array('status' => 'publish'), $extra)));
    $found = repget_find_post($id);
    check("  (setup) {$id} is live", get_post_status($found) === 'publish');
    return $found;
}
$saves = array();
add_action('save_post', function ($id) use (&$saves) { $saves[] = (int) $id; });
$updated = array();
add_action('post_updated', function ($id) use (&$updated) { $updated[] = (int) $id; });

echo "\nA SAVE LANDING BETWEEN THE CHECK AND THE WRITE survives, on every path that writes\n";
// wp_insert_post_data: while the columns are worked out. pre_post_update: the last thing before the UPDATE.
foreach (array('wp_insert_post_data', 'pre_post_update') as $hook) {
    $paths = array(
        'a newer revision on a press on a draft' => array(function ($id) { return delivered_draft($id, 'r1'); }, function ($id) { return press($id, 'r2', array('title' => 'The approved title', 'html' => '<p>The approved text.</p>')); }, 'draft_changed'),
        'a press on a live post' => array(function ($id) { return live_post($id); }, function ($id) { return live_press($id, 'r2'); }, 'post_changed'),
        'a hand-over nobody pressed' => array(function ($id) { return live_post($id); }, function ($id) { return handover($id, 'r2', array('status' => 'publish', 'title' => 'The approved title', 'html' => '<p>The approved text.</p>')); }, 'published_in_wordpress'),
    );
    foreach ($paths as $what => list($make, $hand, $outcome)) {
        foreach (array('the text' => array('post_content' => '<p>Saved this very moment.</p>'), 'the letter case of the title' => array('post_title' => 'A TITLE: WITH PUNCTUATION'), 'the excerpt' => array('post_excerpt' => 'Saved this very moment'), 'the address' => array('post_name' => 'saved-this-very-moment'), 'the password' => array('post_password' => 'saved')) as $column => $change) {
            clear_state();
            $post = $make('x1');
            $status = get_post_status($post);
            $written_before = get_post_meta($post, REPGET_META_WRITTEN, true);
            $callback = save_at($hook, function () use ($post, $change) { wp_update_post(array_merge(array('ID' => $post), $change)); });
            $transitions = array();
            sync($hand('x1'));
            remove_filter($hook, $callback, 10);
            $after = row($post);
            $key = array_keys($change)[0];
            check("{$hook}, {$what}, {$column}: the save stands", $after->$key === $change[$key] && strpos($after->post_content, 'The approved text') === false, wp_json_encode($after));
            check("{$hook}, {$what}, {$column}: outcome {$outcome}", last_report()['outcome'] === $outcome, wp_json_encode(last_report()));
            check("{$hook}, {$what}, {$column}: its status as it was, one post", get_post_status($post) === $status && $transitions === array() && posts_of('x1') === array($post));
            check("{$hook}, {$what}, {$column}: the record does not take it for this plugin's own", get_post_meta($post, REPGET_META_WRITTEN, true) === $written_before);
        }
    }
}

echo "\nA SAVE LANDING WHILE A DRAFT IS MADE LIVE: not published with it unseen\n";
foreach (array('the text' => array('post_content' => '<p>Saved this very moment.</p>'), 'the excerpt' => array('post_excerpt' => 'Saved this very moment'), 'the password' => array('post_password' => 'saved')) as $column => $change) {
    clear_state();
    $post = delivered_draft('x2');
    $callback = save_at('wp_unique_post_slug', function () use ($post, $change) { wp_update_post(array_merge(array('ID' => $post), $change)); });
    $transitions = array();
    sync(press('x2', 'r1'));
    remove_filter('wp_unique_post_slug', $callback, 10);
    $key = array_keys($change)[0];
    check("{$column}: refused, still a draft, the save stands", last_report()['outcome'] === 'draft_changed' && get_post_status($post) === 'draft' && $transitions === array() && row($post)->$key === $change[$key], wp_json_encode(last_report()));
}

echo "\nA FEATURED IMAGE: outside the row, so outside the swap\n";
$attachment = wp_insert_attachment(array('post_title' => 'mine', 'post_status' => 'inherit', 'post_mime_type' => 'image/jpeg'), 'mine.jpg');
clear_state();
$post = live_post('x3');
$callback = save_at('wp_insert_post_data', function () use ($post, $attachment) { set_post_thumbnail($post, $attachment); });
sync(live_press('x3', 'r2'));
remove_filter('wp_insert_post_data', $callback, 10);
check('chosen before the last look at it: refused, and it stays', last_report()['outcome'] === 'post_changed' && (int) get_post_thumbnail_id($post) === $attachment && strpos(row($post)->post_content, 'The approved text') === false, wp_json_encode(last_report()));
clear_state();
$post = live_post('x4');
$callback = save_at('pre_post_update', function () use ($post, $attachment) { set_post_thumbnail($post, $attachment); });
sync(live_press('x4', 'r2'));
remove_filter('pre_post_update', $callback, 10);
check('chosen in the instant after it: NOT seen by the swap, the text goes in, the picture is kept', (int) get_post_thumbnail_id($post) === $attachment && strpos(row($post)->post_content, 'The approved text') !== false);
wp_delete_attachment($attachment, true);

echo "\nA PRESS ON A LIVE POST, UNCHANGED: written as WordPress would write it\n";
clear_state();
$tricky = array('title' => 'Quotes "and" an emoji \u{1F600} &amp; more', 'html' => '<h2 id="a">Heading</h2><p>"Quoted" &amp; 100% <em>done</em>\u{1F600}</p><script>alert(1)</script>', 'excerpt' => 'An <b>excerpt</b> & more', 'slug' => 'The Approved Address');
$post = live_post('w1');
$old = row($post);
$saves = array();
$updated = array();
$transitions = array();
sync(live_press('w1', 'r2', $tricky));
$after = row($post);
$fields = array('post_title' => sanitize_text_field($tricky['title']), 'post_content' => wp_kses_post($tricky['html']), 'post_excerpt' => sanitize_text_field($tricky['excerpt']), 'post_name' => sanitize_title($tricky['slug']));
$control = wp_insert_post(array('post_title' => 'x', 'post_status' => 'publish', 'post_content' => 'y'));
wp_update_post($fields + array('ID' => $control));
$same = row($control);
check('the same post, and only one', posts_of('w1') === array($post));
check('the stored bytes are what wp_update_post stores', $after->post_title === $same->post_title && $after->post_content === $same->post_content && $after->post_excerpt === $same->post_excerpt, wp_json_encode(array($after, $same)));
check('...and the address the same way', strpos($after->post_name, 'the-approved-address') === 0, $after->post_name);
wp_delete_post($control, true);
check('it stays live, reported live', $after->post_status === 'publish' && last_report()['status'] === 'publish' && !isset(last_report()['outcome']), wp_json_encode(last_report()));
check('its modified time moved', $after->post_modified_gmt !== '0000-00-00 00:00:00');
check('save_post and post_updated ran once for it', count(array_keys($saves, $post, true)) === 1 && count(array_keys($updated, $post, true)) === 1, wp_json_encode(array($saves, $updated)));
check('on record as that revision, as it stands', get_post_meta($post, REPGET_META_WRITTEN, true)['revision'] === 'r2' && repget_written_current($post) !== null);
$kept = array_map(function ($revision) { return $revision->post_content; }, wp_get_post_revisions($post));
check('what it replaced is kept as a revision', in_array($old->post_content, $kept, true), wp_json_encode($kept));
check('...and so is what it wrote, once', count(array_keys($kept, $after->post_content, true)) === 1, wp_json_encode($kept));
check('the old address still leads here', in_array($old->post_name, get_post_meta($post, '_wp_old_slug'), true), wp_json_encode(get_post_meta($post, '_wp_old_slug')));

echo "\nTHE SAME REVISION AGAIN, ITS REPORT LOST: nothing written twice\n";
clear_state();
$post = live_post('w2');
$GLOBALS['report_works'] = false;
sync(live_press('w2', 'r2'));
check('written, the report parked', strpos(row($post)->post_content, 'The approved text') !== false && count(repget_pending_acks()) === 1);
$GLOBALS['report_works'] = true;
$GLOBALS['reports'] = array();
$snap = snapshot($post);
$versions = count(wp_get_post_revisions($post));
$saves = array();
sync(live_press('w2', 'r2'));
check('the parked report goes first, and RepGet then has nothing to send', count($GLOBALS['reports']) === 1 && count(repget_pending_acks()) === 0, wp_json_encode($GLOBALS['reports']));
// The process died before it could park anything: RepGet hands the same revision over again.
sync(live_press('w2', 'r2'));
check('handed over again all the same: reported live', count($GLOBALS['reports']) === 2 && last_report()['status'] === 'publish' && !isset(last_report()['outcome']), wp_json_encode($GLOBALS['reports']));
check('not written again: every column as it was, no revision, no save', snapshot($post) === $snap && count(wp_get_post_revisions($post)) === $versions && !in_array($post, $saves, true));
check('one post', posts_of('w2') === array($post));

echo "\nA LIVE POST EDITED IN WORDPRESS: refused, not overwritten\n";
clear_state();
$post = live_post('w3');
wp_update_post(array('ID' => $post, 'post_content' => '<p>An editor wrote this.</p>'));
$snap = snapshot($post);
sync(live_press('w3', 'r2'));
refused_as('post_changed', 'refused');
check('left exactly as it was', snapshot($post) === $snap && count(repget_pending_acks()) === 0);
sync(live_press('w3', 'r1'));
check('the revision it was sent as: reported as somebody\'s, not written', last_report()['outcome'] === 'published_in_wordpress' && snapshot($post) === $snap, wp_json_encode(last_report()));
clear_state();
$post = live_post('w4');
sleep(1);
wp_update_post(array('ID' => $post));
sync(live_press('w4', 'r2'));
check('pressing Save with no change is not an edit', strpos(row($post)->post_content, 'The approved text') !== false && !isset(last_report()['outcome']), wp_json_encode(last_report()));

echo "\nA LIVE POST FROM BEFORE THE RECORD: proved, or refused\n";
clear_state();
$post = live_post('w5');
delete_post_meta($post, REPGET_META_WRITTEN);
$snap = snapshot($post);
sync(live_press('w5', 'r2'));
refused_as('post_unverified', 'a newer revision cannot be proved: refused');
check('left as it was', snapshot($post) === $snap);
sync(handover('w5', 'r1', array('status' => 'publish', 'existingPost' => array('delivered' => true))));
check('holding exactly what RepGet sends: reported, not written, on record from now', !isset(last_report()['outcome']) && last_report()['status'] === 'publish' && snapshot($post) === $snap && get_post_meta($post, REPGET_META_WRITTEN, true)['revision'] === 'r1', wp_json_encode(last_report()));

echo "\nSOMEBODY HAS IT OPEN IN WORDPRESS: an advisory lock, respected\n";
clear_state();
$post = delivered_draft('w6');
$editor = get_users(array('number' => 1, 'fields' => 'ID'))[0];
update_post_meta($post, '_edit_lock', time() . ':' . $editor);
$snap = snapshot($post);
sync(press('w6', 'r1'));
refused_as('post_locked', 'a draft open: not published');
check('left as it was', get_post_status($post) === 'draft' && snapshot($post) === $snap);
clear_state();
$post = live_post('w7');
update_post_meta($post, '_edit_lock', time() . ':' . $editor);
$snap = snapshot($post);
sync(live_press('w7', 'r2'));
refused_as('post_locked', 'a live post open: not written');
check('left as it was', snapshot($post) === $snap);
update_post_meta($post, '_edit_lock', (time() - 300) . ':' . $editor);
sync(live_press('w7', 'r2'));
check('a lock gone stale is no lock', strpos(row($post)->post_content, 'The approved text') !== false, wp_json_encode(last_report()));

echo "\nA LIVE POST TRASHED OR DELETED: nothing brought back\n";
clear_state();
$post = live_post('w8');
wp_trash_post($post);
$snap = snapshot($post);
sync(live_press('w8', 'r2'));
refused_as('update_trashed', 'in the trash');
check('still there, untouched', get_post_status($post) === 'trash' && snapshot($post) === $snap);
wp_delete_post($post, true);
sync(live_press('w8', 'r2'));
refused_as('update_deleted', 'deleted');
check('no new post', posts_of('w8') === array());

echo "\nA HAND-OVER NOBODY PRESSED, ITS LAST REPORT LOST\n";
clear_state();
$post = live_post('w9');
$snap = snapshot($post);
sync(handover('w9', 'r1', array('status' => 'publish')));
check('the same revision: reported, not written', snapshot($post) === $snap && last_report()['status'] === 'publish' && !isset(last_report()['outcome']), wp_json_encode(last_report()));
wp_update_post(array('ID' => $post, 'post_content' => '<p>An editor wrote this.</p>'));
$snap = snapshot($post);
sync(handover('w9', 'r2', array('status' => 'publish', 'html' => '<p>Newer.</p>')));
check('edited, a newer revision: not written, reported so it is not offered again', snapshot($post) === $snap && last_report()['outcome'] === 'published_in_wordpress' && last_report()['url'] === get_permalink($post), wp_json_encode(last_report()));
clear_state();
$post = delivered_draft('w10');
wp_update_post(array('ID' => $post, 'post_content' => '<p>An editor wrote this.</p>'));
$snap = snapshot($post);
sync(handover('w10', 'r2', array('status' => 'publish', 'html' => '<p>Newer.</p>')));
check('an edited draft: not written, still a draft, reported as one', snapshot($post) === $snap && last_report()['status'] === 'draft' && !isset(last_report()['outcome']), wp_json_encode(last_report()));
clear_state();
$post = live_post('w11');
delete_post_meta($post, REPGET_META_WRITTEN);
$snap = snapshot($post);
sync(handover('w11', 'r2', array('status' => 'publish', 'html' => '<p>Newer.</p>')));
check('no record, and not what RepGet sends: not written', snapshot($post) === $snap && last_report()['outcome'] === 'published_in_wordpress', wp_json_encode(last_report()));
clear_state();
$post = live_post('w12');
wp_trash_post($post);
$snap = snapshot($post);
sync(handover('w12', 'r2', array('status' => 'publish', 'html' => '<p>Newer.</p>')));
check('in the trash: not written, nothing brought back, reported as it stands', snapshot($post) === $snap && last_report()['status'] === 'trash' && posts_of('w12') === array($post), wp_json_encode(last_report()));

clear_state();
echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
