<?php
/**
 * Settings -> Image Studio Blog: the PayPal email payments go to, whether
 * "Get Featured" shows, the author page's bio, and PayPal's test mode.
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
            return array(
                'paypal_email' => $email,
                'show_feature' => !empty($input['show_feature']),
                'sandbox' => !empty($input['sandbox']),
                'post_type' => sanitize_key($input['post_type'] ?? 'custom_post') ?: 'custom_post',
                'bio_en' => sanitize_textarea_field($input['bio_en'] ?? ''),
                'bio_it' => sanitize_textarea_field($input['bio_it'] ?? ''),
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
                    <td><label><input type="checkbox" name="isb_settings[show_feature]" value="1" <?php checked($s['show_feature']); ?>> <?php esc_html_e('Show the "Get Featured" button on every editorial article ($99, one time, through PayPal)', 'imagestudio-blog'); ?></label></td>
                </tr>
                <tr>
                    <th scope="row"><label for="isb-paypal-email"><?php esc_html_e('PayPal email', 'imagestudio-blog'); ?></label></th>
                    <td>
                        <input id="isb-paypal-email" class="regular-text" type="email" name="isb_settings[paypal_email]" value="<?php echo esc_attr($s['paypal_email']); ?>" required>
                        <p class="description"><?php esc_html_e('The PayPal account the $99 is paid to. No PayPal developer keys are needed.', 'imagestudio-blog'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('PayPal test mode', 'imagestudio-blog'); ?></th>
                    <td><label><input type="checkbox" name="isb_settings[sandbox]" value="1" <?php checked($s['sandbox']); ?>> <?php esc_html_e('Send buyers to the PayPal sandbox (for testing with a sandbox account only - no real money moves)', 'imagestudio-blog'); ?></label></td>
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
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
