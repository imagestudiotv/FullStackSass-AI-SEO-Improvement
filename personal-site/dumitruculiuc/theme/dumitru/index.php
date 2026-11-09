<?php
/**
 * Lists of posts: the blog page, categories, tags, dates, authors, search.
 * (home.php, archive.php and search.php all use this.)
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

if ( is_home() ) {
	$dumitru_page_for_posts = (int) get_option( 'page_for_posts' );
	$dumitru_heading        = $dumitru_page_for_posts ? get_the_title( $dumitru_page_for_posts ) : __( 'Blog', 'dumitru' );
	$dumitru_lede           = '';
} elseif ( is_search() ) {
	/* translators: %s: search terms. */
	$dumitru_heading = sprintf( __( 'Search: %s', 'dumitru' ), get_search_query() );
	$dumitru_lede    = '';
} else {
	$dumitru_heading = wp_strip_all_tags( get_the_archive_title() );
	$dumitru_lede    = get_the_archive_description();
}
$dumitru_categories = get_categories(
	array(
		'hide_empty' => true,
		'exclude'    => array( (int) get_option( 'default_category' ) ),
	)
);
?>

<main id="main" class="listing">
	<div class="rack">
		<section class="plate">
			<header class="listing__head">
				<h1 class="display-2"><?php echo esc_html( $dumitru_heading ); ?></h1>
				<?php if ( $dumitru_lede ) : ?>
					<div class="listing__lede"><?php echo wp_kses_post( $dumitru_lede ); ?></div>
				<?php endif; ?>
				<?php if ( $dumitru_categories && ( is_home() || is_category() ) ) : ?>
					<nav class="chips" aria-label="<?php esc_attr_e( 'Categories', 'dumitru' ); ?>">
						<a class="chip<?php echo is_home() ? ' is-current' : ''; ?>" href="<?php echo esc_url( dumitru_blog_url() ); ?>"<?php echo is_home() ? ' aria-current="page"' : ''; ?>><?php esc_html_e( 'All', 'dumitru' ); ?></a>
						<?php foreach ( $dumitru_categories as $dumitru_cat ) : ?>
							<?php $dumitru_here = is_category( $dumitru_cat->term_id ); ?>
							<a class="chip<?php echo $dumitru_here ? ' is-current' : ''; ?>" href="<?php echo esc_url( get_category_link( $dumitru_cat ) ); ?>"<?php echo $dumitru_here ? ' aria-current="page"' : ''; ?>><?php echo esc_html( $dumitru_cat->name ); ?></a>
						<?php endforeach; ?>
					</nav>
				<?php endif; ?>
			</header>

			<?php if ( have_posts() ) : ?>
				<div class="post-list">
					<?php
					while ( have_posts() ) :
						the_post();
						get_template_part( 'template-parts/post-row' );
					endwhile;
					?>
				</div>
				<?php
				the_posts_pagination(
					array(
						'mid_size'           => 1,
						'prev_text'          => '&larr; ' . __( 'Newer', 'dumitru' ),
						'next_text'          => __( 'Older', 'dumitru' ) . ' &rarr;',
						'screen_reader_text' => __( 'More posts', 'dumitru' ),
					)
				);
				?>
			<?php else : ?>
				<div class="empty">
					<p><?php echo is_search() ? esc_html__( 'Nothing matched that search.', 'dumitru' ) : esc_html__( 'No posts here yet.', 'dumitru' ); ?></p>
					<a class="key" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Back home', 'dumitru' ); ?></a>
				</div>
			<?php endif; ?>
		</section>
	</div>
</main>

<?php
get_footer();
