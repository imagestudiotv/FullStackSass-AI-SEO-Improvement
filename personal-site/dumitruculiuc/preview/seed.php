<?php
/**
 * LOCAL PREVIEW CONTENT ONLY. Never run this on the live site.
 *
 * Fills an empty WordPress with clearly marked draft texts so the theme can
 * be reviewed before Daniel's real texts arrive. Every invented sentence is
 * marked "DRAFT"; the only real facts are the two project descriptions,
 * taken from RepGet's and Image Studio's own sites on 2026-11-07.
 *
 * Run inside WordPress (wp-load.php already loaded), e.g. by the
 * WordPress Playground blueprint next to this file.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Pages: a static home page and the blog page.
$home = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Home' ) );
$blog = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Blog', 'post_name' => 'blog' ) );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $home );
update_option( 'page_for_posts', $blog );
update_option( 'blogname', 'Dumitru Culiuc' );
update_option( 'blogdescription', 'DRAFT tagline: to be written by Daniel.' );
update_option( 'permalink_structure', '/%postname%/' );
flush_rewrite_rules();

// A cover picture for the test post: the theme's sharing image.
require_once ABSPATH . 'wp-admin/includes/image.php';
$uploads = wp_upload_dir();
$cover   = $uploads['path'] . '/test-cover.jpg';
copy( get_template_directory() . '/assets/images/portrait/og-1200x630.jpg', $cover );
$cover_id = wp_insert_attachment(
	array(
		'post_mime_type' => 'image/jpeg',
		'post_title'     => 'Test cover',
		'post_status'    => 'inherit',
	),
	$cover
);
wp_update_attachment_metadata( $cover_id, wp_generate_attachment_metadata( $cover_id, $cover ) );

// The test post: every element the reading layout has to handle.
$category = wp_insert_term( 'Test category', 'category' );
$post_id  = wp_insert_post(
	array(
		'post_type'     => 'post',
		'post_status'   => 'publish',
		'post_title'    => 'TEST POST: checking the blog layout (not real content)',
		'post_excerpt'  => 'A test post that exists only to check the listing and the reading layout. Delete it before launch.',
		'post_category' => is_wp_error( $category ) ? array() : array( $category['term_id'] ),
		'post_content'  => implode(
			"\n\n",
			array(
				'<!-- wp:paragraph --><p>This is <strong>test content</strong> for the local preview. It shows how a normal paragraph reads, with <a href="https://wordpress.org/">a link</a> in it.</p><!-- /wp:paragraph -->',
				'<!-- wp:heading --><h2 class="wp-block-heading">A second-level heading</h2><!-- /wp:heading -->',
				'<!-- wp:paragraph --><p>Another paragraph under the heading, long enough to wrap over a few lines on a phone and show the line height of the reading text.</p><!-- /wp:paragraph -->',
				'<!-- wp:list --><ul class="wp-block-list"><li>A list item</li><li>Another list item</li></ul><!-- /wp:list -->',
				'<!-- wp:quote --><blockquote class="wp-block-quote"><p>A quotation, to see the quote style.</p></blockquote><!-- /wp:quote -->',
				'<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">A third-level heading</h3><!-- /wp:heading -->',
				'<!-- wp:paragraph --><p>Inline <code>code</code> and the end of the test.</p><!-- /wp:paragraph -->',
			)
		),
	)
);
set_post_thumbnail( $post_id, $cover_id );

// Two more short test posts so the list and "previous / next" have something.
foreach ( array( 'TEST POST: second entry', 'TEST POST: third entry' ) as $i => $title ) {
	wp_insert_post(
		array(
			'post_type'    => 'post',
			'post_status'  => 'publish',
			'post_title'   => $title,
			'post_excerpt' => 'Short test post. Delete before launch.',
			'post_content' => '<!-- wp:paragraph --><p>Short test post.</p><!-- /wp:paragraph -->',
			'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 40 * ( $i + 1 ) ) . ' days' ) ),
		)
	);
}

// Projects: the two Daniel is known for, described as their own sites do.
$projects = array(
	array( 'RepGet', 'AI SEO platform: content, backlinks and rankings', 'https://www.repget.com/', 1 ),
	array( 'Image Studio', 'Film, video and photography production', 'https://imagestudio.com/', 2 ),
);
foreach ( $projects as $p ) {
	$id = wp_insert_post(
		array(
			'post_type'    => 'dumitru_project',
			'post_status'  => 'publish',
			'post_title'   => $p[0],
			'post_excerpt' => $p[1],
			'menu_order'   => $p[3],
		)
	);
	update_post_meta( $id, '_dumitru_url', $p[2] );
	update_post_meta( $id, '_dumitru_featured', true );
}

// Home page texts: DRAFT markers wherever Daniel's own words are needed.
$mods = array(
	'name'          => 'Dumitru Culiuc',
	'handle'        => 'Dumitru Culiuc',
	'greeting'      => 'Hello! My name is',
	'greeting_name' => 'Dumitru',
	'intro'         => "DRAFT: Daniel's intro goes here (2 to 4 short paragraphs).\n\nDRAFT: what he builds, with links to RepGet and Image Studio.",
	'pitch_kicker'  => 'Psst.',
	'pitch_hurt'    => 'Ow! Fine,',
	'pitch_line'    => 'Try RepGet',
	'pitch_url'     => 'https://www.repget.com/',
	'work_title'    => "Some things I've built",
	'about_title'   => 'DRAFT: About title',
	'about_body'    => "DRAFT: Daniel's biography goes here.\n\nDRAFT: second paragraph.",
	'about_points'  => "DRAFT: a real achievement\nDRAFT: another real achievement",
);
foreach ( $mods as $key => $value ) {
	set_theme_mod( 'dumitru_' . $key, $value );
}
