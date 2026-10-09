<?php
/**
 * The author page (includes/author.php): the author, then their editorial
 * articles in the Editorial page's rows - picture, category, byline, title,
 * date, excerpt, "Read more" - 30 to a page.
 *
 * Runs in the global scope (template-loader.php), so its variables are all
 * isb_-prefixed: the article loop resets WordPress's own globals, $pages
 * among them.
 */

defined('ABSPATH') || exit;

$isb_author = get_queried_object();
$isb_lang = isb_lang();
$isb_settings = isb_settings();
$isb_bio = trim((string) get_the_author_meta('description', $isb_author->ID));
if ($isb_bio === '') $isb_bio = trim($isb_settings[$isb_lang === 'it' ? 'bio_it' : 'bio_en']);
if ($isb_bio === '') $isb_bio = isb_text('bio', $isb_lang);
$isb_total = (int) $GLOBALS['wp_query']->found_posts;
$isb_current = max(1, (int) get_query_var('paged'));
$isb_pages = (int) $GLOBALS['wp_query']->max_num_pages;
$isb_editorial = $isb_lang === 'it' ? home_url('/it/editoriale/') : home_url('/editorial/');

get_header();
?>
<div class="isb-author">
    <header class="isb-author-head">
        <div class="isb-author-inner">
            <a class="isb-author-back" href="<?php echo esc_url($isb_editorial); ?>">&larr; <?php echo esc_html(isb_text('back_editorial', $isb_lang)); ?></a>
            <div class="isb-author-who">
                <?php echo get_avatar($isb_author->ID, 88, '', '', array('class' => 'isb-author-avatar')); ?>
                <div>
                    <p class="isb-author-eyebrow"><?php echo esc_html(isb_text('author', $isb_lang)); ?></p>
                    <h1 class="isb-author-name"><?php echo esc_html($isb_author->display_name); ?></h1>
                </div>
            </div>
            <p class="isb-author-bio"><?php echo esc_html($isb_bio); ?></p>
            <p class="isb-author-count"><?php echo esc_html(sprintf(isb_text($isb_total === 1 ? 'articles_one' : 'articles_many', $isb_lang), $isb_total)); ?></p>
        </div>
    </header>

    <div class="isb-author-list">
        <?php if (have_posts()) : ?>
            <?php while (have_posts()) : the_post(); ?>
                <?php
                $isb_terms = get_the_terms(get_the_ID(), 'editorial_category');
                $isb_term = $isb_terms && !is_wp_error($isb_terms) ? $isb_terms[0] : null;
                ?>
                <article class="isb-row">
                    <a class="isb-row-media" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true">
                        <?php if (has_post_thumbnail()) the_post_thumbnail('large', array('loading' => 'lazy', 'alt' => '')); ?>
                    </a>
                    <div class="isb-row-text">
                        <?php if ($isb_term) : ?>
                            <p class="isb-row-category"><a href="<?php echo esc_url(get_term_link($isb_term)); ?>"><?php echo esc_html($isb_term->name); ?></a></p>
                        <?php endif; ?>
                        <p class="isb-row-byline"><?php echo esc_html($isb_author->display_name); ?></p>
                        <h2 class="isb-row-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
                        <p class="isb-row-date"><time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date()); ?></time></p>
                        <p class="isb-row-excerpt"><?php echo esc_html(wp_trim_words(get_the_excerpt(), 40)); ?></p>
                        <a class="isb-row-more" href="<?php the_permalink(); ?>"><?php echo esc_html(isb_text('read_more', $isb_lang)); ?> &rarr;<span class="screen-reader-text">: <?php the_title(); ?></span></a>
                    </div>
                </article>
            <?php endwhile; ?>
            <?php echo isb_page_links($isb_current, $isb_pages, $isb_lang); ?>
        <?php else : ?>
            <p class="isb-author-none"><?php echo esc_html(isb_text('none', $isb_lang)); ?></p>
        <?php endif; ?>
    </div>
</div>
<?php
get_footer();
