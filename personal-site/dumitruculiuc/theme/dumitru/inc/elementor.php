<?php
/**
 * Elementor (the free plugin) for the home page.
 *
 * - "Dumitru" widgets, one per home section (inc/elementor/widgets.php).
 * - When the static home page is built with Elementor, front-page.php
 *   prints its Elementor content; otherwise the Customizer layout.
 * - Site-wide values that Elementor free cannot edit in the header and
 *   footer (name, header label, email, social links) are read from the home
 *   page's widgets, so they are edited in one place.
 * - A one-click "Set up the home page in Elementor" notice.
 *
 * Nothing here needs Elementor: every Elementor class is only used once the
 * plugin has loaded.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Widget names, in the home page's order.
 *
 * @return string[] Widget name => class name.
 */
function dumitru_elementor_widget_classes() {
	return array(
		'dumitru-intro'    => 'Dumitru_Widget_Intro',
		'dumitru-press'    => 'Dumitru_Widget_Press',
		'dumitru-projects' => 'Dumitru_Widget_Projects',
		'dumitru-about'    => 'Dumitru_Widget_About',
		'dumitru-posts'    => 'Dumitru_Widget_Posts',
		'dumitru-contact'  => 'Dumitru_Widget_Contact',
	);
}

/**
 * Is the Elementor plugin active and loaded?
 *
 * @return bool
 */
function dumitru_elementor_active() {
	return did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' );
}

/**
 * The static home page chosen in Settings → Reading.
 *
 * @return int Page ID, 0 when the home page shows the latest posts.
 */
function dumitru_front_page_id() {
	if ( 'page' !== get_option( 'show_on_front' ) ) {
		return 0;
	}
	$id = (int) get_option( 'page_on_front' );
	return $id && get_post( $id ) ? $id : 0;
}

/**
 * Is a page built with Elementor (its "Edit with Elementor" mode is on)?
 *
 * @param int $post_id Page ID.
 * @return bool
 */
function dumitru_is_elementor_page( $post_id ) {
	return $post_id && dumitru_elementor_active() && 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true );
}

/**
 * Is Elementor's editor previewing this page right now?
 *
 * @param int $post_id Page ID.
 * @return bool
 */
function dumitru_is_elementor_preview( $post_id ) {
	if ( ! dumitru_elementor_active() || ! isset( $_GET['elementor-preview'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- read only.
		return false;
	}
	$plugin = \Elementor\Plugin::$instance;
	return isset( $plugin->preview ) && $plugin->preview->is_preview_mode( $post_id );
}

/**
 * Is Elementor's editor rendering widgets (the editor, not the live site)?
 *
 * @return bool
 */
function dumitru_is_elementor_editor() {
	if ( ! dumitru_elementor_active() ) {
		return false;
	}
	$plugin = \Elementor\Plugin::$instance;
	return isset( $plugin->editor ) && $plugin->editor->is_edit_mode();
}

/**
 * Should front-page.php print the Elementor content?
 *
 * @return bool
 */
function dumitru_front_uses_elementor() {
	if ( ! dumitru_elementor_active() || ! is_front_page() || ! is_page() ) {
		return false;
	}
	$id = (int) get_queried_object_id();
	return dumitru_is_elementor_page( $id ) || dumitru_is_elementor_preview( $id );
}

/**
 * The saved settings of the Dumitru widgets on the Elementor home page.
 *
 * @return array|null Widget name => settings of its first copy on the page,
 *                    or null when the home page is not built with Elementor.
 */
function dumitru_home_widgets() {
	static $cache = false;
	if ( false !== $cache ) {
		return $cache;
	}
	$cache = null;
	$id    = dumitru_front_page_id();
	if ( ! dumitru_is_elementor_page( $id ) ) {
		return $cache;
	}
	$data = get_post_meta( $id, '_elementor_data', true );
	if ( is_string( $data ) ) {
		$data = json_decode( $data, true );
	}
	$cache = array();
	if ( is_array( $data ) ) {
		dumitru_collect_widgets( $data, $cache );
	}
	return $cache;
}

/**
 * Walks Elementor's element tree.
 *
 * @param array $elements Elements.
 * @param array $found    Widget name => settings (filled in).
 */
function dumitru_collect_widgets( $elements, &$found ) {
	foreach ( $elements as $element ) {
		if ( ! is_array( $element ) ) {
			continue;
		}
		if ( isset( $element['elType'], $element['widgetType'] ) && 'widget' === $element['elType'] && 0 === strpos( (string) $element['widgetType'], 'dumitru-' ) && ! isset( $found[ $element['widgetType'] ] ) ) {
			$found[ $element['widgetType'] ] = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : array();
		}
		if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
			dumitru_collect_widgets( $element['elements'], $found );
		}
	}
}

/**
 * One Dumitru widget's settings on the Elementor home page.
 *
 * @param string $name Widget name, e.g. dumitru-contact.
 * @return array|null Settings, or null when there is no such widget there.
 */
function dumitru_home_widget( $name ) {
	$widgets = dumitru_home_widgets();
	return ( null !== $widgets && isset( $widgets[ $name ] ) ) ? $widgets[ $name ] : null;
}

/**
 * A site-wide value: from the home page's Elementor widget when there is
 * one, else from the Customizer.
 *
 * @param string $key name | handle | email.
 * @return string
 */
function dumitru_site_value( $key ) {
	$map = array(
		'name'   => array( 'dumitru-intro', 'full_name' ),
		'handle' => array( 'dumitru-intro', 'header_label' ),
		'email'  => array( 'dumitru-contact', 'email' ),
	);
	if ( isset( $map[ $key ] ) ) {
		$settings = dumitru_home_widget( $map[ $key ][0] );
		if ( null !== $settings ) {
			return dumitru_el_text( $settings, $map[ $key ][1] );
		}
	}
	return dumitru_mod( $key );
}

/*
 * Reading widget settings. They work on both the saved data and Elementor's
 * display settings: a text, a URL control (array with "url"), a media
 * control (array with "id"), a repeater (list of arrays).
 */

/**
 * @param array  $settings Settings.
 * @param string $key      Control ID.
 * @return string Trimmed text, '' when missing.
 */
function dumitru_el_text( $settings, $key ) {
	return isset( $settings[ $key ] ) && is_scalar( $settings[ $key ] ) ? trim( (string) $settings[ $key ] ) : '';
}

/**
 * @param array  $settings Settings.
 * @param string $key      Control ID.
 * @return string Address, '' when missing.
 */
function dumitru_el_url( $settings, $key ) {
	$value = isset( $settings[ $key ] ) ? $settings[ $key ] : '';
	if ( is_array( $value ) ) {
		$value = isset( $value['url'] ) ? $value['url'] : '';
	}
	return is_string( $value ) ? trim( $value ) : '';
}

/**
 * @param array  $settings Settings.
 * @param string $key      Control ID.
 * @return int Attachment ID, 0 when none.
 */
function dumitru_el_media( $settings, $key ) {
	return isset( $settings[ $key ]['id'] ) ? absint( $settings[ $key ]['id'] ) : 0;
}

/**
 * @param array  $settings Settings.
 * @param string $key      Control ID.
 * @return array[] Repeater rows.
 */
function dumitru_el_rows( $settings, $key ) {
	return isset( $settings[ $key ] ) && is_array( $settings[ $key ] ) ? array_values( array_filter( $settings[ $key ], 'is_array' ) ) : array();
}

/**
 * @param array $s "Intro and portrait" settings.
 * @return array Arguments for dumitru_intro_section().
 */
function dumitru_elementor_intro_args( $s ) {
	return array(
		'greeting'      => dumitru_el_text( $s, 'greeting' ),
		'greeting_name' => dumitru_el_text( $s, 'greeting_name' ),
		'intro'         => dumitru_el_text( $s, 'intro' ),
		'pitch_kicker'  => dumitru_el_text( $s, 'pitch_kicker' ),
		'pitch_hurt'    => dumitru_el_text( $s, 'pitch_hurt' ),
		'pitch_line'    => dumitru_el_text( $s, 'pitch_line' ),
		'pitch_url'     => dumitru_el_url( $s, 'pitch_url' ),
		'follow_label'  => dumitru_el_text( $s, 'follow_label' ),
		'follow_url'    => dumitru_el_url( $s, 'follow_url' ),
	);
}

/**
 * @param array $s "As featured in" settings.
 * @return array[] Each: array( name, address ).
 */
function dumitru_elementor_press_args( $s ) {
	$press = array();
	foreach ( dumitru_el_rows( $s, 'mentions' ) as $row ) {
		$press[] = array( dumitru_el_text( $row, 'name' ), dumitru_el_url( $row, 'link' ) );
	}
	return $press;
}

/**
 * @param array $s "Projects" settings.
 * @return array Arguments for dumitru_work_section(). With no projects in the
 *               widget, the ones from the admin menu Projects.
 */
function dumitru_elementor_work_args( $s ) {
	$cards = array();
	$shelf = array();
	foreach ( dumitru_el_rows( $s, 'projects' ) as $row ) {
		$project = array(
			'name' => dumitru_el_text( $row, 'name' ),
			'does' => dumitru_el_text( $row, 'description' ),
			'url'  => dumitru_el_url( $row, 'link' ),
			'year' => dumitru_el_text( $row, 'year' ),
			'code' => dumitru_el_text( $row, 'code' ),
			'logo' => dumitru_el_media( $row, 'logo' ),
		);
		if ( '' === $project['name'] ) {
			continue;
		}
		if ( 'yes' === dumitru_el_text( $row, 'big' ) ) {
			$cards[] = $project;
		} else {
			$shelf[] = $project;
		}
	}
	if ( ! $cards && ! $shelf ) {
		$cards = dumitru_projects( true );
		$shelf = dumitru_projects( false );
	}
	return array(
		'title'      => dumitru_el_text( $s, 'title' ),
		'note'       => dumitru_el_text( $s, 'note' ),
		'cards'      => $cards,
		'shelf'      => $shelf,
		'more_label' => dumitru_el_text( $s, 'more_label' ),
		'more_url'   => dumitru_el_url( $s, 'more_url' ),
	);
}

/**
 * @param array $s "About" settings.
 * @return array Arguments for dumitru_about_section().
 */
function dumitru_elementor_about_args( $s ) {
	$points = array();
	foreach ( dumitru_el_rows( $s, 'highlights' ) as $row ) {
		$points[] = dumitru_el_text( $row, 'text' );
	}
	return array(
		'title'   => dumitru_el_text( $s, 'title' ),
		'body'    => dumitru_el_text( $s, 'body' ),
		'points'  => $points,
		'photo'   => dumitru_el_media( $s, 'photo' ),
		'caption' => dumitru_el_text( $s, 'caption' ),
	);
}

/**
 * @param array $s "Latest posts" settings.
 * @return array Arguments for dumitru_posts_section().
 */
function dumitru_elementor_posts_args( $s ) {
	$count = dumitru_el_text( $s, 'count' );
	return array(
		'title' => dumitru_el_text( $s, 'title' ),
		'count' => '' !== $count ? (int) $count : 4,
	);
}

/**
 * @param array $s "Contact and social" settings.
 * @return array[] Social links as dumitru_social_links() returns them.
 */
function dumitru_elementor_social_links( $s ) {
	$networks = dumitru_social_networks();
	$finishes = array( 'orange', 'steel', 'graphite', 'white' );
	$links    = array();
	foreach ( dumitru_el_rows( $s, 'links' ) as $i => $row ) {
		$url     = dumitru_el_url( $row, 'link' );
		$network = dumitru_el_text( $row, 'network' );
		if ( '' === $url || ! wp_http_validate_url( $url ) ) {
			continue;
		}
		$label = dumitru_el_text( $row, 'label' );
		if ( isset( $networks[ $network ] ) ) {
			$label = '' !== $label ? $label : $networks[ $network ][0];
			$finish = $networks[ $network ][1];
		} else {
			$network = 'other';
			$label   = '' !== $label ? $label : wp_parse_url( $url, PHP_URL_HOST );
			$finish  = $finishes[ $i % count( $finishes ) ];
		}
		$links[] = array(
			'key'    => $network,
			'label'  => $label,
			'url'    => $url,
			'finish' => $finish,
		);
	}
	return $links;
}

/*
 * Registration.
 */

/**
 * The "Dumitru" category in Elementor's widget panel.
 *
 * @param \Elementor\Elements_Manager $elements_manager Elementor.
 */
function dumitru_elementor_category( $elements_manager ) {
	$elements_manager->add_category(
		'dumitru',
		array(
			'title' => __( 'Dumitru', 'dumitru' ),
			'icon'  => 'eicon-person',
		)
	);
}
add_action( 'elementor/elements/categories_registered', 'dumitru_elementor_category' );

/**
 * The widgets.
 *
 * @param \Elementor\Widgets_Manager $widgets_manager Elementor.
 */
function dumitru_elementor_register_widgets( $widgets_manager ) {
	require_once get_template_directory() . '/inc/elementor/widgets.php';
	foreach ( dumitru_elementor_widget_classes() as $class ) {
		$widgets_manager->register( new $class() );
	}
}
add_action( 'elementor/widgets/register', 'dumitru_elementor_register_widgets' );

/**
 * In Elementor's editor, start the portrait and the project strip again
 * each time a widget is redrawn.
 */
function dumitru_elementor_preview_script() {
	wp_enqueue_script( 'dumitru-elementor-preview', get_template_directory_uri() . '/assets/js/elementor-preview.js', array( 'jquery' ), DUMITRU_VERSION, true );
}
add_action( 'elementor/preview/enqueue_scripts', 'dumitru_elementor_preview_script' );

/*
 * "Set up the home page in Elementor".
 */

/**
 * The Elementor page data for a home page with all the widgets in order,
 * filled with what is already in the Customizer (and the Projects menu).
 * Nothing is invented: empty stays empty.
 *
 * @return array[] Elements.
 */
function dumitru_elementor_starter_elements() {
	$url = function ( $address ) {
		return array(
			'url'         => $address,
			'is_external' => '',
			'nofollow'    => '',
		);
	};
	$media = function ( $id ) {
		$id = absint( $id );
		$src = $id ? wp_get_attachment_image_url( $id, 'full' ) : '';
		return $src ? array(
			'id'  => $id,
			'url' => $src,
		) : array(
			'id'  => '',
			'url' => '',
		);
	};
	$paragraphs = function ( $text ) {
		return '' !== $text ? wpautop( $text ) : '';
	};

	$intro = array(
		'full_name'     => dumitru_mod( 'name' ),
		'header_label'  => dumitru_mod( 'handle' ),
		'greeting'      => dumitru_mod( 'greeting' ),
		'greeting_name' => dumitru_mod( 'greeting_name' ),
		'intro'         => $paragraphs( dumitru_mod( 'intro' ) ),
		'pitch_kicker'  => dumitru_mod( 'pitch_kicker' ),
		'pitch_hurt'    => dumitru_mod( 'pitch_hurt' ),
		'pitch_line'    => dumitru_mod( 'pitch_line' ),
		'pitch_url'     => $url( dumitru_mod( 'pitch_url' ) ),
		'follow_label'  => dumitru_mod( 'follow_label' ),
		'follow_url'    => $url( dumitru_mod( 'follow_url' ) ),
	);

	$mentions = array();
	foreach ( dumitru_customizer_press() as $mention ) {
		if ( '' !== $mention[0] && wp_http_validate_url( $mention[1] ) ) {
			$mentions[] = array(
				'_id'  => dumitru_elementor_id(),
				'name' => $mention[0],
				'link' => $url( $mention[1] ),
			);
		}
	}

	$projects = array();
	foreach ( array( true, false ) as $big ) {
		foreach ( dumitru_projects( $big ) as $project ) {
			$projects[] = array(
				'_id'         => dumitru_elementor_id(),
				'name'        => $project['name'],
				'description' => $project['does'],
				'link'        => $url( $project['url'] ),
				'logo'        => $media( $project['logo'] ),
				'big'         => $big ? 'yes' : '',
				'year'        => $project['year'],
				'code'        => $project['code'],
			);
		}
	}

	$highlights = array();
	foreach ( dumitru_lines( dumitru_mod( 'about_points' ) ) as $point ) {
		$highlights[] = array(
			'_id'  => dumitru_elementor_id(),
			'text' => $point,
		);
	}

	$links = array();
	foreach ( dumitru_social_networks() as $key => $network ) {
		$address = dumitru_mod( 'social_' . $key );
		if ( '' !== $address ) {
			$links[] = array(
				'_id'     => dumitru_elementor_id(),
				'network' => $key,
				'link'    => $url( $address ),
			);
		}
	}

	$widgets = array(
		'dumitru-intro'    => $intro,
		'dumitru-press'    => array( 'mentions' => $mentions ),
		'dumitru-projects' => array(
			'title'      => dumitru_mod( 'work_title' ),
			'note'       => dumitru_mod( 'work_note' ),
			'projects'   => $projects,
			'more_label' => dumitru_mod( 'work_more_label' ),
			'more_url'   => $url( dumitru_mod( 'work_more_url' ) ),
		),
		'dumitru-about'    => array(
			'title'      => dumitru_mod( 'about_title' ),
			'body'       => $paragraphs( dumitru_mod( 'about_body' ) ),
			'highlights' => $highlights,
			'photo'      => $media( get_theme_mod( 'dumitru_about_photo', 0 ) ),
			'caption'    => dumitru_mod( 'about_caption' ),
		),
		'dumitru-posts'    => array( 'title' => dumitru_mod( 'blog_title' ) ),
		'dumitru-contact'  => array(
			'email' => dumitru_mod( 'email' ),
			'links' => $links,
		),
	);

	$children = array();
	foreach ( $widgets as $name => $settings ) {
		$children[] = array(
			'id'         => dumitru_elementor_id(),
			'elType'     => 'widget',
			'widgetType' => $name,
			'settings'   => $settings,
			'elements'   => array(),
			'isInner'    => false,
		);
	}

	$experiments = \Elementor\Plugin::$instance->experiments;
	if ( $experiments && $experiments->is_feature_active( 'container' ) ) {
		// One full-width container without padding or gaps: the sections space themselves.
		return array(
			array(
				'id'       => dumitru_elementor_id(),
				'elType'   => 'container',
				'settings' => array(
					'content_width' => 'full',
					'flex_gap'      => array(
						'column'   => '0',
						'row'      => '0',
						'isLinked' => true,
						'unit'     => 'px',
						'size'     => 0,
					),
					'padding'       => array(
						'unit'     => 'px',
						'top'      => '0',
						'right'    => '0',
						'bottom'   => '0',
						'left'     => '0',
						'isLinked' => true,
					),
				),
				'elements' => $children,
				'isInner'  => false,
			),
		);
	}
	// Older Elementor layout: one full-width section, one column, no gaps.
	return array(
		array(
			'id'       => dumitru_elementor_id(),
			'elType'   => 'section',
			'settings' => array(
				'layout' => 'full_width',
				'gap'    => 'no',
			),
			'elements' => array(
				array(
					'id'       => dumitru_elementor_id(),
					'elType'   => 'column',
					'settings' => array( '_column_size' => 100 ),
					'elements' => $children,
					'isInner'  => false,
				),
			),
			'isInner'  => false,
		),
	);
}

/**
 * A new Elementor element ID (7 hex characters, like Elementor's own).
 *
 * @return string
 */
function dumitru_elementor_id() {
	return substr( md5( wp_generate_uuid4() ), 0, 7 );
}

/**
 * Builds the home page with the widgets. Creates a "Home" page and makes it
 * the home page when the site shows its latest posts there.
 *
 * @param bool $replace Whether existing Elementor data or page text may be replaced.
 * @return int|WP_Error Page ID, or an error. Error code "dumitru_confirm" when
 *                      the page has its own content and $replace is false.
 */
function dumitru_elementor_setup_home( $replace ) {
	if ( ! dumitru_elementor_active() ) {
		return new WP_Error( 'dumitru_no_elementor', __( 'Elementor is not active.', 'dumitru' ) );
	}
	$id = dumitru_front_page_id();
	if ( $id && ! $replace && dumitru_page_has_content( $id ) ) {
		return new WP_Error( 'dumitru_confirm', __( 'The home page already has content.', 'dumitru' ) );
	}
	if ( ! $id ) {
		$id = wp_insert_post(
			array(
				'post_type'   => 'page',
				'post_status' => 'publish',
				'post_title'  => __( 'Home', 'dumitru' ),
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		update_option( 'page_on_front', $id );
		update_option( 'show_on_front', 'page' );
	}

	$elements = dumitru_elementor_starter_elements();
	$saved    = false;
	$document = \Elementor\Plugin::$instance->documents->get( $id, false );
	if ( $document ) {
		$saved = $document->save( array( 'elements' => $elements ) );
	}
	if ( ! $saved ) {
		// Elementor refused (e.g. an old version): store the data as Elementor does.
		update_post_meta( $id, '_elementor_data', wp_slash( wp_json_encode( $elements ) ) );
		update_post_meta( $id, '_elementor_template_type', 'wp-page' );
		if ( defined( 'ELEMENTOR_VERSION' ) ) {
			update_post_meta( $id, '_elementor_version', ELEMENTOR_VERSION );
		}
	}
	update_post_meta( $id, '_elementor_edit_mode', 'builder' );
	return $id;
}

/**
 * Has a page got Elementor content or text of its own?
 *
 * @param int $id Page ID.
 * @return bool
 */
function dumitru_page_has_content( $id ) {
	$data = get_post_meta( $id, '_elementor_data', true );
	if ( is_string( $data ) ) {
		$data = json_decode( $data, true );
	}
	return ! empty( $data ) || '' !== trim( (string) get_post_field( 'post_content', $id ) );
}

/**
 * The notice, on the dashboard and the Pages and Themes screens.
 */
function dumitru_elementor_setup_notice() {
	if ( ! current_user_can( 'edit_theme_options' ) || ! dumitru_elementor_active() ) {
		return;
	}
	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->id, array( 'dashboard', 'edit-page', 'themes', 'page' ), true ) ) {
		return;
	}
	$id     = dumitru_front_page_id();
	$status = isset( $_GET['dumitru-setup'] ) ? sanitize_key( wp_unslash( $_GET['dumitru-setup'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- only picks the message.

	if ( 'done' === $status && $id ) {
		printf(
			'<div class="notice notice-success is-dismissible"><p>%s <a href="%s">%s</a></p></div>',
			esc_html__( 'The home page is set up in Elementor.', 'dumitru' ),
			esc_url( admin_url( 'post.php?post=' . $id . '&action=elementor' ) ),
			esc_html__( 'Edit it with Elementor', 'dumitru' )
		);
		return;
	}
	if ( 'error' === $status ) {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'The home page could not be set up in Elementor. Please try again.', 'dumitru' ) . '</p></div>';
	}
	if ( dumitru_is_elementor_page( $id ) ) {
		return;
	}

	$confirm = 'confirm' === $status;
	?>
	<div class="notice notice-<?php echo $confirm ? 'warning' : 'info'; ?>">
		<p><strong><?php esc_html_e( 'Edit your home page in Elementor', 'dumitru' ); ?></strong></p>
		<p>
			<?php
			if ( $confirm ) {
				esc_html_e( 'Your home page already has its own content. Setting it up replaces that content with the home page sections (your Customizer texts are copied in). Continue?', 'dumitru' );
			} elseif ( $id ) {
				esc_html_e( 'One click puts all the home page sections into Elementor, filled with what you already wrote in the Customizer. Empty fields stay hidden on the site.', 'dumitru' );
			} else {
				esc_html_e( 'One click creates a "Home" page with all the home page sections in Elementor and makes it your home page. Empty fields stay hidden on the site.', 'dumitru' );
			}
			?>
		</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="dumitru_elementor_setup">
			<?php wp_nonce_field( 'dumitru_elementor_setup', 'dumitru_nonce' ); ?>
			<?php if ( $confirm ) : ?>
				<input type="hidden" name="dumitru_replace" value="1">
			<?php endif; ?>
			<p><button type="submit" class="button button-primary"><?php echo $confirm ? esc_html__( 'Yes, replace it and set up the home page', 'dumitru' ) : esc_html__( 'Set up the home page in Elementor', 'dumitru' ); ?></button></p>
		</form>
	</div>
	<?php
}
add_action( 'admin_notices', 'dumitru_elementor_setup_notice' );

/**
 * The button's handler.
 */
function dumitru_elementor_setup_handler() {
	if ( ! current_user_can( 'edit_theme_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'dumitru' ), 403 );
	}
	check_admin_referer( 'dumitru_elementor_setup', 'dumitru_nonce' );

	$back   = wp_get_referer() ? wp_get_referer() : admin_url( 'index.php' );
	$back   = remove_query_arg( 'dumitru-setup', $back );
	$result = dumitru_elementor_setup_home( ! empty( $_POST['dumitru_replace'] ) );
	if ( is_wp_error( $result ) ) {
		$status = 'dumitru_confirm' === $result->get_error_code() ? 'confirm' : 'error';
	} else {
		$status = 'done';
	}
	wp_safe_redirect( add_query_arg( 'dumitru-setup', $status, $back ) );
	exit;
}
add_action( 'admin_post_dumitru_elementor_setup', 'dumitru_elementor_setup_handler' );
