<?php
/**
 * Plugin Name: Image Studio Blog
 * Description: Image Studio's editorial author page, a clickable "Image Studio" byline, and "Get Featured in This Article" ($99 through PayPal) on editorial articles. Also carries the site's phone-layout fixes.
 * Version: 2.0.0
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Author: RepGet
 * Text Domain: imagestudio-blog
 *
 * Built for imagestudio.com (client request, 2026-10-08): its editorial
 * articles are the "custom_post" type, rendered by the site's own "cps"
 * single template, and written by the WordPress user "Image Studio".
 *
 *  - Author page (includes/author.php): WordPress's own author page,
 *    /author/imagestudio/, lists the editorial articles, 30 to a page, in
 *    the Editorial page's style. The byline in each article links to it.
 *  - Get Featured (includes/featured.php): a reader pays $99 once, through a
 *    plain PayPal "Buy Now" to the configured PayPal email, for a sponsored
 *    mention in the article, subject to editorial approval. Requests are
 *    kept under "Featured placements" in the admin menu. No PayPal API keys.
 *  - Layout fixes (layout.css, layout.js): the phone menu, the homepage grid
 *    and portfolio posts.
 *
 * Settings: Settings -> Image Studio Blog.
 */

defined('ABSPATH') || exit;

define('ISB_VERSION', '2.0.0');
define('ISB_FILE', __FILE__);
define('ISB_DIR', __DIR__);

require_once ISB_DIR . '/includes/markup.php';
require_once ISB_DIR . '/includes/settings.php';
require_once ISB_DIR . '/includes/author.php';
require_once ISB_DIR . '/includes/featured.php';

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('isb-layout', plugins_url('layout.css', ISB_FILE), array(), ISB_VERSION);
    wp_enqueue_script('isb-layout', plugins_url('layout.js', ISB_FILE), array(), ISB_VERSION, true);
});

register_activation_hook(__FILE__, function () {
    isb_register_placement_type();
    flush_rewrite_rules();
});
register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
