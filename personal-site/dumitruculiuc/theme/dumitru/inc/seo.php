<?php
/**
 * Search and sharing tags.
 *
 * WordPress itself provides the <title>, the canonical link on posts and
 * pages, and the sitemap at /wp-sitemap.xml. This adds a description,
 * Open Graph / X card tags and, on the home page, a Person record, but only
 * while no SEO plugin is active, so a site that installs Yoast (or Rank
 * Math, SEOPress, All in One SEO) never prints them twice.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Is a dedicated SEO plugin handling the tags?
 *
 * @return bool
 */
function dumitru_seo_plugin_active() {
	return defined( 'WPSEO_VERSION' ) || class_exists( 'RankMath' ) || defined( 'SEOPRESS_VERSION' ) || defined( 'AIOSEO_VERSION' );
}

/**
 * Description of the current view.
 *
 * @return string
 */
function dumitru_meta_description() {
	if ( is_singular() ) {
		$post = get_queried_object();
		$text = has_excerpt( $post ) ? get_the_excerpt( $post ) : wp_trim_words( wp_strip_all_tags( strip_shortcodes( $post->post_content ) ), 30, '…' );
	} elseif ( is_category() || is_tag() ) {
		$text = wp_strip_all_tags( term_description() );
	} else {
		$text = get_bloginfo( 'description' );
	}
	$text = trim( preg_replace( '/\s+/', ' ', html_entity_decode( (string) $text, ENT_QUOTES, 'UTF-8' ) ) );
	return mb_substr( $text, 0, 160 );
}

/**
 * Prints the tags.
 */
function dumitru_seo_tags() {
	if ( dumitru_seo_plugin_active() || is_404() ) {
		return;
	}

	$description = dumitru_meta_description();
	$title       = wp_get_document_title();
	$url         = is_singular() ? get_permalink() : ( is_front_page() ? home_url( '/' ) : '' );
	$image       = dumitru_image( 'portrait/og-1200x630.jpg' );
	$image_w     = 1200;
	$image_h     = 630;
	if ( is_singular() && has_post_thumbnail() ) {
		$src = wp_get_attachment_image_src( get_post_thumbnail_id(), 'dumitru-cover' );
		if ( $src ) {
			list( $image, $image_w, $image_h ) = $src;
		}
	}

	if ( '' !== $description ) {
		printf( '<meta name="description" content="%s">' . "\n", esc_attr( $description ) );
	}
	// WordPress prints the canonical itself when the home page is a static page.
	if ( is_front_page() && ! is_singular() && ! is_paged() ) {
		printf( '<link rel="canonical" href="%s">' . "\n", esc_url( home_url( '/' ) ) );
	}
	$og = array(
		'og:type'        => is_singular( 'post' ) ? 'article' : 'website',
		'og:site_name'   => get_bloginfo( 'name' ),
		'og:title'       => $title,
		'og:description' => $description,
		'og:url'         => $url,
		'og:image'       => $image,
		'og:image:width' => (string) $image_w,
		'og:image:height' => (string) $image_h,
		'og:locale'      => get_locale(),
	);
	foreach ( $og as $property => $content ) {
		if ( '' !== $content ) {
			printf( '<meta property="%s" content="%s">' . "\n", esc_attr( $property ), esc_attr( $content ) );
		}
	}
	if ( is_singular( 'post' ) ) {
		printf( '<meta property="article:published_time" content="%s">' . "\n", esc_attr( get_the_date( DATE_W3C ) ) );
		printf( '<meta property="article:modified_time" content="%s">' . "\n", esc_attr( get_the_modified_date( DATE_W3C ) ) );
	}
	echo '<meta name="twitter:card" content="summary_large_image">' . "\n";

	if ( is_front_page() ) {
		$same_as = wp_list_pluck( dumitru_social_links(), 'url' );
		$person  = array(
			'@context' => 'https://schema.org',
			'@type'    => 'Person',
			'name'     => dumitru_name(),
			'url'      => home_url( '/' ),
			'image'    => dumitru_image( 'portrait/portrait-640.jpg' ),
		);
		if ( $same_as ) {
			$person['sameAs'] = array_values( $same_as );
		}
		echo '<script type="application/ld+json">' . wp_json_encode( $person, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "</script>\n";
	}
}
add_action( 'wp_head', 'dumitru_seo_tags', 5 );

/**
 * WordPress adds its own canonical on singular views; the home page above.
 * Project pages are not public, so keep them out of the sitemap.
 *
 * @param array $post_types Post types in the sitemap.
 * @return array
 */
function dumitru_sitemap_post_types( $post_types ) {
	unset( $post_types['dumitru_project'] );
	return $post_types;
}
add_filter( 'wp_sitemaps_post_types', 'dumitru_sitemap_post_types' );
