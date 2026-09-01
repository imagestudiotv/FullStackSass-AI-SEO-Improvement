<?php
/**
 * Plugin Name: SEOVision Connector
 * Description: Publishes articles written by SEOVision straight to this site. Paste your Integration Key to connect.
 * Version: 1.0.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * License: GPLv2 or later
 */

/**
 * SEOVision Connector.
 *
 * The alternative to this plugin is the application-password flow, where the
 * customer finds a screen buried in WordPress admin, understands that an
 * application password is not their login password, and hands us write access
 * to their site. This is one key, pasted once.
 *
 * It also works where the push flow cannot: a site behind a firewall, on a
 * staging domain, or with the REST API disabled by a security plugin can still
 * make outbound requests. Those installs are exactly the ones where the other
 * flow fails, and they fail confusingly.
 *
 * The plugin PULLS. We never hold credentials to the customer's site; the
 * plugin already runs there with permission to create posts.
 */

// Direct file access would run this outside WordPress, where none of the
// functions below exist.
if (!defined('ABSPATH')) {
    exit;
}

define('SEOVISION_VERSION', '1.0.0');
define('SEOVISION_OPTION_KEY', 'seovision_integration_key');
define('SEOVISION_OPTION_STATUS', 'seovision_status');
define('SEOVISION_OPTION_ENDPOINT', 'seovision_endpoint');

/** Default API host. Overridable for self-hosted or staging installs. */
function seovision_endpoint() {
    $stored = get_option(SEOVISION_OPTION_ENDPOINT);
    if (is_string($stored) && $stored !== '') {
        return untrailingslashit($stored);
    }
    return 'https://seovision.io';
}

function seovision_key() {
    $key = get_option(SEOVISION_OPTION_KEY);
    return is_string($key) ? trim($key) : '';
}

/**
 * Calls the SEOVision API.
 *
 * Returns an array on success or a WP_Error. Timeouts are generous: article
 * bodies are large, and a customer's shared host is often slow.
 */
function seovision_request($path, $args = array()) {
    $key = seovision_key();
    if ($key === '') {
        return new WP_Error('no_key', __('No Integration Key is set.', 'seovision'));
    }

    $defaults = array(
        'timeout' => 30,
        'headers' => array(
            'X-Integration-Key' => $key,
            'Content-Type'      => 'application/json',
            'Accept'            => 'application/json',
        ),
    );

    $response = wp_remote_request(
        seovision_endpoint() . $path,
        array_merge($defaults, $args)
    );

    if (is_wp_error($response)) {
        return $response;
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($code === 401) {
        // Recorded so the settings page can say the key stopped working
        // rather than silently doing nothing on every cron run.
        update_option(SEOVISION_OPTION_STATUS, 'invalid_key');
        return new WP_Error('invalid_key', __('The Integration Key was rejected.', 'seovision'));
    }

    if ($code < 200 || $code >= 300) {
        $message = is_array($body) && isset($body['error'])
            ? $body['error']
            : sprintf(__('The server returned HTTP %d.', 'seovision'), $code);
        return new WP_Error('http_error', $message);
    }

    return is_array($body) ? $body : array();
}

/* -------------------------------------------------------------------------- */
/* Settings page                                                              */
/* -------------------------------------------------------------------------- */

add_action('admin_menu', 'seovision_admin_menu');
function seovision_admin_menu() {
    add_options_page(
        'SEOVision',
        'SEOVision',
        // Only administrators: this key controls what gets published.
        'manage_options',
        'seovision',
        'seovision_settings_page'
    );
}

function seovision_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $notice = '';
    $notice_type = 'success';

    /**
     * Nonce-checked. Without it, a request forged from another site could
     * change which SEOVision account publishes to this WordPress install.
     */
    if (isset($_POST['seovision_save']) && check_admin_referer('seovision_save_key')) {
        $key = isset($_POST['seovision_key'])
            ? sanitize_text_field(wp_unslash($_POST['seovision_key']))
            : '';
        update_option(SEOVISION_OPTION_KEY, $key);

        $result = seovision_verify();
        if (is_wp_error($result)) {
            $notice = $result->get_error_message();
            $notice_type = 'error';
        } else {
            $name = isset($result['website']['name']) ? $result['website']['name'] : '';
            $notice = $name !== ''
                ? sprintf(__('Connected to %s.', 'seovision'), esc_html($name))
                : __('Connected.', 'seovision');
        }
    }

    if (isset($_POST['seovision_sync']) && check_admin_referer('seovision_save_key')) {
        $count = seovision_sync();
        if (is_wp_error($count)) {
            $notice = $count->get_error_message();
            $notice_type = 'error';
        } else {
            $notice = sprintf(
                _n('%d article published.', '%d articles published.', $count, 'seovision'),
                $count
            );
        }
    }

    $key = seovision_key();
    $status = get_option(SEOVISION_OPTION_STATUS);
    ?>
    <div class="wrap">
        <h1>SEOVision</h1>

        <?php if ($notice !== '') : ?>
            <div class="notice notice-<?php echo esc_attr($notice_type); ?> is-dismissible">
                <p><?php echo esc_html($notice); ?></p>
            </div>
        <?php endif; ?>

        <p>
            <?php esc_html_e(
                'Paste the Integration Key from your SEOVision workspace. Articles will then publish here automatically.',
                'seovision'
            ); ?>
        </p>

        <form method="post">
            <?php wp_nonce_field('seovision_save_key'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="seovision_key"><?php esc_html_e('Integration Key', 'seovision'); ?></label>
                    </th>
                    <td>
                        <input
                            type="password"
                            id="seovision_key"
                            name="seovision_key"
                            value="<?php echo esc_attr($key); ?>"
                            class="regular-text"
                            autocomplete="off"
                        />
                        <p class="description">
                            <?php esc_html_e('Websites → your site → Publishing, in SEOVision.', 'seovision'); ?>
                        </p>
                    </td>
                </tr>
                <?php if ($key !== '') : ?>
                <tr>
                    <th scope="row"><?php esc_html_e('Status', 'seovision'); ?></th>
                    <td>
                        <?php if ($status === 'connected') : ?>
                            <span style="color:#00a32a;">&#10003; <?php esc_html_e('Connected', 'seovision'); ?></span>
                        <?php elseif ($status === 'invalid_key') : ?>
                            <span style="color:#d63638;"><?php esc_html_e('The key was rejected. Check it was copied in full.', 'seovision'); ?></span>
                        <?php else : ?>
                            <span><?php esc_html_e('Not checked yet', 'seovision'); ?></span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endif; ?>
            </table>

            <p class="submit">
                <button type="submit" name="seovision_save" class="button button-primary">
                    <?php esc_html_e('Save and connect', 'seovision'); ?>
                </button>
                <?php if ($key !== '') : ?>
                    <button type="submit" name="seovision_sync" class="button">
                        <?php esc_html_e('Check for articles now', 'seovision'); ?>
                    </button>
                <?php endif; ?>
            </p>
        </form>
    </div>
    <?php
}

/* -------------------------------------------------------------------------- */
/* Connect and sync                                                           */
/* -------------------------------------------------------------------------- */

/** Confirms the key works, and tells SEOVision which site this is. */
function seovision_verify() {
    $result = seovision_request('/api/plugin/verify', array(
        'method' => 'POST',
        'body'   => wp_json_encode(array(
            'siteUrl'       => get_site_url(),
            'wpVersion'     => get_bloginfo('version'),
            'pluginVersion' => SEOVISION_VERSION,
        )),
    ));

    if (is_wp_error($result)) {
        return $result;
    }

    update_option(SEOVISION_OPTION_STATUS, 'connected');
    return $result;
}

/**
 * Pulls waiting articles and creates posts.
 *
 * Every outcome is reported back, success or failure. An article we fail to
 * create must not stay in the queue silently, and must not be marked live.
 */
function seovision_sync() {
    $result = seovision_request('/api/plugin/articles', array('method' => 'GET'));
    if (is_wp_error($result)) {
        return $result;
    }

    $articles = isset($result['articles']) && is_array($result['articles'])
        ? $result['articles']
        : array();

    $published = 0;

    foreach ($articles as $article) {
        if (empty($article['id']) || empty($article['title'])) {
            continue;
        }

        $post_id = wp_insert_post(array(
            'post_title'   => sanitize_text_field($article['title']),
            /**
             * wp_kses_post rather than raw HTML. The body comes from an API,
             * and while we generate it ourselves, a plugin that injects
             * unfiltered HTML into a customer's site is one compromise away
             * from being the vector. WordPress's own post-content whitelist is
             * exactly the right filter here.
             */
            'post_content' => wp_kses_post($article['html']),
            'post_excerpt' => isset($article['excerpt'])
                ? sanitize_text_field($article['excerpt'])
                : '',
            'post_name'    => isset($article['slug']) ? sanitize_title($article['slug']) : '',
            'post_status'  => 'publish',
            'post_type'    => 'post',
        ), true);

        if (is_wp_error($post_id)) {
            seovision_report($article['id'], null, null, $post_id->get_error_message());
            continue;
        }

        // The header image, when one was generated. A failure here is not
        // fatal: the article is still published, just without its image.
        if (!empty($article['image']['url'])) {
            seovision_attach_image($post_id, $article['image']['url'], $article['image']['alt']);
        }

        seovision_report($article['id'], get_permalink($post_id), $post_id, null);
        $published++;
    }

    return $published;
}

/** Tells SEOVision what happened, so the article leaves the queue. */
function seovision_report($article_id, $url, $remote_id, $error) {
    seovision_request('/api/plugin/published', array(
        'method' => 'POST',
        'body'   => wp_json_encode(array(
            'articleId' => $article_id,
            'url'       => $url,
            'remoteId'  => $remote_id,
            'error'     => $error,
        )),
    ));
}

/** Downloads the header image into the media library and sets it featured. */
function seovision_attach_image($post_id, $url, $alt) {
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $attachment_id = media_sideload_image($url, $post_id, $alt, 'id');
    if (is_wp_error($attachment_id)) {
        return;
    }

    update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt));
    set_post_thumbnail($post_id, $attachment_id);
}

/* -------------------------------------------------------------------------- */
/* Scheduled sync                                                             */
/* -------------------------------------------------------------------------- */

register_activation_hook(__FILE__, 'seovision_activate');
function seovision_activate() {
    if (!wp_next_scheduled('seovision_sync_event')) {
        // Hourly. Articles are written over minutes and reviewed by a human
        // before they reach the queue, so polling faster would only add load.
        wp_schedule_event(time() + 60, 'hourly', 'seovision_sync_event');
    }
}

register_deactivation_hook(__FILE__, 'seovision_deactivate');
function seovision_deactivate() {
    // Leaving a scheduled event behind would keep calling an API the site no
    // longer has a plugin for.
    wp_clear_scheduled_hook('seovision_sync_event');
}

add_action('seovision_sync_event', 'seovision_cron_sync');
function seovision_cron_sync() {
    if (seovision_key() === '') {
        return;
    }
    seovision_sync();
}
