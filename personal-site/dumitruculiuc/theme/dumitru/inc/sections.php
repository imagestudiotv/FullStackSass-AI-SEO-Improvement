<?php
/**
 * The home page's sections.
 *
 * One function per section prints its markup. Both the Customizer layout
 * (front-page.php without Elementor) and the Elementor widgets
 * (inc/elementor/) call them, so the page looks the same either way.
 *
 * Each function prints nothing when its section has no real content, and
 * returns whether it printed something.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The next section number ("01", "02"…). Only shown sections take one.
 *
 * @return string
 */
function dumitru_section_number() {
	static $number = 0;
	$number++;
	return sprintf( '%02d', $number );
}

/**
 * Intro and portrait.
 *
 * @param array $args {
 *     @type string $greeting      Text before the highlighted name.
 *     @type string $greeting_name The highlighted name. Empty: the first name.
 *     @type string $intro         Intro paragraphs (HTML allowed).
 *     @type string $pitch_kicker  Speech bubble: small first line.
 *     @type string $pitch_hurt    Speech bubble: line while the face is pulled.
 *     @type string $pitch_line    Speech bubble: main line.
 *     @type string $pitch_url     Speech bubble: address.
 *     @type string $follow_label  Link under the portrait: text.
 *     @type string $follow_url    Link under the portrait: address.
 * }
 * @return bool Always true: the portrait is always shown.
 */
function dumitru_intro_section( $args ) {
	$keys = array( 'greeting', 'greeting_name', 'intro', 'pitch_kicker', 'pitch_hurt', 'pitch_line', 'pitch_url', 'follow_label', 'follow_url' );
	$a    = array();
	foreach ( $keys as $key ) {
		$a[ $key ] = isset( $args[ $key ] ) ? trim( (string) $args[ $key ] ) : '';
	}
	?>
		<section class="plate plate--screwed hero" aria-label="<?php esc_attr_e( 'Introduction', 'dumitru' ); ?>">
			<div class="hero__grid">
				<div class="hero__copy">
					<h1 class="display-1">
						<?php if ( '' !== $a['greeting'] ) : ?>
							<?php echo esc_html( $a['greeting'] ); ?>
							<span class="marker"><?php echo esc_html( '' !== $a['greeting_name'] ? $a['greeting_name'] : dumitru_first_name() ); ?></span>
						<?php else : ?>
							<span class="marker"><?php echo esc_html( dumitru_name() ); ?></span>
						<?php endif; ?>
					</h1>
					<?php if ( '' !== $a['intro'] ) : ?>
						<div class="hero__intro body-lg"><?php echo wp_kses_post( wpautop( $a['intro'] ) ); ?></div>
					<?php endif; ?>
					<?php echo dumitru_newsletter_form( 'hero' ); // phpcs:ignore WordPress.Security.EscapeOutput -- the newsletter plugin's own form. ?>
				</div>

				<div class="hero__stage">
					<div class="hero__portrait">
						<?php echo dumitru_portrait_html(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
						<?php if ( '' !== $a['pitch_line'] && '' !== $a['pitch_url'] ) : ?>
							<a class="pitch" href="<?php echo esc_url( $a['pitch_url'] ); ?>"<?php echo dumitru_link_attrs( $a['pitch_url'] ); // phpcs:ignore ?>>
								<span class="pitch__bubble">
									<?php if ( '' !== $a['pitch_kicker'] ) : ?>
										<span class="pitch__kicker">
											<span class="pitch__calm"><?php echo esc_html( $a['pitch_kicker'] ); ?></span>
											<?php if ( '' !== $a['pitch_hurt'] ) : ?>
												<span class="pitch__hurt" aria-hidden="true"><?php echo esc_html( $a['pitch_hurt'] ); ?></span>
											<?php endif; ?>
										</span>
									<?php endif; ?>
									<span class="pitch__line"><?php echo esc_html( $a['pitch_line'] ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></span>
								</span>
							</a>
						<?php endif; ?>
					</div>
					<p class="hero__hint silk" aria-hidden="true"><?php esc_html_e( 'Grab my face', 'dumitru' ); ?></p>
					<?php if ( '' !== $a['follow_label'] && '' !== $a['follow_url'] ) : ?>
						<a class="hero__follow silk" href="<?php echo esc_url( $a['follow_url'] ); ?>"<?php echo dumitru_link_attrs( $a['follow_url'] ); // phpcs:ignore ?>><?php echo esc_html( $a['follow_label'] ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></a>
					<?php endif; ?>
				</div>
			</div>
		</section>
	<?php
	return true;
}

/**
 * "As featured in": real articles only.
 *
 * @param array[] $mentions Each: array( name, address ). Incomplete ones are skipped.
 * @return bool
 */
function dumitru_press_section( $mentions ) {
	$press = array();
	foreach ( (array) $mentions as $mention ) {
		$name = isset( $mention[0] ) ? trim( (string) $mention[0] ) : '';
		$url  = isset( $mention[1] ) ? trim( (string) $mention[1] ) : '';
		if ( '' !== $name && wp_http_validate_url( $url ) ) {
			$press[] = array( $name, $url );
		}
	}
	if ( ! $press ) {
		return false;
	}
	?>
		<div class="press">
			<h2 class="press__label silk"><?php esc_html_e( 'As featured in', 'dumitru' ); ?></h2>
			<ul class="press__row">
				<?php foreach ( $press as $mention ) : ?>
					<li><a class="press__link" href="<?php echo esc_url( $mention[1] ); ?>" target="_blank" rel="noopener"><?php echo esc_html( $mention[0] ); ?></a></li>
				<?php endforeach; ?>
			</ul>
		</div>
	<?php
	return true;
}

/**
 * Projects: big cards, then the logo strip and an optional button.
 *
 * @param array $args {
 *     @type string  $title      Section title. Empty: "Things I've built".
 *     @type string  $note       Note on the right.
 *     @type array[] $cards      Big cards (see dumitru_projects()).
 *     @type array[] $shelf      Logo strip items (see dumitru_projects()).
 *     @type string  $more_label Button under the projects: text.
 *     @type string  $more_url   Button under the projects: address.
 * }
 * @return bool
 */
function dumitru_work_section( $args ) {
	$title      = isset( $args['title'] ) ? trim( (string) $args['title'] ) : '';
	$note       = isset( $args['note'] ) ? trim( (string) $args['note'] ) : '';
	$cards      = ! empty( $args['cards'] ) ? array_values( $args['cards'] ) : array();
	$shelf      = ! empty( $args['shelf'] ) ? array_values( $args['shelf'] ) : array();
	$more_label = isset( $args['more_label'] ) ? trim( (string) $args['more_label'] ) : '';
	$more_url   = isset( $args['more_url'] ) ? trim( (string) $args['more_url'] ) : '';
	if ( ! $cards && ! $shelf ) {
		return false;
	}
	?>
			<section id="work" class="plate">
				<?php dumitru_strip( dumitru_section_number(), '' !== $title ? $title : __( 'Things I\'ve built', 'dumitru' ), $note ); ?>
				<?php if ( $cards ) : ?>
					<div class="catalogue catalogue--<?php echo esc_attr( min( 3, count( $cards ) ) ); ?>">
						<?php foreach ( $cards as $card ) : ?>
							<?php $tag = '' !== $card['url'] ? 'a' : 'div'; ?>
							<<?php echo $tag; // phpcs:ignore ?> class="product"<?php if ( 'a' === $tag ) { echo ' href="' . esc_url( $card['url'] ) . '"' . dumitru_link_attrs( $card['url'] ); } // phpcs:ignore ?>>
								<span class="product__top">
									<span class="silk figures"><?php echo esc_html( $card['code'] ); ?></span>
									<span class="silk figures"><?php echo esc_html( $card['year'] ); ?></span>
								</span>
								<span class="product__mark">
									<?php
									if ( $card['logo'] ) {
										echo wp_get_attachment_image( $card['logo'], 'medium', false, array( 'alt' => '', 'loading' => 'lazy' ) );
									} else {
										echo '<span class="product__initial" aria-hidden="true">' . esc_html( mb_substr( $card['name'], 0, 1 ) ) . '</span>';
									}
									?>
								</span>
								<span class="product__name"><?php echo esc_html( $card['name'] ); ?></span>
								<?php if ( '' !== $card['does'] ) : ?>
									<span class="product__does"><?php echo esc_html( $card['does'] ); ?></span>
								<?php endif; ?>
								<?php if ( 'a' === $tag ) : ?>
									<span class="product__go seat" aria-hidden="true"><?php echo dumitru_arrow(); // phpcs:ignore ?></span>
								<?php endif; ?>
							</<?php echo $tag; // phpcs:ignore ?>>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>

				<?php if ( $shelf || '' !== $more_url ) : ?>
					<div class="shelf">
						<?php if ( $shelf ) : ?>
							<div class="shelf__carousel" data-dc-shelf>
								<button class="shelf__control" type="button" data-dc-shelf-step="-1" aria-label="<?php esc_attr_e( 'Previous projects', 'dumitru' ); ?>">&#8592;</button>
								<ul class="shelf__items" tabindex="0" aria-label="<?php esc_attr_e( 'More projects', 'dumitru' ); ?>">
									<?php foreach ( $shelf as $item ) : ?>
										<li>
											<?php if ( '' !== $item['url'] ) : ?>
												<a class="shelf__item" href="<?php echo esc_url( $item['url'] ); ?>"<?php echo dumitru_link_attrs( $item['url'] ); // phpcs:ignore ?>>
											<?php else : ?>
												<span class="shelf__item">
											<?php endif; ?>
											<?php
											if ( $item['logo'] ) {
												echo wp_get_attachment_image( $item['logo'], 'medium', false, array( 'alt' => $item['name'], 'loading' => 'lazy' ) );
											} else {
												echo '<span class="shelf__name">' . esc_html( $item['name'] ) . '</span>';
											}
											?>
											<?php echo '' !== $item['url'] ? '</a>' : '</span>'; ?>
										</li>
									<?php endforeach; ?>
								</ul>
								<button class="shelf__control" type="button" data-dc-shelf-step="1" aria-label="<?php esc_attr_e( 'Next projects', 'dumitru' ); ?>">&#8594;</button>
							</div>
						<?php endif; ?>
						<?php if ( '' !== $more_url && '' !== $more_label ) : ?>
							<a class="key key--light" href="<?php echo esc_url( $more_url ); ?>"<?php echo dumitru_link_attrs( $more_url ); // phpcs:ignore ?>><?php echo esc_html( $more_label ); ?> <?php echo dumitru_arrow(); // phpcs:ignore ?></a>
						<?php endif; ?>
					</div>
				<?php endif; ?>
			</section>
	<?php
	return true;
}

/**
 * About. Hidden without a text.
 *
 * @param array $args {
 *     @type string   $title   Title.
 *     @type string   $body    Text (HTML allowed).
 *     @type string[] $points  Highlights.
 *     @type int      $photo   Attachment ID, 0 for none.
 *     @type string   $caption Photo caption.
 * }
 * @return bool
 */
function dumitru_about_section( $args ) {
	$title   = isset( $args['title'] ) ? trim( (string) $args['title'] ) : '';
	$body    = isset( $args['body'] ) ? trim( (string) $args['body'] ) : '';
	$points  = isset( $args['points'] ) ? array_values( array_filter( array_map( 'trim', (array) $args['points'] ), 'strlen' ) ) : array();
	$photo   = isset( $args['photo'] ) ? absint( $args['photo'] ) : 0;
	$caption = isset( $args['caption'] ) ? trim( (string) $args['caption'] ) : '';
	if ( ! dumitru_has_text( $body ) ) {
		return false;
	}
	?>
			<section id="about" class="plate">
				<?php dumitru_strip( dumitru_section_number(), __( 'About', 'dumitru' ) ); ?>
				<div class="about<?php echo $photo ? ' about--photo' : ''; ?>">
					<div>
						<?php if ( '' !== $title ) : ?>
							<h3 class="about__title"><?php echo esc_html( $title ); ?></h3>
						<?php endif; ?>
						<div class="about__body"><?php echo wp_kses_post( wpautop( $body ) ); ?></div>
						<?php if ( $points ) : ?>
							<ul class="points">
								<?php foreach ( $points as $point ) : ?>
									<li><span class="pip" aria-hidden="true"></span><span><?php echo esc_html( $point ); ?></span></li>
								<?php endforeach; ?>
							</ul>
						<?php endif; ?>
					</div>
					<?php if ( $photo ) : ?>
						<figure class="about__picture">
							<div class="about__frame"><?php echo wp_get_attachment_image( $photo, 'large', false, array( 'loading' => 'lazy' ) ); ?></div>
							<?php if ( '' !== $caption ) : ?>
								<figcaption><span class="silk"><?php esc_html_e( 'Fig. 1', 'dumitru' ); ?></span> <span class="silk"><?php echo esc_html( $caption ); ?></span></figcaption>
							<?php endif; ?>
						</figure>
					<?php endif; ?>
				</div>
			</section>
	<?php
	return true;
}

/**
 * Newsletter section (Customizer layout only; shown only when a newsletter
 * plugin is really connected).
 *
 * @return bool
 */
function dumitru_newsletter_section() {
	$form = dumitru_newsletter_form( 'pitch' );
	if ( '' === $form || '' === dumitru_mod( 'newsletter_title' ) ) {
		return false;
	}
	?>
			<section id="newsletter" class="plate plate--sheet pitch-plate">
				<?php dumitru_strip( dumitru_section_number(), __( 'Newsletter', 'dumitru' ), '', 'p' ); ?>
				<div class="pitch-plate__body">
					<h2 class="pitch-plate__title"><?php echo esc_html( dumitru_mod( 'newsletter_title' ) ); ?></h2>
					<?php if ( '' !== dumitru_mod( 'newsletter_body' ) ) : ?>
						<div class="pitch-plate__copy"><?php echo wp_kses_post( wpautop( dumitru_mod( 'newsletter_body' ) ) ); ?></div>
					<?php endif; ?>
					<?php echo $form; // phpcs:ignore WordPress.Security.EscapeOutput -- the newsletter plugin's own form. ?>
				</div>
			</section>
	<?php
	return true;
}

/**
 * Latest posts. Hidden while there are none.
 *
 * @param array $args {
 *     @type string $title Section title. Empty: "Blog".
 *     @type int    $count How many posts (1-12). Default 4.
 * }
 * @return bool
 */
function dumitru_posts_section( $args ) {
	$title = isset( $args['title'] ) ? trim( (string) $args['title'] ) : '';
	$count = isset( $args['count'] ) ? max( 1, min( 12, absint( $args['count'] ) ) ) : 4;
	$posts = new WP_Query(
		array(
			'post_type'           => 'post',
			'posts_per_page'      => $count,
			'ignore_sticky_posts' => true,
			'no_found_rows'       => true,
		)
	);
	if ( ! $posts->have_posts() ) {
		return false;
	}
	?>
			<section id="writing" class="plate">
				<?php dumitru_strip( dumitru_section_number(), '' !== $title ? $title : __( 'Blog', 'dumitru' ) ); ?>
				<div class="post-list">
					<?php
					while ( $posts->have_posts() ) :
						$posts->the_post();
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
	<?php
	return true;
}

/*
 * The same sections filled from Appearance → Customize → Home page.
 */

/**
 * @return array Arguments for dumitru_intro_section().
 */
function dumitru_customizer_intro() {
	$args = array();
	foreach ( array( 'greeting', 'greeting_name', 'intro', 'pitch_kicker', 'pitch_hurt', 'pitch_line', 'pitch_url', 'follow_label', 'follow_url' ) as $key ) {
		$args[ $key ] = dumitru_mod( $key );
	}
	return $args;
}

/**
 * "Name | address" lines.
 *
 * @return array[] Each: array( name, address ).
 */
function dumitru_customizer_press() {
	$press = array();
	foreach ( dumitru_lines( dumitru_mod( 'press' ) ) as $line ) {
		$press[] = array_map( 'trim', array_pad( explode( '|', $line, 2 ), 2, '' ) );
	}
	return $press;
}

/**
 * @return array Arguments for dumitru_work_section(), with the projects from
 *               the admin menu Projects.
 */
function dumitru_customizer_work() {
	return array(
		'title'      => dumitru_mod( 'work_title' ),
		'note'       => dumitru_mod( 'work_note' ),
		'cards'      => dumitru_projects( true ),
		'shelf'      => dumitru_projects( false ),
		'more_label' => dumitru_mod( 'work_more_label' ),
		'more_url'   => dumitru_mod( 'work_more_url' ),
	);
}

/**
 * @return array Arguments for dumitru_about_section().
 */
function dumitru_customizer_about() {
	return array(
		'title'   => dumitru_mod( 'about_title' ),
		'body'    => dumitru_mod( 'about_body' ),
		'points'  => dumitru_lines( dumitru_mod( 'about_points' ) ),
		'photo'   => (int) get_theme_mod( 'dumitru_about_photo', 0 ),
		'caption' => dumitru_mod( 'about_caption' ),
	);
}

/**
 * @return array Arguments for dumitru_posts_section().
 */
function dumitru_customizer_posts() {
	return array(
		'title' => dumitru_mod( 'blog_title' ),
		'count' => 4,
	);
}
