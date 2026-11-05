<?php
/**
 * Rank Math's social fields (1.10.0) against a REAL WordPress and a REAL Rank Math.
 *
 *   php wordpress-plugin/tests/real-wordpress-rank-math.php <wordpress dir> <plugin file>
 *
 * The WordPress dir needs a wp-config.php pointing at a DISPOSABLE database,
 * installed with install-wordpress.php, and the free Rank Math plugin unpacked
 * in its wp-content/plugins/seo-by-rank-math; this script writes posts, media
 * files and options. Never point it at a real site. RepGet is never contacted:
 * the check's answer and every picture download are served by a
 * pre_http_request filter here.
 *
 * What it shows, reading the result through Rank Math's own code, and from the
 * tags Rank Math itself prints in wp_head for a custom post type:
 *  - create, update and a retried hand-over leave Facebook and Twitter on the
 *    same attachment as the featured image, with the article's words;
 *  - a picture changed in RepGet, or a featured image changed in WordPress
 *    with WordPress's own functions, moves the social images with it;
 *  - a field edited by hand wins, also in the page's tags;
 *  - the backfill is a dry run until told otherwise.
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php real-wordpress-rank-math.php <wordpress dir> <plugin file>\n");
    exit(2);
}
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';

// Hooks WordPress picks up as it starts: Rank Math active, and the site's article type.
$GLOBALS['wp_filter'] = array(
    'option_active_plugins' => array(10 => array(array(
        'function' => function ($plugins) {
            $plugins = is_array($plugins) ? $plugins : array();
            $plugins[] = 'seo-by-rank-math/rank-math.php';
            return array_values(array_unique($plugins));
        },
        'accepted_args' => 1,
    ))),
    'init' => array(0 => array(array(
        'function' => function () {
            register_post_type('custom_post', array('public' => true, 'label' => 'Editorial', 'show_ui' => true, 'supports' => array('title', 'editor', 'excerpt', 'thumbnail'), 'rewrite' => array('slug' => 'editorial/post')));
        },
        'accepted_args' => 0,
    ))),
);
require rtrim($argv[1], '/\\') . '/wp-load.php';
require $argv[2];

/*
  A page request of its own: what Rank Math prints for a post, on a real
  front-end query, in a fresh process as on a real site.
*/
if (isset($argv[3]) && $argv[3] === '--tags') {
    wp(array('p' => (int) $argv[4], 'post_type' => get_post_type((int) $argv[4])));
    the_post();
    ob_start();
    do_action('rank_math/head');
    $html = ob_get_clean();
    $tags = array();
    preg_match_all('/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/', $html, $found, PREG_SET_ORDER);
    foreach ($found as $tag) {
        if (!isset($tags[$tag[1]])) $tags[$tag[1]] = html_entity_decode($tag[2], ENT_QUOTES);
    }
    echo "\n@@TAGS@@" . json_encode($tags);
    exit(0);
}

global $wpdb;
$failures = 0;
function check($label, $cond, $detail = '') {
    global $failures;
    echo ($cond ? "  ok    " : "  FAIL  ") . $label . ($cond ? '' : " {$detail}") . "\n";
    if (!$cond) $failures++;
}

if (!defined('RANK_MATH_VERSION')) {
    fwrite(STDERR, "Rank Math did not load: unpack it into wp-content/plugins/seo-by-rank-math\n");
    exit(2);
}
echo "WordPress " . get_bloginfo('version') . ", Rank Math " . RANK_MATH_VERSION . "\n";

// Rank Math set up as on a real site: activated once, its setup wizard passed.
if (get_option('rank_math_test_activated') !== 'yes') {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    do_action('activate_seo-by-rank-math/rank-math.php', false);
    update_option('rank_math_registration_skip', true);
    update_option('rank_math_test_activated', 'yes');
}
update_option(REPGET_OPTION_POST_TYPE, 'custom_post');
update_option(REPGET_OPTION_KEY, 'test-key-not-real');

// ------------------------------------------------- fake RepGet and storage --
define('STORE', 'https://store.test/storage/v1/object/public/article-images/');
$GLOBALS['queue'] = array();
$GLOBALS['missing'] = array();

/** A real 1200 x 630 picture, so WordPress and Rank Math measure it for real. */
function picture_bytes() {
    $image = imagecreatetruecolor(1200, 630);
    imagefill($image, 0, 0, imagecolorallocate($image, 40, 60, 90));
    ob_start();
    imagejpeg($image, null, 70);
    return ob_get_clean();
}

add_filter('pre_http_request', function ($pre, $args, $url) {
    $reply = function ($code, $body, $headers = array()) use ($args) {
        return array(
            'headers' => $headers, 'body' => $body, 'cookies' => array(),
            'response' => array('code' => $code, 'message' => $code === 200 ? 'OK' : 'Not Found'),
            'filename' => isset($args['filename']) ? $args['filename'] : null,
        );
    };
    if (strpos($url, STORE) === 0) {
        if (in_array($url, $GLOBALS['missing'], true)) {
            return $reply(404, '');
        }
        if (!empty($args['stream']) && !empty($args['filename'])) {
            file_put_contents($args['filename'], picture_bytes());
        }
        return $reply(200, '', array('content-type' => 'image/jpeg'));
    }
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === '/api/plugin/articles') {
        return $reply(200, wp_json_encode(array('ok' => true, 'storage' => array(STORE), 'articles' => array_values($GLOBALS['queue']))));
    }
    if ($path === '/api/plugin/published') {
        $sent = json_decode($args['body'], true);
        unset($GLOBALS['queue'][$sent['articleId']]);
        return $reply(200, wp_json_encode(array('ok' => true)));
    }
    return $reply(200, '{}');
}, 10, 3);

function send($id, $title, $excerpt, $picture) {
    $GLOBALS['queue'][$id] = array(
        'id' => $id, 'title' => $title, 'slug' => sanitize_title($title), 'html' => '<p>Words.</p>', 'excerpt' => $excerpt, 'status' => 'publish',
        'image' => $picture ? array('url' => STORE . $picture, 'alt' => 'The picture') : null,
        'dispatch' => array('id' => wp_generate_uuid4(), 'revision' => 'r'),
    );
    $result = repget_sync_locked();
    if (is_wp_error($result)) {
        check('the check ran', false, $result->get_error_message());
    }
    return repget_find_post($id);
}

/** The tags Rank Math itself prints for a post, on a real front-end query. */
function tags_of($post_id) {
    global $argv;
    $child = proc_open(
        array(PHP_BINARY, '-c', (string) php_ini_loaded_file(), $argv[0], $argv[1], $argv[2], '--tags', (string) $post_id),
        array(1 => array('pipe', 'w'), 2 => array('redirect', 1)),
        $pipes
    );
    $out = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    proc_close($child);
    $at = strrpos($out, '@@TAGS@@');
    return $at === false ? array('error' => substr($out, 0, 800)) : (array) json_decode(substr($out, $at + 8), true);
}
function tag($tags, $name) { return isset($tags[$name]) ? $tags[$name] : ''; }
function m($post, $key) { return get_post_meta($post, $key, true); }

// Nothing left from an earlier run: every post of this article type, and the media.
foreach (get_posts(array('post_type' => array('custom_post', 'attachment'), 'post_status' => 'any', 'posts_per_page' => -1, 'fields' => 'ids', 'suppress_filters' => true)) as $leftover) {
    wp_delete_post($leftover, true);
}

// ------------------------------------------------------------------ tests ---
echo "\nCREATE\n";
$p = send('rm1', 'Rainy Wedding Photography Italy', 'Worried about rain on your wedding day?', 'rainy-a.jpg');
$thumb = (int) get_post_thumbnail_id($p);
check('the article is the site\'s article type', get_post_type($p) === 'custom_post');
check('Rank Math treats that type as its own', \RankMath\Helper::is_post_type_accessible('custom_post'));
check('it has a featured image in the media library', $thumb > 0 && get_post_type($thumb) === 'attachment');
check('Rank Math reads the Facebook fields', \RankMath\Post::get_meta('facebook_title', $p) === 'Rainy Wedding Photography Italy' && \RankMath\Post::get_meta('facebook_description', $p) === 'Worried about rain on your wedding day?');
check('Rank Math reads the Twitter fields', \RankMath\Post::get_meta('twitter_title', $p) === 'Rainy Wedding Photography Italy' && \RankMath\Post::get_meta('twitter_description', $p) === 'Worried about rain on your wedding day?');
check('both images are the attachment and its address', (int) m($p, 'rank_math_facebook_image_id') === $thumb && (int) m($p, 'rank_math_twitter_image_id') === $thumb && m($p, 'rank_math_facebook_image') === wp_get_attachment_url($thumb) && m($p, 'rank_math_twitter_image') === wp_get_attachment_url($thumb));
check('...on this site, not on RepGet\'s storage', strpos(m($p, 'rank_math_facebook_image'), 'store.test') === false);
$tags = tags_of($p);
check('the page: og:title', tag($tags, 'og:title') === 'Rainy Wedding Photography Italy', var_export($tags, true));
check('the page: og:description', tag($tags, 'og:description') === 'Worried about rain on your wedding day?');
check('the page: og:image is the featured image', tag($tags, 'og:image') === wp_get_attachment_url($thumb), tag($tags, 'og:image'));
check('the page: twitter:title and description', tag($tags, 'twitter:title') === 'Rainy Wedding Photography Italy' && tag($tags, 'twitter:description') === 'Worried about rain on your wedding day?');
check('the page: twitter:image is the featured image', tag($tags, 'twitter:image') === wp_get_attachment_url($thumb), tag($tags, 'twitter:image'));

echo "\nRETRY AND UPDATE\n";
$attachments = (int) array_sum((array) wp_count_posts('attachment'));
send('rm1', 'Rainy Wedding Photography Italy', 'Worried about rain on your wedding day?', 'rainy-a.jpg');
check('a retried hand-over adds no attachment', (int) array_sum((array) wp_count_posts('attachment')) === $attachments);
check('...and the image is the same', (int) get_post_thumbnail_id($p) === $thumb && (int) m($p, 'rank_math_twitter_image_id') === $thumb);
send('rm1', 'Rainy Weddings in Italy', 'New words.', 'rainy-a.jpg');
$tags = tags_of($p);
check('an updated article: new words on the page', tag($tags, 'og:title') === 'Rainy Weddings in Italy' && tag($tags, 'twitter:description') === 'New words.');

echo "\nA CHANGED PICTURE\n";
send('rm1', 'Rainy Weddings in Italy', 'New words.', 'rainy-b.jpg');
$second = (int) get_post_thumbnail_id($p);
$tags = tags_of($p);
check('RepGet\'s new picture is the featured image', $second > 0 && $second !== $thumb);
check('...and the page\'s images', tag($tags, 'og:image') === wp_get_attachment_url($second) && tag($tags, 'twitter:image') === wp_get_attachment_url($second), tag($tags, 'og:image'));
$own = media_handle_sideload(array('name' => 'chosen-here.jpg', 'tmp_name' => (function () { $f = wp_tempnam('chosen-here.jpg'); file_put_contents($f, picture_bytes()); return $f; })()), 0);
check('(a picture chosen here)', is_int($own));
set_post_thumbnail($p, $own);
check('set in WordPress: the social images follow, through WordPress\'s own hooks', (int) m($p, 'rank_math_facebook_image_id') === $own && (int) m($p, 'rank_math_twitter_image_id') === $own);
$tags = tags_of($p);
check('...and the page\'s', tag($tags, 'og:image') === wp_get_attachment_url($own) && tag($tags, 'twitter:image') === wp_get_attachment_url($own));
send('rm1', 'Rainy Weddings in Italy', 'New words.', 'rainy-c.jpg');
check('a later picture from RepGet does not replace the one chosen here', (int) get_post_thumbnail_id($p) === $own && (int) m($p, 'rank_math_twitter_image_id') === $own);
delete_post_thumbnail($p);
check('removed in WordPress: the social images go with it', m($p, 'rank_math_facebook_image_id') === '' && m($p, 'rank_math_twitter_image') === '');
check('...and the record of what was written with them', !isset(repget_social_written($p)['facebook_image']));

echo "\nA HAND EDIT WINS\n";
$p = send('rm2', 'First title', 'First words.', 'second-a.jpg');
$thumb = (int) get_post_thumbnail_id($p);
update_post_meta($p, 'rank_math_facebook_title', 'My own Facebook title');
update_post_meta($p, 'rank_math_twitter_description', 'My own Twitter words');
send('rm2', 'Second title', 'Second words.', 'second-a.jpg');
$tags = tags_of($p);
check('edited Facebook title on the page', tag($tags, 'og:title') === 'My own Facebook title');
check('edited Twitter description on the page', tag($tags, 'twitter:description') === 'My own Twitter words');
check('the rest follows the article', tag($tags, 'og:description') === 'Second words.' && tag($tags, 'twitter:title') === 'Second title');

echo "\nA FAILED PICTURE\n";
$GLOBALS['missing'] = array(STORE . 'gone.jpg');
$p = send('rm3', 'Third', 'Third words.', 'gone.jpg');
check('no featured image, no social image, no RepGet address', (int) get_post_thumbnail_id($p) === 0 && m($p, 'rank_math_facebook_image') === '');
$GLOBALS['missing'] = array();
send('rm3', 'Third', 'Third words.', 'gone.jpg');
$thumb = (int) get_post_thumbnail_id($p);
check('retried publish: the picture arrives and the social images are it', $thumb > 0 && (int) m($p, 'rank_math_facebook_image_id') === $thumb);

echo "\nTHE BACKFILL\n";
$old = wp_insert_post(array('post_type' => 'custom_post', 'post_title' => 'Older article', 'post_excerpt' => 'Older words.', 'post_status' => 'publish', 'meta_input' => array(REPGET_META_ARTICLE => 'old1')));
$old_edited = wp_insert_post(array('post_type' => 'custom_post', 'post_title' => 'Older edited', 'post_excerpt' => 'Older edited words.', 'post_status' => 'publish', 'meta_input' => array(REPGET_META_ARTICLE => 'old2', 'rank_math_twitter_title' => 'Written by hand')));
$not_ours = wp_insert_post(array('post_type' => 'custom_post', 'post_title' => 'Not RepGet', 'post_status' => 'publish'));
set_post_thumbnail($old, $own);
set_post_thumbnail($not_ours, $own);
check('(a post from before 1.10.0: nothing yet, as the thumbnail hook only follows what exists)', true);
delete_post_meta($old, 'rank_math_facebook_image');
delete_post_meta($old, 'rank_math_facebook_image_id');
delete_post_meta($old, 'rank_math_twitter_image');
delete_post_meta($old, 'rank_math_twitter_image_id');
delete_post_meta($old, REPGET_META_SOCIAL);
$rows = function () use ($wpdb) { return $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta}"); };
$before = $rows();
$report = repget_social_backfill(50);
check('a dry run writes nothing', $rows() === $before && m($old, 'rank_math_facebook_title') === '');
$by_id = array_column($report['posts'], null, 'id');
check('...it lists what it would do', isset($by_id[$old]) && $by_id[$old]['changes'] === 7);
check('...and what it would keep', isset($by_id[$old_edited]) && $by_id[$old_edited]['kept'] === array('twitter_title'));
check('...and not the post that is not RepGet\'s', !isset($by_id[$not_ours]));
$limited = repget_social_backfill(1);
check('a batch of one is one, and says where to go on', count($limited['posts']) === 1 && $limited['next'] === 1);
repget_social_backfill(50, 0, true);
$tags = tags_of($old);
check('applied: the older article\'s tags', tag($tags, 'og:title') === 'Older article' && tag($tags, 'twitter:description') === 'Older words.' && tag($tags, 'og:image') === wp_get_attachment_url($own));
check('applied: the hand-written field is kept', m($old_edited, 'rank_math_twitter_title') === 'Written by hand');
check('applied: the post that is not RepGet\'s has no social fields', m($not_ours, 'rank_math_facebook_title') === '' && m($not_ours, 'rank_math_facebook_image_id') === '');

echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
