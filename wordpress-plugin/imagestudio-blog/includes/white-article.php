<?php
/**
 * A white reading surface in dark mode, for named articles only (client
 * request, 2026-11-05: rainy-wedding-photography-italy).
 *
 * Found by the post itself, not by anything on the page: this article's slug
 * on the Editorial post type. WordPress's body classes for this type carry the
 * post id but not the slug, so the class is added here. The slug is compared
 * exactly, so other articles, a translation with its own slug and every other
 * page get neither the class nor the stylesheet. To change the list, use the
 * isb_white_articles filter.
 */

defined('ABSPATH') || exit;

/** The slugs that keep the white surface. */
function isb_white_articles() {
    return (array) apply_filters('isb_white_articles', array('rainy-wedding-photography-italy'));
}

/** True for one of those slugs on the Editorial post type. */
function isb_is_white_article($post, $post_type) {
    return is_object($post)
        && isset($post->post_type, $post->post_name)
        && $post->post_type === $post_type
        && in_array($post->post_name, isb_white_articles(), true);
}

/** The article this request shows, when it is one of them. */
function isb_is_white_article_page() {
    return is_singular(isb_post_type()) && isb_is_white_article(get_queried_object(), isb_post_type());
}

add_filter('body_class', function ($classes) {
    if (isb_is_white_article_page()) $classes[] = 'isb-white-article';
    return $classes;
});

add_action('wp_enqueue_scripts', function () {
    if (!isb_is_white_article_page()) return;
    wp_enqueue_style('isb-white-article', plugins_url('assets/white-article.css', ISB_FILE), array('isb-extras'), ISB_VERSION);
}, 20);
