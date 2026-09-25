<?php
/**
 * Plugin Name: RepGet Connector
 * Description: Publishes articles written by RepGet straight to this site. Paste your Integration Key to connect.
 * Version: 1.4.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * License: GPLv2 or later
 */

/**
 * RepGet Connector.
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

define('REPGET_VERSION', '1.4.0');
define('REPGET_OPTION_KEY', 'repget_integration_key');
define('REPGET_OPTION_STATUS', 'repget_status');
define('REPGET_OPTION_ENDPOINT', 'repget_endpoint');
/*
  Set by the activation hook, read and deleted on the next admin screen.
  An activation hook cannot redirect - it runs inside the request WordPress
  is still using to finish activating - so the intent is parked here.
*/
define('REPGET_OPTION_ACTIVATED', 'repget_just_activated');

/**
 * Default API host. Overridable for self-hosted or staging installs.
 *
 * THIS VALUE IS SECURITY-RELEVANT, not cosmetic. Every request below sends
 * the customer's Integration Key in an X-Integration-Key header, so whatever
 * host is named here receives that key from every install that does not
 * override it.
 *
 * It previously read `https://seovision.io`, which is a live, unrelated
 * company's website — not a typo for a domain we own. Any customer who
 * installed the plugin and pasted their key sent it straight to a third
 * party, and got nothing back but a 404, because that host has no
 * /api/plugin/* routes.
 */
function repget_endpoint() {
    $stored = get_option(REPGET_OPTION_ENDPOINT);
    if (is_string($stored) && $stored !== '') {
        return untrailingslashit($stored);
    }
    return 'https://full-stack-sass-ai-seo-improvement.vercel.app';
}

function repget_key() {
    $key = get_option(REPGET_OPTION_KEY);
    return is_string($key) ? trim($key) : '';
}

/**
 * Carries settings over from the plugin's former name.
 *
 * The plugin was called "SEOVision Connector" and stored its options under
 * seovision_* keys. Renaming the functions alone would leave those rows
 * untouched and unread, so an existing install would silently forget its
 * Integration Key and stop publishing — with a settings page showing an empty
 * field and no hint that a key was ever there.
 *
 * Runs on activation, which is when WordPress loads the renamed plugin for the
 * first time. Only ever fills a key that is currently EMPTY: if someone has
 * already entered one under the new name, theirs is the current intent and
 * must not be overwritten by a stale value.
 *
 * The old rows are deleted once copied. Leaving a valid Integration Key in the
 * options table under a name nothing reads is a credential lying around for no
 * reason.
 */
function repget_migrate_legacy_options() {
    $pairs = array(
        'seovision_integration_key' => REPGET_OPTION_KEY,
        'seovision_status'          => REPGET_OPTION_STATUS,
        'seovision_endpoint'        => REPGET_OPTION_ENDPOINT,
    );

    foreach ($pairs as $legacy => $current) {
        $old = get_option($legacy);
        if (!is_string($old) || $old === '') {
            continue;
        }

        $existing = get_option($current);
        if (!is_string($existing) || $existing === '') {
            update_option($current, $old);
        }

        delete_option($legacy);
    }

    /**
     * The old default pointed at an unrelated third party. An install that
     * stored it explicitly would keep sending keys there even after this
     * upgrade, so that one value is dropped rather than carried over — the
     * function's own default then applies.
     */
    $endpoint = get_option(REPGET_OPTION_ENDPOINT);
    if (is_string($endpoint) && strpos($endpoint, 'seovision.io') !== false) {
        delete_option(REPGET_OPTION_ENDPOINT);
    }
}

/**
 * Calls the RepGet API.
 *
 * Returns an array on success or a WP_Error. Timeouts are generous: article
 * bodies are large, and a customer's shared host is often slow.
 */
function repget_request($path, $args = array()) {
    $key = repget_key();
    if ($key === '') {
        return new WP_Error('no_key', __('No Integration Key is set.', 'repget'));
    }

    $defaults = array(
        'timeout' => 30,
        'headers' => array(
            'X-Integration-Key' => $key,
            'Content-Type'      => 'application/json',
            'Accept'            => 'application/json',
            // Where RepGet can ask this site to check now - see
            // repget_remote_sync. Sent every time so an upgraded plugin is
            // picked up on its next check, without reconnecting.
            'X-RepGet-Sync-Url' => admin_url('admin-ajax.php'),
        ),
    );

    $response = wp_remote_request(
        repget_endpoint() . $path,
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
        update_option(REPGET_OPTION_STATUS, 'invalid_key');
        return new WP_Error('invalid_key', __('The Integration Key was rejected.', 'repget'));
    }

    if ($code < 200 || $code >= 300) {
        $message = is_array($body) && isset($body['error'])
            ? $body['error']
            : sprintf(__('The server returned HTTP %d.', 'repget'), $code);
        return new WP_Error('http_error', $message);
    }

    return is_array($body) ? $body : array();
}

/* -------------------------------------------------------------------------- */
/* Settings page                                                              */
/* -------------------------------------------------------------------------- */

add_action('admin_menu', 'repget_admin_menu');
function repget_admin_menu() {
    /*
      A TOP-LEVEL menu item, not a Settings submenu.

      It was add_options_page, which is where WordPress says an options page
      belongs - and for a plugin that is configured once and forgotten, that
      is right. This one is not: it holds the key, the connection status and
      the "check for articles now" button, and a customer who cannot find it
      cannot tell whether their site is publishing.

      The client asked for exactly this, comparing us with the product he was
      already using: "And I like a lot it's showing on the main dashboard
      without going to the settings and find the plugin there."

      Position 58 sits it just below Settings, away from the content menus a
      writer uses daily. The dashicon is the generic admin-links mark rather
      than a bespoke SVG - this menu is found by its name, and a custom icon
      is weight for nothing.
    */
    add_menu_page(
        'RepGet',
        'RepGet',
        // Only administrators: this key controls what gets published.
        'manage_options',
        'repget',
        'repget_settings_page',
        'dashicons-admin-links',
        58
    );

    /*
      Settings -> RepGet still works.

      It was the only way in for every install before this version, so it is
      in browser histories, in our own setup guide and in the links shared
      with the client. Registered as a hidden submenu of the same slug: the
      page renders identically and the old URL keeps resolving, without a
      duplicate entry appearing under Settings.
    */
    add_submenu_page(
        'options-general.php',
        'RepGet',
        'RepGet',
        'manage_options',
        'repget',
        'repget_settings_page'
    );
}

/**
 * A "Settings" link on the Plugins list row.
 *
 * The client could not find this screen after installing: "if not I will
 * never know it even needs to add the api key. This is very important."
 * Settings -> RepGet is where WordPress says an options page belongs, but
 * nothing pointed at it, and a plugin that does nothing until a key is
 * pasted has to say where the key goes.
 *
 * This is the convention every established plugin follows, and it costs
 * one filter.
 */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'repget_action_links');
function repget_action_links($links) {
    $settings = sprintf(
        '<a href="%s">%s</a>',
        esc_url(admin_url('admin.php?page=repget')),
        esc_html__('Settings', 'repget')
    );
    // Prepended: the first link is the one people reach for.
    array_unshift($links, $settings);
    return $links;
}

/**
 * Send the customer to the settings screen the moment the plugin activates.
 *
 * The strongest version of the client's request - "It should redirect in
 * some way to the settings of the plugin in the wordpress dashboard. Right
 * now it's not intuitive."
 *
 * Three guards, because an activation redirect is easy to get wrong:
 *
 *  - Only when OUR flag is set, cleared immediately, so it happens once.
 *  - Never during a bulk activation. WordPress sets `activate-multi` when
 *    several plugins are switched on together, and redirecting then would
 *    interrupt the other activations.
 *  - Never for somebody who cannot see the page anyway.
 *
 * Skipped entirely when a key is already saved: an upgrade should not throw
 * an administrator onto a settings screen they finished with months ago.
 */
add_action('admin_init', 'repget_maybe_redirect_after_activation');
function repget_maybe_redirect_after_activation() {
    if (!get_option(REPGET_OPTION_ACTIVATED)) {
        return;
    }

    // Once, whatever happens next.
    delete_option(REPGET_OPTION_ACTIVATED);

    if (isset($_GET['activate-multi'])) {
        return;
    }
    if (!current_user_can('manage_options')) {
        return;
    }
    if (repget_key() !== '') {
        return;
    }

    wp_safe_redirect(admin_url('admin.php?page=repget'));
    exit;
}

/**
 * A banner on every admin screen while the plugin is installed but idle.
 *
 * The redirect above covers the moment of activation; this covers everyone
 * who navigated away, activated in bulk, or upgraded from a version that
 * never had the redirect. Without a key the plugin publishes nothing, and
 * silently doing nothing is the state the client was stuck in.
 *
 * Not shown ON the settings screen - the form is already there - and not
 * shown to anyone who could not act on it.
 */
add_action('admin_notices', 'repget_setup_notice');
function repget_setup_notice() {
    if (!current_user_can('manage_options')) {
        return;
    }
    if (repget_key() !== '') {
        return;
    }

    /*
      Both screen ids. The page is now reachable two ways - the top-level
      menu (toplevel_page_repget) and the Settings alias kept for old links
      (settings_page_repget) - and the banner must not appear above the form
      it is pointing at, whichever route the customer took.
    */
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if ($screen && in_array($screen->id, array('toplevel_page_repget', 'settings_page_repget'), true)) {
        return;
    }

    printf(
        '<div class="notice notice-warning"><p><strong>%s</strong> %s <a href="%s">%s</a></p></div>',
        esc_html__('RepGet is not connected yet.', 'repget'),
        esc_html__('Paste your Integration Key to start publishing articles.', 'repget'),
        esc_url(admin_url('admin.php?page=repget')),
        esc_html__('Open settings', 'repget')
    );
}

function repget_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $notice = '';
    $notice_type = 'success';


    /**
     * Nonce-checked. Without it, a request forged from another site could
     * change which RepGet account publishes to this WordPress install.
     */
    if (isset($_POST['repget_save']) && check_admin_referer('repget_save_key')) {
        $key = isset($_POST['repget_key'])
            ? sanitize_text_field(wp_unslash($_POST['repget_key']))
            : '';
        update_option(REPGET_OPTION_KEY, $key);

        $result = repget_verify();
        if (is_wp_error($result)) {
            $notice = $result->get_error_message();
            $notice_type = 'error';
        } else {
            $name = isset($result['website']['name']) ? $result['website']['name'] : '';
            $notice = $name !== ''
                ? sprintf(__('Connected to %s.', 'repget'), esc_html($name))
                : __('Connected.', 'repget');
        }
    }

    if (isset($_POST['repget_sync']) && check_admin_referer('repget_save_key')) {
        $count = repget_sync();
        if (is_wp_error($count)) {
            $notice = $count->get_error_message();
            $notice_type = 'error';
        } else {
            $notice = sprintf(
                _n('%d article sent to WordPress.', '%d articles sent to WordPress.', $count, 'repget'),
                $count
            );
        }
    }

    $key = repget_key();
    $status = get_option(REPGET_OPTION_STATUS);
    ?>
    <div class="wrap">
        <h1>RepGet</h1>

        <?php /* Revealed by the script at the end of this page. */ ?>
        <div id="repget-prefill-notice" class="notice notice-info" hidden>
            <p><?php esc_html_e('Your key is filled in below. Press "Save and connect" to finish.', 'repget'); ?></p>
        </div>

        <?php if ($notice !== '') : ?>
            <div class="notice notice-<?php echo esc_attr($notice_type); ?> is-dismissible">
                <p><?php echo esc_html($notice); ?></p>
            </div>
        <?php endif; ?>

        <p>
            <?php esc_html_e(
                'Paste the Integration Key from your RepGet workspace. Articles will then publish here automatically.',
                'repget'
            ); ?>
        </p>

        <form method="post">
            <?php wp_nonce_field('repget_save_key'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="repget_key"><?php esc_html_e('Integration Key', 'repget'); ?></label>
                    </th>
                    <td>
                        <input
                            type="password"
                            id="repget_key"
                            name="repget_key"
                            value="<?php echo esc_attr($key); ?>"
                            class="regular-text"
                            autocomplete="off"
                        />
                        <p class="description">
                            <?php esc_html_e('In RepGet: Settings → Integrations → WordPress plugin → New key.', 'repget'); ?>
                        </p>
                    </td>
                </tr>
                <?php if ($key !== '') : ?>
                <tr>
                    <th scope="row"><?php esc_html_e('Status', 'repget'); ?></th>
                    <td>
                        <?php if ($status === 'connected') : ?>
                            <span style="color:#00a32a;">&#10003; <?php esc_html_e('Connected', 'repget'); ?></span>
                        <?php elseif ($status === 'invalid_key') : ?>
                            <span style="color:#d63638;"><?php esc_html_e('The key was rejected. Check it was copied in full.', 'repget'); ?></span>
                        <?php else : ?>
                            <span><?php esc_html_e('Not checked yet', 'repget'); ?></span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endif; ?>
            </table>

            <p class="submit">
                <button type="submit" name="repget_save" class="button button-primary">
                    <?php esc_html_e('Save and connect', 'repget'); ?>
                </button>
                <?php if ($key !== '') : ?>
                    <button type="submit" name="repget_sync" class="button">
                        <?php esc_html_e('Check for articles now', 'repget'); ?>
                    </button>
                <?php endif; ?>
            </p>
        </form>
    </div>

    <?php
    /*
      Fills the key in from the RepGet link - from the URL FRAGMENT, not the
      query string.

      1.3.0 read it from ?repget_key=, which put a live credential in this
      site's web-server access logs, in any analytics or security plugin that
      records admin URLs, and in the Referer of anything the page loaded. The
      part after # is never sent to a server by any browser, so none of those
      ever see it.

      It is written into the input's value rather than into markup, so a
      crafted fragment can only ever be text in a password field. The
      address bar is cleaned straight after, so the key does not sit in the
      tab or in screenshots sent to support.

      It still does not SAVE anything: the customer presses Save and connect,
      a normal nonce-checked POST. See the note on repget_settings_page for
      why acting on a link alone would be unsafe.
    */
    ?>
    <script>
    (function () {
        var match = /(?:^#|&)repget_key=([^&]*)/.exec(window.location.hash);
        if (!match) return;

        var key = '';
        try {
            key = decodeURIComponent(match[1]);
        } catch (e) {
            // Malformed escape - leave the field as it was.
        }

        var field = document.getElementById('repget_key');
        if (field && key) {
            field.value = key;
            var notice = document.getElementById('repget-prefill-notice');
            if (notice) notice.hidden = false;
        }

        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    })();
    </script>
    <?php
}

/* -------------------------------------------------------------------------- */
/* Connect and sync                                                           */
/* -------------------------------------------------------------------------- */

/** Confirms the key works, and tells RepGet which site this is. */
function repget_verify() {
    $result = repget_request('/api/plugin/verify', array(
        'method' => 'POST',
        'body'   => wp_json_encode(array(
            'siteUrl'       => get_site_url(),
            'wpVersion'     => get_bloginfo('version'),
            'pluginVersion' => REPGET_VERSION,
            'syncUrl'       => admin_url('admin-ajax.php'),
        )),
    ));

    if (is_wp_error($result)) {
        return $result;
    }

    update_option(REPGET_OPTION_STATUS, 'connected');
    return $result;
}

/**
 * Pulls waiting articles and creates posts.
 *
 * Every outcome is reported back, success or failure. An article we fail to
 * create must not stay in the queue silently, and must not be marked live.
 */
function repget_sync() {
    $result = repget_request('/api/plugin/articles', array('method' => 'GET'));
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

        /*
          Live or draft, as RepGet decided: the website's "Publish as" setting,
          or the choice made when somebody pressed Publish. Before 1.3.2 every
          article was published live, whatever that setting said. Anything
          unexpected falls back to live, which is what RepGet sent it for.
        */
        $status = (isset($article['status']) && $article['status'] === 'draft')
            ? 'draft'
            : 'publish';

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
            'post_status'  => $status,
            'post_type'    => 'post',
        ), true);

        if (is_wp_error($post_id)) {
            repget_report($article['id'], null, null, $post_id->get_error_message(), $status);
            continue;
        }

        // The header image, when one was generated. A failure here is not
        // fatal: the article is still published, just without its image.
        if (!empty($article['image']['url'])) {
            repget_attach_image($post_id, $article['image']['url'], $article['image']['alt']);
        }

        repget_report($article['id'], get_permalink($post_id), $post_id, null, $status);
        $published++;
    }

    return $published;
}

/** Tells RepGet what happened, so the article leaves the queue. */
function repget_report($article_id, $url, $remote_id, $error, $status = 'publish') {
    repget_request('/api/plugin/published', array(
        'method' => 'POST',
        'body'   => wp_json_encode(array(
            'articleId' => $article_id,
            'url'       => $url,
            'remoteId'  => $remote_id,
            'error'     => $error,
            // So RepGet records a WordPress draft as a draft, not as live.
            'status'    => $status,
        )),
    ));
}

/** Downloads the header image into the media library and sets it featured. */
function repget_attach_image($post_id, $url, $alt) {
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

register_activation_hook(__FILE__, 'repget_activate');
function repget_activate() {
    // Before anything else: an upgraded install must find its existing key.
    repget_migrate_legacy_options();

    /*
      The old plugin scheduled 'seovision_sync_event'. Its handler no longer
      exists after the rename, so WordPress would keep waking an event that
      does nothing, forever. Deactivating the old plugin clears it only if the
      customer deactivates rather than overwrites, so clear it here too.
    */
    wp_clear_scheduled_hook('seovision_sync_event');

    if (!wp_next_scheduled('repget_sync_event')) {
        // Hourly. Articles are written over minutes and reviewed by a human
        // before they reach the queue, so polling faster would only add load.
        wp_schedule_event(time() + 60, 'hourly', 'repget_sync_event');
    }

    /*
      Read once by admin_init on the next screen load, which is where the
      redirect happens. It cannot happen here: an activation hook runs inside
      the plugin-activation request, and redirecting from it aborts the
      activation WordPress is still finishing.
    */
    add_option(REPGET_OPTION_ACTIVATED, 1);
}

register_deactivation_hook(__FILE__, 'repget_deactivate');
function repget_deactivate() {
    // Leaving a scheduled event behind would keep calling an API the site no
    // longer has a plugin for.
    wp_clear_scheduled_hook('repget_sync_event');
}

/**
 * "Check now", called by RepGet when somebody presses Publish.
 *
 * Without it a Publish press waited for the hourly check below. It runs that
 * same check - fetch due articles from RepGet and create them - and nothing
 * else, so the worst a caller could do is make this site ask RepGet for its
 * own articles early.
 *
 * admin-ajax.php, not the REST API: this plugin exists for hosts that block
 * /wp-json, and admin-ajax is what every site keeps open for its own pages.
 * nopriv because RepGet is not a logged-in WordPress user; the request is
 * authenticated by its signature instead:
 *
 *   sig = HMAC-SHA256(timestamp, SHA-256 of the integration key)
 *
 * RepGet stores only that hash and this site holds the key, so both can
 * compute it and nobody else can. Anything older than five minutes, or
 * already seen, is refused, and only one runs at a time.
 */
add_action('wp_ajax_nopriv_repget_sync', 'repget_remote_sync');
add_action('wp_ajax_repget_sync', 'repget_remote_sync');
function repget_remote_sync() {
    $key = repget_key();
    $ts  = isset($_POST['ts']) ? sanitize_text_field(wp_unslash($_POST['ts'])) : '';
    $sig = isset($_POST['sig']) ? sanitize_text_field(wp_unslash($_POST['sig'])) : '';

    if ($key === '' || $sig === '' || !ctype_digit($ts) || abs(time() - (int) $ts) > 300) {
        wp_send_json_error(array('error' => 'rejected'), 403);
    }

    $expected = hash_hmac('sha256', $ts, hash('sha256', trim($key)));
    if (!hash_equals($expected, $sig)) {
        wp_send_json_error(array('error' => 'rejected'), 403);
    }

    // A signature is good for one call.
    $seen = 'repget_sync_seen_' . md5($sig);
    if (get_transient($seen)) {
        wp_send_json_error(array('error' => 'replayed'), 409);
    }
    set_transient($seen, 1, 10 * MINUTE_IN_SECONDS);

    // One check at a time: two would create the same post twice.
    if (get_transient('repget_sync_running')) {
        wp_send_json_error(array('error' => 'busy'), 429);
    }
    set_transient('repget_sync_running', 1, 2 * MINUTE_IN_SECONDS);
    $result = repget_sync();
    delete_transient('repget_sync_running');

    if (is_wp_error($result)) {
        wp_send_json_error(array('error' => $result->get_error_message()), 502);
    }
    wp_send_json_success(array('created' => (int) $result));
}

add_action('repget_sync_event', 'repget_cron_sync');
function repget_cron_sync() {
    if (repget_key() === '') {
        return;
    }
    repget_sync();
}
