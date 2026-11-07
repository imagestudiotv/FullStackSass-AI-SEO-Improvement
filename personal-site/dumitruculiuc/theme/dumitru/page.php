<?php
/**
 * An ordinary page (also pages built with Elementor's editor).
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

while ( have_posts() ) :
	the_post();
	?>
	<main id="main" class="reading">
		<div class="rack">
			<article <?php post_class( 'plate article' ); ?>>
				<header class="article__head">
					<h1 class="article__title"><?php the_title(); ?></h1>
				</header>
				<div class="prose">
					<?php the_content(); ?>
				</div>
			</article>
			<?php if ( comments_open() || get_comments_number() ) : ?>
				<section class="plate comments-plate"><?php comments_template(); ?></section>
			<?php endif; ?>
		</div>
	</main>
	<?php
endwhile;

get_footer();
