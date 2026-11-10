<?php
/**
 * Dumitru theme setup.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DUMITRU_VERSION', '1.3.1' );

require get_template_directory() . '/inc/helpers.php';
require get_template_directory() . '/inc/customizer.php';
require get_template_directory() . '/inc/projects.php';
require get_template_directory() . '/inc/sections.php';
require get_template_directory() . '/inc/elementor.php';
require get_template_directory() . '/inc/seo.php';
require get_template_directory() . '/inc/shortcodes.php';

/**
 * Theme supports, menus and image sizes.
 */
function dumitru_setup() {
	load_theme_textdomain( 'dumitru', get_template_directory() . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script', 'navigation-widgets' ) );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'align-wide' );
	add_theme_support( 'editor-styles' );
	add_editor_style( array( 'assets/fonts/fonts.css', 'assets/css/editor.css' ) );

	register_nav_menus(
		array(
			'primary' => __( 'Header tabs', 'dumitru' ),
		)
	);

	// Blog cards and the single post's cover.
	add_image_size( 'dumitru-cover', 1440, 810, true );
	add_image_size( 'dumitru-card', 720, 405, true );
}
add_action( 'after_setup_theme', 'dumitru_setup' );

/**
 * Width of embeds and wide images inside a post.
 */
function dumitru_content_width() {
	$GLOBALS['content_width'] = 760;
}
add_action( 'after_setup_theme', 'dumitru_content_width', 0 );

/**
 * Styles and scripts. The portrait's script loads only where a portrait is
 * on the page; it starts its engine lazily by itself.
 */
function dumitru_assets() {
	$uri = get_template_directory_uri();
	wp_enqueue_style( 'dumitru-fonts', $uri . '/assets/fonts/fonts.css', array(), DUMITRU_VERSION );
	wp_enqueue_style( 'dumitru-site', $uri . '/assets/css/site.css', array( 'dumitru-fonts' ), DUMITRU_VERSION );
	wp_enqueue_script( 'dumitru-site', $uri . '/assets/js/site.js', array(), DUMITRU_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );

	wp_register_style( 'dumitru-portrait', $uri . '/assets/css/portrait.css', array( 'dumitru-site' ), DUMITRU_VERSION );
	wp_register_script( 'dumitru-portrait', $uri . '/assets/js/portrait.js', array(), DUMITRU_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
	if ( is_front_page() ) {
		wp_enqueue_style( 'dumitru-portrait' );
		wp_enqueue_script( 'dumitru-portrait' );
	}

	if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
		wp_enqueue_script( 'comment-reply' );
	}
}
add_action( 'wp_enqueue_scripts', 'dumitru_assets' );

/**
 * Preload the two fonts the first screen uses.
 */
function dumitru_preload_fonts() {
	$fonts = array( 'inter-latin.woff2', 'zalando-sans-expanded-latin.woff2' );
	foreach ( $fonts as $font ) {
		printf(
			'<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
			esc_url( get_template_directory_uri() . '/assets/fonts/' . $font )
		);
	}
}
add_action( 'wp_head', 'dumitru_preload_fonts', 1 );

/**
 * Puts the visitor's light/dark choice on <html> before anything is painted,
 * so the page never flashes the wrong colours. No choice: follow the device.
 */
function dumitru_theme_boot() {
	echo "<script>(function(){try{var t=localStorage.getItem('dumitru-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}document.documentElement.classList.add('js');})();</script>\n";
}
add_action( 'wp_head', 'dumitru_theme_boot', 0 );

/**
 * Excerpts on the blog lists are short.
 */
function dumitru_excerpt_length() {
	return 28;
}
add_filter( 'excerpt_length', 'dumitru_excerpt_length' );

function dumitru_excerpt_more() {
	return '…';
}
add_filter( 'excerpt_more', 'dumitru_excerpt_more' );
