<?php
/**
 * Pictures (1.8.0, 1.9.0) against a REAL WordPress and a REAL MySQL.
 *
 *   php wordpress-plugin/tests/real-wordpress-images.php <wordpress dir> <plugin file>
 *
 * The WordPress dir needs a wp-config.php pointing at a DISPOSABLE database,
 * installed with install-wordpress.php; this script writes posts, media files
 * and options. Never point it at a real site. RepGet is never contacted: the
 * check's answer and every picture download are served by a pre_http_request
 * filter here.
 *
 * What it shows, with WordPress's own media handling:
 *  - an article's RepGet pictures are copied into the media library under
 *    readable names (what each shows; the header after the article), belong
 *    to the post, and the post shows the copies with WordPress's attachment
 *    class - every other attribute kept, other sites' pictures left alone;
 *  - an update, another article or the next check reuses a copy and never
 *    downloads it again;
 *  - posts published before 1.8.0 are brought up to date in place, their
 *    dates and revisions untouched, and an edit saved meanwhile is never
 *    overwritten;
 *  - a picture that keeps failing is tried once per check, given up after
 *    three, and its post is not looked at again until it changes;
 *  - what the time budget does not allow waits for the next check;
 *  - 1.9.0: the site's own photographs (RepGet's "Use photos from my
 *    website") are used where they are - the featured image is the
 *    attachment, found by the id RepGet sends or by its address - and never
 *    copied or changed.
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php real-wordpress-images.php <wordpress dir> <plugin file>\n");
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

// ------------------------------------------------- fake RepGet and storage --
define('STORE', 'https://store.test/storage/v1/object/public/article-images/');
// Real picture bytes (32 x 18), so WordPress's own file-type checks run for real.
$GLOBALS['jpeg'] = base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gNzAK/9sAQwAKBwcIBwYKCAgICwoKCw4YEA4NDQ4dFRYRGCMfJSQiHyIhJis3LyYpNCkhIjBBMTQ5Oz4+PiUuRElDPEg3PT47/9sAQwEKCwsODQ4cEBAcOygiKDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7/8AAEQgAEgAgAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8Amooor5U+mCiiigAooooAKKKKAP/Z');
$GLOBALS['png'] = base64_decode('iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAJElEQVQ4y2M8UaHBQEvAxEBjMGrBqAWjFoxaMGrBqAUMDAwMABdMAYz1Nnc2AAAAAElFTkSuQmCC');
$GLOBALS['queue'] = array();
$GLOBALS['storage'] = array(STORE);
$GLOBALS['downloads'] = array();   // address => times downloaded
$GLOBALS['missing'] = array();     // addresses that answer 404
$GLOBALS['on_download'] = null;    // runs just before a picture is served
update_option(REPGET_OPTION_KEY, 'test-key-not-real');

add_filter('pre_http_request', function ($pre, $args, $url) {
    $reply = function ($code, $body, $headers = array()) use ($args) {
        return array(
            'headers' => $headers, 'body' => $body, 'cookies' => array(),
            'response' => array('code' => $code, 'message' => $code === 200 ? 'OK' : 'Not Found'),
            'filename' => isset($args['filename']) ? $args['filename'] : null,
        );
    };
    if (strpos($url, STORE) === 0 || strpos($url, 'https://elsewhere.test/') === 0) {
        $GLOBALS['downloads'][$url] = downloads($url) + 1;
        if ($GLOBALS['on_download']) {
            call_user_func($GLOBALS['on_download'], $url);
        }
        if (in_array($url, $GLOBALS['missing'], true)) {
            return $reply(404, '');
        }
        $png = substr(parse_url($url, PHP_URL_PATH), -4) === '.png';
        $bytes = $png ? $GLOBALS['png'] : $GLOBALS['jpeg'];
        // download_url() streams to a file: WordPress writes it only for a real request.
        if (!empty($args['stream']) && !empty($args['filename'])) {
            file_put_contents($args['filename'], $bytes);
        }
        return $reply(200, empty($args['stream']) ? $bytes : '', array('content-type' => $png ? 'image/png' : 'image/jpeg'));
    }
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === '/api/plugin/articles') {
        return $reply(200, wp_json_encode(array('ok' => true, 'storage' => $GLOBALS['storage'], 'articles' => array_values($GLOBALS['queue']))));
    }
    if ($path === '/api/plugin/published') {
        $sent = json_decode($args['body'], true);
        unset($GLOBALS['queue'][$sent['articleId']]);
        return $reply(200, wp_json_encode(array('ok' => true)));
    }
    return $reply(200, '{}');
}, 10, 3);

/** How often `$html` names attachment `$id`'s class (wp-image-12 is not wp-image-1). */
function classed($html, $id) {
    return preg_match_all('/\bwp-image-' . (int) $id . '(?!\d)/', (string) $html);
}
function downloads($url) {
    return isset($GLOBALS['downloads'][$url]) ? $GLOBALS['downloads'][$url] : 0;
}
function article($id, $html, $extra = array()) {
    return array_merge(array(
        'id' => $id, 'title' => 'Building a Music Video Production Crew: Key Roles', 'slug' => 'music-video-crew',
        'html' => $html, 'status' => 'publish', 'dispatch' => array('id' => wp_generate_uuid4(), 'revision' => 'r'),
    ), $extra);
}
function post_for($article_id) {
    $id = repget_find_post($article_id);
    return $id > 0 ? get_post($id) : null;
}
function file_of($attachment_id) {
    return wp_basename((string) get_attached_file((int) $attachment_id));
}
function attachments() {
    return get_posts(array('post_type' => 'attachment', 'post_status' => 'any', 'posts_per_page' => -1, 'fields' => 'ids', 'suppress_filters' => true));
}
/** A post as 1.7 left it: tagged as RepGet's, its pictures loading from RepGet, dated in the past. */
function older_post($article_id, $html, $name) {
    global $wpdb;
    $id = wp_insert_post(array('post_title' => 'Older ' . $name, 'post_name' => $name, 'post_status' => 'publish', 'post_content' => $html, 'meta_input' => array(REPGET_META_ARTICLE => $article_id)));
    $wpdb->update($wpdb->posts, array('post_modified' => '2026-10-01 10:00:00', 'post_modified_gmt' => '2026-10-01 10:00:00'), array('ID' => $id));
    clean_post_cache($id);
    return $id;
}
function reset_state() {
    global $wpdb;
    $ids = $wpdb->get_col($wpdb->prepare("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s", REPGET_META_ARTICLE));
    $ids = array_merge($ids, $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE guid LIKE 'https://repget.invalid/articles/%' OR post_title = 'Not RepGet'"));
    foreach (array_unique(array_map('intval', $ids)) as $id) wp_delete_post($id, true);
    foreach (attachments() as $id) wp_delete_attachment($id, true);
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s", REPGET_LOCK));
    delete_option(REPGET_OPTION_PENDING_ACK);
    delete_option(REPGET_OPTION_IMAGE_FAILURES);
    $GLOBALS['queue'] = array();
    $GLOBALS['storage'] = array(STORE);
    $GLOBALS['downloads'] = array();
    $GLOBALS['missing'] = array();
    $GLOBALS['on_download'] = null;
}

echo "\nWordPress " . get_bloginfo('version') . ", MySQL " . $wpdb->db_version() . "\n";

echo "\nNAMES: the rule RepGet uses (lib/publishing/image-names.test.ts has the same examples)\n";
check('what the picture shows', repget_image_name('Director coordinating a music video shoot', 'x') === 'director-coordinating-a-music-video-shoot');
check('accents dropped', repget_image_name("Sposi all'alba sul Lago di Como, è magia", 'x') === 'sposi-all-alba-sul-lago-di-como-e-magia');
check('letters spelled out', repget_image_name('Straße & Œuvre: Ærø', 'x') === 'strasse-oeuvre-aero', repget_image_name('Straße & Œuvre: Ærø', 'x'));
check('Spanish', repget_image_name('Fotógrafo en la ceremonia, niño', 'x') === 'fotografo-en-la-ceremonia-nino');
check('cut between words within 60', repget_image_name('Director coordinating a music video shoot on a busy city street at golden hour', 'x') === 'director-coordinating-a-music-video-shoot-on-a-busy-city');
check('one long word cut at 60', repget_image_name(str_repeat('a', 80), 'x') === str_repeat('a', 60));
check('no text: the fallback', repget_image_name('', 'building-a-music-video-crew-2') === 'building-a-music-video-crew-2' && repget_image_name('  ...  ', 'crew-1') === 'crew-1');
check('digits only: the fallback', repget_image_name('2026', 'crew-1') === 'crew-1');
check('never empty', repget_image_name('', '') === 'image' && repget_image_name('日本語', '日本語') === 'image');
check('entities decoded', repget_image_name('Rock &amp; roll', 'x') === 'rock-roll');

echo "\nSTORAGE: only https prefixes ending in a slash count\n";
check('valid kept, the rest dropped', repget_storage_prefixes(array('storage' => array('http://a.test/p/', 'https://a.test/p', 'https://ok.test/p/', 7, 'https://ok.test/p/'))) === array('https://ok.test/p/'));
check('none sent: none', repget_storage_prefixes(array('articles' => array())) === array());

echo "\nTAGS: the rewrite is exact\n";
$t = repget_retarget_image("<img alt=\"a > b, src=x\" class=\"hero wp-image-7\" src='" . STORE . "a.jpg' srcset=\"" . STORE . "a.jpg 2x\" sizes=\"100vw\" width=1280 />", 'https://wp.test/wp-content/uploads/a.jpg', 42);
check('src replaced, srcset and sizes gone, classes kept, the rest as written', $t === '<img alt="a > b, src=x" class="hero wp-image-42" src="https://wp.test/wp-content/uploads/a.jpg" width=1280 />', $t);
$found = array();
preg_match_all(repget_img_pattern(), '<p>x</p><img alt="1 > 0" src="' . STORE . 'b.jpg"><p>y</p>', $found);
check('a ">" inside a value does not end the tag', $found[0] === array('<img alt="1 > 0" src="' . STORE . 'b.jpg">'));

echo "\nA NEW ARTICLE: its pictures are copied before it is written\n";
reset_state();
$a = STORE . 'site/art/1791986572090-96wum8.jpg';
$b = STORE . 'site/art/1791986573111-ab12cd.png';
$h = STORE . 'site/art/1791986570000-header.jpg';
$html = '<h2>Roles</h2><p>Who does what.</p>'
    . '<img src="' . $a . '" alt="Director coordinating a music video shoot" width="1280" height="720" loading="eager" decoding="async" style="max-width:100%;height:auto">'
    . '<h2>Budget</h2><p>What it costs.</p><img src="' . $b . '" alt="" width="800" height="450" loading="lazy" decoding="async" style="max-width:100%;height:auto">'
    . '<p>Their own photo:</p><img src="https://elsewhere.test/own.jpg" alt="Own">'
    . '<p>Again:</p><img src="' . $a . '" alt="Director coordinating a music video shoot">';
$GLOBALS['queue']['n1'] = article('n1', $html, array('image' => array('url' => $h, 'alt' => 'A film crew at work')));
$r = repget_sync_locked();
check('sync completed', $r === 1, is_wp_error($r) ? $r->get_error_message() : var_export($r, true));
$post = post_for('n1');
$content = $post ? $post->post_content : '';
$copy_a = repget_find_image($a);
$copy_b = repget_find_image($b);
$copy_h = repget_find_image($h);
check('no RepGet address left in the post', $post && strpos($content, STORE) === false, $content);
check('each RepGet picture has a copy', $copy_a > 0 && $copy_b > 0 && $copy_h > 0);
check('...named after what it shows', file_of($copy_a) === 'director-coordinating-a-music-video-shoot.jpg', file_of($copy_a));
check('...or, with no alt text, after the article and its place in it', file_of($copy_b) === 'music-video-crew-2.png', file_of($copy_b));
check('the header is named after the article, and is the featured image', file_of($copy_h) === 'music-video-crew.jpg' && $post && (int) get_post_thumbnail_id($post->ID) === $copy_h, file_of($copy_h));
check('the alt text is on the copy', get_post_meta($copy_a, '_wp_attachment_image_alt', true) === 'Director coordinating a music video shoot');
check('the copies belong to the post', $post && (int) get_post_field('post_parent', $copy_a) === $post->ID && (int) get_post_field('post_parent', $copy_b) === $post->ID);
check('the post shows the copies, with WordPress\'s attachment class',
    strpos($content, 'src="' . wp_get_attachment_url($copy_a) . '"') !== false && classed($content, $copy_a) === 2 && classed($content, $copy_b) === 1, $content);
check('...everything else about a picture is kept', strpos($content, 'width="1280" height="720"') !== false && strpos($content, 'style="max-width:100%;height:auto"') !== false, $content);
check('another site\'s picture is left alone, and not downloaded', strpos($content, 'src="https://elsewhere.test/own.jpg"') !== false && downloads('https://elsewhere.test/own.jpg') === 0);
check('a picture used twice was downloaded once', downloads($a) === 1);
$shown = apply_filters('the_content', $content);
check('WordPress recognises its attachment when it shows the post', classed($shown, $copy_a) > 0 && strpos($shown, wp_get_attachment_url($copy_a)) !== false);

echo "\nAN UPDATE uses the copies already made\n";
$media = count(attachments());
$GLOBALS['queue']['n1'] = article('n1', $html . '<p>A new closing line.</p>', array('image' => array('url' => $h, 'alt' => 'A film crew at work')));
repget_sync_locked();
$post = post_for('n1');
check('the update arrived', $post && strpos($post->post_content, 'A new closing line.') !== false);
check('...showing the copies', $post && strpos($post->post_content, STORE) === false && classed($post->post_content, $copy_a) > 0);
check('nothing downloaded again, no new media', downloads($a) === 1 && downloads($b) === 1 && downloads($h) === 1 && count(attachments()) === $media);

echo "\nANOTHER ARTICLE with the same picture\n";
$GLOBALS['queue']['n2'] = article('n2', '<p>x</p><img src="' . $a . '" alt="The same picture">', array('slug' => 'second-article', 'title' => 'Second article'));
repget_sync_locked();
$second = post_for('n2');
check('shows the same copy', $second && classed($second->post_content, $copy_a) === 1);
check('...not downloaded again', downloads($a) === 1);
check('...which stays with the first article', (int) get_post_field('post_parent', $copy_a) === post_for('n1')->ID);

echo "\nWITHOUT STORAGE in RepGet's answer the text goes as it was\n";
reset_state();
$GLOBALS['storage'] = array();
$GLOBALS['queue']['s1'] = article('s1', '<p>x</p><img src="' . $a . '" alt="x">', array('slug' => 'no-storage', 'image' => array('url' => $h, 'alt' => 'h')));
repget_sync_locked();
$post = post_for('s1');
check('the picture is not copied', $post && strpos($post->post_content, 'src="' . $a . '"') !== false && downloads($a) === 0);
check('...and the header still is, under the article\'s name', $post && file_of(get_post_thumbnail_id($post->ID)) === 'no-storage.jpg');

echo "\nPOSTS PUBLISHED BEFORE 1.8.0 are brought up to date in place\n";
reset_state();
$c = STORE . 'site/old/1790000000000-old111.jpg';
$old = older_post('old1', '<p>Older article.</p><img src="' . $c . '" alt="An older picture" width="1280" height="720">', 'older-article');
$revisions = count(wp_get_post_revisions($old));
$theirs = wp_insert_post(array('post_title' => 'Not RepGet', 'post_status' => 'publish', 'post_content' => '<img src="' . $c . '" alt="Theirs">'));
repget_sync_locked();
$post = get_post($old);
$copy_c = repget_find_image($c);
check('its picture was copied, and the post shows the copy', $copy_c > 0 && strpos($post->post_content, STORE) === false && classed($post->post_content, $copy_c) === 1, $post->post_content);
check('...named after what it shows', file_of($copy_c) === 'an-older-picture.jpg', file_of($copy_c));
check('...its date is untouched, and no revision was made', $post->post_modified_gmt === '2026-10-01 10:00:00' && count(wp_get_post_revisions($old)) === $revisions, $post->post_modified_gmt);
check('a post RepGet did not write is left alone', strpos(get_post_field('post_content', $theirs), 'src="' . $c . '"') !== false);
repget_sync_locked();
check('the next check has nothing to do', downloads($c) === 1);

echo "\n...a few posts per check, newest first\n";
reset_state();
$older = array();
for ($i = 1; $i <= REPGET_IMAGE_POSTS_PER_CHECK + 1; $i++) {
    $older[$i] = older_post("many{$i}", '<img src="' . STORE . "site/many/{$i}.jpg" . '" alt="Picture ' . $i . '">', "older-{$i}");
}
repget_sync_locked();
$done = array_filter($older, function ($id) { return strpos(get_post_field('post_content', $id), STORE) === false; });
check('the first check did ' . REPGET_IMAGE_POSTS_PER_CHECK . ', the newest', count($done) === REPGET_IMAGE_POSTS_PER_CHECK && !isset($done[1]), implode(',', array_keys($done)));
repget_sync_locked();
check('the next check did the last', strpos(get_post_field('post_content', $older[1]), STORE) === false);

echo "\nAN EDIT SAVED WHILE A PICTURE DOWNLOADS is never overwritten\n";
reset_state();
$d = STORE . 'site/old/1790000000001-old222.jpg';
$edited = older_post('old2', '<p>Before.</p><img src="' . $d . '" alt="Edited picture">', 'being-edited');
$GLOBALS['on_download'] = function ($url) use ($edited) {
    global $wpdb;
    $GLOBALS['on_download'] = null;
    // The site owner saves an edit in WordPress at this very moment.
    $wpdb->update($wpdb->posts, array('post_content' => '<p>Their edit.</p><img src="' . $url . '" alt="Edited picture">'), array('ID' => $edited));
    clean_post_cache($edited);
};
repget_sync_locked();
$post = get_post($edited);
check('the edit survived', strpos($post->post_content, 'Their edit.') !== false, $post->post_content);
check('...its picture still loading from RepGet, for now', strpos($post->post_content, 'src="' . $d . '"') !== false);
repget_sync_locked();
$post = get_post($edited);
check('the next check puts the copy into the edited text, without downloading again',
    strpos($post->post_content, 'Their edit.') !== false && strpos($post->post_content, STORE) === false && downloads($d) === 1, $post->post_content);

echo "\nA PICTURE THAT KEEPS FAILING is left where it is\n";
reset_state();
$e = STORE . 'site/x/1790000000002-gone33.jpg';
$GLOBALS['missing'][] = $e;
$GLOBALS['queue']['f1'] = article('f1', '<p>x</p><img src="' . $e . '" alt="Gone">', array('slug' => 'failing'));
repget_sync_locked();
$post = post_for('f1');
check('the article is published anyway, the picture loading from RepGet', $post && $post->post_status === 'publish' && strpos($post->post_content, 'src="' . $e . '"') !== false);
check('...tried once in that check', downloads($e) === 1, (string) downloads($e));
repget_sync_locked();
repget_sync_locked();
check('tried once per check, three times in all', downloads($e) === 3, (string) downloads($e));
repget_sync_locked();
check('...then given up', downloads($e) === 3, (string) downloads($e));
check('...and the post is not looked at again until it changes', $post && get_post_meta($post->ID, REPGET_META_IMAGES_CHECKED, true) === md5(get_post_field('post_content', $post->ID)));

echo "\nOUT OF TIME: what the budget does not allow waits for the next check\n";
reset_state();
$g = STORE . 'site/y/1790000000003-late44.jpg';
$late = repget_localize_images('<img src="' . $g . '" alt="Late">', array(STORE), 0, 'late', time() - 1);
check('nothing downloaded, the text unchanged, one left', downloads($g) === 0 && $late['left'] === 1 && $late['html'] === '<img src="' . $g . '" alt="Late">');

echo "\nTHE SITE'S OWN PHOTOGRAPHS (1.9.0) are used where they are, never copied\n";
/** A photograph the site owner uploaded themselves. */
function own_photo($name, $alt) {
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    $tmp = wp_tempnam($name);
    file_put_contents($tmp, $GLOBALS['jpeg']);
    $id = media_handle_sideload(array('name' => $name, 'tmp_name' => $tmp), 0, $alt);
    update_post_meta($id, '_wp_attachment_image_alt', $alt);
    return (int) $id;
}
reset_state();
$boat = own_photo('couple-boat-lake-como.jpg', 'Couple on a boat');
$villa = own_photo('villa-ceremony.jpg', 'Villa ceremony');
$boat_url = wp_get_attachment_url($boat);
$villa_url = wp_get_attachment_url($villa);
$media = count(attachments());
$body = '<p>Villas.</p><img src="' . $villa_url . '" alt="Cerimonia in villa" class="wp-image-' . $villa . '" width="32" height="18">';
$GLOBALS['queue']['o1'] = article('o1', $body, array('slug' => 'lake-como', 'image' => array('url' => $boat_url, 'alt' => 'Coppia in barca', 'attachmentId' => $boat)));
repget_sync_locked();
$post = post_for('o1');
check('the featured image is the attachment RepGet named', $post && (int) get_post_thumbnail_id($post->ID) === $boat);
check('...no copy made, nothing downloaded', count(attachments()) === $media && !$GLOBALS['downloads']);
check('...and the photograph is as the owner left it: its alt text, belonging to no post', get_post_meta($boat, '_wp_attachment_image_alt', true) === 'Couple on a boat' && (int) get_post_field('post_parent', $boat) === 0);
check('the photograph in the text is left as RepGet sent it', $post && strpos($post->post_content, 'src="' . $villa_url . '"') !== false && classed($post->post_content, $villa) === 1);
$shown = apply_filters('the_content', $post ? $post->post_content : '');
check('...and WordPress recognises it when it shows the post', classed($shown, $villa) > 0);

$GLOBALS['queue']['o2'] = article('o2', '<p>x</p>', array('slug' => 'wrong-id', 'image' => array('url' => $boat_url, 'alt' => 'x', 'attachmentId' => $villa)));
repget_sync_locked();
check('a named attachment that is another picture is not used: the address decides', (int) get_post_thumbnail_id(post_for('o2')->ID) === $boat && count(attachments()) === $media);

$GLOBALS['queue']['o3'] = article('o3', '<p>x</p>', array('slug' => 'no-id', 'image' => array('url' => $boat_url, 'alt' => 'x')));
repget_sync_locked();
check('with no attachment named (an older RepGet), it is found by its address in this site\'s uploads', (int) get_post_thumbnail_id(post_for('o3')->ID) === $boat && count(attachments()) === $media);

$other_scheme = preg_replace('#^https?:#', strpos($boat_url, 'https:') === 0 ? 'http:' : 'https:', $boat_url);
$GLOBALS['queue']['o4'] = article('o4', '<p>x</p>', array('slug' => 'scheme', 'image' => array('url' => $other_scheme, 'alt' => 'x', 'attachmentId' => $boat)));
repget_sync_locked();
check('...the same picture whatever the scheme', (int) get_post_thumbnail_id(post_for('o4')->ID) === $boat && count(attachments()) === $media);

$GLOBALS['queue']['o5'] = article('o5', '<p>x</p>', array('slug' => 'repget-picture', 'image' => array('url' => $h, 'alt' => 'A film crew', 'attachmentId' => $boat)));
repget_sync_locked();
$thumb = (int) get_post_thumbnail_id(post_for('o5')->ID);
check('RepGet\'s own picture is copied as before, whatever id comes with it', $thumb !== $boat && $thumb > 0 && file_of($thumb) === 'repget-picture.jpg' && downloads($h) === 1, file_of($thumb));

reset_state();
echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
