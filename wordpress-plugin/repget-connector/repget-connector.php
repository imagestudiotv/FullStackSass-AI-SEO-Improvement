<?php
/**
 * Plugin Name: RepGet Connector
 * Description: Publishes articles written by RepGet straight to this site. Press Connect to RepGet to connect.
 * Version: 1.7.1
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * License: GPLv2 or later
 * Update URI: https://www.repget.com/repget-connector.json
 */

/*
  "Update URI" (WordPress 5.8+) is not decoration. Without it WordPress asks
  api.wordpress.org about every installed plugin by its folder name, and
  would offer whatever a stranger published there as "repget-connector" as an
  update to this one - somebody else's code, installed with one click. Any
  value other than wordpress.org opts the plugin out of that; updates come
  only from RepGet's own manifest (see "Updates" at the end of this file).
*/

/**
 * RepGet Connector.
 *
 * The alternative to this plugin is the application-password flow, where the
 * customer finds a screen buried in WordPress admin, understands that an
 * application password is not their login password, and hands us write access
 * to their site. This is one button, "Connect to RepGet" (1.7.0) - or, for
 * sites set up before it, one key pasted once.
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

define('REPGET_VERSION', '1.7.1');
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
/*
  Which RepGet account and website this site is connected to (1.7.0+):
    array('workspace', 'website', 'domain', 'websiteId', 'connected_at')

  The 2026-09-29 incident was a site that said "Connected" while holding a key
  from a second RepGet account, and nothing on either screen said which. This
  is what lets the settings page name the account even when RepGet cannot be
  reached. Refreshed by every successful verify; never holds the key.
*/
define('REPGET_OPTION_CONNECTION', 'repget_connection');
/** The live verify behind "Connected to ...", cached so the page does not call RepGet on every view. */
define('REPGET_VERIFY_CACHE', 'repget_verify_cache');
/** How long a pending "Connect to RepGet" stays valid - RepGet's own limit for a request it did not start. */
define('REPGET_CONNECT_TTL', 900);
/** The folder and slug WordPress knows this plugin by; the zip's top-level folder. */
define('REPGET_PLUGIN_SLUG', 'repget-connector');
/** RepGet's update manifest, cached. See repget_update_manifest(). */
define('REPGET_UPDATE_MANIFEST', 'repget_update_manifest');

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
    if (is_string($stored) && $stored !== '' && !repget_is_legacy_endpoint($stored)) {
        return untrailingslashit($stored);
    }
    return REPGET_DEFAULT_ENDPOINT;
}

/*
  RepGet's own address. Until 1.7.1 it was the Vercel deployment's address
  (full-stack-sass-ai-seo-improvement.vercel.app), from before repget.com was
  live. That host still answers, but "Connect to RepGet" then opened RepGet
  there, where the customer was not signed in, under an address they did not
  recognise. "www" because repget.com redirects to it, and a redirect is one
  more hop for every API call.
*/
define('REPGET_DEFAULT_ENDPOINT', 'https://www.repget.com');

/** The pre-repget.com address, if an install stored it: read as the default instead. */
function repget_is_legacy_endpoint($url) {
    $host = parse_url(trim($url), PHP_URL_HOST);
    return is_string($host) && strtolower($host) === 'full-stack-sass-ai-seo-improvement.vercel.app';
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

    // Straight to the Connect to RepGet button: the one thing to do next.
    wp_safe_redirect(repget_settings_url() . '#repget-connect');
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

    /*
      Points at the Connect to RepGet button (1.7.0), not at a key field: the
      key is no longer something the customer handles. A link rather than the
      button itself, so this banner never starts a connection by accident.
    */
    printf(
        '<div class="notice notice-warning"><p><strong>%s</strong> %s <a href="%s">%s</a></p></div>',
        esc_html__('RepGet is not connected yet.', 'repget'),
        esc_html__('Connect this site to RepGet to start publishing articles.', 'repget'),
        esc_url(repget_settings_url() . '#repget-connect'),
        esc_html__('Connect to RepGet', 'repget')
    );
}

/**
 * The settings screen: connect, see WHICH RepGet account this site belongs
 * to, choose the content type - and, folded away, the 1.6 key field.
 *
 * One connection card, in one of three states, so the customer is never asked
 * to choose between two ways of doing the same thing:
 *
 *  - ?repget_link=... : RepGet's "Connect WordPress" sent the admin here to
 *    finish (flow A in docs/wordpress-connect.md). One button.
 *  - no key           : one sentence and Connect to RepGet (flow B).
 *  - a key            : "Connected to <workspace> · <domain>", checked live
 *    against RepGet (cached five minutes), with what to do next.
 *
 * Every action that changes something is a nonce-checked POST, and the page
 * itself is only for manage_options. Everything printed is escaped.
 */
function repget_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $notice = '';
    $notice_type = 'success';
    $advanced_open = false;

    /*
      Left by the connect callback, Disconnect or a failed start, which all
      redirect here. Carried in a per-user transient rather than the URL: a
      message in the query string could be written by any link.
    */
    $flash = repget_take_flash();
    if ($flash !== null) {
        $notice = $flash['message'];
        $notice_type = $flash['type'];
    }

    /*
      Advanced: "Save and connect" with a pasted key - the 1.6 flow, kept for
      sites connected that way, and for a RepGet that still sends the key in
      the #repget_key fragment.

      Nonce-checked. Without it, a request forged from another site could
      change which RepGet account publishes to this WordPress install.
    */
    if (isset($_POST['repget_save']) && check_admin_referer('repget_save_key')) {
        $advanced_open = true;
        $submitted = isset($_POST['repget_key'])
            ? sanitize_text_field(wp_unslash($_POST['repget_key']))
            : '';

        /*
          An EMPTY field keeps the saved key. 1.6 printed the saved key back
          into this field; 1.7 never puts a key in a page - a key that came
          through Connect to RepGet has never been shown to anyone, and must
          not start being shown here - so an untouched field arrives empty and
          means "keep it, and check it". Removing the key is Disconnect's job.
        */
        if ($submitted !== '' && $submitted !== repget_key()) {
            update_option(REPGET_OPTION_KEY, $submitted);
            // What was known about the previous key's account is not true of
            // this one. The verify below records the new one.
            delete_option(REPGET_OPTION_CONNECTION);
            delete_transient(REPGET_VERIFY_CACHE);
        }

        $result = repget_verify();
        if (is_wp_error($result)) {
            $notice = $result->get_error_message();
            $notice_type = 'error';
        } else {
            $notice = repget_connection_label(repget_stored_connection()) . '.';
        }
    }

    /*
      "Publish articles as". Its own form since 1.7: it used to ride along with
      the key field, which is now folded under Advanced.
    */
    if (isset($_POST['repget_save_post_type']) && check_admin_referer('repget_post_type')) {
        $wanted = isset($_POST['repget_post_type'])
            ? sanitize_key(wp_unslash($_POST['repget_post_type']))
            : '';
        $choices = repget_post_type_choices();
        if (!isset($choices[$wanted])) {
            $notice = __('That content type is not available on this site.', 'repget');
            $notice_type = 'error';
        } elseif ($wanted === repget_post_type()) {
            $notice = sprintf(__('Articles are published as %s.', 'repget'), $choices[$wanted]);
        } else {
            update_option(REPGET_OPTION_POST_TYPE, $wanted);
            $moved = repget_move_articles_to($wanted);
            $notice = sprintf(__('Articles will be published as %s.', 'repget'), $choices[$wanted]);
            if ($moved > 0) {
                $notice .= ' ' . sprintf(
                    _n('Moved %1$d existing article to %2$s.', 'Moved %1$d existing articles to %2$s.', $moved, 'repget'),
                    $moved,
                    $choices[$wanted]
                );
            }
        }
    }

    if (isset($_POST['repget_sync']) && check_admin_referer('repget_sync')) {
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
    $stored = repget_stored_connection();

    /*
      RepGet's "Connect WordPress" (flow A) adds ?repget_link=<id>. Checked
      against the id format before it is printed anywhere; anything else is
      ignored and the page shows its normal state. The link alone connects
      nothing: it only fills in the button's form, and the button starts the
      same handshake as Connect to RepGet.
    */
    $link = isset($_GET['repget_link']) && is_string($_GET['repget_link'])
        ? wp_unslash($_GET['repget_link'])
        : '';
    if (!repget_valid_link($link)) {
        $link = '';
    }

    // Only the connected card needs RepGet's live answer.
    $view = ($key !== '' && $link === '') ? repget_connection_view() : null;
    ?>
    <style>
        .repget-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 1em; }
        .repget-actions form { margin: 0; }
        .repget-ok { color: #00a32a; }
        .repget-bad { color: #d63638; }
        #repget-advanced { margin-top: 2em; }
        #repget-advanced summary { cursor: pointer; font-weight: 600; }
    </style>
    <div class="wrap">
        <h1>RepGet</h1>

        <?php /* Revealed by the script at the end of this page. */ ?>
        <div id="repget-prefill-notice" class="notice notice-info" hidden>
            <p><?php esc_html_e('Your key is filled in under "Advanced: use an Integration Key". Press "Save and connect" to finish.', 'repget'); ?></p>
        </div>

        <?php if ($notice !== '') : ?>
            <div class="notice notice-<?php echo esc_attr($notice_type); ?> is-dismissible">
                <p><?php echo esc_html($notice); ?></p>
            </div>
        <?php endif; ?>

        <?php if ($link !== '') : ?>
            <div class="card" id="repget-connect">
                <h2><?php esc_html_e('Finish connecting to RepGet', 'repget'); ?></h2>
                <p><?php esc_html_e('RepGet sent you here to connect this site. Press the button: RepGet confirms it is you and brings you straight back.', 'repget'); ?></p>
                <?php if ($key !== '' && repget_connection_name($stored) !== '') : ?>
                    <p><?php echo esc_html(sprintf(
                        __('This site is connected to %s now. Finishing connects it to the RepGet website that sent you here; RepGet asks first if that is a different account or website.', 'repget'),
                        repget_connection_name($stored)
                    )); ?></p>
                <?php endif; ?>
                <div class="repget-actions">
                    <?php repget_connect_form(__('Finish connecting to RepGet', 'repget'), 'button button-primary', $link); ?>
                </div>
            </div>
        <?php elseif ($key === '') : ?>
            <div class="card" id="repget-connect">
                <h2><?php esc_html_e('Connect to RepGet', 'repget'); ?></h2>
                <p><?php esc_html_e('Connect this site to your RepGet account, and the articles you approve there are published here automatically.', 'repget'); ?></p>
                <div class="repget-actions">
                    <?php repget_connect_form(__('Connect to RepGet', 'repget')); ?>
                </div>
                <p class="description"><?php esc_html_e('In RepGet: Integrations → WordPress plugin → Connect WordPress.', 'repget'); ?></p>
            </div>
        <?php else : ?>
            <div class="card" id="repget-connect">
                <h2><?php esc_html_e('Connection', 'repget'); ?></h2>
                <p class="<?php echo esc_attr($view['class']); ?>">
                    <strong><?php echo $view['class'] === 'repget-ok' ? '&#10003; ' : ''; ?><?php echo esc_html($view['text']); ?></strong>
                </p>
                <?php if ($view['note'] !== '') : ?>
                    <p class="description"><?php echo esc_html($view['note']); ?></p>
                <?php endif; ?>
                <div class="repget-actions">
                    <?php if ($view['usable']) : ?>
                        <form method="post">
                            <?php wp_nonce_field('repget_sync'); ?>
                            <button type="submit" name="repget_sync" class="button button-primary">
                                <?php esc_html_e('Check for articles now', 'repget'); ?>
                            </button>
                        </form>
                        <?php repget_connect_form(__('Connect to a different RepGet account', 'repget'), 'button'); ?>
                    <?php else : ?>
                        <?php repget_connect_form(__('Connect to RepGet', 'repget')); ?>
                    <?php endif; ?>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>"
                        onsubmit="return window.confirm('<?php echo esc_js(__('Disconnect this site from RepGet? Articles stop publishing here until you connect again.', 'repget')); ?>');">
                        <input type="hidden" name="action" value="repget_disconnect" />
                        <?php wp_nonce_field('repget_disconnect'); ?>
                        <button type="submit" class="button button-link-delete">
                            <?php esc_html_e('Disconnect', 'repget'); ?>
                        </button>
                    </form>
                </div>
            </div>
        <?php endif; ?>

        <h2><?php esc_html_e('Publishing', 'repget'); ?></h2>
        <form method="post">
            <?php wp_nonce_field('repget_post_type'); ?>
            <table class="form-table" role="presentation">
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
            </table>
            <p class="submit">
                <button type="submit" name="repget_save_post_type" class="button">
                    <?php esc_html_e('Save', 'repget'); ?>
                </button>
            </p>
        </form>

        <details id="repget-advanced"<?php echo $advanced_open ? ' open' : ''; ?>>
            <summary><?php esc_html_e('Advanced: use an Integration Key', 'repget'); ?></summary>
            <p>
                <?php esc_html_e('For a site connected with a key made in RepGet, instead of the button above. Most sites never need this.', 'repget'); ?>
            </p>
            <form method="post">
                <?php wp_nonce_field('repget_save_key'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="repget_key"><?php esc_html_e('Integration Key', 'repget'); ?></label>
                        </th>
                        <td>
                            <?php
                            /*
                              Never pre-filled with the saved key (see the Save
                              handler above). "new-password" because an empty
                              password field on a wp-admin page is exactly where
                              a browser autofills the administrator's own login
                              password - which Save would then send to RepGet.
                            */
                            ?>
                            <input
                                type="password"
                                id="repget_key"
                                name="repget_key"
                                value=""
                                class="regular-text"
                                autocomplete="new-password"
                                spellcheck="false"
                                placeholder="<?php echo esc_attr($key !== '' ? __('A key is saved. Leave empty to keep it.', 'repget') : ''); ?>"
                            />
                            <p class="description">
                                <?php esc_html_e('In RepGet: Integrations → WordPress plugin → Connect WordPress.', 'repget'); ?>
                            </p>
                        </td>
                    </tr>
                    <?php if ($key !== '') : ?>
                    <tr>
                        <th scope="row"><?php esc_html_e('Status', 'repget'); ?></th>
                        <td>
                            <?php if ($status === 'connected') : ?>
                                <span class="repget-ok">&#10003; <?php esc_html_e('Connected', 'repget'); ?></span>
                            <?php elseif ($status === 'invalid_key') : ?>
                                <span class="repget-bad"><?php esc_html_e('The key was rejected. Check it was copied in full.', 'repget'); ?></span>
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
                </p>
            </form>
        </details>
    </div>

    <?php
    /*
      The #repget_key fragment from a RepGet link (the 1.6 flow) - read from
      the URL FRAGMENT, not the query string.

      1.3.0 read it from ?repget_key=, which put a live credential in this
      site's web-server access logs, in any analytics or security plugin that
      records admin URLs, and in the Referer of anything the page loaded. The
      part after # is never sent to a server by any browser, so none of those
      ever see it.

      With ?repget_link= as well (RepGet builds that know 1.7.0), the key is
      NOT used: the Finish connecting button connects without it, and that
      key is left to expire unused in RepGet. The fragment is still cleaned
      from the address bar, so it does not sit in the tab or in screenshots.

      Without a link, the key is written into the Advanced field's value
      rather than into markup, so a crafted fragment can only ever be text in
      a password field, and the Advanced section is opened to show it. It
      still does not SAVE anything: the customer presses Save and connect, a
      normal nonce-checked POST.
    */
    ?>
    <script>
    (function () {
        var match = /(?:^#|&)repget_key=([^&]*)/.exec(window.location.hash);
        if (!match) return;

        var hasLink = <?php echo $link !== '' ? 'true' : 'false'; ?>;
        if (!hasLink) {
            var key = '';
            try {
                key = decodeURIComponent(match[1]);
            } catch (e) {
                // Malformed escape - leave the field as it was.
            }

            var field = document.getElementById('repget_key');
            if (field && key) {
                field.value = key;
                var advanced = document.getElementById('repget-advanced');
                if (advanced) advanced.open = true;
                var notice = document.getElementById('repget-prefill-notice');
                if (notice) notice.hidden = false;
            }
        }

        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    })();
    </script>
    <?php
}

/* -------------------------------------------------------------------------- */
/* One-click connect (1.7.0)                                                  */
/* -------------------------------------------------------------------------- */

/*
  "Connect to RepGet": a handshake in the shape of OAuth with PKCE, so the key
  never passes through a browser. docs/wordpress-connect.md is the contract;
  in short:

    1. The button posts to admin-post.php (nonce, manage_options). The plugin
       makes a state and a verifier, keeps them for THIS WordPress user for 15
       minutes, and registers the site with RepGet server to server
       (POST /api/plugin/connect/start) - sending sha256(verifier), never the
       verifier.
    2. The browser goes to RepGet, which checks who is signed in and which
       website this is, and comes back here with a one-time code.
    3. The plugin exchanges the code AND the verifier for a key, server to
       server (POST /api/plugin/connect/token), checks that the key works,
       and only then saves it.

  What the browser carries - a request id, a one-time code and the state - is
  useless on its own: the code works once, for five minutes, and only
  together with the verifier, which never leaves this server.
*/

/** The settings screen, where every connect step lands. */
function repget_settings_url() {
    return admin_url('admin.php?page=repget');
}

/**
 * Where RepGet sends the browser back. Registered server to server in
 * `start`, and RepGet redirects ONLY to the address registered there. Its path
 * must end in /wp-admin/admin.php and its host must be home_url()'s, or
 * RepGet refuses the start.
 */
function repget_connect_return_url() {
    return admin_url('admin.php?page=repget&repget_connect=callback');
}

/** base64url without padding: the alphabet of every token in the handshake. */
function repget_base64url($bytes) {
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

/** A link id from RepGet's "Connect WordPress": url-safe, at most 64 characters. */
function repget_valid_link($link) {
    return is_string($link) && preg_match('/^[A-Za-z0-9_-]{1,64}$/', $link) === 1;
}

/**
 * One url-safe token from the query string (state, request, code), or ''.
 * Anything else - an array, a stray character, 200 characters - is not a
 * token RepGet made, and is treated as absent.
 */
function repget_query_token($name) {
    if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
        return '';
    }
    $value = wp_unslash($_GET[$name]);
    return preg_match('/^[A-Za-z0-9_-]{1,128}$/', $value) === 1 ? $value : '';
}

/**
 * The pending connect of the CURRENT WordPress user.
 *
 * Per user, so a callback can only be finished by the administrator who
 * pressed the button: another admin, or a link sent to one, finds no state.
 */
function repget_connect_transient() {
    return 'repget_connect_' . (int) get_current_user_id();
}

/** A message for the settings page after a redirect: per user, for one minute, shown once. */
function repget_flash($message, $type = 'success') {
    set_transient(
        'repget_notice_' . (int) get_current_user_id(),
        array('message' => (string) $message, 'type' => (string) $type),
        MINUTE_IN_SECONDS
    );
}

/** The message left by repget_flash(), removed as it is read; null if none. */
function repget_take_flash() {
    $name = 'repget_notice_' . (int) get_current_user_id();
    $flash = get_transient($name);
    if ($flash === false) {
        return null;
    }
    delete_transient($name);
    if (!is_array($flash) || !isset($flash['message']) || !is_string($flash['message'])) {
        return null;
    }
    $type = isset($flash['type']) && in_array($flash['type'], array('success', 'error', 'warning', 'info'), true)
        ? $flash['type']
        : 'info';
    return array('message' => $flash['message'], 'type' => $type);
}

/**
 * POSTs to one of RepGet's connect endpoints: start, token, the verify of a
 * key that is not saved yet, and disconnect.
 *
 * NOT repget_request(). That one turns ANY 401 into repget_status =
 * 'invalid_key', which is right for the key this site publishes with and
 * wrong for every call here: a key RepGet just issued failing its first
 * check, or a code that did not exchange, says nothing about the key the site
 * still holds - and a working site must not start saying "rejected" because
 * a connect attempt went wrong. This function writes no option at all.
 *
 * `$key` goes in X-Integration-Key when given. Returns the decoded reply when
 * RepGet answered 2xx with ok: true, else a WP_Error carrying RepGet's own
 * message where it sent one.
 */
function repget_connect_request($path, $body, $key = '') {
    $headers = array(
        'Content-Type'            => 'application/json',
        'Accept'                  => 'application/json',
        'X-RepGet-Plugin-Version' => REPGET_VERSION,
    );
    if ($key !== '') {
        $headers['X-Integration-Key'] = $key;
    }

    $response = wp_remote_request(repget_endpoint() . $path, array(
        'method'  => 'POST',
        'timeout' => 30,
        'headers' => $headers,
        'body'    => wp_json_encode($body),
    ));
    if (is_wp_error($response)) {
        return $response;
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if ($code >= 200 && $code < 300 && is_array($data) && !empty($data['ok'])) {
        return $data;
    }

    $message = is_array($data) && isset($data['error']) && is_string($data['error']) && $data['error'] !== ''
        ? $data['error']
        : sprintf(__('RepGet answered with HTTP %d.', 'repget'), $code);
    return new WP_Error($code === 401 ? 'repget_rejected' : 'repget_http', $message);
}

/**
 * The Connect to RepGet button: a form posting to admin-post.php, which
 * starts the handshake. `$link` is RepGet's link id in flow A.
 */
function repget_connect_form($label, $class = 'button button-primary', $link = '') {
    ?>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <input type="hidden" name="action" value="repget_connect_start" />
        <?php wp_nonce_field('repget_connect'); ?>
        <?php if ($link !== '') : ?>
            <input type="hidden" name="link" value="<?php echo esc_attr($link); ?>" />
        <?php endif; ?>
        <button type="submit" class="<?php echo esc_attr($class); ?>"><?php echo esc_html($label); ?></button>
    </form>
    <?php
}

/** Back to the settings screen, and stop. */
function repget_redirect_to_settings() {
    wp_safe_redirect(repget_settings_url());
    exit;
}

/**
 * The button: admin-post.php?action=repget_connect_start.
 *
 * An administrator, a valid nonce, then off to RepGet - or back to the
 * settings screen with RepGet's reason when it refused.
 */
add_action('admin_post_repget_connect_start', 'repget_connect_start');
function repget_connect_start() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Sorry, you are not allowed to connect this site to RepGet.', 'repget'), '', array('response' => 403));
    }
    check_admin_referer('repget_connect');

    /*
      Flow A's link, from the Finish connecting card. One that does not look
      like RepGet's is dropped rather than sent, and the handshake runs as
      flow B: RepGet then asks which website instead of approving at once.
    */
    $link = isset($_POST['link']) && is_string($_POST['link'])
        ? sanitize_text_field(wp_unslash($_POST['link']))
        : '';
    if (!repget_valid_link($link)) {
        $link = '';
    }

    $authorize = repget_connect_begin($link);
    if (is_wp_error($authorize)) {
        repget_flash(
            sprintf(__('Could not start connecting to RepGet: %s Nothing changed.', 'repget'), rtrim($authorize->get_error_message(), '.') . '.'),
            'error'
        );
        repget_redirect_to_settings();
    }

    // wp_redirect, not wp_safe_redirect: RepGet is another host, and the
    // address was checked against repget_endpoint() in repget_connect_begin.
    wp_redirect($authorize);
    exit;
}

/**
 * Registers a connect with RepGet and returns where to send the browser.
 *
 * The state and the verifier are 32 random bytes each; RepGet is sent only
 * the SHA-256 of the verifier (PKCE S256), so the one-time code it later
 * hands the browser cannot be exchanged by anyone who does not hold the
 * verifier - which never leaves this server.
 *
 * The current key, if any, goes along in X-Integration-Key: RepGet uses it to
 * warn that the site is about to move away from another account (flow C),
 * and revokes it only once the NEW key has verified.
 *
 * @return string|WP_Error the authorize URL
 */
function repget_connect_begin($link = '') {
    $state = repget_base64url(random_bytes(32));
    $verifier = repget_base64url(random_bytes(32));
    $challenge = repget_base64url(hash('sha256', $verifier, true));

    $body = array(
        'siteUrl'       => home_url(),
        'returnUrl'     => repget_connect_return_url(),
        'state'         => $state,
        'challenge'     => $challenge,
        'pluginVersion' => REPGET_VERSION,
    );
    if ($link !== '') {
        $body['link'] = $link;
    }

    $result = repget_connect_request('/api/plugin/connect/start', $body, repget_key());
    if (is_wp_error($result)) {
        return $result;
    }

    /*
      Only ever RepGet's own confirm page, on the host this plugin already
      trusts with its key. Anything else - another host, a look-alike host
      that merely starts with ours, another path - is refused, so a reply
      from a misconfigured or impersonated endpoint cannot turn this button
      into an open redirect.
    */
    $prefix = repget_endpoint() . '/connect/wordpress?request=';
    $url = isset($result['authorizeUrl']) && is_string($result['authorizeUrl']) ? $result['authorizeUrl'] : '';
    $request = strpos($url, $prefix) === 0 ? substr($url, strlen($prefix)) : '';
    if (preg_match('/^[A-Za-z0-9_-]{1,128}$/', $request) !== 1) {
        return new WP_Error('repget_connect_url', __('RepGet answered with an unexpected address.', 'repget'));
    }

    /*
      Stored only now that RepGet accepted it. The request id is kept too: the
      callback must come back for THIS request, not merely with this state.
      One pending connect per user - pressing the button again replaces it.
    */
    set_transient(repget_connect_transient(), array(
        'state'    => $state,
        'verifier' => $verifier,
        'request'  => $request,
    ), REPGET_CONNECT_TTL);

    return $url;
}

/**
 * RepGet's redirect back: admin.php?page=repget&repget_connect=callback|cancelled.
 *
 * On admin_init, before the page prints anything, so it can redirect to a
 * clean URL: the code must not stay in the address bar, and a reload must
 * not replay it.
 */
add_action('admin_init', 'repget_connect_callback');
function repget_connect_callback() {
    if (!isset($_GET['page'], $_GET['repget_connect']) || $_GET['page'] !== 'repget' || !is_string($_GET['repget_connect'])) {
        return;
    }
    $mode = sanitize_key(wp_unslash($_GET['repget_connect']));
    if ($mode !== 'callback' && $mode !== 'cancelled') {
        return;
    }
    // Anyone else is turned away by WordPress when the page itself loads.
    if (!current_user_can('manage_options')) {
        return;
    }

    $name = repget_connect_transient();
    $pending = get_transient($name);
    $state = repget_query_token('state');
    $known = is_array($pending)
        && isset($pending['state'], $pending['verifier'])
        && is_string($pending['state'])
        && is_string($pending['verifier'])
        && $state !== ''
        && hash_equals($pending['state'], $state);

    if ($mode === 'cancelled') {
        if ($known) {
            delete_transient($name);
        }
        repget_flash(__('Connection cancelled. Nothing changed.', 'repget'), 'info');
        repget_redirect_to_settings();
    }

    $request = repget_query_token('request');
    $code = repget_query_token('code');
    if ($known && isset($pending['request']) && is_string($pending['request']) && $pending['request'] !== ''
        && !hash_equals($pending['request'], $request)) {
        $known = false;
    }

    if (!$known) {
        /*
          A code this user did not ask for: started by another WordPress user
          or in another browser, older than 15 minutes, or planted by a link
          someone sent. It is USED UP - exchanged with an empty verifier,
          which RepGet answers by burning it - so it cannot be finished
          anywhere else either, and nothing here changes.
        */
        if ($request !== '' && $code !== '') {
            repget_connect_request('/api/plugin/connect/token', array(
                'request'  => $request,
                'code'     => $code,
                'verifier' => '',
            ));
        }
        repget_flash(
            __('That connection was not started from this WordPress login, or it is more than 15 minutes old, so it was not used. Nothing changed. Press Connect to RepGet to try again.', 'repget'),
            'error'
        );
        repget_redirect_to_settings();
    }

    /*
      The state is single-use from here, whatever happens next: the code is
      spent by the exchange below even when it fails, so a pending connect
      that has reached this point can never finish again.
    */
    delete_transient($name);

    if ($request === '' || $code === '') {
        repget_flash(__('RepGet did not send a connection code. Nothing changed. Press Connect to RepGet to try again.', 'repget'), 'error');
        repget_redirect_to_settings();
    }

    $connection = repget_connect_finish($request, $code, $pending['verifier']);
    if (is_wp_error($connection)) {
        repget_flash($connection->get_error_message(), 'error');
    } else {
        repget_flash(repget_connection_label($connection) . '. ' . __('Articles you approve in RepGet now publish here.', 'repget'), 'success');
    }
    repget_redirect_to_settings();
}

/**
 * Exchanges the code for a key, checks the key, and only then saves it.
 *
 * THE OLD KEY STAYS until the new one has verified. A connect that fails at
 * any step - RepGet refusing the code, the new key failing its first check,
 * the network dropping in between - leaves the site publishing exactly as
 * before. RepGet, for its part, revokes the key it replaces only when the new
 * one verifies (the step below), so both sides switch at the same moment.
 *
 * @return array|WP_Error the saved connection
 */
function repget_connect_finish($request, $code, $verifier) {
    $issued = repget_connect_request('/api/plugin/connect/token', array(
        'request'  => $request,
        'code'     => $code,
        'verifier' => $verifier,
    ));
    if (is_wp_error($issued)) {
        return new WP_Error('repget_token', sprintf(
            // RepGet's own reason already says what to do next.
            __('RepGet did not complete the connection: %s Nothing changed.', 'repget'),
            rtrim($issued->get_error_message(), '.') . '.'
        ));
    }

    // Printable, no spaces: it goes into an HTTP header on every request.
    $key = isset($issued['key']) && is_string($issued['key']) ? trim($issued['key']) : '';
    if (preg_match('/^[\x21-\x7e]{8,512}$/', $key) !== 1) {
        return new WP_Error('repget_token', __('RepGet did not send a usable key. Nothing changed. Press Connect to RepGet to try again.', 'repget'));
    }

    /*
      The NEW key, checked before anything is saved - through
      repget_connect_request, so a failure cannot mark the key the site still
      holds as rejected. This is also the call that tells RepGet the new key
      is live: RepGet revokes the key this site presented at start (if any)
      now, and not before.
    */
    $verified = repget_connect_request('/api/plugin/verify', repget_verify_body(), $key);
    if (is_wp_error($verified) && $verified->get_error_code() !== 'repget_rejected') {
        // Once more: the check may have reached RepGet and only its answer got lost.
        $verified = repget_connect_request('/api/plugin/verify', repget_verify_body(), $key);
    }
    /*
      Only a REJECTION is a verdict on the new key. No answer, a timeout or an
      error page is not: RepGet issued this key seconds ago for the website
      just approved - and the check may well have reached RepGet, which then
      retired the key this site held for ANOTHER website (a move). Keeping the
      old key then would leave the site holding a revoked key while saying
      nothing changed. So the new key is saved; the settings page this
      redirects to checks it live and says so if anything is wrong.
    */
    if (is_wp_error($verified) && $verified->get_error_code() !== 'repget_rejected') {
        $verified = array();
    }
    if (is_wp_error($verified)) {
        return new WP_Error('repget_verify', sprintf(
            __('RepGet issued a key, but it did not pass its first check: %s This site\'s connection is unchanged. Press Connect to RepGet to try again.', 'repget'),
            rtrim($verified->get_error_message(), '.') . '.'
        ));
    }

    update_option(REPGET_OPTION_KEY, $key);
    update_option(REPGET_OPTION_STATUS, 'connected');
    $connection = repget_remember_connection($verified, $issued, true);
    /*
      Not primed from this answer: the settings page this redirects to checks
      live once more. When the site moved from another account, RepGet's
      revocation of the old key nudges this site, and a sync still running on
      the old key can record "invalid_key" after the save above; the next
      live verify puts the status right.
    */
    delete_transient(REPGET_VERIFY_CACHE);
    /*
      What is already due - the website's first article above all - comes now,
      not at the next hourly check. RepGet nudged this site when the new key
      verified, but that nudge is signed with the new key and arrives before
      the save above, so this site turned it away. One run of the hourly
      check's own hook, which WordPress starts on its next request (the
      redirect that follows) and which takes the sync lock. WordPress drops
      it when the hourly run is due within ten minutes anyway.
    */
    wp_schedule_single_event(time(), 'repget_sync_event');
    return $connection;
}

/**
 * Disconnect: admin-post.php?action=repget_disconnect.
 *
 * Tells RepGet first, which revokes the key, then forgets everything here.
 * Forgets it EVEN IF RepGet could not be told: the administrator asked this
 * site to stop, and a site that cannot reach RepGet is exactly the one that
 * must not be left half-connected. The key is then merely unused in RepGet,
 * where it can be revoked by hand.
 */
add_action('admin_post_repget_disconnect', 'repget_disconnect');
function repget_disconnect() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Sorry, you are not allowed to disconnect this site from RepGet.', 'repget'), '', array('response' => 403));
    }
    check_admin_referer('repget_disconnect');

    $key = repget_key();
    /*
      With this install's addresses: RepGet revokes the key only on the word
      of the install it belongs to, while no other address uses it. A host's
      staging copy holds the live site's key too, and disconnecting the copy
      must not stop the live site.
    */
    $told = $key === ''
        ? true
        : repget_connect_request('/api/plugin/disconnect', repget_verify_body(), $key);

    repget_forget_connection();

    if (is_wp_error($told) && $told->get_error_code() === 'repget_rejected') {
        // Revoked in RepGet already, or retired by a move: nothing left to tell it.
        repget_flash(__('Disconnected. RepGet had already stopped accepting this site\'s key.', 'repget'), 'success');
    } elseif (is_wp_error($told)) {
        repget_flash(sprintf(
            __('Disconnected. RepGet could not be told (%s), so the key still appears there until you revoke it in RepGet.', 'repget'),
            rtrim($told->get_error_message(), '.')
        ), 'warning');
    } elseif (is_array($told) && array_key_exists('revoked', $told) && $told['revoked'] === false) {
        /*
          RepGet kept the key: another address uses it too (a staging copy of
          this site, say), or it cannot yet tell this install from a copy.
          This site has let go of it either way.
        */
        repget_flash(__('Disconnected here. RepGet kept the key, because another copy of this site (a staging site, for example) may still use it. To stop it everywhere, revoke it in RepGet under Integrations, Keys (advanced).', 'repget'), 'warning');
    } else {
        repget_flash(__('Disconnected. This site no longer publishes articles from RepGet.', 'repget'), 'success');
    }
    repget_redirect_to_settings();
}

/** Forgets the key, its status, its account and the cached check. */
function repget_forget_connection() {
    delete_option(REPGET_OPTION_KEY);
    delete_option(REPGET_OPTION_STATUS);
    delete_option(REPGET_OPTION_CONNECTION);
    delete_transient(REPGET_VERIFY_CACHE);
}

/** The stored connection, every field present and a string (connected_at an int). */
function repget_stored_connection() {
    $stored = get_option(REPGET_OPTION_CONNECTION);
    $stored = is_array($stored) ? $stored : array();
    $out = array();
    foreach (array('workspace', 'website', 'domain', 'websiteId') as $field) {
        $out[$field] = isset($stored[$field]) && is_string($stored[$field]) ? $stored[$field] : '';
    }
    $out['connected_at'] = isset($stored['connected_at']) ? (int) $stored['connected_at'] : 0;
    return $out;
}

/** The first non-empty `$group.$field` among `$sources`, as plain text. */
function repget_pick_text($sources, $group, $field) {
    foreach ($sources as $source) {
        if (is_array($source) && isset($source[$group][$field]) && is_scalar($source[$group][$field])) {
            $value = sanitize_text_field((string) $source[$group][$field]);
            if ($value !== '') {
                return $value;
            }
        }
    }
    return '';
}

/**
 * Records which account and website a verify answered for.
 *
 * The verify reply is the authority - it describes the key as RepGet sees it
 * now; the token reply fills any gap. `connected_at` is kept across re-checks
 * of the same website, and restarts for a new connection.
 */
function repget_remember_connection($verified, $issued = array(), $new_connection = false) {
    $previous = repget_stored_connection();
    $sources = array($verified, $issued);
    $connection = array(
        'workspace' => repget_pick_text($sources, 'workspace', 'name'),
        'website'   => repget_pick_text($sources, 'website', 'name'),
        'domain'    => repget_pick_text($sources, 'website', 'domain'),
        'websiteId' => repget_pick_text($sources, 'website', 'id'),
    );
    $same = !$new_connection
        && $previous['connected_at'] > 0
        && $previous['websiteId'] !== ''
        && $previous['websiteId'] === $connection['websiteId'];
    $connection['connected_at'] = $same ? $previous['connected_at'] : time();
    update_option(REPGET_OPTION_CONNECTION, $connection, false);
    return $connection;
}

/** "<workspace> · <domain>", or whichever of the two is known, or ''. */
function repget_connection_name($connection) {
    $workspace = isset($connection['workspace']) ? (string) $connection['workspace'] : '';
    $domain = isset($connection['domain']) && $connection['domain'] !== ''
        ? (string) $connection['domain']
        : (isset($connection['website']) ? (string) $connection['website'] : '');
    if ($workspace !== '' && $domain !== '') {
        return $workspace . ' · ' . $domain;
    }
    return $workspace . $domain;
}

/** "Connected to <workspace> · <domain>" - or plain "Connected" when RepGet named neither. */
function repget_connection_label($connection) {
    $name = repget_connection_name($connection);
    return $name !== ''
        ? sprintf(__('Connected to %s', 'repget'), $name)
        : __('Connected', 'repget');
}

/** Ties a cached check to the key it checked, without storing the key again. */
function repget_key_fingerprint() {
    return hash_hmac('sha256', 'repget-verify-cache', repget_key());
}

/** Caches a live check's outcome for the current key. Returns it. */
function repget_cache_status($status, $ttl = 300) {
    $status['for'] = repget_key_fingerprint();
    set_transient(REPGET_VERIFY_CACHE, $status, $ttl);
    return $status;
}

/**
 * The connection as RepGet sees it now: 'connected' (with the account),
 * 'rejected', or 'unreachable' (with the error).
 *
 * A LIVE verify, not the stored status alone: the stored status is only what
 * the last check found, and a key revoked in RepGet - or a site moved to
 * another account - would keep saying "Connected" here until something
 * happened to call RepGet. Cached five minutes so the page does not call
 * RepGet on every view; an unreachable RepGet is retried after a minute, and
 * the page then falls back to what the site last knew.
 */
function repget_connection_status() {
    $cached = get_transient(REPGET_VERIFY_CACHE);
    if (is_array($cached) && isset($cached['state'], $cached['for']) && is_string($cached['for'])
        && hash_equals(repget_key_fingerprint(), $cached['for'])) {
        return $cached;
    }

    // Shorter than the usual 30 seconds: a page is waiting on this.
    $result = repget_verify(10);
    if (!is_wp_error($result)) {
        return array('state' => 'connected') + repget_stored_connection();
    }
    if ($result->get_error_code() === 'invalid_key') {
        return array('state' => 'rejected');
    }
    return repget_cache_status(
        array('state' => 'unreachable', 'error' => $result->get_error_message()),
        MINUTE_IN_SECONDS
    );
}

/**
 * What the connected card says.
 *
 * @return array{text: string, note: string, class: string, usable: bool}
 */
function repget_connection_view() {
    $live = repget_connection_status();
    if ($live['state'] === 'connected') {
        return array('text' => repget_connection_label($live), 'note' => '', 'class' => 'repget-ok', 'usable' => true);
    }

    $status = get_option(REPGET_OPTION_STATUS);
    if ($live['state'] === 'rejected' || $status === 'invalid_key') {
        return array(
            'text'   => __('RepGet no longer accepts this site\'s key.', 'repget'),
            'note'   => __('It was revoked, or this site was connected to another RepGet account. Connect again to resume publishing.', 'repget'),
            'class'  => 'repget-bad',
            'usable' => false,
        );
    }

    // RepGet could not be reached: say what the site last knew, and that it is that.
    $note = sprintf(
        __('RepGet could not be reached just now (%s). This is what this site last knew.', 'repget'),
        isset($live['error']) ? rtrim((string) $live['error'], '.') : ''
    );
    if ($status === 'connected') {
        return array('text' => repget_connection_label(repget_stored_connection()), 'note' => $note, 'class' => 'repget-ok', 'usable' => true);
    }
    return array('text' => __('Not checked yet', 'repget'), 'note' => $note, 'class' => '', 'usable' => true);
}

/* -------------------------------------------------------------------------- */
/* Connect and sync                                                           */
/* -------------------------------------------------------------------------- */

/** What every verify tells RepGet: which site this is, and where to ask it to check now. */
function repget_verify_body() {
    return array(
        'siteUrl'       => get_site_url(),
        'wpVersion'     => get_bloginfo('version'),
        'pluginVersion' => REPGET_VERSION,
        'syncUrl'       => admin_url('admin-ajax.php'),
    );
}

/**
 * Confirms the SAVED key works, and tells RepGet which site this is.
 *
 * Records the outcome: the status, which account and website RepGet says
 * the key belongs to (1.7.0), and the live check the settings page shows.
 * A key not saved yet is checked with repget_connect_request instead - see
 * repget_connect_finish.
 */
function repget_verify($timeout = 30) {
    $result = repget_request('/api/plugin/verify', array(
        'method'  => 'POST',
        'timeout' => $timeout,
        'body'    => wp_json_encode(repget_verify_body()),
    ));

    if (is_wp_error($result)) {
        if ($result->get_error_code() === 'invalid_key') {
            repget_cache_status(array('state' => 'rejected'));
        }
        return $result;
    }

    update_option(REPGET_OPTION_STATUS, 'connected');
    $connection = repget_remember_connection($result);
    repget_cache_status(array('state' => 'connected') + $connection);
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
 * Found by the tag this plugin puts on every post it creates (1.5.0+). Only
 * those posts are touched; nothing else on the site is.
 *
 * 1.5.0 - 1.6.0 ALSO asked RepGet for the post ids it had recorded, to find
 * posts made before the tag existed - through GET /api/plugin/articles. That
 * is not a lookup: it is the delivery call. Every article due at that moment
 * was CLAIMED (recorded as handed to the plugin, in flight for ten minutes)
 * and the list was then thrown away, so changing this setting held back
 * everything that was about to publish. RepGet has no call that returns
 * those ids without claiming, so the lookup is gone; the only posts it
 * found in addition were created by plugins older than 1.5.0, before the
 * tag. Reporting the new addresses is unaffected: it goes through
 * /api/plugin/published, which claims nothing.
 *
 * @return int how many posts moved
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

/* -------------------------------------------------------------------------- */
/* Updates (1.7.0)                                                            */
/* -------------------------------------------------------------------------- */

/*
  WordPress offers new versions of this plugin itself, like any plugin from
  the directory - so the one manual upload of 1.7.0 is the last one.

  RepGet publishes a manifest next to the zip (written by
  wordpress-plugin/build.mjs):

    { version, package: "/repget-connector.zip", sha256, requires,
      requires_php, tested, changelog }

  and three filters use it:

    - pre_set_site_transient_update_plugins offers an update, only for a
      version STRICTLY newer than this one;
    - plugins_api answers "View details" for this plugin's slug only;
    - upgrader_pre_download downloads OUR package itself and refuses it
      unless its SHA-256 matches the manifest - a zip that was altered, or
      swapped between the manifest and the download, is deleted, not
      installed.

  The manifest comes from repget_endpoint(), the host that already receives
  this site's key: nothing new is trusted.
*/

/** Where RepGet publishes the manifest. */
function repget_manifest_url() {
    return repget_endpoint() . '/repget-connector.json';
}

/**
 * The package's full URL: RepGet's own host for a path ("/repget-connector.zip"),
 * or an absolute http(s) URL as given. '' for anything else - a protocol-
 * relative "//host" included. Whatever the URL, the download is hash-checked.
 */
function repget_package_url($package) {
    if (!is_string($package) || $package === '') {
        return '';
    }
    if ($package[0] === '/' && strpos($package, '//') !== 0) {
        return repget_endpoint() . $package;
    }
    return preg_match('#^https?://[^\s]+$#i', $package) === 1 ? $package : '';
}

/** A manifest as fetched, checked field by field; null if it is not usable. */
function repget_clean_manifest($data) {
    if (!is_array($data)) {
        return null;
    }
    $version = isset($data['version']) && is_string($data['version']) ? trim($data['version']) : '';
    $sha256 = isset($data['sha256']) && is_string($data['sha256']) ? strtolower(trim($data['sha256'])) : '';
    $package = repget_package_url(isset($data['package']) ? $data['package'] : '');
    if (preg_match('/^\d+(\.\d+){0,3}$/', $version) !== 1 || preg_match('/^[0-9a-f]{64}$/', $sha256) !== 1 || $package === '') {
        return null;
    }

    $text = function ($field) use ($data) {
        return isset($data[$field]) && is_scalar($data[$field]) ? sanitize_text_field((string) $data[$field]) : '';
    };
    return array(
        'version'      => $version,
        'package'      => $package,
        'sha256'       => $sha256,
        'requires'     => $text('requires'),
        'requires_php' => $text('requires_php'),
        'tested'       => $text('tested'),
        // Multi-line; escaped where it is printed (repget_changelog_html).
        'changelog'    => isset($data['changelog']) && is_string($data['changelog']) ? $data['changelog'] : '',
    );
}

/**
 * RepGet's manifest, cached 12 hours; null when there is none to be had.
 *
 * `$fresh` skips the cache - used right before a download, so the hash
 * checked is the one published NOW, next to the zip being served now. When
 * RepGet cannot be reached, a fresh read falls back to the cached copy; a
 * failed read with nothing cached is remembered for an hour, so a site that
 * cannot reach RepGet does not ask on every update check.
 */
function repget_update_manifest($fresh = false) {
    $cached = get_site_transient(REPGET_UPDATE_MANIFEST);
    $usable = is_array($cached) && isset($cached['version'], $cached['package'], $cached['sha256']);
    if (!$fresh && is_array($cached)) {
        return $usable ? $cached : null;
    }

    $manifest = null;
    $response = wp_remote_get(repget_manifest_url(), array(
        'timeout' => 10,
        'headers' => array('Accept' => 'application/json'),
    ));
    if (!is_wp_error($response) && (int) wp_remote_retrieve_response_code($response) === 200) {
        $manifest = repget_clean_manifest(json_decode(wp_remote_retrieve_body($response), true));
    }

    if ($manifest !== null) {
        set_site_transient(REPGET_UPDATE_MANIFEST, $manifest, 12 * HOUR_IN_SECONDS);
        return $manifest;
    }
    if ($fresh && $usable) {
        return $cached;
    }
    set_site_transient(REPGET_UPDATE_MANIFEST, array(), HOUR_IN_SECONDS);
    return null;
}

/** The entry WordPress keeps for this plugin in its update list. */
function repget_update_entry($manifest) {
    return (object) array(
        'id'            => repget_manifest_url(),
        'slug'          => REPGET_PLUGIN_SLUG,
        'plugin'        => plugin_basename(__FILE__),
        'new_version'   => $manifest['version'],
        'url'           => repget_endpoint(),
        'package'       => $manifest['package'],
        'requires'      => $manifest['requires'],
        'requires_php'  => $manifest['requires_php'],
        'tested'        => $manifest['tested'],
        'icons'         => array(),
        'banners'       => array(),
        'banners_rtl'   => array(),
        'compatibility' => new stdClass(),
    );
}

/**
 * Offers the manifest's version when it is STRICTLY newer than this one.
 *
 * The same version, or an older one (a rollback on RepGet's side), offers
 * nothing - and removes any offer for this plugin that did not come from
 * RepGet - and lists the plugin under no_update, which is what gives it
 * WordPress's "Enable auto-updates" link. A manifest that cannot be read
 * leaves WordPress's list as it was.
 */
add_filter('pre_set_site_transient_update_plugins', 'repget_offer_update');
function repget_offer_update($transient) {
    if (!is_object($transient)) {
        return $transient;
    }
    $manifest = repget_update_manifest();
    if ($manifest === null) {
        return $transient;
    }

    $plugin = plugin_basename(__FILE__);
    $entry = repget_update_entry($manifest);
    /*
      The version on DISK, not REPGET_VERSION. Right after an update this
      code - still the OLD version, in memory - runs again in the same
      request, and must not offer the version just installed. WordPress
      passes what it read from disk in ->checked, except on its first save,
      which starts from an empty object: then the file itself is read.
    */
    $installed = isset($transient->checked) && is_array($transient->checked)
        && isset($transient->checked[$plugin]) && is_string($transient->checked[$plugin]) && $transient->checked[$plugin] !== ''
        ? $transient->checked[$plugin]
        : repget_installed_version();
    if (version_compare($manifest['version'], $installed, '>')) {
        if (!isset($transient->response) || !is_array($transient->response)) {
            $transient->response = array();
        }
        $transient->response[$plugin] = $entry;
        if (isset($transient->no_update) && is_array($transient->no_update)) {
            unset($transient->no_update[$plugin]);
        }
    } else {
        if (isset($transient->response) && is_array($transient->response)) {
            unset($transient->response[$plugin]);
        }
        if (!isset($transient->no_update) || !is_array($transient->no_update)) {
            $transient->no_update = array();
        }
        $entry->new_version = $installed;
        $entry->package = '';
        $transient->no_update[$plugin] = $entry;
    }
    return $transient;
}

/** This plugin's version as the file on disk says - newer than REPGET_VERSION right after an update. */
function repget_installed_version() {
    if (function_exists('get_file_data')) {
        $data = get_file_data(__FILE__, array('Version' => 'Version'));
        if (is_array($data) && isset($data['Version']) && is_string($data['Version']) && $data['Version'] !== '') {
            return $data['Version'];
        }
    }
    return REPGET_VERSION;
}

/** "View details" for this plugin: RepGet's manifest, never the WordPress.org directory. */
add_filter('plugins_api', 'repget_plugin_details', 10, 3);
function repget_plugin_details($result, $action, $args) {
    if ($action !== 'plugin_information' || !is_object($args) || !isset($args->slug) || $args->slug !== REPGET_PLUGIN_SLUG) {
        return $result;
    }
    $manifest = repget_update_manifest();
    if ($manifest === null) {
        /*
          An error, not a pass-through: passing on would let WordPress look the
          slug up in the public directory and show whatever is listed there
          under this name.
        */
        return new WP_Error('plugins_api_failed', __('RepGet could not be reached for the plugin details. Try again later.', 'repget'));
    }

    return (object) array(
        'name'          => 'RepGet Connector',
        'slug'          => REPGET_PLUGIN_SLUG,
        'version'       => $manifest['version'],
        'author'        => 'RepGet',
        'homepage'      => repget_endpoint(),
        'requires'      => $manifest['requires'],
        'requires_php'  => $manifest['requires_php'],
        'tested'        => $manifest['tested'],
        'download_link' => $manifest['package'],
        'sections'      => array(
            'description' => '<p>' . esc_html__('Publishes articles written by RepGet straight to your WordPress site.', 'repget') . '</p>',
            'changelog'   => repget_changelog_html($manifest['changelog']),
        ),
    );
}

/** The manifest's plain-text changelog ("* item" lines, wrapped) as an escaped list. */
function repget_changelog_html($text) {
    $items = array();
    foreach (preg_split('/\r?\n/', (string) $text) as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        if (strpos($line, '* ') === 0 || empty($items)) {
            $items[] = ltrim($line, '* ');
        } else {
            $items[count($items) - 1] .= ' ' . $line;
        }
    }
    if (empty($items)) {
        return '';
    }
    return '<ul><li>' . implode('</li><li>', array_map('esc_html', $items)) . '</li></ul>';
}

/**
 * Downloads OUR package itself and installs it only if its SHA-256 is the
 * manifest's.
 *
 * Ours is recognised by URL - RepGet's zip, or the package the cached
 * manifest named - independently of whether a manifest can be read now, so
 * RepGet being unreachable at the wrong moment fails CLOSED: no manifest, no
 * install. Every other download is left to WordPress untouched.
 */
add_filter('upgrader_pre_download', 'repget_verified_download', 10, 4);
function repget_verified_download($reply, $package, $upgrader = null, $hook_extra = array()) {
    if ($reply !== false || !repget_is_our_package($package)) {
        return $reply;
    }

    $manifest = repget_update_manifest(true);
    if ($manifest === null) {
        return new WP_Error('repget_package_unverified', __('RepGet\'s update manifest could not be read, so the RepGet Connector update was not installed. Try again later.', 'repget'));
    }

    if (!function_exists('download_url')) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
    }
    $file = download_url($package);
    if (is_wp_error($file)) {
        return $file;
    }

    $actual = hash_file('sha256', $file);
    if (!is_string($actual) || !hash_equals($manifest['sha256'], strtolower($actual))) {
        wp_delete_file($file);
        return new WP_Error('repget_package_mismatch', __('The downloaded RepGet Connector update did not match the checksum RepGet published, so it was deleted and not installed.', 'repget'));
    }
    return $file;
}

/** True for the package URLs this plugin's updates come from. */
function repget_is_our_package($package) {
    if (!is_string($package) || $package === '') {
        return false;
    }
    if ($package === repget_package_url('/' . REPGET_PLUGIN_SLUG . '.zip')) {
        return true;
    }
    $cached = get_site_transient(REPGET_UPDATE_MANIFEST);
    return is_array($cached) && isset($cached['package']) && $cached['package'] === $package;
}
