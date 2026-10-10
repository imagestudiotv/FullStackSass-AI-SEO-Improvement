<?php
/**
 * Article extras (client, 2026-10-09), as on RepGet's blog:
 *
 *  - "In this article" ("In questo articolo"): a contents box at the top of
 *    the article's text listing its H2 headings as links, made on its own
 *    from the article when it has at least 3 of them. Each of those headings
 *    gets an id to link to. On for every article unless switched off in
 *    Settings -> Image Studio Blog, or for one article in its "Article
 *    extras" box.
 *  - FAQ ("Domande frequenti"): optional questions and answers, written in
 *    the article's "Article extras" box, shown after the article's text -
 *    each question a row that opens to its answer - and given to search
 *    engines as FAQPage data (JSON-LD).
 *
 * Both are added to the article's finished HTML (isb_filter_article in
 * author.php), like the byline link: the site's own "cps" template prints
 * the article, and no filter reaches it. That template prints two
 * .cps-single-content blocks - the excerpt, then the article's text - so the
 * text is the last one.
 */

defined('ABSPATH') || exit;

/** Fewer H2s than this, and the article gets no contents box: it would be noise. */
const ISB_TOC_MIN = 3;
/** From this many entries, the box lists them in two columns on a computer. */
const ISB_TOC_LONG = 10;
/** Questions an article can have. */
const ISB_FAQ_MAX = 20;

/** What an article gets: the contents box or not, its FAQ, and the page's language. */
function isb_article_extras($post) {
    $settings = isb_settings();
    return array(
        'toc' => !empty($settings['show_toc']) && get_post_meta($post->ID, '_isb_hide_toc', true) !== '1',
        'faq' => isb_faq_items(get_post_meta($post->ID, '_isb_faq', true)),
        'lang' => isb_lang(),
    );
}

/* ------------------------------------------------------ the article's HTML */

/**
 * The contents box and the FAQ, added to an article's page. The box goes at
 * the very start of the article's text, between the excerpt and the text, as
 * on RepGet. The FAQ goes after the text, before the bottom "Back to
 * Editorial" link - or before "Read more" (.cps-related-wrap) when that link
 * is missing; with neither, there is no FAQ. A page whose text cannot be
 * found is left as it is.
 */
function isb_add_extras($html, array $extras) {
    $toc = !empty($extras['toc']);
    $faq = isb_faq_items($extras['faq'] ?? array());
    if (!is_string($html) || (!$toc && !$faq)) return $html;
    $body = isb_article_body($html);
    if (!$body) return $html;
    list($start, $close, $end) = $body;
    $lang = ($extras['lang'] ?? 'en') === 'it' ? 'it' : 'en';

    // The FAQ first: it goes after the text, so the text stays where it was found.
    if ($faq && strpos($html, '<section class="isb-faq"') === false) {
        $at = isb_faq_position($html, $end);
        if ($at !== null) $html = substr($html, 0, $at) . isb_faq_markup($faq, $lang) . substr($html, $at);
    }
    if ($toc && strpos($html, '<nav class="isb-toc') === false) {
        list($text, $entries) = isb_heading_ids(substr($html, $start, $close - $start), isb_page_ids($html));
        if (count($entries) >= ISB_TOC_MIN) {
            $html = substr($html, 0, $start) . isb_toc_markup($entries, $lang) . $text . substr($html, $close);
        }
    }
    return $html;
}

/**
 * A pattern for an opening tag carrying a class: <div class="x cps-single-content y">.
 * Not "cps-single-content-more": the class must be the whole word.
 */
function isb_tag_pattern($tag, $class) {
    return '~<' . $tag . '\b[^>]*?\sclass\s*=\s*["\']?[^"\'>]*?(?<![\w-])' . preg_quote($class, '~') . '(?![\w-])[^>]*>~i';
}

/**
 * Where the article's text is: the last .cps-single-content before "Read
 * more" (the first one is the excerpt). Returned as the offsets of its
 * inside's start, of its closing </div>, and of the end of that </div>; null
 * when there is none, or its end cannot be found.
 */
function isb_article_body($html) {
    if (!preg_match_all(isb_tag_pattern('div', 'cps-single-content'), $html, $found, PREG_OFFSET_CAPTURE)) return null;
    $related = preg_match(isb_tag_pattern('div', 'cps-related-wrap'), $html, $m, PREG_OFFSET_CAPTURE) ? $m[0][1] : PHP_INT_MAX;
    $open = end($found[0]);
    foreach ($found[0] as $tag) {
        if ($tag[1] < $related) $open = $tag;
    }
    $start = $open[1] + strlen($open[0]);
    $close = isb_closing_div($html, $start);
    return $close ? array($start, $close[0], $close[1]) : null;
}

/**
 * The </div> closing a <div> whose inside starts at $from, counting the
 * <div>s opened and closed inside it (articles have their own). Comments,
 * scripts and styles are skipped: a "<div" in them is not a tag. Returns the
 * offsets of the </div> and of its end, or null.
 */
function isb_closing_div($html, $from) {
    $pattern = '~<!--.*?-->|<(script|style|textarea)\b[^>]*>.*?</\1\s*>|<(/?)div\b[^>]*>~is';
    $depth = 1;
    $at = $from;
    while (preg_match($pattern, $html, $m, PREG_OFFSET_CAPTURE, $at)) {
        $at = $m[0][1] + strlen($m[0][0]);
        if (!isset($m[2]) || $m[2][1] < 0) continue;
        $depth += $m[2][0] === '/' ? -1 : 1;
        if ($depth === 0) return array($m[0][1], $at);
    }
    return null;
}

/** Every id already in the page, so a heading's new id is not one of them. */
function isb_page_ids($html) {
    preg_match_all('~<[a-z][^>]*?\sid\s*=\s*(["\']?)([^"\'\s>]+)\1~i', $html, $m);
    return array_fill_keys($m[2], true);
}

/** A heading's text: no tags, entities decoded, spaces collapsed. */
function isb_plain_text($html) {
    $text = (string) preg_replace('~<(script|style)\b[^>]*>.*?</\1\s*>~is', '', (string) $html);
    $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $clean = preg_replace('~[\s\x{00A0}\x{200B}]+~u', ' ', $text);
    return trim($clean === null ? preg_replace('~\s+~', ' ', $text) : $clean);
}

/**
 * The id a heading gets from its HTML's text: lowercase letters and digits joined by
 * hyphens, accents dropped ("Perché è così" -> "perche-e-cosi"), apostrophes
 * dropped as WordPress does in addresses ("Let's" -> "lets"), at most 80
 * characters, cut between words. "section" when nothing is left.
 *
 * Never starting with a digit: a numbering at the start is dropped ("1. Stop
 * posing" -> "stop-posing"). The theme's "scroll to ID" (Astra) looks the id
 * up as a CSS selector, and "#1-stop-posing" is not one: opening the article
 * at that address made it fail with an error.
 */
function isb_heading_slug($text) {
    $slug = str_replace(array("'", "\u{2019}", "\u{2018}"), '', isb_plain_text($text));
    $slug = strtolower(remove_accents($slug));
    $slug = trim(preg_replace(array('~[^a-z0-9]+~', '~^[0-9-]+~'), array('-', ''), $slug), '-');
    if (strlen($slug) > 80) {
        $cut = substr($slug, 0, 81);
        $space = strrpos($cut, '-');
        $slug = rtrim($space > 20 ? substr($cut, 0, $space) : substr($slug, 0, 80), '-');
    }
    return $slug === '' ? 'section' : $slug;
}

/**
 * The article text's H2 headings, each with an id: its own if it has one,
 * else one from its text, made unique in the page with -2, -3... A heading
 * with no text (only a picture) is skipped. Returns the text with the ids
 * added, and the entries for the contents box (id, plain text), in order.
 */
function isb_heading_ids($text, array $used) {
    $entries = array();
    $text = preg_replace_callback('~<h2\b([^>]*)>(.*?)(</h2\s*>)~is', function ($m) use (&$used, &$entries) {
        $label = isb_plain_text($m[2]);
        if ($label === '') return $m[0];
        $attrs = $m[1];
        if (preg_match('~(?<![\w-])id\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+))~i', $attrs, $found)) {
            $own = trim(html_entity_decode($found[1] . ($found[2] ?? '') . ($found[3] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($own !== '') {
                $entries[] = array('id' => $own, 'text' => $label);
                return $m[0];
            }
            // id="": replaced, not repeated (a second id attribute would be ignored).
            $attrs = str_replace($found[0], '', $attrs);
        }
        $base = isb_heading_slug($m[2]);
        $id = $base;
        for ($n = 2; isset($used[$id]); $n++) $id = $base . '-' . $n;
        $used[$id] = true;
        $entries[] = array('id' => $id, 'text' => $label);
        return '<h2' . rtrim($attrs) . ' id="' . esc_attr($id) . '">' . $m[2] . $m[3];
    }, $text);
    return array($text, $entries);
}

/** The contents box: "In this article", then an arrow and a link for each heading. */
function isb_toc_markup(array $entries, $lang) {
    $label = isb_text('toc', $lang);
    $items = '';
    foreach ($entries as $entry) {
        $items .= '<li><a href="' . esc_url('#' . $entry['id']) . '"><span class="isb-toc-arrow" aria-hidden="true">&rarr;</span>'
            . '<span class="isb-toc-text">' . esc_html($entry['text']) . '</span></a></li>';
    }
    return '<nav class="isb-toc' . (count($entries) >= ISB_TOC_LONG ? ' isb-toc-long' : '') . '" aria-label="' . esc_attr($label) . '">'
        . '<p class="isb-toc-title">' . esc_html($label) . '</p><ul class="isb-toc-list">' . $items . '</ul></nav>';
}

/* --------------------------------------------------------------- the FAQ */

/**
 * The questions shown on the article: those with both a question and an
 * answer (the box keeps a half-written one for later), at most 20.
 */
function isb_faq_items($value) {
    $items = array();
    if (!is_array($value)) return $items;
    foreach ($value as $row) {
        if (!is_array($row) || !isset($row['q'], $row['a']) || !is_string($row['q']) || !is_string($row['a'])) continue;
        $q = trim($row['q']);
        $a = trim($row['a']);
        if ($q === '' || $a === '') continue;
        $items[] = array('q' => $q, 'a' => $a);
        if (count($items) >= ISB_FAQ_MAX) break;
    }
    return $items;
}

/** Where the FAQ goes, after the article's text ending at $from: see isb_add_extras(). */
function isb_faq_position($html, $from) {
    $back = preg_match(isb_tag_pattern('a', 'cps-single-back'), $html, $m, PREG_OFFSET_CAPTURE, $from) ? $m[0][1] : null;
    $related = preg_match(isb_tag_pattern('div', 'cps-related-wrap'), $html, $m, PREG_OFFSET_CAPTURE, $from) ? $m[0][1] : null;
    if ($back !== null && ($related === null || $back < $related)) return $back;
    return $related;
}

/** An answer as written: an empty line starts a paragraph, a line break a new line. */
function isb_faq_answer_html($answer) {
    $html = '';
    foreach (preg_split('~\n[ \t]*\n~', str_replace(array("\r\n", "\r"), "\n", trim($answer))) as $paragraph) {
        $lines = array_filter(array_map('trim', explode("\n", trim($paragraph))), 'strlen');
        if ($lines) $html .= '<p>' . implode('<br>', array_map('esc_html', $lines)) . '</p>';
    }
    return $html;
}

/**
 * The FAQ: "FAQ", then each question as a row that opens to its answer
 * (<details>: no script needed, keyboard and screen readers included), then
 * the same questions as FAQPage data for search engines.
 */
function isb_faq_markup(array $faq, $lang) {
    $icon = '<svg class="isb-faq-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    $html = '<section class="isb-faq" id="isb-faq" aria-labelledby="isb-faq-title"><h2 class="isb-faq-title" id="isb-faq-title">' . esc_html(isb_text('faq', $lang)) . '</h2><div class="isb-faq-list">';
    foreach ($faq as $item) {
        $html .= '<details class="isb-faq-item"><summary class="isb-faq-question"><span class="isb-faq-q">' . esc_html($item['q']) . '</span>' . $icon . '</summary>'
            . '<div class="isb-faq-answer">' . isb_faq_answer_html($item['a']) . '</div></details>';
    }
    $html .= '</div></section>';
    $json = isb_faq_jsonld($faq);
    return $json ? $html . '<script type="application/ld+json">' . $json . '</script>' : $html;
}

/**
 * FAQPage data (schema.org) for the questions. "<", ">", "&" and quotes are
 * written as JSON escapes, so "</script>" in an answer cannot end the block.
 */
function isb_faq_jsonld(array $faq) {
    $questions = array();
    foreach ($faq as $item) {
        $questions[] = array('@type' => 'Question', 'name' => $item['q'], 'acceptedAnswer' => array('@type' => 'Answer', 'text' => $item['a']));
    }
    return wp_json_encode(
        array('@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $questions),
        JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}

/*
 * The look (extras.css), and extras.js: the site's theme (Astra, "scroll to
 * ID") scrolls "#..." links itself, to the very top of the heading - under
 * the fixed header, whatever the CSS says. extras.js keeps the contents links
 * to the browser's own jump.
 */
add_action('wp_enqueue_scripts', function () {
    if (!is_singular(isb_post_type())) return;
    wp_enqueue_style('isb-extras', plugins_url('assets/extras.css', ISB_FILE), array(), ISB_VERSION);
    wp_enqueue_script('isb-extras', plugins_url('assets/extras.js', ISB_FILE), array(), ISB_VERSION, true);
});

/* ---------------------------------------------- the article's edit screen */

add_action('add_meta_boxes', function ($post_type) {
    if ($post_type !== isb_post_type()) return;
    add_meta_box('isb-extras', __('Article extras', 'imagestudio-blog'), 'isb_extras_box', $post_type, 'normal', 'default');
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'post.php' && $hook !== 'post-new.php') return;
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if (!$screen || $screen->post_type !== isb_post_type()) return;
    wp_enqueue_script('isb-extras-admin', plugins_url('assets/extras-admin.js', ISB_FILE), array(), ISB_VERSION, true);
});

/** One question and its answer in the box. $index is "__i__" in the template extras-admin.js copies. */
function isb_faq_row($index, $question, $answer) {
    $i = esc_attr($index);
    return '<div class="isb-faq-row">'
        . '<p><label for="isb-faq-q-' . $i . '">' . esc_html__('Question', 'imagestudio-blog') . '</label>'
        . '<input type="text" class="widefat" id="isb-faq-q-' . $i . '" name="isb_faq[' . $i . '][q]" value="' . esc_attr($question) . '"></p>'
        . '<p><label for="isb-faq-a-' . $i . '">' . esc_html__('Answer', 'imagestudio-blog') . '</label>'
        . '<textarea class="widefat" rows="4" id="isb-faq-a-' . $i . '" name="isb_faq[' . $i . '][a]">' . esc_textarea($answer) . '</textarea></p>'
        . '<p class="isb-faq-row-actions"><button type="button" class="button-link button-link-delete" data-isb-faq-remove>' . esc_html__('Remove', 'imagestudio-blog') . '</button></p>'
        . '</div>';
}

/**
 * The "Article extras" box: hide the contents box on this article, and its
 * FAQ. Plain form fields, saved with the article by the classic editor and by
 * the block editor alike (isb_save_extras). Without JavaScript there is one
 * empty question to fill in; with it, "Add question" and "Remove".
 */
function isb_extras_box($post) {
    $saved = get_post_meta($post->ID, '_isb_faq', true);
    $rows = is_array($saved) ? array_values(array_filter($saved, 'is_array')) : array();
    if (!$rows) $rows[] = array('q' => '', 'a' => '');
    $global = !empty(isb_settings()['show_toc']);
    wp_nonce_field('isb_extras_' . $post->ID, 'isb_extras_nonce');
    ?>
<style>
    #isb-extras .isb-faq-rows { margin-top: 8px; }
    #isb-extras .isb-faq-row { margin: 0 0 12px; padding: 2px 12px; border: 1px solid #dcdcde; border-radius: 4px; background: #f6f7f7; }
    #isb-extras .isb-faq-row p { margin: 8px 0; }
    #isb-extras .isb-faq-row label { display: block; margin-bottom: 4px; font-weight: 600; }
    #isb-extras .isb-faq-row-actions { text-align: right; }
    #isb-extras .isb-extras-faq-title { margin: 20px 0 4px; font-size: 14px; }
</style>
<div class="isb-extras" data-isb-extras>
    <p><label><input type="checkbox" name="isb_hide_toc" value="1" <?php checked(get_post_meta($post->ID, '_isb_hide_toc', true) === '1'); ?>> <?php esc_html_e('Hide "In this article" on this article', 'imagestudio-blog'); ?></label></p>
    <p class="description">
        <?php esc_html_e('"In this article" is the contents box at the top of the article\'s text: a link to each H2 heading, shown when there are at least 3.', 'imagestudio-blog'); ?>
        <?php if (!$global) esc_html_e('It is switched off for all articles in Settings -> Image Studio Blog.', 'imagestudio-blog'); ?>
    </p>
    <h4 class="isb-extras-faq-title"><?php esc_html_e('FAQ (optional)', 'imagestudio-blog'); ?></h4>
    <p class="description"><?php esc_html_e('Questions and answers shown at the end of the article - a reader clicks a question to open its answer - and given to Google as FAQ data. Leave empty for none; up to 20. In an answer, a line break starts a new line and an empty line a new paragraph. A question without an answer (or an answer without a question) is kept here but not shown.', 'imagestudio-blog'); ?></p>
    <div class="isb-faq-rows" data-isb-faq-rows data-max="<?php echo (int) ISB_FAQ_MAX; ?>" data-next="<?php echo count($rows); ?>">
        <?php
        foreach ($rows as $i => $row) {
            echo isb_faq_row($i, is_string($row['q'] ?? null) ? $row['q'] : '', is_string($row['a'] ?? null) ? $row['a'] : '');
        }
        ?>
    </div>
    <template data-isb-faq-template><?php echo isb_faq_row('__i__', '', ''); ?></template>
    <p>
        <button type="button" class="button" data-isb-faq-add><?php esc_html_e('Add question', 'imagestudio-blog'); ?></button>
        <span class="description" data-isb-faq-full hidden><?php esc_html_e('20 questions is the most an article can have.', 'imagestudio-blog'); ?></span>
    </p>
</div>
    <?php
}

/**
 * The box's fields, cleaned for saving: questions as one line of text,
 * answers as text with their line breaks (as "\n"); rows with neither
 * dropped; at most 20.
 */
function isb_clean_faq($rows) {
    $faq = array();
    if (!is_array($rows)) return $faq;
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $q = isset($row['q']) && is_string($row['q']) ? sanitize_text_field($row['q']) : '';
        $a = isset($row['a']) && is_string($row['a']) ? trim(str_replace(array("\r\n", "\r"), "\n", sanitize_textarea_field($row['a']))) : '';
        if ($q === '' && $a === '') continue;
        $faq[] = array('q' => $q, 'a' => $a);
        if (count($faq) >= ISB_FAQ_MAX) break;
    }
    return $faq;
}

/**
 * Saves the box with the article. Only from the box itself (its nonce, made
 * for this article), by someone who may edit the article, and never for an
 * autosave or a revision. The block editor saves the article first without
 * the box's fields - nothing happens then - and then sends the box.
 */
function isb_save_extras($post_id) {
    if (!isset($_POST['isb_extras_nonce']) || !is_string($_POST['isb_extras_nonce'])) return;
    if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['isb_extras_nonce'])), 'isb_extras_' . $post_id)) return;
    if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;
    if (get_post_type($post_id) !== isb_post_type() || !current_user_can('edit_post', $post_id)) return;

    if (!empty($_POST['isb_hide_toc'])) update_post_meta($post_id, '_isb_hide_toc', '1');
    else delete_post_meta($post_id, '_isb_hide_toc');

    $faq = isb_clean_faq(wp_unslash($_POST['isb_faq'] ?? array()));
    // update_post_meta() unslashes what it is given: slashed, so a "\" in an answer stays.
    if ($faq) update_post_meta($post_id, '_isb_faq', wp_slash($faq));
    else delete_post_meta($post_id, '_isb_faq');
}
add_action('save_post', 'isb_save_extras');
