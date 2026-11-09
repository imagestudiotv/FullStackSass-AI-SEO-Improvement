<?php
/**
 * Newsletter band (when set up), contact and social links, copyright.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$dumitru_email  = dumitru_mod( 'email' );
$dumitru_social = dumitru_social_links();
$dumitru_band   = dumitru_newsletter_form( 'band' );
?>

<?php if ( '' !== $dumitru_band && '' !== dumitru_mod( 'newsletter_band_title' ) ) : ?>
	<div class="closer">
		<div class="rack">
			<section class="plate plate--contrast plate--screwed band" aria-labelledby="band-title">
				<div class="band__copy">
					<p class="silk"><?php esc_html_e( 'Newsletter', 'dumitru' ); ?></p>
					<h2 id="band-title" class="band__title"><?php echo esc_html( dumitru_mod( 'newsletter_band_title' ) ); ?></h2>
					<?php if ( '' !== dumitru_mod( 'newsletter_band_text' ) ) : ?>
						<p class="band__text"><?php echo esc_html( dumitru_mod( 'newsletter_band_text' ) ); ?></p>
					<?php endif; ?>
				</div>
				<?php echo $dumitru_band; // phpcs:ignore WordPress.Security.EscapeOutput -- the newsletter plugin's own form. ?>
			</section>
		</div>
	</div>
<?php endif; ?>

<footer class="site-footer">
	<div class="rack">
		<div class="footer-panel">
			<?php if ( '' !== $dumitru_email && is_email( $dumitru_email ) ) : ?>
				<a class="footer-email" href="<?php echo esc_url( 'mailto:' . antispambot( $dumitru_email ) ); ?>">
					<span class="silk"><?php esc_html_e( 'Write to me', 'dumitru' ); ?></span>
					<span class="footer-email__address"><?php echo esc_html( antispambot( $dumitru_email ) ); ?></span>
				</a>
			<?php endif; ?>

			<?php if ( $dumitru_social ) : ?>
				<ul class="knobs">
					<?php foreach ( $dumitru_social as $dumitru_link ) : ?>
						<li>
							<span class="silk silk--sm" aria-hidden="true"><?php echo esc_html( $dumitru_link['label'] ); ?></span>
							<a class="knob knob--<?php echo esc_attr( $dumitru_link['finish'] ); ?>" href="<?php echo esc_url( $dumitru_link['url'] ); ?>" target="_blank" rel="me noopener">
								<span class="screen-reader-text"><?php echo esc_html( $dumitru_link['label'] ); ?></span>
							</a>
						</li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>

			<p class="footer-copy silk">© <?php echo esc_html( wp_date( 'Y' ) . ' ' . dumitru_name() ); ?></p>
		</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
