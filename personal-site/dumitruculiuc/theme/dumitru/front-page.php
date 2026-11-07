<?php
/**
 * The home page: intro and portrait, press, projects, about, newsletter,
 * latest posts. Each section is shown only when it has real content; the
 * section numbers (01, 02…) follow the ones shown.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$dumitru_no = 0;
$dumitru_next = function () use ( &$dumitru_no ) {
	$dumitru_no++;
	return sprintf( '%02d', $dumitru_no );
};

$dumitru_greeting      = dumitru_mod( 'greeting' );
$dumitru_greeting_name = dumitru_mod( 'greeting_name' );
$dumitru_intro         = dumitru_mod( 'intro' );
$dumitru_pitch_line    = dumitru_mod( 'pitch_line' );
$dumitru_pitch_url     = dumitru_mod( 'pitch_url' );
$dumitru_follow_label  = dumitru_mod( 'follow_label' );
$dumitru_follow_url    = dumitru_mod( 'follow_url' );
$dumitru_cards         = dumitru_projects( true );
$dumitru_shelf         = dumitru_projects( false );
$dumitru_about_title   = dumitru_mod( 'about_title' );
$dumitru_about_body    = dumitru_mod( 'about_body' );
$dumitru_about_points  = dumitru_lines( dumitru_mod( 'about_points' ) );
$dumitru_about_photo   = (int) get_theme_mod( 'dumitru_about_photo', 0 );
$dumitru_press         = array();
foreach ( dumitru_lines( dumitru_mod( 'press' ) ) as $dumitru_line ) {
	$dumitru_parts = array_map( 'trim', explode( '|', $dumitru_line, 2 ) );
	if ( 2 === count( $dumitru_parts ) && '' !== $dumitru_parts[0] && wp_http_validate_url( $dumitru_parts[1] ) ) {
		$dumitru_press[] = $dumitru_parts;
	}
}
$dumitru_posts = new WP_Query(
	array(
		'post_type'           => 'post',
		'posts_per_page'      => 4,
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	)
);
?>

<main id="main" class="front">
	<div class="rack">

		<section class="plate plate--screwed hero" aria-label="<?php esc_attr_e( 'Introduction', 'dumitru' ); ?>">
			<div class="hero__grid">
				<div class="hero__copy">
					<h1 class="display-1">
						<?php if ( '' !== $dumitru_greeting ) : ?>
							<?php echo esc_html( $dumitru_greeting ); ?>
							<span class="marker"><?php echo esc_html( '' !== $dumitru_greeting_name ? $dumitru_greeting_name : dumitru_first_name() ); ?></span>
						<?php else : ?>
							<span class="marker"><?php echo esc_html( dumitru_name() ); ?></span>
						<?php endif; ?>
					</h1>
					<?php if ( '' !== $dumitru_intro ) : ?>
						<div class="hero__intro body-lg"><?php echo wp_kses_post( wpautop( $dumitru_intro ) ); ?></div>
					<?php endif; ?>
					<?php echo dumitru_newsletter_form( 'hero' ); // phpcs:ignore WordPress.Security.EscapeOutput -- the newsletter plugin's own form. ?>
				</div>

				<div class="hero__stage">
					<div class="hero__portrait">
						<?php echo dumitru_portrait_html(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
						<?php if ( '' !== $dumitru_pitch_line && '' !== $dumitru_pitch_url ) : ?>
							<a class="pitch" href="<?php echo esc_url( $dumitru_pitch_url ); ?>"<?php echo dumitru_link_attrs( $dumitru_pitch_url ); // phpcs:ignore ?>>
								<span class="pitch__bubble">
									<?php if ( '' !== dumitru_mod( 'pitch_kicker' ) ) : ?>
										<span class="pitch__kicker">
											<span class="pitch__calm"><?php echo esc_html( dumitru_mod( 'pitch_kicker' ) ); ?></span>
											<?php if ( '' !== dumitru_mod( 'pitch_hurt' ) ) : ?>
												<span class="pitch__hurt" aria-hidden="true"><?php echo esc_html( dumitru_mod( 'pitch_hurt' ) ); ?></span>
											<?php endif; ?>
										</span>
									<?php endif; ?>
									<span class="pitch__line"><?php echo esc_html( $dumitru_pitch_line ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></span>
								</span>
							</a>
						<?php endif; ?>
					</div>
					<p class="hero__hint silk" aria-hidden="true"><?php esc_html_e( 'Grab my face', 'dumitru' ); ?></p>
					<?php if ( '' !== $dumitru_follow_label && '' !== $dumitru_follow_url ) : ?>
						<a class="hero__follow silk" href="<?php echo esc_url( $dumitru_follow_url ); ?>"<?php echo dumitru_link_attrs( $dumitru_follow_url ); // phpcs:ignore ?>><?php echo esc_html( $dumitru_follow_label ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></a>
					<?php endif; ?>
				</div>
			</div>
		</section>

		<?php if ( $dumitru_press ) : ?>
			<div class="press">
				<h2 class="press__label silk"><?php esc_html_e( 'As featured in', 'dumitru' ); ?></h2>
				<ul class="press__row">
					<?php foreach ( $dumitru_press as $dumitru_mention ) : ?>
						<li><a class="press__link" href="<?php echo esc_url( $dumitru_mention[1] ); ?>" target="_blank" rel="noopener"><?php echo esc_html( $dumitru_mention[0] ); ?></a></li>
					<?php endforeach; ?>
				</ul>
			</div>
		<?php endif; ?>

		<?php if ( $dumitru_cards || $dumitru_shelf ) : ?>
			<section id="work" class="plate">
				<?php dumitru_strip( $dumitru_next(), '' !== dumitru_mod( 'work_title' ) ? dumitru_mod( 'work_title' ) : __( 'Things I\'ve built', 'dumitru' ), dumitru_mod( 'work_note' ) ); ?>
				<?php if ( $dumitru_cards ) : ?>
					<div class="catalogue catalogue--<?php echo esc_attr( min( 3, count( $dumitru_cards ) ) ); ?>">
						<?php foreach ( $dumitru_cards as $dumitru_card ) : ?>
							<?php $dumitru_tag = '' !== $dumitru_card['url'] ? 'a' : 'div'; ?>
							<<?php echo $dumitru_tag; // phpcs:ignore ?> class="product"<?php if ( 'a' === $dumitru_tag ) { echo ' href="' . esc_url( $dumitru_card['url'] ) . '"' . dumitru_link_attrs( $dumitru_card['url'] ); } // phpcs:ignore ?>>
								<span class="product__top">
									<span class="silk figures"><?php echo esc_html( $dumitru_card['code'] ); ?></span>
									<span class="silk figures"><?php echo esc_html( $dumitru_card['year'] ); ?></span>
								</span>
								<span class="product__mark">
									<?php
									if ( $dumitru_card['logo'] ) {
										echo wp_get_attachment_image( $dumitru_card['logo'], 'medium', false, array( 'alt' => '', 'loading' => 'lazy' ) );
									} else {
										echo '<span class="product__initial" aria-hidden="true">' . esc_html( mb_substr( $dumitru_card['name'], 0, 1 ) ) . '</span>';
									}
									?>
								</span>
								<span class="product__name"><?php echo esc_html( $dumitru_card['name'] ); ?></span>
								<?php if ( '' !== $dumitru_card['does'] ) : ?>
									<span class="product__does"><?php echo esc_html( $dumitru_card['does'] ); ?></span>
								<?php endif; ?>
								<?php if ( 'a' === $dumitru_tag ) : ?>
									<span class="product__go seat" aria-hidden="true"><?php echo dumitru_arrow(); // phpcs:ignore ?></span>
								<?php endif; ?>
							</<?php echo $dumitru_tag; // phpcs:ignore ?>>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>

				<?php if ( $dumitru_shelf || '' !== dumitru_mod( 'work_more_url' ) ) : ?>
					<div class="shelf">
						<?php if ( $dumitru_shelf ) : ?>
							<div class="shelf__carousel" data-dc-shelf>
								<button class="shelf__control" type="button" data-dc-shelf-step="-1" aria-label="<?php esc_attr_e( 'Previous projects', 'dumitru' ); ?>">&#8592;</button>
								<ul class="shelf__items" tabindex="0" aria-label="<?php esc_attr_e( 'More projects', 'dumitru' ); ?>">
									<?php foreach ( $dumitru_shelf as $dumitru_item ) : ?>
										<li>
											<?php if ( '' !== $dumitru_item['url'] ) : ?>
												<a class="shelf__item" href="<?php echo esc_url( $dumitru_item['url'] ); ?>"<?php echo dumitru_link_attrs( $dumitru_item['url'] ); // phpcs:ignore ?>>
											<?php else : ?>
												<span class="shelf__item">
											<?php endif; ?>
											<?php
											if ( $dumitru_item['logo'] ) {
												echo wp_get_attachment_image( $dumitru_item['logo'], 'medium', false, array( 'alt' => $dumitru_item['name'], 'loading' => 'lazy' ) );
											} else {
												echo '<span class="shelf__name">' . esc_html( $dumitru_item['name'] ) . '</span>';
											}
											?>
											<?php echo '' !== $dumitru_item['url'] ? '</a>' : '</span>'; ?>
										</li>
									<?php endforeach; ?>
								</ul>
								<button class="shelf__control" type="button" data-dc-shelf-step="1" aria-label="<?php esc_attr_e( 'Next projects', 'dumitru' ); ?>">&#8594;</button>
							</div>
						<?php endif; ?>
						<?php if ( '' !== dumitru_mod( 'work_more_url' ) && '' !== dumitru_mod( 'work_more_label' ) ) : ?>
							<a class="key key--light" href="<?php echo esc_url( dumitru_mod( 'work_more_url' ) ); ?>"<?php echo dumitru_link_attrs( dumitru_mod( 'work_more_url' ) ); // phpcs:ignore ?>><?php echo esc_html( dumitru_mod( 'work_more_label' ) ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></a>
						<?php endif; ?>
					</div>
				<?php endif; ?>
			</section>
		<?php endif; ?>

		<?php if ( '' !== $dumitru_about_body ) : ?>
			<section id="about" class="plate">
				<?php dumitru_strip( $dumitru_next(), __( 'About', 'dumitru' ) ); ?>
				<div class="about<?php echo $dumitru_about_photo ? ' about--photo' : ''; ?>">
					<div>
						<?php if ( '' !== $dumitru_about_title ) : ?>
							<h3 class="about__title"><?php echo esc_html( $dumitru_about_title ); ?></h3>
						<?php endif; ?>
						<div class="about__body"><?php echo wp_kses_post( wpautop( $dumitru_about_body ) ); ?></div>
						<?php if ( $dumitru_about_points ) : ?>
							<ul class="points">
								<?php foreach ( $dumitru_about_points as $dumitru_point ) : ?>
									<li><span class="pip" aria-hidden="true"></span><span><?php echo esc_html( $dumitru_point ); ?></span></li>
								<?php endforeach; ?>
							</ul>
						<?php endif; ?>
					</div>
					<?php if ( $dumitru_about_photo ) : ?>
						<figure class="about__picture">
							<div class="about__frame"><?php echo wp_get_attachment_image( $dumitru_about_photo, 'large', false, array( 'loading' => 'lazy' ) ); ?></div>
							<?php if ( '' !== dumitru_mod( 'about_caption' ) ) : ?>
								<figcaption><span class="silk"><?php esc_html_e( 'Fig. 1', 'dumitru' ); ?></span> <span class="silk"><?php echo esc_html( dumitru_mod( 'about_caption' ) ); ?></span></figcaption>
							<?php endif; ?>
						</figure>
					<?php endif; ?>
				</div>
			</section>
		<?php endif; ?>

		<?php $dumitru_pitch_form = dumitru_newsletter_form( 'pitch' ); ?>
		<?php if ( '' !== $dumitru_pitch_form && '' !== dumitru_mod( 'newsletter_title' ) ) : ?>
			<section id="newsletter" class="plate plate--sheet pitch-plate">
				<?php dumitru_strip( $dumitru_next(), __( 'Newsletter', 'dumitru' ), '', 'p' ); ?>
				<div class="pitch-plate__body">
					<h2 class="pitch-plate__title"><?php echo esc_html( dumitru_mod( 'newsletter_title' ) ); ?></h2>
					<?php if ( '' !== dumitru_mod( 'newsletter_body' ) ) : ?>
						<div class="pitch-plate__copy"><?php echo wp_kses_post( wpautop( dumitru_mod( 'newsletter_body' ) ) ); ?></div>
					<?php endif; ?>
					<?php echo $dumitru_pitch_form; // phpcs:ignore WordPress.Security.EscapeOutput -- the newsletter plugin's own form. ?>
				</div>
			</section>
		<?php endif; ?>

		<?php if ( $dumitru_posts->have_posts() ) : ?>
			<section id="writing" class="plate">
				<?php dumitru_strip( $dumitru_next(), '' !== dumitru_mod( 'blog_title' ) ? dumitru_mod( 'blog_title' ) : __( 'Blog', 'dumitru' ) ); ?>
				<div class="post-list">
					<?php
					while ( $dumitru_posts->have_posts() ) :
						$dumitru_posts->the_post();
						get_template_part( 'template-parts/post-row' );
					endwhile;
					wp_reset_postdata();
					?>
				</div>
				<?php if ( (int) get_option( 'page_for_posts' ) ) : ?>
					<div class="plate__foot">
						<a class="key" href="<?php echo esc_url( dumitru_blog_url() ); ?>"><?php esc_html_e( 'See all posts', 'dumitru' ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></a>
					</div>
				<?php endif; ?>
			</section>
		<?php endif; ?>

	</div>
</main>

<?php
get_footer();
