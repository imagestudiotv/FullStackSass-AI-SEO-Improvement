<?php
/**
 * Settings -> Image Studio Blog: the PayPal email payments go to, whether
 * "Get Featured" shows, the author page's bio, PayPal's test mode, whether
 * articles show "In this article" (extras.php), and the proxies trusted to
 * say who a visitor is (limits.php).
 */

defined('ABSPATH') || exit;

/** The settings, with their defaults: the PayPal email the client gave (2026-10-08). */
function isb_settings() {
    $saved = get_option('isb_settings', array());
    return wp_parse_args(is_array($saved) ? $saved : array(), array(
        'paypal_email' => 'dimoncic@live.it',
        'show_feature' => true,
        'sandbox' => false,
        'post_type' => 'custom_post',
        'bio_en' => '',
        'bio_it' => '',
        'show_toc' => true,
        // None: only the address that connects counts (limits.php).
        'trusted_proxies' => '',
        'client_ip_header' => '',
    ));
}

/** The editorial articles' post type: "custom_post" on imagestudio.com. */
function isb_post_type() {
    return sanitize_key(isb_settings()['post_type']) ?: 'custom_post';
}

/** "it" on the Italian pages (WPML), else "en". */
function isb_lang() {
    $wpml = apply_filters('wpml_current_language', null);
    $lang = is_string($wpml) && $wpml !== '' ? $wpml : substr(determine_locale(), 0, 2);
    return $lang === 'it' ? 'it' : 'en';
}

/** True when "Get Featured" can take payments: switched on, with a PayPal email. */
function isb_feature_ready() {
    $settings = isb_settings();
    return !empty($settings['show_feature']) && is_email($settings['paypal_email']);
}

add_action('admin_init', function () {
    register_setting('isb_settings', 'isb_settings', array(
        'type' => 'array',
        'sanitize_callback' => function ($input) {
            $input = is_array($input) ? $input : array();
            $email = sanitize_email($input['paypal_email'] ?? '');
            if (!is_email($email)) {
                add_settings_error('isb_settings', 'isb_paypal_email', __('Enter the email address of the PayPal account that should receive the payments.', 'imagestudio-blog'));
                $email = isb_settings()['paypal_email'];
            }
            // Trusted proxies: each line an address or a range; anything else is dropped, and named.
            $proxies = array();
            $rejected = array();
            foreach (preg_split('~[\s,]+~', (string) ($input['trusted_proxies'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) as $entry) {
                $range = isb_clean_range($entry);
                if ($range === null) $rejected[] = $entry;
                elseif (!in_array($range, $proxies, true)) $proxies[] = $range;
            }
            if ($rejected) {
                /* translators: %s: the entries that were not addresses or ranges */
                add_settings_error('isb_settings', 'isb_trusted_proxies', sprintf(__('Not saved as trusted proxies (not an IP address or a range of at least /8 for IPv4, /16 for IPv6): %s', 'imagestudio-blog'), implode(', ', array_map('sanitize_text_field', array_slice($rejected, 0, 10)))));
            }
            $header = sanitize_key($input['client_ip_header'] ?? '');
            return array(
                'paypal_email' => $email,
                'show_feature' => !empty($input['show_feature']),
                'sandbox' => !empty($input['sandbox']),
                'post_type' => sanitize_key($input['post_type'] ?? 'custom_post') ?: 'custom_post',
                'bio_en' => sanitize_textarea_field($input['bio_en'] ?? ''),
                'bio_it' => sanitize_textarea_field($input['bio_it'] ?? ''),
                'show_toc' => !empty($input['show_toc']),
                'trusted_proxies' => implode("\n", $proxies),
                'client_ip_header' => isset(isb_client_ip_headers()[$header]) ? $header : '',
            );
        },
    ));
});

add_action('admin_menu', function () {
    add_options_page(__('Image Studio Blog', 'imagestudio-blog'), __('Image Studio Blog', 'imagestudio-blog'), 'manage_options', 'imagestudio-blog', 'isb_settings_page');
});

function isb_settings_page() {
    if (!current_user_can('manage_options')) return;
    $s = isb_settings();
    $types = get_post_types(array('public' => true), 'objects');
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Image Studio Blog', 'imagestudio-blog'); ?></h1>
        <form method="post" action="options.php">
            <?php settings_fields('isb_settings'); ?>
            <h2><?php esc_html_e('Get Featured in This Article', 'imagestudio-blog'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><?php esc_html_e('Show on articles', 'imagestudio-blog'); ?></th>
                    <td><label><input type="checkbox" name="isb_settings[show_feature]" value="1" <?php checked($s['show_feature']); ?>> <?php echo esc_html(sprintf(__('Show the "Get Featured" button on every editorial article (%s, one time, through PayPal)', 'imagestudio-blog'), isb_price_label('en'))); ?></label></td>
                </tr>
                <tr>
                    <th scope="row"><label for="isb-paypal-email"><?php esc_html_e('PayPal email', 'imagestudio-blog'); ?></label></th>
                    <td>
                        <input id="isb-paypal-email" class="regular-text" type="email" name="isb_settings[paypal_email]" value="<?php echo esc_attr($s['paypal_email']); ?>" required>
                        <p class="description"><?php echo esc_html(sprintf(__('The PayPal account the %s is paid to. No PayPal developer keys are needed.', 'imagestudio-blog'), isb_price_label('en'))); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('PayPal test mode', 'imagestudio-blog'); ?></th>
                    <td><label><input type="checkbox" name="isb_settings[sandbox]" value="1" <?php checked($s['sandbox']); ?>> <?php esc_html_e('Send buyers to the PayPal sandbox (for testing with a sandbox account only - no real money moves)', 'imagestudio-blog'); ?></label></td>
                </tr>
                <tr>
                    <th scope="row"><label for="isb-trusted-proxies"><?php esc_html_e('Trusted proxies', 'imagestudio-blog'); ?></label></th>
                    <td>
                        <textarea id="isb-trusted-proxies" class="large-text code" rows="4" name="isb_settings[trusted_proxies]" placeholder="203.0.113.0/24"><?php echo esc_textarea($s['trusted_proxies']); ?></textarea>
                        <p class="description"><?php esc_html_e('Requests are limited per visitor (5 an hour, 20 a day), per email and overall. A visitor is the address that connects to this server, unless it is one of these proxies (addresses or ranges, one per line - for example the published ranges of your CDN). Leave empty when visitors connect directly. Never add a range that ordinary visitors can connect from.', 'imagestudio-blog'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="isb-client-ip-header"><?php esc_html_e('Visitor address header', 'imagestudio-blog'); ?></label></th>
                    <td>
                        <select id="isb-client-ip-header" name="isb_settings[client_ip_header]">
                            <option value="" <?php selected($s['client_ip_header'], ''); ?>><?php esc_html_e('None - the connecting address only', 'imagestudio-blog'); ?></option>
                            <option value="cf-connecting-ip" <?php selected($s['client_ip_header'], 'cf-connecting-ip'); ?>>CF-Connecting-IP (Cloudflare)</option>
                            <option value="x-forwarded-for" <?php selected($s['client_ip_header'], 'x-forwarded-for'); ?>>X-Forwarded-For</option>
                            <option value="x-real-ip" <?php selected($s['client_ip_header'], 'x-real-ip'); ?>>X-Real-IP</option>
                        </select>
                        <p class="description"><?php esc_html_e('The header the trusted proxies put the address of the visitor in. It is read only on requests that come from a trusted proxy.', 'imagestudio-blog'); ?></p>
                        <?php
                        $remote = isb_clean_ip($_SERVER['REMOTE_ADDR'] ?? '');
                        $counted = isb_client_ip($_SERVER, isb_client_ip_policy());
                        ?>
                        <p class="description"><?php
                            /* translators: 1: the address this page was requested from, 2: the visitor address the limits use */
                            echo esc_html(sprintf(__('This page was requested from %1$s, counted as visitor %2$s. If every visitor shows the same proxy address here, add the ranges of that proxy above.', 'imagestudio-blog'), $remote ?? 'unknown', $counted ?? 'unknown'));
                        ?></p>
                        <?php if (!isb_quota_ready()) : ?>
                            <p class="notice notice-error inline"><?php esc_html_e('Requests are being refused: the request-limit tables could not be created as InnoDB tables. Ask the host to enable InnoDB.', 'imagestudio-blog'); ?></p>
                        <?php endif; ?>
                    </td>
                </tr>
            </table>
            <h2><?php esc_html_e('Author page', 'imagestudio-blog'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="isb-bio-en"><?php esc_html_e('Bio (English)', 'imagestudio-blog'); ?></label></th>
                    <td><textarea id="isb-bio-en" class="large-text" rows="3" name="isb_settings[bio_en]" placeholder="<?php echo esc_attr(isb_text('bio', 'en')); ?>"><?php echo esc_textarea($s['bio_en']); ?></textarea></td>
                </tr>
                <tr>
                    <th scope="row"><label for="isb-bio-it"><?php esc_html_e('Bio (Italian)', 'imagestudio-blog'); ?></label></th>
                    <td><textarea id="isb-bio-it" class="large-text" rows="3" name="isb_settings[bio_it]" placeholder="<?php echo esc_attr(isb_text('bio', 'it')); ?>"><?php echo esc_textarea($s['bio_it']); ?></textarea></td>
                </tr>
                <tr>
                    <th scope="row"><label for="isb-post-type"><?php esc_html_e('Articles', 'imagestudio-blog'); ?></label></th>
                    <td>
                        <select id="isb-post-type" name="isb_settings[post_type]">
                            <?php foreach ($types as $type) : ?>
                                <option value="<?php echo esc_attr($type->name); ?>" <?php selected($s['post_type'], $type->name); ?>><?php echo esc_html($type->labels->singular_name . ' (' . $type->name . ')'); ?></option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description"><?php esc_html_e('The editorial articles. On imagestudio.com: Editorial (custom_post).', 'imagestudio-blog'); ?></p>
                    </td>
                </tr>
            </table>
            <h2><?php esc_html_e('Article extras', 'imagestudio-blog'); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><?php esc_html_e('In this article', 'imagestudio-blog'); ?></th>
                    <td>
                        <label><input type="checkbox" name="isb_settings[show_toc]" value="1" <?php checked($s['show_toc']); ?>> <?php esc_html_e('Show \'In this article\' on articles', 'imagestudio-blog'); ?></label>
                        <p class="description"><?php esc_html_e('A contents box at the top of each article\'s text, with a link to each of its H2 headings, when it has at least 3. It can be hidden on one article in the "Article extras" box of its edit screen, where the article\'s optional FAQ is written too.', 'imagestudio-blog'); ?></p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
