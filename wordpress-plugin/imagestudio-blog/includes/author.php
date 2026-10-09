<?php
/**
 * The author page (client, 2026-10-08: "an author page on the Image Studio
 * website too ... author name inside articles clickable, leading to the
 * author page"). It is WordPress's own author page - /author/imagestudio/
 * for the user "Image Studio", who writes the editorial articles - showing
 * those articles, 30 to a page, in the Editorial page's style
 * (templates/author.php), instead of the theme's generic archive of
 * portfolio posts.
 *
 * And the article side (isb_filter_article): each editorial article's byline
 * becomes a link to its author's page, and "Get Featured" is added
 * (featured.php). Done on the finished HTML, because the byline and the date
 * line come from the site's own "cps" template, which no filter reaches.
 */

defined('ABSPATH') || exit;

const ISB_PER_PAGE = 30;

/**
 * The author page's own query: editorial articles, 30 to a page. Set again
 * after the theme: Astra sets its blog's own number per page on
 * parse_tax_query, later than pre_get_posts.
 */
function isb_author_query($query) {
    if (is_admin() || !$query->is_main_query() || !$query->is_author()) return;
    $query->set('post_type', isb_post_type());
    $query->set('posts_per_page', ISB_PER_PAGE);
    $query->set('ignore_sticky_posts', true);
}
add_action('pre_get_posts', 'isb_author_query');
add_action('parse_tax_query', 'isb_author_query', 99);

add_filter('template_include', function ($template) {
    if (!is_author() || is_feed()) return $template;
    $ours = ISB_DIR . '/templates/author.php';
    return is_readable($ours) ? $ours : $template;
}, 99);

add_action('wp_enqueue_scripts', function () {
    if (is_author()) wp_enqueue_style('isb-author', plugins_url('assets/author.css', ISB_FILE), array(), ISB_VERSION);
    if (is_singular(isb_post_type())) wp_enqueue_style('isb-byline', plugins_url('assets/byline.css', ISB_FILE), array(), ISB_VERSION);
});

/*
 * Rank Math keeps author pages out of search results on this site. This one
 * is meant to be found - every article links to it - so it is indexed when it
 * lists articles.
 */
add_filter('rank_math/frontend/robots', function ($robots) {
    if (is_author() && have_posts()) {
        $robots['index'] = 'index';
        $robots['follow'] = 'follow';
    }
    return $robots;
});

/**
 * The article's finished HTML, before it is sent (and cached). What goes in
 * is built here, first: nothing can be buffered inside the buffer's own
 * callback.
 */
add_action('template_redirect', function () {
    if (is_admin() || is_feed() || is_embed() || !is_singular(isb_post_type())) return;
    $post = get_queried_object();
    if (!($post instanceof WP_Post)) return;
    $author_url = get_author_posts_url((int) $post->post_author);
    $feature = null;
    if (isb_feature_ready()) {
        $lang = isb_lang();
        $feature = array(isb_feature_trigger($lang), isb_feature_panel($post, $lang));
    }
    ob_start(function ($html) use ($author_url, $feature) {
        return isb_filter_article($html, $author_url, $feature);
    });
}, 0);

/** The byline linked, and "Get Featured" placed ($feature: its button and panel, or null). */
function isb_filter_article($html, $author_url, $feature) {
    if (!is_string($html) || strpos($html, 'cps-single') === false) return $html;
    $html = isb_link_byline($html, $author_url);
    return $feature ? isb_place_feature($html, $feature[0], $feature[1]) : $html;
}

/**
 * The page links: "Newer", the page numbers (first, last, the current one and
 * its neighbours, "…" between), "Older" - the same row as RepGet's blog.
 */
function isb_page_links($current, $total, $lang) {
    if ($total < 2) return '';
    $numbers = array();
    for ($n = 1; $n <= $total; $n++) {
        if ($n === 1 || $n === $total || abs($n - $current) <= 1 || ($current <= 3 && $n <= 5) || ($current >= $total - 2 && $n >= $total - 4)) $numbers[] = $n;
    }
    $html = '<nav class="isb-pages" aria-label="' . esc_attr(isb_text('pages', $lang)) . '">';
    $step = function ($page, $label, $rel) use ($current) {
        return $page
            ? '<a class="isb-page-step" rel="' . $rel . '" href="' . esc_url(get_pagenum_link($page)) . '">' . $label . '</a>'
            : '<span class="isb-page-step is-disabled" aria-disabled="true">' . $label . '</span>';
    };
    $html .= $step($current > 1 ? $current - 1 : 0, '&larr; ' . esc_html(isb_text('newer', $lang)), 'prev');
    $html .= '<span class="isb-page-numbers">';
    $previous = 0;
    foreach ($numbers as $n) {
        if ($previous && $n > $previous + 1) $html .= '<span class="isb-page-gap" aria-hidden="true">&hellip;</span>';
        $html .= $n === $current
            ? '<span class="isb-page-number is-current" aria-current="page">' . $n . '</span>'
            : '<a class="isb-page-number" href="' . esc_url(get_pagenum_link($n)) . '">' . $n . '</a>';
        $previous = $n;
    }
    $html .= '</span>';
    $html .= '<span class="isb-page-count">' . esc_html(sprintf(isb_text('page_of', $lang), $current, $total)) . '</span>';
    $html .= $step($current < $total ? $current + 1 : 0, esc_html(isb_text('older', $lang)) . ' &rarr;', 'next');
    return $html . '</nav>';
}
