<?php
/**
 * One post in a list: big year, month, title, excerpt, arrow.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<a class="post-row" href="<?php the_permalink(); ?>">
	<time class="post-row__date" datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>">
		<span class="post-row__year"><?php echo esc_html( get_the_date( 'Y' ) ); ?></span>
		<span class="silk"><?php echo esc_html( get_the_date( 'M' ) ); ?></span>
	</time>
	<span class="post-row__text">
		<span class="post-row__title"><?php the_title(); ?></span>
		<?php if ( get_the_excerpt() ) : ?>
			<span class="post-row__excerpt"><?php echo esc_html( wp_strip_all_tags( get_the_excerpt() ) ); ?></span>
		<?php endif; ?>
	</span>
	<span class="seat" aria-hidden="true"><?php echo dumitru_arrow(); // phpcs:ignore ?></span>
</a>
