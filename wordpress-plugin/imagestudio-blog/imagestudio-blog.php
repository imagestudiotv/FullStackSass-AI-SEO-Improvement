<?php
/**
 * Plugin Name: Image Studio Blog
 * Description: Image Studio's editorial author page, a clickable "Image Studio" byline, "Get Featured in This Article" (€99 through PayPal), an "In this article" contents box and an optional FAQ on editorial articles. Also carries the site's phone-layout fixes.
 * Version: 2.3.0
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
 *  - Get Featured (includes/featured.php): a reader pays €99 once, through a
 *    plain PayPal "Buy Now" to the configured PayPal email, for a sponsored
 *    mention in the article, subject to editorial approval. Requests are
 *    kept under "Featured placements" in the admin menu. No PayPal API keys.
 *    Limits per visitor, per email and overall (includes/limits.php, 2.2.0):
 *    the visitor is REMOTE_ADDR unless a trusted proxy is set up in the
 *    settings, and each request is checked and recorded atomically.
 *  - Article extras (includes/extras.php, client request 2026-10-09, as on
 *    RepGet's blog): an "In this article" box at the top of each article's
 *    text linking to its H2 headings (when it has at least 3), and an
 *    optional FAQ after the text - questions that open to their answers,
 *    also given to search engines as FAQPage data. The FAQ, and hiding the
 *    box on one article, are in the "Article extras" box of the article's
 *    edit screen. wpml-config.xml has the FAQ translated with the article.
 *  - Layout fixes (layout.css, layout.js): the phone menu, the homepage grid
 *    and portfolio posts.
 *
 * Settings: Settings -> Image Studio Blog.
 */

defined('ABSPATH') || exit;

define('ISB_VERSION', '2.3.0');
define('ISB_FILE', __FILE__);
define('ISB_DIR', __DIR__);

require_once ISB_DIR . '/includes/markup.php';
require_once ISB_DIR . '/includes/settings.php';
require_once ISB_DIR . '/includes/author.php';
require_once ISB_DIR . '/includes/limits.php';
require_once ISB_DIR . '/includes/featured.php';
require_once ISB_DIR . '/includes/extras.php';

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('isb-layout', plugins_url('layout.css', ISB_FILE), array(), ISB_VERSION);
    wp_enqueue_script('isb-layout', plugins_url('layout.js', ISB_FILE), array(), ISB_VERSION, true);
});

register_activation_hook(__FILE__, function () {
    isb_register_placement_type();
    isb_install_tables();
    flush_rewrite_rules();
});
register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
