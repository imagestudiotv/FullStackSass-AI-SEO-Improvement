<?php
/**
 * Small helpers shared by the templates.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A home-page setting from the Customizer, trimmed. Defaults are empty on
 * purpose: a section with no real content is not shown rather than shown
 * with placeholder text.
 *
 * @param string $key     Setting name without the `dumitru_` prefix.
 * @param string $default Fallback.
 * @return string
 */
function dumitru_mod( $key, $default = '' ) {
	$value = get_theme_mod( 'dumitru_' . $key, $default );
	return is_string( $value ) ? trim( $value ) : $value;
}

/**
 * Non-empty lines of a multi-line setting.
 *
 * @param string $text Text.
 * @return string[]
 */
function dumitru_lines( $text ) {
	return array_values( array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', (string) $text ) ) ) );
}

/**
 * The person's name: the home page's Elementor "Intro and portrait" widget
 * when there is one, else the Customizer, else the site title.
 *
 * @return string
 */
function dumitru_name() {
	$name = dumitru_site_value( 'name' );
	return '' !== $name ? $name : get_bloginfo( 'name' );
}

/**
 * Social networks offered for the footer buttons, in display order. The
 * first six are the Customizer's fields.
 *
 * @return array[] Key => array( label, finish ) (finish: the knob's colour).
 */
function dumitru_social_networks() {
	return array(
		'x'         => array( 'X', 'orange' ),
		'linkedin'  => array( 'LinkedIn', 'steel' ),
		'instagram' => array( 'Instagram', 'graphite' ),
		'github'    => array( 'GitHub', 'white' ),
		'youtube'   => array( 'YouTube', 'orange' ),
		'facebook'  => array( 'Facebook', 'steel' ),
		'tiktok'    => array( 'TikTok', 'graphite' ),
		'threads'   => array( 'Threads', 'white' ),
		'bluesky'   => array( 'Bluesky', 'steel' ),
		'medium'    => array( 'Medium', 'graphite' ),
	);
}

/**
 * Social profiles that have a URL, in display order: the home page's
 * Elementor "Contact and social" widget when there is one, else the
 * Customizer.
 *
 * @return array[] Each: key, label, url, finish (the knob's colour).
 */
function dumitru_social_links() {
	$contact = dumitru_home_widget( 'dumitru-contact' );
	if ( null !== $contact ) {
		return dumitru_elementor_social_links( $contact );
	}
	$links = array();
	foreach ( array_slice( dumitru_social_networks(), 0, 6, true ) as $key => $meta ) {
		$url = dumitru_mod( 'social_' . $key );
		if ( '' !== $url ) {
			$links[] = array(
				'key'    => $key,
				'label'  => $meta[0],
				'url'    => $url,
				'finish' => $meta[1],
			);
		}
	}
	return $links;
}

/**
 * Theme image URL.
 *
 * @param string $path Path below assets/images/.
 * @return string
 */
function dumitru_image( $path ) {
	return get_template_directory_uri() . '/assets/images/' . ltrim( $path, '/' );
}

/**
 * The grabbable portrait. Without JavaScript or WebGL it is the photograph
 * in its circle.
 *
 * @param array $args {
 *     @type string $alt   Alternative text. Default: the person's name.
 *     @type string $sizes `sizes` for the photograph.
 *     @type bool   $poke  Whether to add the keyboard "poke" button.
 * }
 * @return string HTML.
 */
function dumitru_portrait_html( $args = array() ) {
	$args = wp_parse_args(
		$args,
		array(
			'alt'   => dumitru_name(),
			'sizes' => '(max-width: 760px) 80vw, 30rem',
			'poke'  => true,
		)
	);

	// With the expression photos (tools/make-expressions.mjs) the portrait
	// starts from their resting face, so the faces match it exactly.
	$expressions = file_exists( get_template_directory() . '/assets/images/portrait/expressions/expressions.json' );
	if ( $expressions ) {
		$photo_480 = dumitru_image( 'portrait/expressions/face-rest-480.webp' );
		$photo_640 = dumitru_image( 'portrait/expressions/face-rest.webp' );
	} else {
		$photo_480 = dumitru_image( 'portrait/cutout-480.webp' );
		$photo_640 = dumitru_image( 'portrait/cutout-640.webp' );
	}

	ob_start();
	?>
	<div class="dc-portrait" data-dc-portrait data-texture="<?php echo esc_url( $photo_640 ); ?>"<?php if ( $expressions ) : ?> data-expressions="<?php echo esc_url( dumitru_image( 'portrait/expressions/expressions.json' ) . '?ver=' . DUMITRU_VERSION ); ?>"<?php endif; ?>>
		<span class="dc-portrait__disc" aria-hidden="true"></span>
		<div class="dc-portrait__stage">
			<img class="dc-portrait__img"
				src="<?php echo esc_url( $photo_480 ); ?>"
				srcset="<?php echo esc_url( $photo_480 ); ?> 480w, <?php echo esc_url( $photo_640 ); ?> 640w"
				sizes="<?php echo esc_attr( $args['sizes'] ); ?>"
				width="480" height="480"
				alt="<?php echo esc_attr( $args['alt'] ); ?>"
				fetchpriority="high" decoding="async">
		</div>
		<?php if ( $args['poke'] ) : ?>
			<?php /* translators: %s: the person's first name. */ ?>
			<button class="dc-portrait__poke" type="button"><?php echo esc_html( sprintf( __( 'Poke %s', 'dumitru' ), dumitru_first_name() ) ); ?></button>
		<?php endif; ?>
	</div>
	<?php
	return ob_get_clean();
}

/**
 * First word of the name, for "Poke …" and similar.
 *
 * @return string
 */
function dumitru_first_name() {
	$parts = preg_split( '/\s+/', dumitru_name() );
	return $parts ? $parts[0] : dumitru_name();
}

/**
 * A numbered section header strip: "01  SOME THINGS I'VE BUILT      note".
 *
 * @param string $number Two digits.
 * @param string $title  Section name.
 * @param string $note   Optional right-hand note.
 * @param string $tag    Heading tag.
 */
function dumitru_strip( $number, $title, $note = '', $tag = 'h2' ) {
	$tag = in_array( $tag, array( 'h2', 'h3', 'p' ), true ) ? $tag : 'h2';
	?>
	<header class="strip">
		<span class="strip__no" aria-hidden="true"><?php echo esc_html( $number ); ?></span>
		<<?php echo $tag; // phpcs:ignore WordPress.Security.EscapeOutput -- whitelisted above. ?> class="strip__name silk silk--strong"><?php echo esc_html( $title ); ?></<?php echo $tag; // phpcs:ignore ?>>
		<?php if ( '' !== $note ) : ?>
			<p class="strip__note silk"><span class="lamp" aria-hidden="true"></span><?php echo esc_html( $note ); ?></p>
		<?php endif; ?>
	</header>
	<?php
}

/**
 * The little arrow on cards and keys.
 *
 * @return string SVG.
 */
function dumitru_arrow() {
	return '<svg class="arrow" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 8h9m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

/**
 * Is an external URL (opens in a new tab)?
 *
 * @param string $url URL.
 * @return bool
 */
function dumitru_is_external( $url ) {
	$host = wp_parse_url( $url, PHP_URL_HOST );
	return $host && wp_parse_url( home_url(), PHP_URL_HOST ) !== $host;
}

/**
 * target/rel attributes for a link.
 *
 * @param string $url URL.
 * @return string
 */
function dumitru_link_attrs( $url ) {
	return dumitru_is_external( $url ) ? ' target="_blank" rel="noopener"' : '';
}

/**
 * The newsletter form, when one has been set up: the provider plugin's
 * shortcode (e.g. MailPoet, Mailchimp for WP, Brevo) rendered inside the
 * theme's styling. Without one, nothing is shown: no form that goes nowhere.
 *
 * @param string $context hero | pitch | band.
 * @return string HTML or ''.
 */
function dumitru_newsletter_form( $context ) {
	$shortcode = dumitru_mod( 'newsletter_shortcode' );
	if ( '' === $shortcode || ! dumitru_newsletter_enabled() ) {
		return '';
	}
	$html = do_shortcode( $shortcode );
	if ( '' === trim( wp_strip_all_tags( $html, true ) ) && false === strpos( $html, '<form' ) ) {
		return ''; // The plugin is gone or the shortcode is wrong: show nothing.
	}
	return '<div class="newsletter newsletter--' . esc_attr( $context ) . '">' . $html . '</div>';
}

/**
 * Whether the newsletter sections are switched on and have a form.
 *
 * @return bool
 */
function dumitru_newsletter_enabled() {
	return (bool) get_theme_mod( 'dumitru_newsletter_on', false ) && '' !== dumitru_mod( 'newsletter_shortcode' );
}

/**
 * Address of the blog list: the "Posts page" chosen in Settings → Reading,
 * else the home page's blog section.
 *
 * @return string
 */
function dumitru_blog_url() {
	$page = (int) get_option( 'page_for_posts' );
	if ( $page && 'publish' === get_post_status( $page ) ) {
		return get_permalink( $page );
	}
	return home_url( '/#writing' );
}

/**
 * Does the home page show its About section?
 *
 * @return bool
 */
function dumitru_has_about() {
	if ( null !== dumitru_home_widgets() ) {
		$about = dumitru_home_widget( 'dumitru-about' );
		if ( null === $about ) {
			return false;
		}
		return dumitru_has_text( dumitru_el_text( $about, 'body' ) );
	}
	return '' !== dumitru_mod( 'about_body' );
}

/**
 * Has a text something to show? An editor's leftover empty paragraph does
 * not count.
 *
 * @param string $html Text or HTML.
 * @return bool
 */
function dumitru_has_text( $html ) {
	return '' !== trim( wp_strip_all_tags( (string) $html ) ) || false !== strpos( (string) $html, '<img' );
}

/**
 * Header tabs when no menu has been assigned: About (the home page's About
 * section, when it has content) and Blog.
 */
function dumitru_default_tabs() {
	$tabs = array();
	if ( dumitru_has_about() ) {
		$tabs[] = array( __( 'About', 'dumitru' ), home_url( '/#about' ), false );
	}
	$tabs[] = array( __( 'Blog', 'dumitru' ), dumitru_blog_url(), is_home() || is_singular( 'post' ) || is_archive() );
	echo '<ul class="tabs">';
	foreach ( $tabs as $tab ) {
		printf(
			'<li class="menu-item%s"><a href="%s"%s>%s</a></li>',
			$tab[2] ? ' current-menu-item' : '',
			esc_url( $tab[1] ),
			$tab[2] ? ' aria-current="page"' : '',
			esc_html( $tab[0] )
		);
	}
	echo '</ul>';
}
