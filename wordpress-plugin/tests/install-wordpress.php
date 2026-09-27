<?php
/**
 * Installs WordPress into the DISPOSABLE database named in <wordpress dir>/
 * wp-config.php, for real-wordpress.php. Never run it against a real site.
 *
 *   php wordpress-plugin/tests/install-wordpress.php <wordpress dir>
 */
if ($argc < 2) {
    fwrite(STDERR, "usage: php install-wordpress.php <wordpress dir>\n");
    exit(2);
}
define('WP_INSTALLING', true);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
require rtrim($argv[1], '/\\') . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
if (is_blog_installed()) {
    echo "already installed\n";
    exit(0);
}
// A throwaway admin; the random password is discarded.
$result = wp_install('RepGet test', 'admin', 'admin@wp.test', false, '', wp_generate_password(32));
echo "installed WordPress " . get_bloginfo('version') . "\n";
exit(empty($result['user_id']) ? 1 : 0);
