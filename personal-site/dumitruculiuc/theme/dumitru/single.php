<?php
/**
 * One blog post: title, date, author, cover, the text, copy-link, previous
 * and next posts, comments when they are open.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

while ( have_posts() ) :
	the_post();
	$dumitru_words   = str_word_count( wp_strip_all_tags( get_the_content() ) );
	$dumitru_minutes = max( 1, (int) round( $dumitru_words / 220 ) );
	$dumitru_cats    = get_the_category();
	?>
	<main id="main" class="reading">
		<div class="rack">
			<article <?php post_class( 'plate article' ); ?>>
				<header class="article__head">
					<a class="article__back silk" href="<?php echo esc_url( dumitru_blog_url() ); ?>">&larr; <?php esc_html_e( 'All posts', 'dumitru' ); ?></a>
					<?php if ( $dumitru_cats && 'uncategorized' !== $dumitru_cats[0]->slug ) : ?>
						<a class="chip" href="<?php echo esc_url( get_category_link( $dumitru_cats[0] ) ); ?>"><?php echo esc_html( $dumitru_cats[0]->name ); ?></a>
					<?php endif; ?>
					<h1 class="article__title"><?php the_title(); ?></h1>
					<p class="article__meta">
						<?php echo get_avatar( get_the_author_meta( 'ID' ), 32, '', '', array( 'class' => 'article__avatar' ) ); ?>
						<span><?php the_author(); ?></span>
						<span aria-hidden="true">·</span>
						<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
						<span aria-hidden="true">·</span>
						<?php /* translators: %d: minutes. */ ?>
						<span><?php echo esc_html( sprintf( _n( '%d minute read', '%d minutes read', $dumitru_minutes, 'dumitru' ), $dumitru_minutes ) ); ?></span>
					</p>
				</header>

				<?php if ( has_post_thumbnail() ) : ?>
					<figure class="article__cover">
						<?php the_post_thumbnail( 'dumitru-cover', array( 'fetchpriority' => 'high' ) ); ?>
						<?php if ( get_the_post_thumbnail_caption() ) : ?>
							<figcaption class="silk"><?php the_post_thumbnail_caption(); ?></figcaption>
						<?php endif; ?>
					</figure>
				<?php endif; ?>

				<div class="prose">
					<?php
					the_content();
					wp_link_pages(
						array(
							'before' => '<nav class="page-links">' . esc_html__( 'Pages:', 'dumitru' ),
							'after'  => '</nav>',
						)
					);
					?>
				</div>

				<footer class="article__foot">
					<?php the_tags( '<p class="article__tags">', ' ', '</p>' ); ?>
					<div class="article__actions">
						<button class="key" type="button" data-dc-copy="<?php echo esc_url( get_permalink() ); ?>" data-dc-copied="<?php esc_attr_e( 'Link copied', 'dumitru' ); ?>"><?php esc_html_e( 'Copy link', 'dumitru' ); ?></button>
						<a class="key key--light" href="<?php echo esc_url( dumitru_blog_url() ); ?>"><?php esc_html_e( 'More posts', 'dumitru' ); ?></a>
					</div>
					<?php
					the_post_navigation(
						array(
							'prev_text'          => '<span class="silk">' . esc_html__( 'Previous', 'dumitru' ) . '</span><span class="nav-title">%title</span>',
							'next_text'          => '<span class="silk">' . esc_html__( 'Next', 'dumitru' ) . '</span><span class="nav-title">%title</span>',
							'screen_reader_text' => __( 'More posts', 'dumitru' ),
						)
					);
					?>
				</footer>
			</article>

			<?php if ( comments_open() || get_comments_number() ) : ?>
				<section class="plate comments-plate">
					<?php comments_template(); ?>
				</section>
			<?php endif; ?>
		</div>
	</main>
	<?php
endwhile;

get_footer();
