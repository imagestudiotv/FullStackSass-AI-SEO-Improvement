<?php
/**
 * Projects: admin menu → Projects.
 *
 * A project is its name (title), a one-line description (excerpt), a logo
 * (featured image), an address, a year and a short code. "Show as a big
 * card" puts it among the large cards; the rest go on the logo strip below
 * them. The order is the "Order" box (lower first).
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The post type. Not public on its own: projects are shown on the home page
 * and link out to the project's site.
 */
function dumitru_register_projects() {
	register_post_type(
		'dumitru_project',
		array(
			'labels'          => array(
				'name'               => __( 'Projects', 'dumitru' ),
				'singular_name'      => __( 'Project', 'dumitru' ),
				'add_new_item'       => __( 'Add project', 'dumitru' ),
				'edit_item'          => __( 'Edit project', 'dumitru' ),
				'featured_image'     => __( 'Logo', 'dumitru' ),
				'set_featured_image' => __( 'Set logo', 'dumitru' ),
				'not_found'          => __( 'No projects yet.', 'dumitru' ),
			),
			'public'          => false,
			'show_ui'         => true,
			'show_in_rest'    => true,
			'menu_icon'       => 'dashicons-portfolio',
			'menu_position'   => 21,
			'supports'        => array( 'title', 'excerpt', 'thumbnail', 'page-attributes' ),
			'capability_type' => 'post',
		)
	);
}
add_action( 'init', 'dumitru_register_projects' );

/**
 * The meta fields, also editable through the REST API / block editor.
 */
function dumitru_register_project_meta() {
	$fields = array(
		'_dumitru_url'      => 'esc_url_raw',
		'_dumitru_year'     => 'sanitize_text_field',
		'_dumitru_code'     => 'sanitize_text_field',
		'_dumitru_featured' => 'rest_sanitize_boolean',
	);
	foreach ( $fields as $key => $sanitize ) {
		register_post_meta(
			'dumitru_project',
			$key,
			array(
				'type'              => '_dumitru_featured' === $key ? 'boolean' : 'string',
				'single'            => true,
				'sanitize_callback' => $sanitize,
				'auth_callback'     => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}
}
add_action( 'init', 'dumitru_register_project_meta' );

/**
 * The "Project details" box.
 */
function dumitru_project_box() {
	add_meta_box( 'dumitru_project_details', __( 'Project details', 'dumitru' ), 'dumitru_project_box_html', 'dumitru_project', 'normal', 'high' );
}
add_action( 'add_meta_boxes', 'dumitru_project_box' );

/**
 * @param WP_Post $post Project.
 */
function dumitru_project_box_html( $post ) {
	wp_nonce_field( 'dumitru_project_save', 'dumitru_project_nonce' );
	$url      = get_post_meta( $post->ID, '_dumitru_url', true );
	$year     = get_post_meta( $post->ID, '_dumitru_year', true );
	$code     = get_post_meta( $post->ID, '_dumitru_code', true );
	$featured = (bool) get_post_meta( $post->ID, '_dumitru_featured', true );
	?>
	<p><?php esc_html_e( 'The description is the "Excerpt" box; the logo is the "Logo" box (a white or transparent PNG/SVG/WebP looks best).', 'dumitru' ); ?></p>
	<p>
		<label for="dumitru_url"><strong><?php esc_html_e( 'Address', 'dumitru' ); ?></strong></label><br>
		<input type="url" id="dumitru_url" name="dumitru_url" value="<?php echo esc_attr( $url ); ?>" class="widefat" placeholder="https://">
	</p>
	<p>
		<label for="dumitru_year"><strong><?php esc_html_e( 'Year', 'dumitru' ); ?></strong></label><br>
		<input type="text" id="dumitru_year" name="dumitru_year" value="<?php echo esc_attr( $year ); ?>" maxlength="9" size="10">
	</p>
	<p>
		<label for="dumitru_code"><strong><?php esc_html_e( 'Short code', 'dumitru' ); ?></strong></label><br>
		<input type="text" id="dumitru_code" name="dumitru_code" value="<?php echo esc_attr( $code ); ?>" maxlength="8" size="10">
		<span class="description"><?php esc_html_e( 'Printed small in the card\'s corner, e.g. "RG-24". Optional.', 'dumitru' ); ?></span>
	</p>
	<p>
		<label><input type="checkbox" name="dumitru_featured" value="1" <?php checked( $featured ); ?>> <?php esc_html_e( 'Show as a big card (otherwise on the logo strip)', 'dumitru' ); ?></label>
	</p>
	<?php
}

/**
 * Saves the box.
 *
 * @param int $post_id Project ID.
 */
function dumitru_project_save( $post_id ) {
	if ( ! isset( $_POST['dumitru_project_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['dumitru_project_nonce'] ) ), 'dumitru_project_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$url  = isset( $_POST['dumitru_url'] ) ? esc_url_raw( wp_unslash( $_POST['dumitru_url'] ) ) : '';
	$year = isset( $_POST['dumitru_year'] ) ? sanitize_text_field( wp_unslash( $_POST['dumitru_year'] ) ) : '';
	$code = isset( $_POST['dumitru_code'] ) ? sanitize_text_field( wp_unslash( $_POST['dumitru_code'] ) ) : '';
	update_post_meta( $post_id, '_dumitru_url', $url );
	update_post_meta( $post_id, '_dumitru_year', $year );
	update_post_meta( $post_id, '_dumitru_code', $code );
	update_post_meta( $post_id, '_dumitru_featured', ! empty( $_POST['dumitru_featured'] ) );
}
add_action( 'save_post_dumitru_project', 'dumitru_project_save' );

/**
 * Columns in the Projects list.
 */
function dumitru_project_columns( $columns ) {
	$columns['dumitru_kind'] = __( 'Shown as', 'dumitru' );
	return $columns;
}
add_filter( 'manage_dumitru_project_posts_columns', 'dumitru_project_columns' );

function dumitru_project_column( $column, $post_id ) {
	if ( 'dumitru_kind' === $column ) {
		echo get_post_meta( $post_id, '_dumitru_featured', true ) ? esc_html__( 'Big card', 'dumitru' ) : esc_html__( 'Logo strip', 'dumitru' );
	}
}
add_action( 'manage_dumitru_project_posts_custom_column', 'dumitru_project_column', 10, 2 );

/**
 * Published projects, ordered.
 *
 * @param bool $featured Big cards (true) or the strip (false).
 * @return array[] name, does, url, year, code, logo (attachment ID or 0).
 */
function dumitru_projects( $featured ) {
	$posts = get_posts(
		array(
			'post_type'      => 'dumitru_project',
			'post_status'    => 'publish',
			'posts_per_page' => 40,
			'orderby'        => array(
				'menu_order' => 'ASC',
				'date'       => 'DESC',
			),
			'no_found_rows'  => true,
		)
	);
	$out   = array();
	foreach ( $posts as $post ) {
		if ( (bool) get_post_meta( $post->ID, '_dumitru_featured', true ) !== $featured ) {
			continue;
		}
		$out[] = array(
			'name' => get_the_title( $post ),
			'does' => has_excerpt( $post ) ? get_the_excerpt( $post ) : '',
			'url'  => get_post_meta( $post->ID, '_dumitru_url', true ),
			'year' => get_post_meta( $post->ID, '_dumitru_year', true ),
			'code' => get_post_meta( $post->ID, '_dumitru_code', true ),
			'logo' => (int) get_post_thumbnail_id( $post ),
		);
	}
	return $out;
}
