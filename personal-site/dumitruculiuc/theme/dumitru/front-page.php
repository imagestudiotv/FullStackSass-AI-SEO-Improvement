<?php
/**
 * The home page.
 *
 * Built with Elementor (the free plugin): the theme's header, the page's
 * Elementor content across the full width, the footer. The "Dumitru"
 * widgets print the same sections as below.
 *
 * Otherwise: intro and portrait, press, projects, about, newsletter, latest
 * posts, filled from Appearance → Customize → Home page. Each section is
 * shown only when it has real content; the section numbers (01, 02…) follow
 * the ones shown.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

if ( dumitru_front_uses_elementor() ) :
	?>

<main id="main" class="front front--elementor">
	<?php
	while ( have_posts() ) :
		the_post();
		the_content();
	endwhile;
	?>
</main>

	<?php
else :
	?>

<main id="main" class="front">
	<div class="rack">

		<?php
		dumitru_intro_section( dumitru_customizer_intro() );
		dumitru_press_section( dumitru_customizer_press() );
		dumitru_work_section( dumitru_customizer_work() );
		dumitru_about_section( dumitru_customizer_about() );
		dumitru_newsletter_section();
		dumitru_posts_section( dumitru_customizer_posts() );
		?>

	</div>
</main>

	<?php
endif;

get_footer();
