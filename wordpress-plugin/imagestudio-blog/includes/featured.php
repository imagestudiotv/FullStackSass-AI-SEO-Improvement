<?php
/**
 * "Get Featured in This Article" on Image Studio's editorial articles
 * (client, 2026-10-08): the same offer as RepGet's blog - $99, one time, a
 * sponsored mention and link, subject to editorial approval - paid through
 * PayPal to the configured PayPal email (dimoncic@live.it) instead of Stripe.
 *
 * How it works:
 *  1. The button and panel are added to the article (includes/article.php,
 *     markup.php). The panel asks for an email, a website and what to
 *     mention, and posts them here (isb_handle_request).
 *  2. The request is kept as a private "Featured placement", and the buyer
 *     goes to a plain PayPal "Buy Now" page for $99 - no PayPal API keys.
 *  3. PayPal tells the site about the payment (IPN, isb_handle_ipn). The site
 *     asks PayPal to confirm the notice is genuine, checks it pays for this
 *     request, marks the request paid and emails the site administrator.
 *     PayPal also emails the account owner, as for any payment.
 *  4. Under "Featured placements", the team marks each paid request published
 *     (after adding the mention by hand) or declined. If a payment notice
 *     never arrives, a request can be marked paid by hand after checking
 *     PayPal.
 */

defined('ABSPATH') || exit;

/** A request's states, as post statuses, so the admin list can filter by them. */
function isb_placement_statuses() {
    return array(
        'isb_awaiting' => __('Not paid', 'imagestudio-blog'),
        'isb_paid' => __('Paid - to review', 'imagestudio-blog'),
        'isb_published' => __('Published', 'imagestudio-blog'),
        'isb_declined' => __('Declined', 'imagestudio-blog'),
    );
}

/** Limits on anonymous requests: per visitor, per email, and overall. */
const ISB_LIMITS = array(
    'visitor_hour' => 5,
    'visitor_day' => 20,
    'email_hour' => 5,
    'all_day' => 100,
);

function isb_register_placement_type() {
    register_post_type('isb_placement', array(
        'labels' => array(
            'name' => __('Featured placements', 'imagestudio-blog'),
            'singular_name' => __('Featured placement', 'imagestudio-blog'),
            'menu_name' => __('Featured placements', 'imagestudio-blog'),
            'edit_item' => __('Featured placement request', 'imagestudio-blog'),
            'search_items' => __('Search requests', 'imagestudio-blog'),
            'not_found' => __('No requests yet.', 'imagestudio-blog'),
            'not_found_in_trash' => __('No requests in the bin.', 'imagestudio-blog'),
        ),
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'show_in_rest' => false,
        'menu_position' => 26,
        'menu_icon' => 'dashicons-megaphone',
        'supports' => false,
        // Administrators only; requests are only ever created by readers.
        'capabilities' => array(
            'edit_post' => 'manage_options',
            'read_post' => 'manage_options',
            'delete_post' => 'manage_options',
            'edit_posts' => 'manage_options',
            'edit_others_posts' => 'manage_options',
            'delete_posts' => 'manage_options',
            'publish_posts' => 'manage_options',
            'read_private_posts' => 'manage_options',
            'create_posts' => 'do_not_allow',
        ),
        'map_meta_cap' => false,
    ));
    foreach (isb_placement_statuses() as $status => $label) {
        register_post_status($status, array(
            'label' => $label,
            'public' => false,
            'internal' => false,
            'protected' => true,
            'exclude_from_search' => true,
            'show_in_admin_all_list' => true,
            'show_in_admin_status_list' => true,
            /* translators: %s: number of requests */
            'label_count' => array(0 => $label . ' <span class="count">(%s)</span>', 1 => $label . ' <span class="count">(%s)</span>', 'singular' => $label . ' <span class="count">(%s)</span>', 'plural' => $label . ' <span class="count">(%s)</span>', 'context' => null, 'domain' => 'imagestudio-blog'),
        ));
    }
}
add_action('init', 'isb_register_placement_type');

/* --------------------------------------------------------------- the panel */

function isb_icon($name) {
    $paths = array(
        'arrow' => '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
        'back' => '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        'check' => '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
        'sparkles' => '<path d="M9.94 14.06 8.5 19l-1.44-4.94L2 12.5l5.06-1.44L8.5 6l1.44 5.06L15 12.5z"/><path d="M18 3v4"/><path d="M20 5h-4"/>',
    );
    return '<svg class="isb-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . $paths[$name] . '</svg>';
}

/** The pill in the article's date line. */
function isb_feature_trigger($lang) {
    return '<button type="button" class="isb-feature-trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="isb-feature-panel">'
        . esc_html(isb_text('trigger', $lang)) . isb_icon('arrow') . '</button>';
}

/**
 * The panel the pill opens: the client's design word for word (offer step),
 * then the three questions (details step), which post to admin-post.php and
 * go on to PayPal. Notices after PayPal (thanks, cancelled) and refusals are
 * shown by featured.js from the data-* copy.
 */
function isb_feature_panel($post, $lang) {
    $t = function ($key) use ($lang) {
        return esc_html(isb_text($key, $lang));
    };
    $a = function ($key) use ($lang) {
        return esc_attr(isb_text($key, $lang));
    };
    ob_start();
    ?>
<div class="isb-feature-panel" id="isb-feature-panel" role="dialog" aria-modal="false" aria-labelledby="isb-feature-title" tabindex="-1" hidden
    data-thanks="<?php echo $a('thanks'); ?>" data-cancelled="<?php echo $a('cancelled'); ?>"
    data-error-fields="<?php echo $a('error_fields'); ?>" data-error-website="<?php echo $a('error_website'); ?>"
    data-error-busy="<?php echo $a('error_busy'); ?>" data-error-unavailable="<?php echo $a('error_unavailable'); ?>"
    data-opening="<?php echo $a('opening'); ?>">
    <p class="isb-eyebrow"><?php echo isb_icon('sparkles') . $t('eyebrow'); ?></p>
    <h2 class="isb-title" id="isb-feature-title"><?php echo $t('title'); ?></h2>
    <p class="isb-description"><?php echo $t('description'); ?></p>
    <p class="isb-notice" role="status" hidden></p>
    <div class="isb-card">
        <div class="isb-offer">
            <div class="isb-price-row">
                <div>
                    <p class="isb-label"><?php echo $t('one_time'); ?></p>
                    <p class="isb-price">$99</p>
                </div>
                <div class="isb-terms">
                    <p class="isb-check"><?php echo isb_icon('check') . $t('no_subscription'); ?></p>
                    <p><?php echo $t('per_article'); ?></p>
                </div>
            </div>
            <button type="button" class="isb-buy" data-isb-next><?php echo $t('buy') . isb_icon('arrow'); ?></button>
            <p class="isb-approval"><?php echo $t('approval'); ?></p>
        </div>
        <form class="isb-details" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" hidden>
            <input type="hidden" name="action" value="isb_featured">
            <input type="hidden" name="article" value="<?php echo (int) $post->ID; ?>">
            <input type="hidden" name="lang" value="<?php echo esc_attr($lang); ?>">
            <div class="isb-trap" aria-hidden="true"><label>Leave empty <input type="text" name="isb_company" tabindex="-1" autocomplete="off"></label></div>
            <div class="isb-form-head">
                <p><?php echo $t('details'); ?></p>
                <button type="button" class="isb-back" data-isb-back><?php echo isb_icon('back') . $t('back'); ?></button>
            </div>
            <div class="isb-fields">
                <p><label for="isb-email"><?php echo $t('email'); ?></label><input id="isb-email" type="email" name="email" autocomplete="email" maxlength="254" required></p>
                <p><label for="isb-website"><?php echo $t('website'); ?></label><input id="isb-website" type="text" inputmode="url" name="website" autocomplete="url" maxlength="2000" placeholder="<?php echo $a('website_hint'); ?>" required></p>
            </div>
            <p><label for="isb-message"><?php echo $t('message'); ?></label><textarea id="isb-message" name="message" rows="3" maxlength="1000" placeholder="<?php echo $a('message_hint'); ?>" required></textarea></p>
            <p class="isb-error" role="alert" hidden></p>
            <button type="submit" class="isb-buy"><?php echo $t('continue') . isb_icon('arrow'); ?></button>
            <p class="isb-approval"><?php echo $t('secure'); ?></p>
        </form>
    </div>
</div>
    <?php
    return trim(ob_get_clean());
}

add_action('wp_enqueue_scripts', function () {
    if (!is_singular(isb_post_type()) || !isb_feature_ready()) return;
    wp_enqueue_style('isb-featured', plugins_url('assets/featured.css', ISB_FILE), array(), ISB_VERSION);
    wp_enqueue_script('isb-featured', plugins_url('assets/featured.js', ISB_FILE), array(), ISB_VERSION, true);
});

/* -------------------------------------------------------------- a request */

/** Who is asking, as a keyed hash: the address itself is never stored. */
function isb_visitor_hash() {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
    if ($ip === '' && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    if ($ip === '') $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return substr(hash_hmac('sha256', $ip, wp_salt('nonce')), 0, 32);
}

/** Requests made within the last $seconds, optionally only those carrying one meta value. */
function isb_recent_requests($seconds, $meta_key = null, $meta_value = null) {
    $args = array(
        'post_type' => 'isb_placement',
        // The bin too: binning a request does not hand its slot back.
        'post_status' => array_merge(array_keys(isb_placement_statuses()), array('trash')),
        'fields' => 'ids',
        'posts_per_page' => 200,
        'no_found_rows' => true,
        'date_query' => array(array('column' => 'post_date_gmt', 'after' => gmdate('Y-m-d H:i:s', time() - $seconds), 'inclusive' => true)),
    );
    if ($meta_key) $args['meta_query'] = array(array('key' => $meta_key, 'value' => $meta_value));
    return count((new WP_Query($args))->posts);
}

function isb_back_to($url, array $args) {
    wp_safe_redirect(add_query_arg($args, $url), 303);
    exit;
}

/** A reader's "Continue to PayPal": checks, records the request, and sends them to PayPal. */
function isb_handle_request() {
    $lang = (wp_unslash($_POST['lang'] ?? '') === 'it') ? 'it' : 'en';
    $post = get_post(absint($_POST['article'] ?? 0));
    if (!$post || $post->post_type !== isb_post_type() || $post->post_status !== 'publish') {
        wp_safe_redirect(home_url('/'), 303);
        exit;
    }
    $article_url = get_permalink($post);
    if (!isb_feature_ready()) isb_back_to($article_url, array('featured' => 'error', 'reason' => 'unavailable'));
    // Filled in only by bots: quietly back to the article, nothing recorded.
    if (!empty($_POST['isb_company'])) isb_back_to($article_url, array());

    $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
    $website = isb_website_address(wp_unslash($_POST['website'] ?? ''));
    $message = trim(sanitize_textarea_field(wp_unslash($_POST['message'] ?? '')));
    if (!is_email($email) || $message === '' || strlen($message) > 3000) isb_back_to($article_url, array('featured' => 'error', 'reason' => 'fields'));
    if (!$website) isb_back_to($article_url, array('featured' => 'error', 'reason' => 'website'));

    $visitor = isb_visitor_hash();
    $email_key = strtolower($email);
    if (
        isb_recent_requests(HOUR_IN_SECONDS, '_isb_visitor', $visitor) >= ISB_LIMITS['visitor_hour'] ||
        isb_recent_requests(DAY_IN_SECONDS, '_isb_visitor', $visitor) >= ISB_LIMITS['visitor_day'] ||
        isb_recent_requests(HOUR_IN_SECONDS, '_isb_email', $email_key) >= ISB_LIMITS['email_hour'] ||
        isb_recent_requests(DAY_IN_SECONDS) >= ISB_LIMITS['all_day']
    ) {
        isb_back_to($article_url, array('featured' => 'error', 'reason' => 'busy'));
    }

    $secret = wp_generate_password(32, false);
    $id = wp_insert_post(array(
        'post_type' => 'isb_placement',
        'post_status' => 'isb_awaiting',
        'post_title' => sprintf('%s - %s', $email_key, $post->post_title),
        'meta_input' => array(
            '_isb_article' => $post->ID,
            '_isb_email' => $email_key,
            '_isb_website' => $website,
            '_isb_message' => function_exists('mb_substr') ? mb_substr($message, 0, 1000) : substr($message, 0, 1000),
            '_isb_lang' => $lang,
            '_isb_secret' => $secret,
            '_isb_visitor' => $visitor,
        ),
    ), true);
    if (is_wp_error($id)) isb_back_to($article_url, array('featured' => 'error', 'reason' => 'unavailable'));

    $settings = isb_settings();
    $paypal = isb_paypal_url(array(
        'sandbox' => !empty($settings['sandbox']),
        'email' => $settings['paypal_email'],
        'article_title' => wp_strip_all_tags($post->post_title),
        'request_id' => $id,
        'secret' => $secret,
        'lang' => $lang,
        'return_url' => add_query_arg('featured', 'thanks', $article_url),
        'cancel_url' => add_query_arg('featured', 'cancelled', $article_url),
        'notify_url' => rest_url('imagestudio-blog/v1/paypal-ipn'),
    ));
    nocache_headers();
    // Not wp_safe_redirect: PayPal is another site, on purpose.
    wp_redirect($paypal, 303);
    exit;
}
add_action('admin_post_nopriv_isb_featured', 'isb_handle_request');
add_action('admin_post_isb_featured', 'isb_handle_request');

/* --------------------------------------------- PayPal's payment notice (IPN) */

add_action('rest_api_init', function () {
    register_rest_route('imagestudio-blog/v1', '/paypal-ipn', array(
        'methods' => 'POST',
        'callback' => 'isb_handle_ipn',
        'permission_callback' => '__return_true',
    ));
});

/**
 * PayPal's notice that a "Buy Now" payment happened. Answered 200 unless
 * PayPal could not be asked (then 503, so PayPal sends it again).
 *
 * Nothing is believed from the notice itself: it must name a request that
 * exists and carry that request's secret before PayPal is even asked, PayPal
 * must answer VERIFIED to the exact message, and the payment must be
 * completed, to the configured PayPal email, for exactly $99 USD.
 */
function isb_handle_ipn(WP_REST_Request $request) {
    $ok = new WP_REST_Response(null, 200);
    $raw = $request->get_body();
    if ($raw === '' || strlen($raw) > 20000) return $ok;
    parse_str($raw, $ipn);

    $custom = isb_parse_custom($ipn['custom'] ?? '');
    $placement = $custom ? get_post($custom['id']) : null;
    if (!$placement || $placement->post_type !== 'isb_placement') return $ok;
    $secret = (string) get_post_meta($placement->ID, '_isb_secret', true);
    if ($secret === '' || !hash_equals($secret, $custom['secret'])) return $ok;

    $settings = isb_settings();
    $test = ($ipn['test_ipn'] ?? '') === '1';
    // A sandbox notice never pays for a real request, nor a real one for a test.
    if ($test !== !empty($settings['sandbox'])) return $ok;

    $verify = wp_remote_post($test ? 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr' : 'https://ipnpb.paypal.com/cgi-bin/webscr', array(
        'body' => 'cmd=_notify-validate&' . $raw,
        'timeout' => 20,
        'httpversion' => '1.1',
        'headers' => array('Content-Type' => 'application/x-www-form-urlencoded', 'User-Agent' => 'ImageStudioBlog/' . ISB_VERSION),
    ));
    if (is_wp_error($verify) || (int) wp_remote_retrieve_response_code($verify) !== 200) return new WP_REST_Response(null, 503);
    if (trim(wp_remote_retrieve_body($verify)) !== 'VERIFIED') return $ok;

    $status = $ipn['payment_status'] ?? '';
    if (in_array($status, array('Refunded', 'Reversed', 'Canceled_Reversal'), true)) {
        if (($ipn['parent_txn_id'] ?? '') !== '' && $ipn['parent_txn_id'] === get_post_meta($placement->ID, '_isb_txn', true)) {
            update_post_meta($placement->ID, '_isb_payment_note', sprintf('%s at PayPal on %s', $status, gmdate('Y-m-d H:i') . ' UTC'));
        }
        return $ok;
    }

    $problem = isb_ipn_problem($ipn + array('custom_secret' => $custom['secret']), array('email' => $settings['paypal_email'], 'secret' => $secret));
    if ($problem) {
        update_post_meta($placement->ID, '_isb_payment_note', 'PayPal notice not accepted: ' . $problem);
        return $ok;
    }
    // The same notice again, or a request already decided: nothing more to do.
    if ($placement->post_status !== 'isb_awaiting') return $ok;

    update_post_meta($placement->ID, '_isb_txn', sanitize_text_field($ipn['txn_id']));
    update_post_meta($placement->ID, '_isb_payer', sanitize_email($ipn['payer_email'] ?? ''));
    update_post_meta($placement->ID, '_isb_paid_at', time());
    update_post_meta($placement->ID, '_isb_paid_by', 'paypal');
    wp_update_post(array('ID' => $placement->ID, 'post_status' => 'isb_paid'));
    isb_notify_paid($placement->ID);
    return $ok;
}

/** Emails the site administrator about a paid request. */
function isb_notify_paid($id) {
    $article = get_post((int) get_post_meta($id, '_isb_article', true));
    $title = $article ? $article->post_title : '';
    $body = implode("\n\n", array(
        sprintf('%s paid $99 for a sponsored mention in "%s".', get_post_meta($id, '_isb_email', true), $title),
        'Website: ' . get_post_meta($id, '_isb_website', true),
        "What they would like mentioned:\n" . get_post_meta($id, '_isb_message', true),
        'Review it: ' . admin_url('post.php?post=' . (int) $id . '&action=edit'),
        'Add the mention to the article yourself, then mark the request published - or decline it.',
    ));
    wp_mail(get_option('admin_email'), 'Paid placement request: ' . $title, $body, array('Reply-To: ' . get_post_meta($id, '_isb_email', true)));
}

/* ------------------------------------------------------------ admin screens */

/** Where a request may go from where it is. "Mark as paid" is for a payment checked in PayPal by hand. */
function isb_moves($status) {
    $moves = array(
        'isb_awaiting' => array('isb_paid' => __('Mark as paid', 'imagestudio-blog'), 'isb_declined' => __('Decline', 'imagestudio-blog')),
        'isb_paid' => array('isb_published' => __('Mark as published', 'imagestudio-blog'), 'isb_declined' => __('Decline', 'imagestudio-blog')),
        'isb_published' => array('isb_paid' => __('Move back to review', 'imagestudio-blog')),
        'isb_declined' => array('isb_paid' => __('Move back to review', 'imagestudio-blog')),
    );
    return $moves[$status] ?? array();
}

function isb_move_url($id, $to) {
    return wp_nonce_url(admin_url('admin-post.php?action=isb_move&id=' . (int) $id . '&to=' . $to), 'isb_move_' . (int) $id);
}

add_action('admin_post_isb_move', function () {
    $id = absint($_GET['id'] ?? 0);
    $to = sanitize_key($_GET['to'] ?? '');
    check_admin_referer('isb_move_' . $id);
    if (!current_user_can('manage_options')) wp_die(esc_html__('You cannot change this request.', 'imagestudio-blog'), 403);
    $post = get_post($id);
    if (!$post || $post->post_type !== 'isb_placement' || !isset(isb_moves($post->post_status)[$to])) {
        wp_die(esc_html__('This request changed in the meantime. Go back and reload the page.', 'imagestudio-blog'), 409);
    }
    if ($to === 'isb_paid' && $post->post_status === 'isb_awaiting') {
        update_post_meta($id, '_isb_paid_at', time());
        update_post_meta($id, '_isb_paid_by', wp_get_current_user()->user_email);
    }
    wp_update_post(array('ID' => $id, 'post_status' => $to));
    wp_safe_redirect(wp_get_referer() ?: admin_url('edit.php?post_type=isb_placement'));
    exit;
});

add_filter('manage_isb_placement_posts_columns', function () {
    return array(
        'cb' => '<input type="checkbox" />',
        'isb_article' => __('Article', 'imagestudio-blog'),
        'isb_buyer' => __('Buyer', 'imagestudio-blog'),
        'isb_status' => __('Status', 'imagestudio-blog'),
        'isb_requested' => __('Requested', 'imagestudio-blog'),
    );
});

add_action('manage_isb_placement_posts_custom_column', function ($column, $id) {
    $post = get_post($id);
    switch ($column) {
        case 'isb_article':
            $article = get_post((int) get_post_meta($id, '_isb_article', true));
            echo $article ? '<strong><a href="' . esc_url(get_edit_post_link($id)) . '">' . esc_html($article->post_title) . '</a></strong>' : '&mdash;';
            break;
        case 'isb_buyer':
            echo esc_html(get_post_meta($id, '_isb_email', true)) . '<br><span class="description">' . esc_html(get_post_meta($id, '_isb_website', true)) . '</span>';
            break;
        case 'isb_status':
            echo esc_html(isb_placement_statuses()[$post->post_status] ?? $post->post_status);
            $actions = array();
            foreach (isb_moves($post->post_status) as $to => $label) {
                $actions[] = '<a href="' . esc_url(isb_move_url($id, $to)) . '">' . esc_html($label) . '</a>';
            }
            if ($actions) echo '<div class="row-actions visible">' . implode(' | ', $actions) . '</div>';
            break;
        case 'isb_requested':
            echo esc_html(get_date_from_gmt($post->post_date_gmt, 'j M Y, H:i'));
            break;
    }
}, 10, 2);

add_filter('post_row_actions', function ($actions, $post) {
    if ($post->post_type !== 'isb_placement') return $actions;
    unset($actions['inline hide-if-no-js'], $actions['view']);
    return $actions;
}, 10, 2);

/* Paid requests first, the longest-waiting at the top: they are the ones waiting for someone. */
add_filter('posts_orderby', function ($orderby, $query) {
    global $wpdb;
    if (!is_admin() || !$query->is_main_query() || $query->get('post_type') !== 'isb_placement' || isset($_GET['orderby'])) return $orderby;
    return "FIELD({$wpdb->posts}.post_status, 'isb_paid', 'isb_awaiting', 'isb_published', 'isb_declined'), "
        . "CASE WHEN {$wpdb->posts}.post_status = 'isb_paid' THEN {$wpdb->posts}.post_date END ASC, {$wpdb->posts}.post_date DESC";
}, 10, 2);

add_action('add_meta_boxes_isb_placement', function () {
    remove_meta_box('submitdiv', 'isb_placement', 'side');
    remove_meta_box('slugdiv', 'isb_placement', 'normal');
    add_meta_box('isb-request', __('Request', 'imagestudio-blog'), 'isb_request_box', 'isb_placement', 'normal', 'high');
    add_meta_box('isb-decision', __('Status', 'imagestudio-blog'), 'isb_decision_box', 'isb_placement', 'side', 'high');
});

function isb_request_box($post) {
    $article = get_post((int) get_post_meta($post->ID, '_isb_article', true));
    $rows = array(
        __('Article', 'imagestudio-blog') => $article ? '<a href="' . esc_url(get_permalink($article)) . '" target="_blank" rel="noopener">' . esc_html($article->post_title) . '</a>' : '&mdash;',
        __('Buyer', 'imagestudio-blog') => '<a href="mailto:' . esc_attr(get_post_meta($post->ID, '_isb_email', true)) . '">' . esc_html(get_post_meta($post->ID, '_isb_email', true)) . '</a>',
        __('Website', 'imagestudio-blog') => '<a href="' . esc_url(get_post_meta($post->ID, '_isb_website', true)) . '" target="_blank" rel="noopener nofollow">' . esc_html(get_post_meta($post->ID, '_isb_website', true)) . '</a>',
        __('What to mention', 'imagestudio-blog') => nl2br(esc_html(get_post_meta($post->ID, '_isb_message', true))),
        __('Language', 'imagestudio-blog') => get_post_meta($post->ID, '_isb_lang', true) === 'it' ? 'Italiano' : 'English',
        __('Requested', 'imagestudio-blog') => esc_html(get_date_from_gmt($post->post_date_gmt, 'j M Y, H:i')),
        __('PayPal reference', 'imagestudio-blog') => esc_html('IS-' . $post->ID),
    );
    $paid_at = (int) get_post_meta($post->ID, '_isb_paid_at', true);
    if ($paid_at) {
        $by = get_post_meta($post->ID, '_isb_paid_by', true);
        $rows[__('Paid', 'imagestudio-blog')] = esc_html(wp_date('j M Y, H:i', $paid_at) . ' - ' . ($by === 'paypal' ? 'confirmed by PayPal (transaction ' . get_post_meta($post->ID, '_isb_txn', true) . ')' : 'marked by ' . $by));
    }
    $note = get_post_meta($post->ID, '_isb_payment_note', true);
    if ($note) $rows[__('Note', 'imagestudio-blog')] = esc_html($note);
    echo '<table class="form-table" role="presentation">';
    foreach ($rows as $label => $value) {
        echo '<tr><th scope="row">' . esc_html($label) . '</th><td>' . $value . '</td></tr>';
    }
    echo '</table>';
}

function isb_decision_box($post) {
    echo '<p><strong>' . esc_html(isb_placement_statuses()[$post->post_status] ?? $post->post_status) . '</strong></p>';
    if ($post->post_status === 'isb_awaiting') {
        /* translators: %s: the request's PayPal reference, e.g. IS-123 */
        echo '<p class="description">' . esc_html(sprintf(__('Paid requests are marked automatically when PayPal confirms the payment. Mark it paid by hand only after finding the payment (reference %s) in PayPal.', 'imagestudio-blog'), 'IS-' . (int) $post->ID)) . '</p>';
    } elseif ($post->post_status === 'isb_paid') {
        echo '<p class="description">' . esc_html__('Add the sponsored mention and link to the article, then mark it published - or decline it and reply to the buyer.', 'imagestudio-blog') . '</p>';
    }
    foreach (isb_moves($post->post_status) as $to => $label) {
        printf('<p><a class="button%s" href="%s">%s</a></p>', $to === 'isb_published' ? ' button-primary' : '', esc_url(isb_move_url($post->ID, $to)), esc_html($label));
    }
}
