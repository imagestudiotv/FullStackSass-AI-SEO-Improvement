<?php
/**
 * Page not found.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>
<main id="main" class="listing">
	<div class="rack">
		<section class="plate plate--screwed empty empty--404">
			<p class="silk"><?php esc_html_e( 'Error 404', 'dumitru' ); ?></p>
			<h1 class="display-2"><?php esc_html_e( 'This page does not exist', 'dumitru' ); ?></h1>
			<p><?php esc_html_e( 'The link may be old, or the address mistyped.', 'dumitru' ); ?></p>
			<div class="empty__actions">
				<a class="key key--orange" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'dumitru' ); ?></a>
				<a class="key key--light" href="<?php echo esc_url( dumitru_blog_url() ); ?>"><?php esc_html_e( 'Blog', 'dumitru' ); ?></a>
			</div>
			<?php get_search_form(); ?>
		</section>
	</div>
</main>
<?php
get_footer();
