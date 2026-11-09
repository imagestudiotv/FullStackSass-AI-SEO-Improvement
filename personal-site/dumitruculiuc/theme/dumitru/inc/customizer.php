<?php
/**
 * Home page settings: Appearance → Customize → "Home page".
 *
 * Every field starts empty. A section with nothing real in it is left out
 * of the page, so nothing invented or "lorem ipsum" can ever go live.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sanitizers.
 */
function dumitru_sanitize_checkbox( $value ) {
	return (bool) $value;
}

function dumitru_sanitize_html( $value ) {
	return wp_kses_post( $value );
}

function dumitru_sanitize_lines( $value ) {
	return implode( "\n", array_map( 'sanitize_text_field', dumitru_lines( $value ) ) );
}

/**
 * A newsletter shortcode, e.g. [mailpoet_form id="1"]. Only a single
 * shortcode is accepted, never raw HTML or script.
 */
function dumitru_sanitize_shortcode( $value ) {
	$value = trim( wp_strip_all_tags( (string) $value ) );
	return preg_match( '/^\[[a-zA-Z0-9_-]+(\s[^\[\]]*)?\]$/', $value ) ? $value : '';
}

/**
 * Registers the settings and controls.
 *
 * @param WP_Customize_Manager $wp_customize Customizer.
 */
function dumitru_customize_register( $wp_customize ) {
	$wp_customize->add_panel(
		'dumitru_home',
		array(
			'title'       => __( 'Home page', 'dumitru' ),
			'description' => __( 'Texts and links of the home page. Leave a field empty to hide what it feeds. Projects are edited under Projects in the admin menu; posts under Posts.', 'dumitru' ),
			'priority'    => 30,
		)
	);

	$sections = array(
		'dumitru_identity'   => __( 'Name and header', 'dumitru' ),
		'dumitru_hero'       => __( 'Intro and portrait', 'dumitru' ),
		'dumitru_work'       => __( 'Projects section', 'dumitru' ),
		'dumitru_about'      => __( 'About', 'dumitru' ),
		'dumitru_newsletter' => __( 'Newsletter', 'dumitru' ),
		'dumitru_press'      => __( 'As featured in', 'dumitru' ),
		'dumitru_blog'       => __( 'Blog section', 'dumitru' ),
		'dumitru_contact'    => __( 'Contact and social links', 'dumitru' ),
	);
	$priority = 10;
	foreach ( $sections as $id => $title ) {
		$wp_customize->add_section(
			$id,
			array(
				'title'    => $title,
				'panel'    => 'dumitru_home',
				'priority' => $priority,
			)
		);
		$priority += 10;
	}

	$fields = array(
		// Name and header.
		array( 'name', 'dumitru_identity', 'text', __( 'Full name', 'dumitru' ), __( 'Shown on the page and used for the portrait\'s description. Empty: the site title.', 'dumitru' ) ),
		array( 'handle', 'dumitru_identity', 'text', __( 'Header label', 'dumitru' ), __( 'Next to the small avatar in the header, e.g. a handle like @name. Empty: the full name.', 'dumitru' ) ),

		// Intro and portrait.
		array( 'greeting', 'dumitru_hero', 'text', __( 'Greeting before the name', 'dumitru' ), __( 'e.g. "Hello! My name is". The highlighted word after it is the next field.', 'dumitru' ) ),
		array( 'greeting_name', 'dumitru_hero', 'text', __( 'Highlighted name', 'dumitru' ), __( 'The word in the orange marker, e.g. the first name.', 'dumitru' ) ),
		array( 'intro', 'dumitru_hero', 'textarea', __( 'Intro paragraphs', 'dumitru' ), __( 'A blank line starts a new paragraph. Links and bold are allowed.', 'dumitru' ) ),
		array( 'follow_label', 'dumitru_hero', 'text', __( 'Link under the portrait: text', 'dumitru' ), __( 'e.g. "Follow me on LinkedIn".', 'dumitru' ) ),
		array( 'follow_url', 'dumitru_hero', 'url', __( 'Link under the portrait: address', 'dumitru' ), '' ),
		array( 'pitch_kicker', 'dumitru_hero', 'text', __( 'Speech bubble: small first line', 'dumitru' ), __( 'e.g. "Psst."', 'dumitru' ) ),
		array( 'pitch_hurt', 'dumitru_hero', 'text', __( 'Speech bubble: small line while his face is pulled', 'dumitru' ), __( 'e.g. "Ow! Fine,"', 'dumitru' ) ),
		array( 'pitch_line', 'dumitru_hero', 'text', __( 'Speech bubble: main line', 'dumitru' ), __( 'e.g. "Try RepGet". The bubble is hidden without this and an address.', 'dumitru' ) ),
		array( 'pitch_url', 'dumitru_hero', 'url', __( 'Speech bubble: address', 'dumitru' ), '' ),

		// Projects.
		array( 'work_title', 'dumitru_work', 'text', __( 'Section title', 'dumitru' ), __( 'e.g. "Some things I\'ve built". Projects themselves: admin menu → Projects.', 'dumitru' ) ),
		array( 'work_note', 'dumitru_work', 'text', __( 'Note on the right', 'dumitru' ), __( 'Optional, e.g. "2 of 5". Only write a number that is true.', 'dumitru' ) ),
		array( 'work_more_label', 'dumitru_work', 'text', __( 'Button under the projects: text', 'dumitru' ), '' ),
		array( 'work_more_url', 'dumitru_work', 'url', __( 'Button under the projects: address', 'dumitru' ), '' ),

		// About.
		array( 'about_title', 'dumitru_about', 'text', __( 'Title', 'dumitru' ), '' ),
		array( 'about_body', 'dumitru_about', 'textarea', __( 'Text', 'dumitru' ), __( 'A blank line starts a new paragraph.', 'dumitru' ) ),
		array( 'about_points', 'dumitru_about', 'lines', __( 'Highlights (one per line)', 'dumitru' ), __( 'Short, true achievements. Shown as a list with orange dots.', 'dumitru' ) ),
		array( 'about_caption', 'dumitru_about', 'text', __( 'Photo caption', 'dumitru' ), '' ),

		// Newsletter.
		array( 'newsletter_on', 'dumitru_newsletter', 'checkbox', __( 'Show the newsletter forms', 'dumitru' ), __( 'Only switch on once the shortcode below works: a newsletter plugin (e.g. MailPoet or Mailchimp for WordPress) must be installed and connected.', 'dumitru' ) ),
		array( 'newsletter_shortcode', 'dumitru_newsletter', 'text', __( 'Form shortcode', 'dumitru' ), __( 'From the newsletter plugin, e.g. [mailpoet_form id="1"].', 'dumitru' ) ),
		array( 'newsletter_title', 'dumitru_newsletter', 'text', __( 'Newsletter section: title', 'dumitru' ), '' ),
		array( 'newsletter_body', 'dumitru_newsletter', 'textarea', __( 'Newsletter section: text', 'dumitru' ), '' ),
		array( 'newsletter_band_title', 'dumitru_newsletter', 'text', __( 'Band above the footer: title', 'dumitru' ), __( 'e.g. "Get an email when I write a new post".', 'dumitru' ) ),
		array( 'newsletter_band_text', 'dumitru_newsletter', 'text', __( 'Band above the footer: text', 'dumitru' ), '' ),

		// Press.
		array( 'press', 'dumitru_press', 'lines', __( 'Mentions (one per line: Name | address)', 'dumitru' ), __( 'Only real articles about you, e.g. "Forbes | https://…". The row is hidden while this is empty.', 'dumitru' ) ),

		// Blog.
		array( 'blog_title', 'dumitru_blog', 'text', __( 'Section title', 'dumitru' ), __( 'Empty: "Blog". The section shows the latest posts and is hidden while there are none.', 'dumitru' ) ),

		// Contact and social.
		array( 'email', 'dumitru_contact', 'email', __( 'Email shown in the footer', 'dumitru' ), __( '"Write to me" links to it. Hidden while empty.', 'dumitru' ) ),
		array( 'social_x', 'dumitru_contact', 'url', 'X', '' ),
		array( 'social_linkedin', 'dumitru_contact', 'url', 'LinkedIn', '' ),
		array( 'social_instagram', 'dumitru_contact', 'url', 'Instagram', '' ),
		array( 'social_github', 'dumitru_contact', 'url', 'GitHub', '' ),
		array( 'social_youtube', 'dumitru_contact', 'url', 'YouTube', '' ),
		array( 'social_facebook', 'dumitru_contact', 'url', 'Facebook', '' ),
	);

	foreach ( $fields as $field ) {
		list( $key, $section, $type, $label, $description ) = $field;
		$sanitize = array(
			'text'     => 'sanitize_text_field',
			'textarea' => 'dumitru_sanitize_html',
			'lines'    => 'dumitru_sanitize_lines',
			'url'      => 'esc_url_raw',
			'email'    => 'sanitize_email',
			'checkbox' => 'dumitru_sanitize_checkbox',
		);
		if ( 'newsletter_shortcode' === $key ) {
			$sanitize['text'] = 'dumitru_sanitize_shortcode';
		}
		$wp_customize->add_setting(
			'dumitru_' . $key,
			array(
				'default'           => 'checkbox' === $type ? false : '',
				'sanitize_callback' => $sanitize[ $type ],
				'capability'        => 'edit_theme_options',
			)
		);
		$wp_customize->add_control(
			'dumitru_' . $key,
			array(
				'label'       => $label,
				'description' => $description,
				'section'     => $section,
				'type'        => 'lines' === $type ? 'textarea' : $type,
			)
		);
	}

	// About photo: any image from the Media Library. Empty: the portrait.
	$wp_customize->add_setting(
		'dumitru_about_photo',
		array(
			'default'           => 0,
			'sanitize_callback' => 'absint',
			'capability'        => 'edit_theme_options',
		)
	);
	$wp_customize->add_control(
		new WP_Customize_Media_Control(
			$wp_customize,
			'dumitru_about_photo',
			array(
				'label'       => __( 'Photo', 'dumitru' ),
				'description' => __( 'Empty: the section shows text only.', 'dumitru' ),
				'section'     => 'dumitru_about',
				'mime_type'   => 'image',
			)
		)
	);
}
add_action( 'customize_register', 'dumitru_customize_register' );
