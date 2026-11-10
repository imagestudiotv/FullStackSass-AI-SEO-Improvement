<?php
/**
 * Template Name: Full width (for Elementor)
 * Template Post Type: page, post
 *
 * The theme's header and footer around the page's own content, with no
 * title or plate, so a page designed in Elementor uses the whole width.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>
<main id="main" class="full-width">
	<?php
	while ( have_posts() ) :
		the_post();
		the_content();
	endwhile;
	?>
</main>
<?php
get_footer();
