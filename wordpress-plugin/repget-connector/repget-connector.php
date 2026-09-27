<?php
/**
 * Plugin Name: RepGet Connector
 * Description: Publishes articles written by RepGet straight to this site. Paste your Integration Key to connect.
 * Version: 1.6.0
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

define('REPGET_VERSION', '1.6.0');
define('REPGET_OPTION_KEY', 'repget_integration_key');
define('REPGET_OPTION_STATUS', 'repget_status');
define('REPGET_OPTION_ENDPOINT', 'repget_endpoint');
/** Which content type RepGet articles are created as. See repget_post_type(). */
define('REPGET_OPTION_POST_TYPE', 'repget_post_type');
/** Marks a post as a RepGet article, with the RepGet article id. */
define('REPGET_META_ARTICLE', '_repget_article_id');
/*
  Acknowledgements RepGet has not confirmed yet.

  A post can be created successfully and the report back to RepGet can still
  fail - the site's outbound request times out, RepGet is briefly down, the PHP
  process is killed. The article then stays in RepGet's queue and the next poll
  hands it over again. Before 1.5.1 that produced a SECOND post every time,
  which is exactly the duplicate-content problem this product exists to avoid.

  So an unconfirmed acknowledgement is parked here and retried on the next sync,
  independently of publishing. Shape:
    [ article_id => array('post_id' => int, 'url' => string, 'status' => string) ]
*/
define('REPGET_OPTION_PENDING_ACK', 'repget_pending_acks');
/** Name of the atomic cross-entry-point sync lock. See repget_sync_locked(). */
define('REPGET_LOCK', 'repget_sync_lock');
/** Longest a sync may hold the lock before another entry point may steal it. */
define('REPGET_LOCK_TTL', 300);
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
            /*
              1.6.0+: tells RepGet this plugin echoes each hand-over's
              dispatch id in its report (protocol v2), so a report settles
              exactly the delivery it answers - never a newer one.
            */
            'X-RepGet-Plugin-Version' => REPGET_VERSION,
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

        $moved_notice = '';
        if (isset($_POST['repget_post_type'])) {
            $wanted = sanitize_key(wp_unslash($_POST['repget_post_type']));
            $choices = repget_post_type_choices();
            if (isset($choices[$wanted]) && $wanted !== repget_post_type()) {
                update_option(REPGET_OPTION_POST_TYPE, $wanted);
                $moved = repget_move_articles_to($wanted);
                if (!is_wp_error($moved) && $moved > 0) {
                    $moved_notice = ' ' . sprintf(
                        _n('Moved %1$d existing article to %2$s.', 'Moved %1$d existing articles to %2$s.', $moved, 'repget'),
                        $moved,
                        $choices[$wanted]
                    );
                }
            }
        }

        $result = repget_verify();
        if (is_wp_error($result)) {
            $notice = $result->get_error_message();
            $notice_type = 'error';
        } else {
            $name = isset($result['website']['name']) ? $result['website']['name'] : '';
            $notice = $name !== ''
                ? sprintf(__('Connected to %s.', 'repget'), esc_html($name))
                : __('Connected.', 'repget');
            $notice .= $moved_notice;
        }
    }

    if (isset($_POST['repget_sync']) && check_admin_referer('repget_save_key')) {
        // Through the lock, like every other entry point: a button press
        // overlapping a cron run or a remote nudge used to double-create posts.
        $count = repget_sync_locked();
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
                <tr>
                    <th scope="row">
                        <label for="repget_post_type"><?php esc_html_e('Publish articles as', 'repget'); ?></label>
                    </th>
                    <td>
                        <select id="repget_post_type" name="repget_post_type">
                            <?php foreach (repget_post_type_choices() as $type => $label) : ?>
                                <option value="<?php echo esc_attr($type); ?>" <?php selected(repget_post_type(), $type); ?>>
                                    <?php echo esc_html($label); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description">
                            <?php esc_html_e('Where your blog articles live on this site. Many themes show ordinary Posts as something else - a portfolio or project page - so choose the type your existing articles use. Changing it moves the articles RepGet already created.', 'repget'); ?>
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
 * The identity a RepGet article's post carries IN ITS OWN ROW.
 *
 * wp_insert_post writes the posts row first and the meta_input afterwards, in
 * separate queries (wp-includes/post.php: $wpdb->insert() of the row, then
 * update_post_meta() for each meta_input entry). meta_input therefore does NOT
 * make the post and its identity atomic: a process killed between the two
 * leaves a post that the meta lookup can never find, and the next poll made a
 * second one.
 *
 * The guid, when passed in, is part of that single INSERT - and WordPress
 * never rewrites a guid it was given (it only fills an EMPTY one with the
 * permalink). So the article id is carried in the guid as well: whatever
 * point a process dies at, a post that exists can be found.
 *
 * An https URL on a reserved, never-resolving host, because WordPress runs
 * guids through esc_url_raw and would strip any other scheme. Independent of
 * the site's own address, so it survives a domain move. Feeds mark guids
 * isPermaLink="false", so nothing treats it as a link.
 */
function repget_identity_guid($article_id) {
    return 'https://repget.invalid/articles/' . rawurlencode((string) $article_id);
}

/** Posts carrying this article's guid, oldest first. Never revisions or media. */
function repget_posts_by_guid($article_id) {
    global $wpdb;
    $ids = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} WHERE guid = %s"
        . " AND post_type NOT IN ('revision', 'attachment') ORDER BY ID ASC",
        repget_identity_guid($article_id)
    ));
    return array_map('intval', is_array($ids) ? $ids : array());
}

/**
 * The post already created for a RepGet article, if there is one.
 *
 * THE REPGET ARTICLE ID IS THE PUBLICATION IDENTITY. Before 1.5.1 repget_sync
 * called wp_insert_post unconditionally, so the same article arriving twice
 * produced two posts competing for the same keyword.
 *
 * Looked up by meta first (every version writes it), then by the identity
 * guid - which finds a post whose meta write was interrupted, and repairs the
 * meta so the fast path works next time.
 *
 * 'any' covers every status including draft, trash and pending. A trashed post
 * is deliberately treated as existing: re-creating one the customer threw away
 * would be worse than updating it in place, and restoring it is one click.
 */
function repget_find_post($article_id) {
    $found = get_posts(array(
        'post_type'        => 'any',
        'post_status'      => 'any',
        'numberposts'      => 1,
        'fields'           => 'ids',
        'meta_key'         => REPGET_META_ARTICLE,
        'meta_value'       => $article_id,
        'suppress_filters' => false,
    ));
    if (!empty($found)) {
        return (int) $found[0];
    }

    $by_guid = repget_posts_by_guid($article_id);
    if (!empty($by_guid)) {
        update_post_meta($by_guid[0], REPGET_META_ARTICLE, $article_id);
        return $by_guid[0];
    }
    return 0;
}

/**
 * After an insert: if another post already carries this article's identity,
 * keep the OLDEST and remove the one just made.
 *
 * The sync lock makes this unreachable in normal operation. It is here for the
 * one case a lock cannot rule out: a worker that ran past its lease (a stalled
 * PHP process) and inserted after a newer worker had taken over and inserted
 * the same article. Both converge: only the newer post is ever deleted, and
 * only by the worker that created it.
 */
function repget_keep_oldest($article_id, $post_id) {
    $ids = repget_posts_by_guid($article_id);
    if (count($ids) <= 1 || $ids[0] === (int) $post_id) {
        return (int) $post_id;
    }
    wp_delete_post((int) $post_id, true);
    update_post_meta($ids[0], REPGET_META_ARTICLE, $article_id);
    return $ids[0];
}

/**
 * Acknowledgements waiting to be confirmed by RepGet.
 *
 * Keyed by the HAND-OVER they answer ("dispatch:<id>", 1.6.0+). 1.5.x keyed
 * them by article id, so a report for an older hand-over and one for a newer
 * revision of the same article overwrote each other; entries parked by 1.5.x
 * are still read (their key is the article id, with no dispatch) and
 * reported as before.
 */
function repget_pending_acks() {
    $acks = get_option(REPGET_OPTION_PENDING_ACK, array());
    return is_array($acks) ? $acks : array();
}

/** The queue key for a report: the dispatch when RepGet sent one, else the article (1.5.x). */
function repget_ack_key($article_id, $dispatch_id) {
    return $dispatch_id !== '' ? 'dispatch:' . $dispatch_id : (string) $article_id;
}

/** A dispatch id from the feed: a UUID, or '' (a RepGet too old to send one). */
function repget_dispatch_id($article) {
    $id = isset($article['dispatch']['id']) && is_string($article['dispatch']['id']) ? strtolower($article['dispatch']['id']) : '';
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id) ? $id : '';
}

/**
 * Parks an acknowledgement so a later sync can retry it.
 *
 * Written BEFORE the report is attempted, so a process killed during the
 * outbound request still leaves a record that this article was published. That
 * ordering is the point: the alternative loses the fact of publication and the
 * next poll creates a duplicate.
 */
function repget_remember_ack($article_id, $dispatch_id, $post_id, $url, $status) {
    $acks = repget_pending_acks();
    $acks[repget_ack_key($article_id, $dispatch_id)] = array(
        'article_id'  => (string) $article_id,
        'dispatch_id' => (string) $dispatch_id,
        'post_id'     => (int) $post_id,
        'url'         => (string) $url,
        'status'      => (string) $status,
    );
    /*
      Bounded. A site that cannot reach RepGet for a long time should not grow
      this option without limit; the oldest entries are dropped, and RepGet's
      own queue still holds those articles, so they remain recoverable.
    */
    if (count($acks) > 200) {
        $acks = array_slice($acks, -200, null, true);
    }
    update_option(REPGET_OPTION_PENDING_ACK, $acks, false);
}

function repget_forget_ack($key) {
    $acks = repget_pending_acks();
    unset($acks[(string) $key]);
    update_option(REPGET_OPTION_PENDING_ACK, $acks, false);
}

/**
 * Retries acknowledgements for posts that were already created.
 *
 * Runs before articles are pulled, so RepGet learns about the previous run's
 * posts before deciding what is still due - which is what stops the duplicate.
 * Publishing and acknowledging are separate concerns and fail separately.
 */
function repget_flush_acks() {
    foreach (repget_pending_acks() as $key => $ack) {
        $post_id = isset($ack['post_id']) ? (int) $ack['post_id'] : 0;
        // Entries parked by 1.5.x: keyed by article id, no dispatch.
        $article_id = isset($ack['article_id']) ? (string) $ack['article_id'] : (string) $key;
        $dispatch_id = isset($ack['dispatch_id']) ? (string) $ack['dispatch_id'] : '';

        /*
          The post was deleted and purged locally. Nothing to confirm, and
          holding the entry for ever would retry for ever; dropping it lets
          RepGet hand the article over again and a fresh post be made.
        */
        if ($post_id > 0 && get_post_status($post_id) === false) {
            repget_forget_ack($key);
            continue;
        }

        $reported = repget_report(
            $article_id,
            $dispatch_id,
            isset($ack['url']) ? $ack['url'] : null,
            $post_id > 0 ? $post_id : null,
            null,
            isset($ack['status']) ? $ack['status'] : 'publish'
        );
        if (!is_wp_error($reported)) {
            repget_forget_ack($key);
        }
    }
}

/**
 * Pulls waiting articles and creates or updates posts.
 *
 * Every outcome is reported back, success or failure. An article we fail to
 * create must not stay in the queue silently, and must not be marked live.
 *
 * IDEMPOTENT BY ARTICLE ID. An article already published here updates its
 * existing post instead of creating a second one, so a repeated poll, a failed
 * acknowledgement or an interrupted run converge on one post rather than
 * multiplying. Call through repget_sync_locked(), never directly: `$token` is
 * that call's lock, renewed before every post written here.
 */
function repget_sync($token = null) {
    /*
      Unconfirmed acknowledgements first. If one succeeds, RepGet drops that
      article from the queue and the request below will not return it at all -
      the cheapest way to avoid re-handling it.
    */
    repget_flush_acks();

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

        $article_id = sanitize_text_field($article['id']);
        // The hand-over this is (1.6.0+): echoed in the report so RepGet
        // settles exactly this delivery.
        $dispatch_id = repget_dispatch_id($article);

        /*
          Still ours? Renewing is also the check: a worker that stalled past its
          lease must not write another post after someone else took over.
        */
        if ($token !== null) {
            $lease = repget_lock_renew($token);
            if ($lease === 'lost') {
                return new WP_Error(
                    'repget_lock_lost',
                    __('Another check took over; this one stopped.', 'repget')
                );
            }
            if ($lease !== 'owned') {
                // Ownership unknown: writing now could race another worker.
                return new WP_Error(
                    'repget_lock_error',
                    __('The site database could not confirm this check still owns its lock; it stopped and will retry.', 'repget')
                );
            }
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

        $existing = repget_find_post($article_id);

        $fields = array(
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
        );

        if ($existing > 0) {
            $fields['ID'] = $existing;

            /*
              THE CUSTOMER'S OWN DECISIONS ARE KEPT.

              post_status and post_type are deliberately NOT overwritten on an
              update. Somebody who unpublished a RepGet article back to draft,
              or moved it to another content type, chose that; a republish of
              edited content must not undo it and silently push a draft live.
              The status is set only when the post is first created.
            */
            $post_id = wp_update_post($fields, true);
        } else {
            $fields['post_status'] = $status;
            $fields['post_type']   = repget_post_type();

            /*
              The identity goes INTO THE ROW as its guid, which wp_insert_post
              writes in the same INSERT as the post itself. meta_input alone is
              not enough: WordPress writes it with separate queries after the
              row, so a process killed in between left a post the meta lookup
              could never find. See repget_identity_guid().
            */
            $fields['guid']       = repget_identity_guid($article_id);
            $fields['meta_input'] = array(REPGET_META_ARTICLE => $article_id);

            $inserted = wp_insert_post($fields, true);
            // A stalled worker may have created it too: keep only the oldest.
            $post_id = is_wp_error($inserted)
                ? $inserted
                : repget_keep_oldest($article_id, (int) $inserted);
            if (!is_wp_error($inserted) && $post_id !== (int) $inserted) {
                $existing = $post_id;
            }
        }

        if (is_wp_error($post_id)) {
            repget_report($article_id, $dispatch_id, null, null, $post_id->get_error_message(), $status);
            continue;
        }

        $post_id = (int) $post_id;

        /*
          Defensive: covers an update to a post whose meta was somehow lost, a
          post whose insert was interrupted before its meta, and posts created
          before meta_input was used here.
        */
        if (get_post_meta($post_id, REPGET_META_ARTICLE, true) !== $article_id) {
            update_post_meta($post_id, REPGET_META_ARTICLE, $article_id);
        }

        /*
          The header image, when one was generated. A failure here is not fatal:
          the article is still published, just without its image. Only on
          creation - re-downloading on every update would add a duplicate
          attachment to the media library each time.
        */
        if ($existing === 0 && !empty($article['image']['url'])) {
            repget_attach_image($post_id, $article['image']['url'], $article['image']['alt']);
        }

        /*
          Recorded before the report goes out, so a failure to reach RepGet - or
          a process killed mid-request - leaves proof this article was
          published. repget_flush_acks retries it on the next run.
        */
        $permalink = get_permalink($post_id);
        /*
          What WordPress actually holds, not what was asked for: an update
          keeps the customer's own status (see above), and a site can store a
          requested "publish" as pending or draft (a workflow plugin, an
          account without publish rights). RepGet counts only "publish" as live.
        */
        $stored = get_post_status($post_id);
        $actual = is_string($stored) && $stored !== '' ? $stored : $status;
        repget_remember_ack($article_id, $dispatch_id, $post_id, $permalink, $actual);

        $reported = repget_report($article_id, $dispatch_id, $permalink, $post_id, null, $actual);
        if (!is_wp_error($reported)) {
            repget_forget_ack(repget_ack_key($article_id, $dispatch_id));
        }

        $published++;
    }

    return $published;
}

/**
 * The sync lock: one owner at a time, identified by a token.
 *
 * NOT add_option(). It looks like an atomic "create if absent", but WordPress
 * checks get_option() first and then runs INSERT ... ON DUPLICATE KEY UPDATE:
 * two requests arriving together both see no lock, both write, and both get
 * true - the second silently overwriting the first. A plain INSERT IGNORE on
 * the options table's unique option_name is atomic in the database, so
 * exactly one caller creates the row.
 *
 * The value is "<token>|<unix time>". The token is what makes it OWNED:
 * renewing and releasing are conditional on it, so a worker whose lease ran
 * out while another took over can neither extend nor delete the new owner's
 * lock. Reads go straight to the table, never the object cache, because a
 * cached value is exactly the stale view a lock must not act on.
 */
function repget_lock_read() {
    global $wpdb;
    $value = $wpdb->get_var($wpdb->prepare(
        "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1",
        REPGET_LOCK
    ));
    return $value === null ? null : (string) $value;
}

/** [token, time] from a stored lock. A pre-1.5.2 lock is a bare timestamp. */
function repget_lock_parse($value) {
    $parts = explode('|', (string) $value, 2);
    return count($parts) === 2
        ? array($parts[0], (int) $parts[1])
        : array('', (int) $value);
}

/** Takes the lock, or steals an abandoned one. Returns the token, or null if held. */
function repget_lock_acquire() {
    global $wpdb;
    $now   = time();
    $token = wp_generate_password(24, false, false);
    $value = $token . '|' . $now;

    $inserted = $wpdb->query($wpdb->prepare(
        "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
        REPGET_LOCK,
        $value
    ));
    wp_cache_delete(REPGET_LOCK, 'options');
    if ($inserted) {
        return $token;
    }

    $held = repget_lock_read();
    if ($held !== null) {
        list(, $taken) = repget_lock_parse($held);
        if ($taken > 0 && ($now - $taken) < REPGET_LOCK_TTL) {
            return null;
        }
        /*
          Abandoned: its owner was killed. Stolen with a conditional UPDATE, so
          if two callers both decide to steal it, only the one whose WHERE still
          matches the old value wins.
        */
        $stolen = $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s",
            $value,
            REPGET_LOCK,
            $held
        ));
        wp_cache_delete(REPGET_LOCK, 'options');
        return $stolen ? $token : null;
    }
    // Released between the insert and the read: try once more.
    $inserted = $wpdb->query($wpdb->prepare(
        "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
        REPGET_LOCK,
        $value
    ));
    wp_cache_delete(REPGET_LOCK, 'options');
    return $inserted ? $token : null;
}

/**
 * Extends the lease - only while `token` still owns the lock.
 *
 * Returns one of three answers, because they mean different things:
 *
 *   'owned' - the lock is ours (renewed, or confirmed unchanged);
 *   'lost'  - another worker holds it, or nobody does: stop writing;
 *   'error' - the database could not answer: ownership is unknown, so stop
 *             writing too, but do not report it as a takeover.
 *
 * An UPDATE's result is a count of CHANGED rows, not matched ones. Renewing
 * twice within the same second writes the value that is already there, and
 * MySQL reports 0 rows although the lock is ours - reading that as "lost"
 * made a fast sync stop after its first post. So a zero is never taken at
 * face value in either direction: the same-second case is recognised before
 * writing, and any other zero is resolved by reading the lock back.
 */
function repget_lock_renew($token) {
    global $wpdb;
    $held = repget_lock_read();
    if ($held === null) {
        return $wpdb->last_error !== '' ? 'error' : 'lost';
    }
    list($owner) = repget_lock_parse($held);
    if ($owner === '' || !hash_equals($owner, (string) $token)) {
        return 'lost';
    }

    $fresh = $token . '|' . time();
    if ($fresh === $held) {
        // Renewed already this second; the read just confirmed it is ours.
        return 'owned';
    }

    $renewed = $wpdb->query($wpdb->prepare(
        "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s",
        $fresh,
        REPGET_LOCK,
        $held
    ));
    wp_cache_delete(REPGET_LOCK, 'options');
    if ($renewed === false) {
        return 'error';
    }
    if ($renewed > 0) {
        return 'owned';
    }

    // Nothing changed: find out why rather than guess.
    $now = repget_lock_read();
    if ($now === null) {
        return $wpdb->last_error !== '' ? 'error' : 'lost';
    }
    list($current) = repget_lock_parse($now);
    return ($current !== '' && hash_equals($current, (string) $token)) ? 'owned' : 'lost';
}

/** Releases the lock - only if `token` still owns it. */
function repget_lock_release($token) {
    global $wpdb;
    $wpdb->query($wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value LIKE %s",
        REPGET_LOCK,
        $wpdb->esc_like((string) $token . '|') . '%'
    ));
    wp_cache_delete(REPGET_LOCK, 'options');
}

/**
 * Runs a sync while holding the lock, whoever asked for it.
 *
 * EVERY ENTRY POINT GOES THROUGH HERE: the remote nudge from RepGet, WordPress
 * cron, and the "Check for articles now" button. Before 1.5.1 only the remote
 * nudge took a lock, so the three overlapped and each created the same post.
 *
 * A STALE LOCK CANNOT WEDGE THE SITE: one older than REPGET_LOCK_TTL is
 * treated as abandoned and stolen. And a worker that was merely SLOW - still
 * running when its lease was stolen - cannot do harm afterwards: repget_sync
 * renews the lease before every post it writes and stops the moment that
 * fails, and its release at the end cannot remove the new owner's lock.
 *
 * Returns a WP_Error with code 'repget_busy' when another sync holds the lock.
 */
function repget_sync_locked() {
    $token = repget_lock_acquire();
    if ($token === null) {
        return new WP_Error(
            'repget_busy',
            __('A check is already running. Try again in a moment.', 'repget')
        );
    }

    /*
      Released whatever happens, including on an exception, so a failed sync
      does not hold it for the full TTL - but only ever this owner's lock.
    */
    try {
        return repget_sync($token);
    } finally {
        repget_lock_release($token);
    }
}

/**
 * The content type RepGet articles are created as.
 *
 * 'post' unless the site owner chose otherwise. Some themes show ordinary
 * Posts as portfolio or project pages - imagestudio.com shows them as a
 * full-screen slider whose text panel has a fixed height, so a full article
 * was cut off below its Read More - while the real blog uses a custom type.
 * A choice that no longer exists falls back to 'post' rather than failing.
 */
function repget_post_type() {
    $type = get_option(REPGET_OPTION_POST_TYPE, 'post');
    $choices = repget_post_type_choices();
    return isset($choices[$type]) ? $type : 'post';
}

/**
 * Content types an article can be published as: public, editable in the
 * admin and with a body - so not media, not page-builder templates.
 *
 * @return array<string,string> slug => label, e.g. 'custom_post' => 'Editorial'
 */
function repget_post_type_choices() {
    $choices = array();
    foreach (get_post_types(array('public' => true, 'show_ui' => true), 'objects') as $type) {
        if (in_array($type->name, array('attachment', 'elementor_library', 'e-floating-buttons'), true)) {
            continue;
        }
        if (!post_type_supports($type->name, 'editor')) {
            continue;
        }
        $label = $type->labels->name ? $type->labels->name : $type->name;
        $choices[$type->name] = $type->name === $label ? $label : sprintf('%s (%s)', $label, $type->name);
    }
    if (!isset($choices['post'])) {
        $choices = array('post' => __('Posts', 'repget')) + $choices;
    }
    return $choices;
}

/**
 * Moves the articles RepGet already created to another content type, and
 * tells RepGet their new addresses.
 *
 * Found two ways: posts this plugin tagged (1.5.0+), and the post ids RepGet
 * recorded when older versions created them - those carry no tag. Only those
 * posts are touched; nothing else on the site is.
 *
 * @return int|WP_Error how many posts moved
 */
function repget_move_articles_to($post_type) {
    $targets = array(); // post id => RepGet article id

    $tagged = get_posts(array(
        'post_type'      => 'any',
        'post_status'    => 'any',
        'posts_per_page' => 500,
        'meta_key'       => REPGET_META_ARTICLE,
        'fields'         => 'ids',
    ));
    foreach ($tagged as $post_id) {
        $targets[(int) $post_id] = get_post_meta($post_id, REPGET_META_ARTICLE, true);
    }

    $result = repget_request('/api/plugin/articles', array('method' => 'GET'));
    if (!is_wp_error($result) && isset($result['sent']) && is_array($result['sent'])) {
        foreach ($result['sent'] as $row) {
            if (!empty($row['postId']) && !empty($row['articleId'])) {
                $targets[(int) $row['postId']] = sanitize_text_field($row['articleId']);
            }
        }
    }

    $moved = 0;
    foreach ($targets as $post_id => $article_id) {
        $post = get_post($post_id);
        if (!$post || $post->post_type === $post_type || $post->post_type === 'revision') {
            continue;
        }
        if (is_wp_error(set_post_type($post_id, $post_type))) {
            continue;
        }
        clean_post_cache($post_id);
        update_post_meta($post_id, REPGET_META_ARTICLE, $article_id);
        $moved++;

        // Its address changed with its type; RepGet links to it.
        if ($article_id !== '') {
            // Not a delivery: RepGet records the new address of a post it already knows.
            $status = get_post_status($post_id);
            repget_report($article_id, '', get_permalink($post_id), $post_id, null, is_string($status) ? $status : 'publish');
        }
    }
    return $moved;
}

/**
 * Tells RepGet what happened, so the article leaves the queue.
 *
 * RETURNS THE RESULT, and the caller must look at it. This used to discard it,
 * so a report that never arrived was indistinguishable from one that did - and
 * an article RepGet never heard about is handed out again on the next poll.
 * repget_sync parks a failed report and repget_flush_acks retries it.
 *
 * `dispatchId` (1.6.0+) names the exact hand-over; '' for reports that are
 * not a delivery (a moved post) or were parked by 1.5.x. `status` is the
 * post status WordPress stored.
 */
function repget_report($article_id, $dispatch_id, $url, $remote_id, $error, $status = 'publish') {
    $body = array(
        'articleId' => $article_id,
        'url'       => $url,
        'remoteId'  => $remote_id,
        'error'     => $error,
        'status'    => $status,
    );
    if ($dispatch_id !== '') {
        $body['dispatchId'] = $dispatch_id;
    }
    return repget_request('/api/plugin/published', array(
        'method' => 'POST',
        'body'   => wp_json_encode($body),
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

    /*
      Release the sync lock on the way out. A site deactivated mid-sync would
      otherwise carry a held lock until its TTL expired, and the first check
      after reactivating would refuse with "already running".

      Pending acknowledgements are deliberately KEPT: those posts exist on this
      site, and RepGet still needs to be told about them if the plugin comes
      back.
    */
    delete_option(REPGET_LOCK);
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

    /*
      One check at a time, through the SHARED lock.

      This used to be its own get_transient/set_transient pair, which is a
      check-then-act race two simultaneous requests both pass, and which cron
      and the admin button did not participate in at all. repget_sync_locked
      holds the only lock now, atomically, and every entry point uses it.
    */
    $result = repget_sync_locked();

    if (is_wp_error($result)) {
        if ($result->get_error_code() === 'repget_busy') {
            wp_send_json_error(array('error' => 'busy'), 429);
        }
        wp_send_json_error(array('error' => $result->get_error_message()), 502);
    }
    wp_send_json_success(array('created' => (int) $result));
}

add_action('repget_sync_event', 'repget_cron_sync');
function repget_cron_sync() {
    if (repget_key() === '') {
        return;
    }
    /*
      Through the lock. WordPress cron fires on a visitor's request, so it can
      easily land while a remote nudge or an admin check is already running -
      and before 1.5.1 it took no lock at all.
    */
    repget_sync_locked();
}
