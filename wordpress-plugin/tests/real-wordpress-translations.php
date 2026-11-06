<?php
/**
 * Translations (1.9.0) against a REAL WordPress and a REAL MySQL.
 *
 *   php wordpress-plugin/tests/real-wordpress-translations.php <wordpress dir> <plugin file>
 *
 * The WordPress dir needs a wp-config.php pointing at a DISPOSABLE database,
 * installed with install-wordpress.php; this script writes posts, terms and
 * options. Never point it at a real site. RepGet is never contacted: the
 * check's answer is served by a pre_http_request filter here.
 *
 * WPML is commercial and cannot be installed in CI, so it is stood in for by
 * the few calls the plugin makes, behaving as WPML 4.x documents them
 * (wpml.org/documentation/support/wpml-coding-api/wpml-hooks-reference/): a
 * post saved without a language is filed under the language WPML is working
 * in, in a translation group of its own; wpml_set_element_language_details
 * moves it into another group; wpml_object_id finds a group's version in a
 * language. The same calls are what Image Studio's ChatGPT Translate plugin
 * uses on the live site.
 *
 * What it shows:
 *  - a translation becomes a post of the original's content type, filed
 *    under its language in the original's group, with the original's
 *    categories in that language and its links to this site's posts pointing
 *    at their versions in that language;
 *  - an update changes the text, keeps the language and the owner's
 *    categories;
 *  - nothing is written - and RepGet is told why - without WPML, for a
 *    language the site does not have, before the original is on the site,
 *    or when the original already has a version in that language that
 *    RepGet did not write;
 *  - an ordinary article is not touched by any of it.
 */

if ($argc < 3) {
    fwrite(STDERR, "usage: php real-wordpress-translations.php <wordpress dir> <plugin file>\n");
    exit(2);
}
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = 'wp.test';
$_SERVER['REQUEST_URI'] = '/';
require rtrim($argv[1], '/\\') . '/wp-load.php';
require $argv[2];

global $wpdb;
$failures = 0;
function check($label, $cond, $detail = '') {
    global $failures;
    echo ($cond ? "  ok    " : "  FAIL  ") . $label . ($cond ? '' : " {$detail}") . "\n";
    if (!$cond) $failures++;
}

// ----------------------------------------------------------- WPML stand-in --
$GLOBALS['wpml'] = array(
    'on'        => true,
    'default'   => 'en',
    'current'   => 'en',
    'languages' => array('en', 'it', 'es'),
    'elements'  => array(),   // "<type>:<id>" => array('trid', 'lang', 'source')
    'next_trid' => 1,
    'terms'     => array(),   // "<taxonomy>:<term id>:<lang>" => translated term id
);
function wpml_key($type, $id) {
    return $type . ':' . (int) $id;
}
function wpml_element($type, $id) {
    $key = wpml_key($type, $id);
    return isset($GLOBALS['wpml']['elements'][$key]) ? $GLOBALS['wpml']['elements'][$key] : null;
}
function wpml_install() {
    add_action('save_post', function ($post_id, $post) {
        if (!$GLOBALS['wpml']['on'] || wp_is_post_revision($post_id) || $post->post_type === 'attachment') return;
        $type = 'post_' . $post->post_type;
        if (wpml_element($type, $post_id) === null) {
            $GLOBALS['wpml']['elements'][wpml_key($type, $post_id)] = array('trid' => $GLOBALS['wpml']['next_trid']++, 'lang' => $GLOBALS['wpml']['current'], 'source' => null);
        }
    }, 10, 2);
    add_filter('wpml_current_language', function () { return $GLOBALS['wpml']['current']; });
    add_filter('wpml_default_language', function () { return $GLOBALS['wpml']['default']; });
    add_action('wpml_switch_language', function ($lang) {
        $GLOBALS['wpml']['current'] = $lang ? $lang : $GLOBALS['wpml']['default'];
    });
    add_filter('wpml_active_languages', function () {
        $out = array();
        foreach ($GLOBALS['wpml']['languages'] as $code) $out[$code] = array('code' => $code, 'native_name' => $code);
        return $out;
    });
    add_filter('wpml_element_trid', function ($empty, $id, $type) {
        $element = wpml_element($type, $id);
        return $element ? $element['trid'] : null;
    }, 10, 3);
    add_filter('wpml_element_language_code', function ($empty, $args) {
        $type = strpos($args['element_type'], 'post_') === 0 ? $args['element_type'] : 'post_' . $args['element_type'];
        $element = wpml_element($type, $args['element_id']);
        return $element ? $element['lang'] : null;
    }, 10, 2);
    add_action('wpml_set_element_language_details', function ($args) {
        $GLOBALS['wpml']['elements'][wpml_key($args['element_type'], $args['element_id'])] = array('trid' => (int) $args['trid'], 'lang' => $args['language_code'], 'source' => $args['source_language_code']);
    });
    add_filter('wpml_object_id', function ($id, $type, $original = false, $lang = null) {
        $lang = $lang ? $lang : $GLOBALS['wpml']['current'];
        if (taxonomy_exists($type)) {
            if ($type !== 'category') return $id;   // a taxonomy WPML does not translate
            $key = $type . ':' . (int) $id . ':' . $lang;
            return isset($GLOBALS['wpml']['terms'][$key]) ? $GLOBALS['wpml']['terms'][$key] : null;
        }
        $element = wpml_element('post_' . $type, $id);
        if (!$element) return $original ? $id : null;
        foreach ($GLOBALS['wpml']['elements'] as $key => $other) {
            if ($other['trid'] === $element['trid'] && $other['lang'] === $lang && strpos($key, 'post_' . $type . ':') === 0) {
                return (int) substr($key, strlen('post_' . $type . ':'));
            }
        }
        return $original ? $id : null;
    }, 10, 4);
}
function wpml_uninstall() {
    foreach (array('wpml_current_language', 'wpml_default_language', 'wpml_active_languages', 'wpml_element_trid', 'wpml_element_language_code', 'wpml_object_id') as $hook) remove_all_filters($hook);
    foreach (array('wpml_switch_language', 'wpml_set_element_language_details') as $hook) remove_all_actions($hook);
}
wpml_install();

// ------------------------------------------------------------- fake RepGet --
$GLOBALS['queue'] = array();
$GLOBALS['reports'] = array();
update_option(REPGET_OPTION_KEY, 'test-key-not-real');
add_filter('pre_http_request', function ($pre, $args, $url) {
    $reply = function ($body) {
        return array('headers' => array(), 'body' => $body, 'cookies' => array(), 'response' => array('code' => 200, 'message' => 'OK'), 'filename' => null);
    };
    $path = parse_url($url, PHP_URL_PATH);
    if ($path === '/api/plugin/articles') {
        $GLOBALS['sent_languages'] = isset($args['headers']['X-RepGet-Languages']) ? $args['headers']['X-RepGet-Languages'] : null;
        return $reply(wp_json_encode(array('ok' => true, 'storage' => array(), 'articles' => array_values($GLOBALS['queue']))));
    }
    if ($path === '/api/plugin/published') {
        $sent = json_decode($args['body'], true);
        $GLOBALS['reports'][] = $sent;
        unset($GLOBALS['queue'][$sent['articleId']]);
        return $reply(wp_json_encode(array('ok' => true)));
    }
    return $reply('{}');
}, 10, 3);

function article($id, $title, $html, $extra = array()) {
    return array_merge(array(
        'id' => $id, 'title' => $title, 'slug' => sanitize_title($title), 'html' => $html, 'status' => 'publish',
        'dispatch' => array('id' => wp_generate_uuid4(), 'revision' => 'r'),
    ), $extra);
}
function post_for($article_id) {
    $id = repget_find_post($article_id);
    return $id > 0 ? get_post($id) : null;
}
function language_of($post_id) {
    $element = wpml_element('post_' . get_post_type($post_id), $post_id);
    return $element ? $element['lang'] : null;
}
function trid_of($post_id) {
    $element = wpml_element('post_' . get_post_type($post_id), $post_id);
    return $element ? $element['trid'] : null;
}
function last_report() {
    return $GLOBALS['reports'] ? $GLOBALS['reports'][count($GLOBALS['reports']) - 1] : null;
}
function reset_state() {
    global $wpdb;
    $ids = $wpdb->get_col($wpdb->prepare("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s", REPGET_META_ARTICLE));
    $ids = array_merge($ids, $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE guid LIKE 'https://repget.invalid/articles/%' OR post_title LIKE 'Theirs:%' OR post_title LIKE 'Villa %'"));
    foreach (array_unique(array_map('intval', $ids)) as $id) wp_delete_post($id, true);
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s", REPGET_LOCK));
    delete_option(REPGET_OPTION_PENDING_ACK);
    $GLOBALS['queue'] = array();
    $GLOBALS['reports'] = array();
    $GLOBALS['wpml']['on'] = true;
    $GLOBALS['wpml']['current'] = 'en';
    $GLOBALS['wpml']['elements'] = array();
    wpml_uninstall();
    wpml_install();
}

echo "\nWordPress " . get_bloginfo('version') . ", MySQL " . $wpdb->db_version() . "\n";

// Categories in three languages, and a site post with an Italian version.
function category_id($name) {
    $found = term_exists($name, 'category');
    if ($found) return (int) $found['term_id'];
    $made = wp_insert_term($name, 'category');
    return is_wp_error($made) ? 0 : (int) $made['term_id'];
}
$cat_en = category_id('Weddings');
$cat_it = category_id('Matrimoni');
$GLOBALS['wpml']['terms']['category:' . $cat_en . ':it'] = $cat_it;
$GLOBALS['wpml']['terms']['category:' . $cat_en . ':en'] = $cat_en;
reset_state();
$villa_en = wp_insert_post(array('post_title' => 'Villa Balbianello guide', 'post_name' => 'villa-balbianello', 'post_status' => 'publish', 'post_type' => 'post'));
do_action('wpml_switch_language', 'it');
$villa_it = wp_insert_post(array('post_title' => 'Villa Balbianello guida', 'post_name' => 'villa-balbianello-guida', 'post_status' => 'publish', 'post_type' => 'post'));
do_action('wpml_switch_language', null);
do_action('wpml_set_element_language_details', array('element_id' => $villa_it, 'element_type' => 'post_post', 'trid' => trid_of($villa_en), 'language_code' => 'it', 'source_language_code' => 'en'));
$villa_es_less = wp_insert_post(array('post_title' => 'Villa Carlotta guide', 'post_name' => 'villa-carlotta', 'post_status' => 'publish', 'post_type' => 'post'));
$link_villa = get_permalink($villa_en);
$link_carlotta = get_permalink($villa_es_less);

echo "\nA TRANSLATION is filed under its language, in its original's group\n";
$GLOBALS['queue']['en1'] = article('en1', 'Getting married on Lake Como', '<p>See <a href="' . $link_villa . '">the villa</a> and <a href="' . $link_carlotta . '#garden">Carlotta</a>.</p>');
repget_sync_locked();
$original = post_for('en1');
check('the original is published, filed under the site\'s language', $original && $original->post_status === 'publish' && language_of($original->ID) === 'en');
wp_set_object_terms($original->ID, array($cat_en), 'category');

$GLOBALS['queue']['it1'] = article('it1', 'Sposarsi sul Lago di Como', '<p>Vedi <a href="' . $link_villa . '">la villa</a> e <a href="' . $link_carlotta . '#garden">Carlotta</a>.</p>', array('translationOf' => 'en1', 'language' => 'it'));
$r = repget_sync_locked();
$it = post_for('it1');
check('sync completed', $r === 1, is_wp_error($r) ? $r->get_error_message() : var_export($r, true));
check('the translation is a post of its own, published', $it && $it->ID !== $original->ID && $it->post_status === 'publish' && $it->post_title === 'Sposarsi sul Lago di Como');
check('...filed under Italian, in the original\'s translation group', $it && language_of($it->ID) === 'it' && trid_of($it->ID) === trid_of($original->ID));
check('...WPML finds it as the original\'s Italian version', $it && (int) apply_filters('wpml_object_id', $original->ID, 'post', false, 'it') === $it->ID);
check('...with the original\'s category in Italian', $it && wp_get_object_terms($it->ID, 'category', array('fields' => 'ids')) === array($cat_it), $it ? wp_json_encode(wp_get_object_terms($it->ID, 'category', array('fields' => 'ids'))) : '');
check('...a link to a post with an Italian version points at it', $it && strpos($it->post_content, 'href="' . get_permalink($villa_it) . '"') !== false, $it ? $it->post_content : '');
check('...a link to a post without one is kept as it was', $it && strpos($it->post_content, 'href="' . $link_carlotta . '#garden"') !== false);
check('RepGet is told it is live, at its address', last_report() && last_report()['articleId'] === 'it1' && last_report()['url'] === get_permalink($it->ID) && empty(last_report()['error']));
check('WPML is working in the site\'s language again', apply_filters('wpml_current_language', null) === 'en');
check('each check tells RepGet the site\'s WPML languages, its default first', $GLOBALS['sent_languages'] === 'en,it,es', var_export($GLOBALS['sent_languages'], true));
check('the original is untouched', get_post($original->ID)->post_title === 'Getting married on Lake Como' && language_of($original->ID) === 'en');

$GLOBALS['wpml']['languages'][] = 'pt-br';
$GLOBALS['queue']['pt1'] = article('pt1', 'Casar no Lago de Como', '<p>x</p>', array('translationOf' => 'en1', 'language' => 'pt'));
repget_sync_locked();
check('a language named by its first part is the site\'s one regional code for it', post_for('pt1') && language_of(post_for('pt1')->ID) === 'pt-br');
array_pop($GLOBALS['wpml']['languages']);

echo "\nAN UPDATE of a translation\n";
$cat_owner = category_id('Owner pick');
wp_set_object_terms($it->ID, array($cat_owner), 'category');
$GLOBALS['queue']['it1'] = article('it1', 'Sposarsi sul Lago di Como', '<p>Nuovo testo.</p>', array('translationOf' => 'en1', 'language' => 'it'));
repget_sync_locked();
$it = get_post($it->ID);
check('changes its text, in the same post', strpos($it->post_content, 'Nuovo testo.') !== false && post_for('it1')->ID === $it->ID);
check('...keeps its language and group', language_of($it->ID) === 'it' && trid_of($it->ID) === trid_of($original->ID));
check('...and the category the owner gave it', wp_get_object_terms($it->ID, 'category', array('fields' => 'ids')) === array($cat_owner), wp_json_encode(wp_get_object_terms($it->ID, 'category', array('fields' => 'ids'))));

echo "\nNOTHING IS WRITTEN, and RepGet is told why\n";
$count = function () { global $wpdb; return (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'post' AND post_status <> 'auto-draft'"); };
$before = $count();
$GLOBALS['queue']['es0'] = article('es0', 'Casarse en el lago', '<p>x</p>', array('translationOf' => 'missing-original', 'language' => 'es'));
repget_sync_locked();
check('before the original is on the site', $count() === $before && strpos((string) last_report()['error'], 'not on this site') !== false, wp_json_encode(last_report()));
$GLOBALS['queue']['fr1'] = article('fr1', 'Se marier', '<p>x</p>', array('translationOf' => 'en1', 'language' => 'fr'));
repget_sync_locked();
check('for a language the site does not have', $count() === $before && strpos((string) last_report()['error'], 'not one of this site') !== false, wp_json_encode(last_report()));
$GLOBALS['queue']['en1b'] = article('en1b', 'Same language', '<p>x</p>', array('translationOf' => 'en1', 'language' => 'en'));
repget_sync_locked();
check('in the original\'s own language', $count() === $before && strpos((string) last_report()['error'], 'already in') !== false, wp_json_encode(last_report()));
do_action('wpml_switch_language', 'es');
$theirs = wp_insert_post(array('post_title' => 'Theirs: casarse en Como', 'post_status' => 'draft', 'post_type' => 'post'));
do_action('wpml_switch_language', null);
do_action('wpml_set_element_language_details', array('element_id' => $theirs, 'element_type' => 'post_post', 'trid' => trid_of($original->ID), 'language_code' => 'es', 'source_language_code' => 'en'));
$before = $count();
$GLOBALS['queue']['es1'] = article('es1', 'Casarse en el Lago de Como', '<p>x</p>', array('translationOf' => 'en1', 'language' => 'es'));
repget_sync_locked();
check('when the original already has a version in that language that RepGet did not write', $count() === $before && strpos((string) last_report()['error'], 'already has') !== false && get_post_status($theirs) === 'draft', wp_json_encode(last_report()));
$GLOBALS['wpml']['on'] = false;
wpml_uninstall();
$GLOBALS['queue']['es2'] = article('es2', 'Casarse', '<p>x</p>', array('translationOf' => 'en1', 'language' => 'es'));
repget_sync_locked();
check('without WPML', $count() === $before && strpos((string) last_report()['error'], 'no WPML') !== false, wp_json_encode(last_report()));
check('...whose check then names no languages', $GLOBALS['sent_languages'] === null);
$GLOBALS['queue']['plain'] = article('plain', 'An ordinary article', '<p>Plain.</p>');
repget_sync_locked();
check('...while an ordinary article still is', post_for('plain') && post_for('plain')->post_status === 'publish' && empty(last_report()['error']));

echo "\nAN ORDINARY ARTICLE is not touched by any of it\n";
reset_state();
$GLOBALS['queue']['en2'] = article('en2', 'Lake Como boat tours', '<p>Boats: <a href="' . $link_villa . '">villa</a>.</p>');
repget_sync_locked();
$plain = post_for('en2');
check('its links are as sent, and it is filed under the site\'s language', $plain && strpos($plain->post_content, 'href="' . $link_villa . '"') !== false && language_of($plain->ID) === 'en');

reset_state();
wp_delete_post($villa_en, true);
wp_delete_post($villa_it, true);
wp_delete_post($villa_es_less, true);
wp_delete_term($cat_en, 'category');
wp_delete_term($cat_it, 'category');
wp_delete_term(category_id('Owner pick'), 'category');
echo "\n" . ($failures === 0 ? "ALL PASSED" : "{$failures} FAILURE(S)") . "\n";
exit($failures === 0 ? 0 : 1);
