<?php
/**
 * Site header: avatar and label, tabs, light/dark switch.
 *
 * @package Dumitru
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$dumitru_handle = dumitru_mod( 'handle' );
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="color-scheme" content="light dark">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'grain' ); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#main"><?php esc_html_e( 'Skip to content', 'dumitru' ); ?></a>

<header class="site-header" data-dc-header>
	<div class="rack">
		<div class="masthead">
			<a class="masthead__brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">
				<img class="masthead__avatar" src="<?php echo esc_url( dumitru_image( 'portrait/portrait-320.webp' ) ); ?>" width="32" height="32" alt="">
				<span class="masthead__handle"><?php echo esc_html( '' !== $dumitru_handle ? $dumitru_handle : dumitru_name() ); ?></span>
			</a>
			<nav class="masthead__nav" aria-label="<?php esc_attr_e( 'Main', 'dumitru' ); ?>">
				<?php
				if ( has_nav_menu( 'primary' ) ) {
					wp_nav_menu(
						array(
							'theme_location' => 'primary',
							'container'      => false,
							'menu_class'     => 'tabs',
							'depth'          => 1,
							'fallback_cb'    => false,
						)
					);
				} else {
					dumitru_default_tabs();
				}
				?>
			</nav>
			<button class="switch" type="button" data-dc-theme-switch aria-pressed="false">
				<span class="screen-reader-text"><?php esc_html_e( 'Dark mode', 'dumitru' ); ?></span>
				<span class="switch__thumb" aria-hidden="true"></span>
			</button>
		</div>
	</div>
</header>
