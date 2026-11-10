<?php
/**
 * [dumitru_portrait]: the grabbable portrait anywhere, e.g. in Elementor's
 * free "Shortcode" widget on another page.
 *
 *   [dumitru_portrait width="320"]
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * @param array $atts width (px, 160-640).
 * @return string
 */
function dumitru_portrait_shortcode( $atts ) {
	$atts  = shortcode_atts( array( 'width' => 320 ), $atts, 'dumitru_portrait' );
	$width = max( 160, min( 640, absint( $atts['width'] ) ) );
	wp_enqueue_style( 'dumitru-portrait' );
	wp_enqueue_script( 'dumitru-portrait' );
	return '<div class="dc-portrait-embed" style="width:' . esc_attr( $width ) . 'px;max-width:80%">' . dumitru_portrait_html( array( 'sizes' => $width . 'px' ) ) . '</div>';
}
add_shortcode( 'dumitru_portrait', 'dumitru_portrait_shortcode' );
