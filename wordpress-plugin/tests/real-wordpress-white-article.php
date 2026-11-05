<?php
/**
 * The white article (Image Studio Blog 2.4.0) against a REAL WordPress: which
 * requests get the body class and the stylesheet.
 *
 *   php wordpress-plugin/tests/real-wordpress-white-article.php <wordpress dir> <plugin file>
 *
 * The WordPress dir needs a wp-config.php pointing at a DISPOSABLE database,
 * installed with install-wordpress.php; this script writes posts. Never point it
 * at a real site. Each page is a process of its own, as on a real site.
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php real-wordpress-white-article.php <wordpress dir> <plugin file>\n");
    exit(2);
}
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
// The site's article type, as WordPress starts.
$GLOBALS['wp_filter'] = array('init' => array(0 => array(array(
    'function' => function () {
        register_post_type('custom_post', array('public' => true, 'label' => 'Editorial', 'supports' => array('title', 'editor')));
    },
    'accepted_args' => 0,
))));
require rtrim($argv[1], '/\\') . '/wp-load.php';
require $argv[2];

if (isset($argv[3]) && $argv[3] === '--page') {
    wp(array('p' => (int) $argv[4], 'post_type' => get_post_type((int) $argv[4])));
    do_action('wp_enqueue_scripts');
    echo "\n@@" . json_encode(array('class' => in_array('isb-white-article', get_body_class(), true), 'style' => wp_style_is('isb-white-article', 'enqueued')));
    exit(0);
}

$failures = 0;
function check($label, $cond, $detail = '') {
    global $failures;
    echo ($cond ? "  ok    " : "  FAIL  ") . $label . ($cond ? '' : " {$detail}") . "\n";
    if (!$cond) $failures++;
}
function page_of($post_id) {
    global $argv;
    $child = proc_open(
        array(PHP_BINARY, '-c', (string) php_ini_loaded_file(), $argv[0], $argv[1], $argv[2], '--page', (string) $post_id),
        array(1 => array('pipe', 'w'), 2 => array('redirect', 1)),
        $pipes
    );
    $out = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    proc_close($child);
    $at = strrpos($out, '@@');
    return $at === false ? array('error' => substr($out, 0, 500)) : (array) json_decode(substr($out, $at + 2), true);
}
function make($type, $slug) {
    $found = get_page_by_path($slug, OBJECT, $type);
    if ($found) return $found->ID;
    return wp_insert_post(array('post_type' => $type, 'post_name' => $slug, 'post_title' => $slug, 'post_status' => 'publish', 'post_content' => 'Words.'));
}

echo "THE NAMED ARTICLE ONLY\n";
$named = page_of(make('custom_post', 'rainy-wedding-photography-italy'));
check('the named article gets the class and the stylesheet', !empty($named['class']) && !empty($named['style']), json_encode($named));
$other = page_of(make('custom_post', 'natural-light-photography'));
check('another article gets neither', isset($other['class']) && !$other['class'] && !$other['style'], json_encode($other));
$longer = page_of(make('custom_post', 'rainy-wedding-photography-italy-tips'));
check('a slug that starts the same gets neither', isset($longer['class']) && !$longer['class'] && !$longer['style'], json_encode($longer));
$page = page_of(make('page', 'rainy-wedding-photography-italy'));
check('a page with that slug gets neither', isset($page['class']) && !$page['class'] && !$page['style'], json_encode($page));

echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
