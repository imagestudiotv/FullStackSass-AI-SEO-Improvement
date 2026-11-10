<?php
/**
 * The "Dumitru" Elementor widgets: one per home page section.
 *
 * Only loaded by Elementor itself (see inc/elementor.php), so Elementor's
 * classes exist here. Each widget prints its section with the same function
 * as the Customizer layout (inc/sections.php), so the design is identical.
 * No field has a default text: an empty field stays hidden on the site.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Repeater;
use Elementor\Widget_Base;

/**
 * What all the Dumitru widgets share.
 */
abstract class Dumitru_Widget extends Widget_Base {

	/**
	 * @return string[]
	 */
	public function get_categories() {
		return array( 'dumitru' );
	}

	/**
	 * @return string[]
	 */
	public function get_keywords() {
		return array( 'dumitru', 'home' );
	}

	/**
	 * Keep Elementor's inner wrapper: the theme's CSS gives it the page's
	 * column width.
	 *
	 * @return bool
	 */
	public function has_widget_inner_wrapper(): bool {
		return true;
	}

	/**
	 * Never cache the output: it depends on posts, projects and on which
	 * sections are shown before it.
	 *
	 * @return bool
	 */
	protected function is_dynamic_content(): bool {
		return true;
	}

	/**
	 * Starts a group of fields in the Content tab.
	 *
	 * @param string $id    Group ID.
	 * @param string $label Group label.
	 */
	protected function group( $id, $label ) {
		$this->start_controls_section(
			$id,
			array(
				'label' => $label,
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);
	}

	/**
	 * A short explanation shown among the fields.
	 *
	 * @param string $id   Control ID.
	 * @param string $text Plain text.
	 */
	protected function help( $id, $text ) {
		$this->add_control(
			$id,
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => esc_html( $text ),
				'content_classes' => 'elementor-descriptor',
			)
		);
	}

	/**
	 * Field options shared by the plain text fields.
	 *
	 * @param string $label       Label.
	 * @param string $description Help under the field.
	 * @return array
	 */
	protected function text( $label, $description = '' ) {
		return array(
			'label'       => $label,
			'type'        => Controls_Manager::TEXT,
			'label_block' => true,
			'description' => $description,
		);
	}

	/**
	 * Field options for an address. Whether it opens in a new tab is
	 * decided by the theme (other sites do), so those options are hidden.
	 *
	 * @param string $label       Label.
	 * @param string $description Help under the field.
	 * @return array
	 */
	protected function url( $label, $description = '' ) {
		return array(
			'label'       => $label,
			'type'        => Controls_Manager::URL,
			'options'     => false,
			'placeholder' => 'https://',
			'label_block' => true,
			'description' => $description,
		);
	}

	/**
	 * In the editor only: a note where a hidden section would be, so it
	 * can still be clicked and filled in.
	 *
	 * @param string $text Plain text.
	 */
	protected function editor_note( $text ) {
		if ( dumitru_is_elementor_editor() ) {
			echo '<p class="dumitru-editor-note">' . esc_html( $text ) . '</p>';
		}
	}
}

/**
 * Intro and portrait (also the name and header label used on every page).
 */
class Dumitru_Widget_Intro extends Dumitru_Widget {

	public function get_name() {
		return 'dumitru-intro';
	}

	public function get_title() {
		return __( 'Intro and portrait', 'dumitru' );
	}

	public function get_icon() {
		return 'eicon-person';
	}

	public function get_style_depends() {
		return array( 'dumitru-portrait' );
	}

	public function get_script_depends() {
		return array( 'dumitru-portrait' );
	}

	protected function register_controls() {
		$this->group( 'section_name', __( 'Your name (used on every page)', 'dumitru' ) );
		$this->add_control( 'full_name', $this->text( __( 'Full name', 'dumitru' ), __( 'Used in the footer, for the portrait\'s description and for search engines. Empty: the site title.', 'dumitru' ) ) );
		$this->add_control( 'header_label', $this->text( __( 'Header label', 'dumitru' ), __( 'Next to the small photo at the top of every page, e.g. a handle like @name. Empty: the full name.', 'dumitru' ) ) );
		$this->end_controls_section();

		$this->group( 'section_intro', __( 'Intro', 'dumitru' ) );
		$this->add_control( 'greeting', $this->text( __( 'Greeting before the name', 'dumitru' ), __( 'e.g. "Hello! My name is".', 'dumitru' ) ) );
		$this->add_control( 'greeting_name', $this->text( __( 'Highlighted name', 'dumitru' ), __( 'The word in the orange marker. Empty: your first name.', 'dumitru' ) ) );
		$this->add_control(
			'intro',
			array(
				'label'       => __( 'Intro paragraphs', 'dumitru' ),
				'type'        => Controls_Manager::WYSIWYG,
				'description' => __( 'Links and bold are allowed. Empty: no intro text.', 'dumitru' ),
			)
		);
		$this->end_controls_section();

		$this->group( 'section_portrait', __( 'Portrait', 'dumitru' ) );
		$this->help( 'portrait_help', __( 'The grabbable portrait is part of the theme. Here you set the speech bubble on it and the link under it.', 'dumitru' ) );
		$this->add_control( 'pitch_kicker', $this->text( __( 'Speech bubble: small first line', 'dumitru' ), __( 'e.g. "Psst."', 'dumitru' ) ) );
		$this->add_control( 'pitch_hurt', $this->text( __( 'Speech bubble: small line while the face is pulled', 'dumitru' ), __( 'e.g. "Ow! Fine,"', 'dumitru' ) ) );
		$this->add_control( 'pitch_line', $this->text( __( 'Speech bubble: main line', 'dumitru' ), __( 'e.g. "Try RepGet". The bubble is hidden without this and an address.', 'dumitru' ) ) );
		$this->add_control( 'pitch_url', $this->url( __( 'Speech bubble: address', 'dumitru' ) ) );
		$this->add_control( 'follow_label', $this->text( __( 'Link under the portrait: text', 'dumitru' ), __( 'e.g. "Follow me on LinkedIn". Hidden without an address.', 'dumitru' ) ) );
		$this->add_control( 'follow_url', $this->url( __( 'Link under the portrait: address', 'dumitru' ) ) );
		$this->end_controls_section();
	}

	protected function render() {
		dumitru_intro_section( dumitru_elementor_intro_args( $this->get_settings_for_display() ) );
	}
}

/**
 * As featured in.
 */
class Dumitru_Widget_Press extends Dumitru_Widget {

	public function get_name() {
		return 'dumitru-press';
	}

	public function get_title() {
		return __( 'As featured in', 'dumitru' );
	}

	public function get_icon() {
		return 'eicon-testimonial';
	}

	protected function register_controls() {
		$this->group( 'section_press', __( 'As featured in', 'dumitru' ) );
		$this->help( 'press_help', __( 'Only real articles about you. The row is hidden while the list is empty.', 'dumitru' ) );
		$repeater = new Repeater();
		$repeater->add_control( 'name', $this->text( __( 'Publication', 'dumitru' ), __( 'e.g. Forbes', 'dumitru' ) ) );
		$repeater->add_control( 'link', $this->url( __( 'Address of the article', 'dumitru' ) ) );
		$this->add_control(
			'mentions',
			array(
				'label'       => __( 'Articles', 'dumitru' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $repeater->get_controls(),
				'default'     => array(),
				'title_field' => '{{{ name }}}',
			)
		);
		$this->end_controls_section();
	}

	protected function render() {
		if ( ! dumitru_press_section( dumitru_elementor_press_args( $this->get_settings_for_display() ) ) ) {
			$this->editor_note( __( 'As featured in: hidden until you add an article with its address.', 'dumitru' ) );
		}
	}
}

/**
 * Projects.
 */
class Dumitru_Widget_Projects extends Dumitru_Widget {

	public function get_name() {
		return 'dumitru-projects';
	}

	public function get_title() {
		return __( 'Projects', 'dumitru' );
	}

	public function get_icon() {
		return 'eicon-gallery-grid';
	}

	protected function register_controls() {
		$this->group( 'section_heading', __( 'Section', 'dumitru' ) );
		$this->add_control( 'title', $this->text( __( 'Section title', 'dumitru' ), __( 'Empty: "Things I\'ve built".', 'dumitru' ) ) );
		$this->add_control( 'note', $this->text( __( 'Note on the right', 'dumitru' ), __( 'Optional, e.g. "2 of 5". Only write a number that is true.', 'dumitru' ) ) );
		$this->end_controls_section();

		$this->group( 'section_projects', __( 'Projects', 'dumitru' ) );
		$this->help( 'projects_help', __( 'Big cards come first, the others go on the logo strip below them. While this list is empty, the projects from the admin menu "Projects" are shown.', 'dumitru' ) );
		$repeater = new Repeater();
		$repeater->add_control(
			'logo',
			array(
				'label'       => __( 'Logo', 'dumitru' ),
				'type'        => Controls_Manager::MEDIA,
				'description' => __( 'A white or transparent PNG, SVG or WebP looks best. Empty: the first letter of the name.', 'dumitru' ),
			)
		);
		$repeater->add_control( 'name', $this->text( __( 'Name', 'dumitru' ), __( 'Required: a project without a name is not shown.', 'dumitru' ) ) );
		$repeater->add_control(
			'description',
			array(
				'label'       => __( 'Description', 'dumitru' ),
				'type'        => Controls_Manager::TEXTAREA,
				'rows'        => 3,
				'description' => __( 'One short line. Shown on big cards.', 'dumitru' ),
			)
		);
		$repeater->add_control( 'link', $this->url( __( 'Address', 'dumitru' ) ) );
		$repeater->add_control(
			'big',
			array(
				'label'        => __( 'Big card', 'dumitru' ),
				'type'         => Controls_Manager::SWITCHER,
				'return_value' => 'yes',
				'default'      => 'yes',
				'description'  => __( 'Off: a small logo on the strip.', 'dumitru' ),
			)
		);
		$repeater->add_control( 'year', $this->text( __( 'Year', 'dumitru' ), __( 'Optional, printed small in the card\'s corner.', 'dumitru' ) ) );
		$repeater->add_control( 'code', $this->text( __( 'Short code', 'dumitru' ), __( 'Optional, printed small in the card\'s corner, e.g. "RG-24".', 'dumitru' ) ) );
		$this->add_control(
			'projects',
			array(
				'label'       => __( 'Projects', 'dumitru' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $repeater->get_controls(),
				'default'     => array(),
				'title_field' => '{{{ name }}}',
			)
		);
		$this->end_controls_section();

		$this->group( 'section_more', __( 'Button under the projects', 'dumitru' ) );
		$this->add_control( 'more_label', $this->text( __( 'Text', 'dumitru' ), __( 'Hidden without an address.', 'dumitru' ) ) );
		$this->add_control( 'more_url', $this->url( __( 'Address', 'dumitru' ) ) );
		$this->end_controls_section();
	}

	protected function render() {
		if ( ! dumitru_work_section( dumitru_elementor_work_args( $this->get_settings_for_display() ) ) ) {
			$this->editor_note( __( 'Projects: hidden until you add a project with a name.', 'dumitru' ) );
		}
	}
}

/**
 * About.
 */
class Dumitru_Widget_About extends Dumitru_Widget {

	public function get_name() {
		return 'dumitru-about';
	}

	public function get_title() {
		return __( 'About', 'dumitru' );
	}

	public function get_icon() {
		return 'eicon-info-circle-o';
	}

	protected function register_controls() {
		$this->group( 'section_about', __( 'About', 'dumitru' ) );
		$this->add_control( 'title', $this->text( __( 'Title', 'dumitru' ) ) );
		$this->add_control(
			'body',
			array(
				'label'       => __( 'Text', 'dumitru' ),
				'type'        => Controls_Manager::WYSIWYG,
				'description' => __( 'The section (and the "About" tab in the header) is hidden while this is empty.', 'dumitru' ),
			)
		);
		$repeater = new Repeater();
		$repeater->add_control( 'text', $this->text( __( 'Highlight', 'dumitru' ) ) );
		$this->add_control(
			'highlights',
			array(
				'label'       => __( 'Highlights', 'dumitru' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $repeater->get_controls(),
				'default'     => array(),
				'title_field' => '{{{ text }}}',
				'description' => __( 'Short, true achievements, shown as a list with orange dots.', 'dumitru' ),
			)
		);
		$this->end_controls_section();

		$this->group( 'section_photo', __( 'Photo', 'dumitru' ) );
		$this->add_control(
			'photo',
			array(
				'label'       => __( 'Photo', 'dumitru' ),
				'type'        => Controls_Manager::MEDIA,
				'description' => __( 'Empty: the section shows text only.', 'dumitru' ),
			)
		);
		$this->add_control( 'caption', $this->text( __( 'Photo caption', 'dumitru' ) ) );
		$this->end_controls_section();
	}

	protected function render() {
		if ( ! dumitru_about_section( dumitru_elementor_about_args( $this->get_settings_for_display() ) ) ) {
			$this->editor_note( __( 'About: hidden until you write the text.', 'dumitru' ) );
		}
	}
}

/**
 * Latest posts.
 */
class Dumitru_Widget_Posts extends Dumitru_Widget {

	public function get_name() {
		return 'dumitru-posts';
	}

	public function get_title() {
		return __( 'Latest posts', 'dumitru' );
	}

	public function get_icon() {
		return 'eicon-post-list';
	}

	protected function register_controls() {
		$this->group( 'section_posts', __( 'Latest posts', 'dumitru' ) );
		$this->help( 'posts_help', __( 'Shows your latest blog posts (admin menu "Posts"). Hidden while there are none.', 'dumitru' ) );
		$this->add_control( 'title', $this->text( __( 'Section title', 'dumitru' ), __( 'Empty: "Blog".', 'dumitru' ) ) );
		$this->add_control(
			'count',
			array(
				'label'   => __( 'How many posts', 'dumitru' ),
				'type'    => Controls_Manager::NUMBER,
				'min'     => 1,
				'max'     => 12,
				'step'    => 1,
				'default' => 4,
			)
		);
		$this->end_controls_section();
	}

	protected function render() {
		if ( ! dumitru_posts_section( dumitru_elementor_posts_args( $this->get_settings_for_display() ) ) ) {
			$this->editor_note( __( 'Latest posts: hidden until a post is published.', 'dumitru' ) );
		}
	}
}

/**
 * Contact and social: the email and the social buttons in the footer of
 * every page. Prints nothing on the page itself.
 */
class Dumitru_Widget_Contact extends Dumitru_Widget {

	public function get_name() {
		return 'dumitru-contact';
	}

	public function get_title() {
		return __( 'Contact and social', 'dumitru' );
	}

	public function get_icon() {
		return 'eicon-social-icons';
	}

	protected function register_controls() {
		$this->group( 'section_contact', __( 'Contact and social', 'dumitru' ) );
		$this->help( 'contact_help', __( 'These appear in the footer of every page (after you click Update). Keep this widget on the home page only.', 'dumitru' ) );
		$this->add_control(
			'email',
			array(
				'label'       => __( 'Email', 'dumitru' ),
				'type'        => Controls_Manager::TEXT,
				'input_type'  => 'email',
				'label_block' => true,
				'description' => __( '"Write to me" links to it. Hidden while empty.', 'dumitru' ),
			)
		);
		$options = array();
		foreach ( dumitru_social_networks() as $key => $network ) {
			$options[ $key ] = $network[0];
		}
		$options['other'] = __( 'Other', 'dumitru' );
		$repeater          = new Repeater();
		$repeater->add_control(
			'network',
			array(
				'label'   => __( 'Network', 'dumitru' ),
				'type'    => Controls_Manager::SELECT,
				'options' => $options,
				'default' => 'linkedin',
			)
		);
		$repeater->add_control( 'link', $this->url( __( 'Address of your profile', 'dumitru' ) ) );
		$repeater->add_control(
			'label',
			array(
				'label'       => __( 'Name shown', 'dumitru' ),
				'type'        => Controls_Manager::TEXT,
				'description' => __( 'For "Other". Empty: the site\'s address.', 'dumitru' ),
				'condition'   => array( 'network' => 'other' ),
			)
		);
		$this->add_control(
			'links',
			array(
				'label'       => __( 'Social links', 'dumitru' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $repeater->get_controls(),
				'default'     => array(),
				'title_field' => '{{{ network }}}',
			)
		);
		$this->end_controls_section();
	}

	protected function render() {
		if ( ! dumitru_is_elementor_editor() ) {
			return;
		}
		$settings = $this->get_settings_for_display();
		$email    = dumitru_el_text( $settings, 'email' );
		$count    = count( dumitru_elementor_social_links( $settings ) );
		$this->editor_note(
			sprintf(
				/* translators: 1: "set" or "empty", 2: number of social links. */
				__( 'Contact and social (shown in the footer of every page): email %1$s, %2$d social link(s).', 'dumitru' ),
				is_email( $email ) ? __( 'set', 'dumitru' ) : __( 'empty', 'dumitru' ),
				$count
			)
		);
	}
}
