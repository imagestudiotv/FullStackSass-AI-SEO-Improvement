<?php
/**
 * Image Studio Blog (wordpress-plugin/imagestudio-blog): the parts that need
 * no WordPress - the byline link, where "Get Featured" goes in an article,
 * the PayPal "Buy Now" address and the checks on PayPal's payment notice, who
 * a visitor is for the request limits (trusted proxies only) - and the
 * article extras ("In this article", the FAQ and the box that saves
 * it), with the few WordPress functions they call stubbed below.
 * The article HTML below is imagestudio.com's own "cps" template, as served
 * on 2026-10-09.
 *
 *   php wordpress-plugin/tests/imagestudio-blog.php
 */

define('ABSPATH', __DIR__ . '/');
function esc_url($url) { return htmlspecialchars($url, ENT_QUOTES); }
function esc_attr($text) { return htmlspecialchars($text, ENT_QUOTES); }
function esc_html($text) { return htmlspecialchars($text, ENT_QUOTES); }

/* WordPress, as far as the article extras need it: options, post meta, nonces and capabilities kept in $wp. */
$wp = array('options' => array(), 'meta' => array(), 'lang' => null, 'types' => array(), 'editable' => array(), 'revisions' => array(), 'autosaves' => array());
function add_action() {}
function add_filter() {}
function __($text) { return $text; }
function esc_html__($text) { return esc_html($text); }
function esc_html_e($text) { echo esc_html($text); }
function esc_textarea($text) { return htmlspecialchars($text, ENT_QUOTES); }
function checked($checked, $current = true) { if ((string) $checked === (string) $current) echo " checked='checked'"; }
function wp_nonce_field($action, $name) { echo '<input type="hidden" name="' . $name . '" value="nonce:' . $action . '">'; }
function wp_verify_nonce($nonce, $action) { return $nonce === 'nonce:' . $action ? 1 : false; }
function current_user_can($cap, $id = null) { return $cap === 'edit_post' && in_array($id, $GLOBALS['wp']['editable'], true); }
function wp_is_post_revision($id) { return in_array($id, $GLOBALS['wp']['revisions'], true) ? 1 : false; }
function wp_is_post_autosave($id) { return in_array($id, $GLOBALS['wp']['autosaves'], true) ? 1 : false; }
function get_post_type($id) { return $GLOBALS['wp']['types'][$id] ?? false; }
function get_option($name, $default = false) { return $GLOBALS['wp']['options'][$name] ?? $default; }
function get_post_meta($id, $key, $single = false) { return $GLOBALS['wp']['meta'][$id][$key] ?? ''; }
// Like WordPress's: what it is given is unslashed before it is stored.
function update_post_meta($id, $key, $value) { $GLOBALS['wp']['meta'][$id][$key] = wp_unslash($value); return true; }
function delete_post_meta($id, $key) { unset($GLOBALS['wp']['meta'][$id][$key]); return true; }
function wp_unslash($value) { return is_array($value) ? array_map('wp_unslash', $value) : (is_string($value) ? stripslashes($value) : $value); }
function wp_slash($value) { return is_array($value) ? array_map('wp_slash', $value) : (is_string($value) ? addslashes($value) : $value); }
function sanitize_text_field($text) { return trim(preg_replace('~[\r\n\t ]+~', ' ', strip_tags($text))); }
function sanitize_textarea_field($text) { return trim(strip_tags($text)); }
function wp_parse_args($args, $defaults) { return array_merge($defaults, $args); }
function sanitize_key($key) { return preg_replace('~[^a-z0-9_\-]~', '', strtolower($key)); }
function apply_filters($hook, $value) { return $hook === 'wpml_current_language' ? $GLOBALS['wp']['lang'] : $value; }
function determine_locale() { return 'en_US'; }
function is_email($email) { return (bool) filter_var($email, FILTER_VALIDATE_EMAIL); }
function wp_json_encode($data, $options = 0) { return json_encode($data, $options); }
function remove_accents($text) { return strtr($text, array('à' => 'a', 'á' => 'a', 'è' => 'e', 'é' => 'e', 'ì' => 'i', 'ò' => 'o', 'ó' => 'o', 'ù' => 'u', 'À' => 'A', 'È' => 'E', 'É' => 'E', 'ç' => 'c', 'ñ' => 'n', 'ü' => 'u', 'ö' => 'o', 'ä' => 'a', 'ß' => 'ss')); }

// Request limits (limits.php).
function wp_salt($scheme = 'auth') { return 'test-salt-' . $scheme; }
const HOUR_IN_SECONDS = 3600;
const DAY_IN_SECONDS = 86400;

require __DIR__ . '/../imagestudio-blog/includes/markup.php';
require __DIR__ . '/../imagestudio-blog/includes/settings.php';
require __DIR__ . '/../imagestudio-blog/includes/author.php';
require __DIR__ . '/../imagestudio-blog/includes/limits.php';
require __DIR__ . '/../imagestudio-blog/includes/extras.php';

$failures = 0;
function check($label, $ok) {
    global $failures;
    echo ($ok ? '  ok    ' : '  FAIL  ') . $label . "\n";
    if (!$ok) $failures++;
}

$article = '<html><body class="single single-custom_post"><div class="cps-single-wrap">'
    . '<a href="https://imagestudio.com/editorial/" class="cps-single-back">&larr; Back to Editorial</a>'
    . '<p class="cps-single-category"><a href="https://imagestudio.com/?editorial_category=wedding">WEDDING</a></p>'
    . '<p class="cps-single-byline">Image Studio</p>'
    . '<h1 class="cps-single-title">The Real Cost of a Luxury Wedding in Italy</h1>'
    . '<p class="cps-single-date">August 6, 2026</p><hr class="cps-single-divider" />'
    . '<div class="cps-single-content"><p>Body.</p></div>'
    . '<div class="cps-related-wrap"><a class="cps-related-card"><p class="cps-related-card-byline">Image Studio</p></a></div>'
    . '</div><div id="colophon"></div></body></html>';

echo "The byline\n";
$linked = isb_link_byline($article, 'https://imagestudio.com/author/imagestudio/');
check('becomes a link to the author page', strpos($linked, '<p class="cps-single-byline"><a class="isb-byline-link" href="https://imagestudio.com/author/imagestudio/" rel="author">Image Studio</a></p>') !== false);
check('only the article\'s own byline, not the related cards\'', substr_count($linked, 'isb-byline-link') === 1 && strpos($linked, '<p class="cps-related-card-byline">Image Studio</p>') !== false);
check('a byline that already holds a link is left alone', isb_link_byline($linked, 'https://x.test/') === $linked);
check('a page without a byline (the Italian template) is unchanged', isb_link_byline('<p class="cps-single-date">Agosto 6, 2026</p>', 'https://x.test/') === '<p class="cps-single-date">Agosto 6, 2026</p>');

echo "Get Featured in the article\n";
$trigger = '<button type="button" class="isb-feature-trigger">Get Featured for $99 \\1 $1</button>';
$panel = '<div id="isb-feature-panel">panel</div>';
$placed = isb_place_feature($article, $trigger, $panel);
check('the button goes in the date line, on its right', strpos($placed, '<p class="cps-single-date isb-has-feature"><span class="isb-date-text">August 6, 2026</span>' . $trigger . '</p>') !== false);
check('"$99", "$1" and "\\1" in the copy stay as written', substr_count($placed, 'Get Featured for $99 \\1 $1') === 1);
check('the panel goes just before </body>, once', substr_count($placed, $panel) === 1 && strpos($placed, $panel . '</body>') !== false);
check('the other header lines are untouched (the black band is drawn on each of them)', strpos($placed, '<p class="cps-single-byline">Image Studio</p><h1 class="cps-single-title">') !== false);
$no_date = str_replace('<p class="cps-single-date">August 6, 2026</p>', '', $article);
check('without a date line, the button goes after the title', strpos(isb_place_feature($no_date, $trigger, $panel), '</h1><div class="isb-feature-row">' . $trigger . '</div>') !== false);
check('without either, the page is unchanged', isb_place_feature('<html><body><p>Other page</p></body></html>', $trigger, $panel) === '<html><body><p>Other page</p></body></html>');

echo "The website a buyer types\n";
check('"example.com" means https://example.com', isb_website_address('example.com') === 'https://example.com');
check('a full address is kept', isb_website_address('http://www.example.it/chi-siamo') === 'http://www.example.it/chi-siamo');
foreach (array('javascript:alert(1)', 'localhost', 'ftp://example.com', 'https://user:pass@example.com', '', 'not a site') as $bad) {
    check('refused: "' . $bad . '"', isb_website_address($bad) === null);
}

echo "PayPal Buy Now\n";
$url = isb_paypal_url(array(
    'sandbox' => false, 'email' => 'dimoncic@live.it', 'article_title' => 'The Real Cost of a Luxury Wedding in Italy',
    'request_id' => 123, 'secret' => 'abcdefghijklmnopqrstuvwxyz012345', 'lang' => 'en',
    'return_url' => 'https://imagestudio.com/editorial/post/x/?featured=thanks',
    'cancel_url' => 'https://imagestudio.com/editorial/post/x/?featured=cancelled',
    'notify_url' => 'https://imagestudio.com/wp-json/imagestudio-blog/v1/paypal-ipn',
));
parse_str(parse_url($url, PHP_URL_QUERY), $q);
check('goes to paypal.com, a single "Buy Now" payment', strpos($url, 'https://www.paypal.com/cgi-bin/webscr?') === 0 && $q['cmd'] === '_xclick');
check('pays dimoncic@live.it', $q['business'] === 'dimoncic@live.it');
check('exactly $99.00 USD, quantity 1, nothing to ship', $q['amount'] === '99.00' && $q['currency_code'] === 'USD' && $q['quantity'] === '1' && $q['no_shipping'] === '1');
check('names the article and the request (IS-123)', $q['item_name'] === 'Featured placement: The Real Cost of a Luxury Wedding in Italy' && $q['item_number'] === 'IS-123');
check('carries the request and its secret back', $q['custom'] === '123:abcdefghijklmnopqrstuvwxyz012345');
check('returns to the article, and tells the site about the payment', $q['return'] === 'https://imagestudio.com/editorial/post/x/?featured=thanks' && $q['cancel_return'] === 'https://imagestudio.com/editorial/post/x/?featured=cancelled' && $q['notify_url'] === 'https://imagestudio.com/wp-json/imagestudio-blog/v1/paypal-ipn');
$it = isb_paypal_url(array('sandbox' => true, 'email' => 'dimoncic@live.it', 'article_title' => 'Le ville', 'request_id' => 7, 'secret' => 'abcdefghijklmnop', 'lang' => 'it', 'return_url' => 'r', 'cancel_url' => 'c', 'notify_url' => 'n'));
parse_str(parse_url($it, PHP_URL_QUERY), $qi);
check('test mode goes to the PayPal sandbox; an Italian page gets PayPal in Italian', strpos($it, 'https://www.sandbox.paypal.com/') === 0 && $qi['lc'] === 'IT' && $qi['item_name'] === 'Menzione sponsorizzata: Le ville');

echo "PayPal's payment notice\n";
$expect = array('email' => 'dimoncic@live.it', 'secret' => 'abcdefghijklmnopqrstuvwxyz012345');
$good = array('payment_status' => 'Completed', 'txn_type' => 'web_accept', 'receiver_email' => 'Dimoncic@Live.it', 'business' => 'dimoncic@live.it', 'mc_gross' => '99.00', 'mc_currency' => 'USD', 'txn_id' => '9AB12345CD678901E', 'custom_secret' => 'abcdefghijklmnopqrstuvwxyz012345');
check('a completed $99 USD payment to dimoncic@live.it for this request pays for it', isb_ipn_problem($good, $expect) === null);
foreach (array(
    'not completed' => array('payment_status' => 'Pending'),
    'not a Buy Now payment' => array('txn_type' => 'subscr_payment'),
    'paid to another account' => array('receiver_email' => 'someone@else.com', 'business' => 'someone@else.com'),
    'wrong amount' => array('mc_gross' => '9.90'),
    'wrong currency' => array('mc_currency' => 'EUR'),
    'no transaction id' => array('txn_id' => ''),
    'wrong request secret' => array('custom_secret' => 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'),
) as $reason => $tamper) {
    check('refused: ' . $reason, isb_ipn_problem(array_merge($good, $tamper), $expect) === $reason);
}
check('custom is read back as id and secret', isb_parse_custom('123:abcdefghijklmnop') === array('id' => 123, 'secret' => 'abcdefghijklmnop'));
foreach (array('', '123', 'abc:abcdefghijklmnop', '123:short', '1:' . str_repeat('a', 65), "123:abcdefghijklmnop\n") as $bad) {
    check('custom refused: ' . json_encode($bad), isb_parse_custom($bad) === null);
}

echo "Who a visitor is (limits.php)\n";
check('an address is kept, trimmed', isb_clean_ip(' 203.0.113.5 ') === '203.0.113.5');
check('a port is dropped (IPv4 and bracketed IPv6)', isb_clean_ip('203.0.113.5:8080') === '203.0.113.5' && isb_clean_ip('[2001:db8::1]:443') === '2001:db8::1');
check('IPv6 in canonical form; IPv4-mapped IPv6 becomes IPv4', isb_clean_ip('2001:DB8:0:0::1') === '2001:db8::1' && isb_clean_ip('::ffff:198.51.100.7') === '198.51.100.7');
foreach (array('', 'unknown', '1.2.3', '256.1.1.1', '203.0.113.5, 198.51.100.1', "203.0.113.5\n198.51.100.1", 'localhost') as $bad) {
    check('not an address: ' . json_encode($bad), isb_clean_ip($bad) === null);
}
check('ranges in canonical form', isb_clean_range('173.245.48.0/20') === '173.245.48.0/20' && isb_clean_range('2400:CB00::/32') === '2400:cb00::/32' && isb_clean_range('198.51.100.7') === '198.51.100.7');
foreach (array('0.0.0.0/0', '10.0.0.0/7', '::/0', '2001::/15', '1.2.3.4/33', '2001:db8::/129', 'x/24', '1.2.3.4/', '1.2.3.4/a') as $bad) {
    check('not a range we accept: ' . $bad, isb_clean_range($bad) === null);
}
check('in a range, and just outside it', isb_ip_in_ranges('173.245.63.255', array('173.245.48.0/20')) && !isb_ip_in_ranges('173.245.64.0', array('173.245.48.0/20')) && !isb_ip_in_ranges('173.245.47.255', array('173.245.48.0/20')));
check('IPv6 ranges; IPv4 never matches an IPv6 range', isb_ip_in_ranges('2400:cb00:1::1', array('2400:cb00::/32')) && !isb_ip_in_ranges('2400:cb01::1', array('2400:cb00::/32')) && !isb_ip_in_ranges('203.0.113.5', array('2400:cb00::/32')));
check('a single trusted address', isb_ip_in_ranges('198.51.100.7', array('198.51.100.7')) && !isb_ip_in_ranges('198.51.100.8', array('198.51.100.7')));

$none = array('proxies' => array(), 'header' => '');
$spoof = array('HTTP_CF_CONNECTING_IP' => '198.51.100.1', 'HTTP_X_FORWARDED_FOR' => '198.51.100.2', 'HTTP_X_REAL_IP' => '198.51.100.3');
check('by default the connecting address counts; CF-Connecting-IP, X-Forwarded-For and X-Real-IP are ignored', isb_client_ip(array('REMOTE_ADDR' => '203.0.113.9') + $spoof, $none) === '203.0.113.9');
check('a header chosen but no trusted proxy: still ignored', isb_client_ip(array('REMOTE_ADDR' => '203.0.113.9') + $spoof, array('proxies' => array(), 'header' => 'cf-connecting-ip')) === '203.0.113.9');
check('no usable connecting address: null (one shared "unknown" visitor)', isb_client_ip(array('REMOTE_ADDR' => 'garbage') + $spoof, $none) === null && isb_client_ip($spoof, $none) === null && isb_visitor_identity(null) === 'unknown');

$hashes = array();
for ($i = 0; $i < 50; $i++) {
    $hashes[isb_visitor_hash(array(
        'REMOTE_ADDR' => '203.0.113.9',
        'HTTP_CF_CONNECTING_IP' => '198.51.100.' . $i,
        'HTTP_X_FORWARDED_FOR' => '192.0.2.' . $i . ', 198.18.0.' . $i,
        'HTTP_X_REAL_IP' => '198.51.100.' . (100 + $i),
    ))] = true;
}
check('50 requests, a new spoofed address in every header each time: one visitor', count($hashes) === 1);
$hash = array_keys($hashes)[0];
check('the hash is keyed, and holds no address', strlen($hash) === 32 && strpos($hash, '203') === false && $hash !== substr(hash('sha256', '203.0.113.9'), 0, 32));

$cloudflare = array('proxies' => array('173.245.48.0/20', '2400:cb00::/32'), 'header' => 'cf-connecting-ip');
check('behind Cloudflare: from Cloudflare, its CF-Connecting-IP is the visitor', isb_client_ip(array('REMOTE_ADDR' => '173.245.48.10', 'HTTP_CF_CONNECTING_IP' => '198.51.100.20', 'HTTP_X_FORWARDED_FOR' => '192.0.2.1'), $cloudflare) === '198.51.100.20');
check('behind Cloudflare: straight to the server (not from Cloudflare), CF-Connecting-IP is ignored', isb_client_ip(array('REMOTE_ADDR' => '203.0.113.9', 'HTTP_CF_CONNECTING_IP' => '198.51.100.20'), $cloudflare) === '203.0.113.9');
check('behind Cloudflare: an unreadable or missing CF-Connecting-IP counts as Cloudflare itself (shared, fails closed)', isb_client_ip(array('REMOTE_ADDR' => '173.245.48.10', 'HTTP_CF_CONNECTING_IP' => 'nonsense'), $cloudflare) === '173.245.48.10' && isb_client_ip(array('REMOTE_ADDR' => '2400:cb00:2::9'), $cloudflare) === '2400:cb00:2::9');

$lb = array('proxies' => array('10.0.0.0/8'), 'header' => 'x-forwarded-for');
check('X-Forwarded-For through a trusted proxy: the address it appended, not what the client wrote', isb_client_ip(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '198.51.100.1, 203.0.113.50'), $lb) === '203.0.113.50');
check('X-Forwarded-For through several trusted proxies: the first untrusted from the right', isb_client_ip(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => 'spoofed, 198.51.100.1, 203.0.113.50, 10.0.0.9'), $lb) === '203.0.113.50');
check('X-Forwarded-For with an unreadable nearest hop: the last trusted proxy (fails closed)', isb_client_ip(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '203.0.113.50, garbage'), $lb) === '10.0.0.2');
check('X-Forwarded-For missing: the proxy itself', isb_client_ip(array('REMOTE_ADDR' => '10.0.0.2'), $lb) === '10.0.0.2');
check('X-Forwarded-For of trusted proxies only: the furthest one', isb_client_ip(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '10.0.0.7, 10.0.0.8'), $lb) === '10.0.0.7');
check('X-Forwarded-For from an untrusted address: ignored', isb_client_ip(array('REMOTE_ADDR' => '203.0.113.9', 'HTTP_X_FORWARDED_FOR' => '198.51.100.1'), $lb) === '203.0.113.9');
check('X-Forwarded-For entries with ports', isb_client_ip(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '[2001:db8::5]:1234, 10.0.0.3:80'), $lb) === '2001:db8::5');

// isb_visitor_hash() reads the policy from the settings.
check('the default settings trust no proxy', isb_client_ip_policy() === array('proxies' => array(), 'header' => ''));
$hashes = array();
for ($i = 0; $i < 50; $i++) {
    $hashes[isb_visitor_hash(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '198.51.100.' . $i . ', 192.0.2.' . $i . ', 203.0.113.50', 'HTTP_CF_CONNECTING_IP' => '198.51.100.' . $i))] = true;
}
check('with the default settings, a proxy forwarding 50 spoofed chains is one visitor', count($hashes) === 1);
$wp['options']['isb_settings'] = array('trusted_proxies' => implode("\n", array('10.0.0.0/8', '0.0.0.0/0, not-a-range')), 'client_ip_header' => 'x-forwarded-for');
check('the policy from the settings: only valid, narrow enough ranges', isb_client_ip_policy() === array('proxies' => array('10.0.0.0/8'), 'header' => 'x-forwarded-for'));
$hashes = array();
for ($i = 0; $i < 50; $i++) {
    $hashes[isb_visitor_hash(array('REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '198.51.100.' . $i . ', 192.0.2.' . $i . ', 203.0.113.50'))] = true;
}
check('behind the configured proxy, 50 requests with a new client-written prefix each: one visitor', count($hashes) === 1);
check('...and not the same visitor as the proxy itself', !isset($hashes[isb_visitor_hash(array('REMOTE_ADDR' => '10.0.0.2'))]));
unset($wp['options']['isb_settings']);

check('IPv6 visitors counted per /64', isb_visitor_identity('2001:db8:1:2:aaaa::1') === '2001:db8:1:2::/64' && isb_visitor_identity('2001:db8:1:2:bbbb:cccc:dddd:9') === '2001:db8:1:2::/64' && isb_visitor_identity('2001:db8:1:3::1') === '2001:db8:1:3::/64');
check('IPv4 visitors counted per address', isb_visitor_identity('203.0.113.9') === '203.0.113.9');
$buckets = isb_request_buckets('abc', ' Buyer@Example.COM ');
check('four limits: visitor an hour and a day, email an hour, everyone a day', array_map(function ($b) { return array($b[1], $b[2]); }, $buckets) === array(array(3600, 5), array(86400, 20), array(3600, 5), array(86400, 100)));
check('one visitor bucket for both windows; the email bucket is case-insensitive and holds no address', $buckets[0][0] === 'v:abc' && $buckets[1][0] === 'v:abc' && $buckets[2][0] === isb_request_buckets('x', 'buyer@example.com')[2][0] && strpos($buckets[2][0], 'example') === false && $buckets[3][0] === 'all');
check('every bucket name fits the table (40 characters)', max(array_map(function ($b) { return strlen($b[0]); }, isb_request_buckets(str_repeat('f', 32), 'a@b.co'))) <= 40);

echo "Copy\n";
check('English is the client\'s wording', isb_text('title', 'en') === 'Get Your Website Featured in This Article.' && isb_text('buy', 'en') === 'Get Featured for $99' && isb_text('approval', 'en') === 'Subject to editorial approval');
check('Italian pages get Italian; an unknown language gets English', isb_text('trigger', 'it') === 'Fatti citare in questo articolo' && isb_text('trigger', 'de') === 'Get Featured in This Article');
check('nothing promises a refund', stripos(json_encode(array(isb_text('thanks', 'en'), isb_text('secure', 'en'), isb_text('description', 'en'))), 'refund') === false);
check('the article extras in English and Italian', isb_text('toc', 'en') === 'In this article' && isb_text('faq', 'en') === 'FAQ' && isb_text('toc', 'it') === 'In questo articolo' && isb_text('faq', 'it') === 'Domande frequenti');

/*
 * A whole article page as the "cps" template prints it (2026-10-09): the
 * excerpt's .cps-single-content, then the text's, with the live site's mix of
 * headings - classes, an H2 that already has an id, entities, inline tags, a
 * call to action in its own <div> - then the bottom "Back to Editorial" link
 * and "Read more". The theme's <div id="content"> is around it all.
 */
$excerpt = '<div class="cps-single-content"><p>A luxury wedding in Italy has no single price.</p>' . "\n" . '</div>';
$text = '<div class="cps-single-content"><p><span style="color: #b8833a;"><b>THE ARTICLE</b></span></p>' . "\n"
    . '<h1 class="western">1.A luxury wedding in Italy does not have one reliable price.</h1>' . "\n"
    . '<h2 class="western">Venue access, exclusivity &amp; accommodation</h2>' . "\n" . '<p>Text.</p>' . "\n"
    . '<div class="note"><div><p>Nested.</p></div></div>' . "\n"
    . '<h2 class="western">Food, beverage <em>and</em> service</h2>' . "\n" . '<h3>Wine</h3>' . "\n"
    . '<h2 id="planning-own" class="western">Planning &#8216;the&#8217; day</h2>' . "\n"
    . '<!-- an old <div> left in a comment --><h2 class="western">Perché è così caro?</h2>' . "\n"
    . '<h2>Content</h2>' . "\n"
    . '<h2 class="western">Venue access, exclusivity &amp; accommodation</h2>' . "\n"
    . '<h2 id="">Empty id &lt;b&gt;</h2>' . "\n"
    . '<h2><img src="divider.png" alt=""></h2>' . "\n"
    . '<div style="margin: 50px 0; padding: 65px 25px;"><h2 style="margin: 0 0 20px; font-size: 42px;">Let&#8217;s Create Your Story</h2><p>Enquire.</p></div>' . "\n"
    . '</div>';
$back = '<a href="https://imagestudio.com/editorial/" class="cps-single-back" style="margin-top:40px;display:inline-block;">&larr; Back to Editorial</a>';
$related = '<div class="cps-related-wrap"><h3 class="cps-related-title">READ MORE</h3><div class="cps-related-grid"><a href="https://imagestudio.com/editorial/post/x/" class="cps-related-card"><div class="cps-related-card-info"><p class="cps-related-card-byline">Image Studio</p></div></a></div></div>';
$page = function ($text, $back, $related) use ($excerpt) {
    return '<html><head><style>.cps-single-content { font-size: 18px; } .cps-single-content h2 { font-size: 26px; }</style></head>'
        . '<body class="single single-custom_post"><div id="page"><div id="content" class="site-content"><div class="cps-single-wrap">'
        . '<a href="https://imagestudio.com/editorial/" class="cps-single-back">&larr; Back to Editorial</a>'
        . '<p class="cps-single-byline">Image Studio</p><h1 class="cps-single-title">The Real Cost of a Luxury Wedding in Italy</h1>'
        . '<p class="cps-single-date">August 6, 2026</p><hr class="cps-single-divider" /><div class="cps-single-thumb"><img src="x.jpg" alt="" /></div>'
        . $excerpt . $text . $back . $related . '</div></div></div><footer id="colophon"></footer></body></html>';
};
$live = $page($text, $back, $related);
$toc_only = array('toc' => true, 'faq' => array(), 'lang' => 'en');

echo "Heading ids\n";
check('from the text: lowercase, hyphens, entities and tags gone', isb_heading_slug('Venue access, exclusivity &amp; <em>accommodation</em>') === 'venue-access-exclusivity-accommodation');
check('accents dropped', isb_heading_slug('Perché è così caro?') === 'perche-e-cosi-caro');
check('apostrophes dropped, as in WordPress addresses', isb_heading_slug('Let&#8217;s Create Your Story') === 'lets-create-your-story' && isb_heading_slug("Dell'eleganza") === 'delleleganza');
check('nothing usable left: "section"', isb_heading_slug('&#9733; !!') === 'section' && isb_heading_slug('') === 'section');
check('never starting with a digit (the theme looks ids up as CSS selectors): a numbering at the start is dropped', isb_heading_slug('1. Stop Trying to Perform for the Camera') === 'stop-trying-to-perform-for-the-camera' && isb_heading_slug('10 - 12 guests') === 'guests' && isb_heading_slug('2026') === 'section' && isb_heading_slug('Top 3 venues') === 'top-3-venues');
$long = isb_heading_slug(str_repeat('Wedding photography ', 10));
check('at most 80 characters, cut between words', strlen($long) <= 80 && substr($long, -1) !== '-' && preg_match('~(^|-)(wedding|photography)$~', $long) === 1);
list($ids_text, $entries) = isb_heading_ids($text, isb_page_ids($live));
$ids = array_column($entries, 'id');
check('each H2 with text gets an id, in order; one without text is skipped', $ids === array('venue-access-exclusivity-accommodation', 'food-beverage-and-service', 'planning-own', 'perche-e-cosi-caro', 'content-2', 'venue-access-exclusivity-accommodation-2', 'empty-id-b', 'lets-create-your-story'));
check('an id the heading already has is kept, and not repeated', strpos($ids_text, '<h2 id="planning-own" class="western">Planning') !== false && substr_count($ids_text, 'id="planning-own"') === 1);
check('a second heading with the same text gets -2', strpos($ids_text, '<h2 class="western" id="venue-access-exclusivity-accommodation-2">') !== false);
check('an id the page already uses (the theme\'s #content) is not reused', strpos($ids_text, '<h2 id="content-2">Content</h2>') !== false);
check('an empty id="" is replaced, not doubled', strpos($ids_text, '<h2 id="empty-id-b">Empty id &lt;b&gt;</h2>') !== false);
check('every H2 has at most one id', preg_match_all('~<h2\b[^>]*\bid=[^>]*\bid=~', $ids_text) === 0);
check('H1, H3 and the rest of the text are untouched', strpos($ids_text, '<h1 class="western">1.A luxury') !== false && strpos($ids_text, '<h3>Wine</h3>') !== false && strpos($ids_text, '<div class="note"><div><p>Nested.</p></div></div>') !== false);
check('the same page gives the same ids every time', isb_heading_ids($text, isb_page_ids($live)) === array($ids_text, $entries));

echo "In this article\n";
$with_toc = isb_add_extras($live, $toc_only);
$toc_at = strpos($with_toc, '<nav class="isb-toc"');
check('the box opens the article\'s text (the last .cps-single-content), not the excerpt', $toc_at !== false && strpos($with_toc, '</div><div class="cps-single-content"><nav class="isb-toc" aria-label="In this article"><p class="isb-toc-title">In this article</p>') !== false && strpos($with_toc, $excerpt . '<div class="cps-single-content"><nav') !== false);
check('one box, one link per heading, each to its id, in order', substr_count($with_toc, '<nav class="isb-toc') === 1 && preg_match_all('~<li><a href="#([^"]+)">~', $with_toc, $links) === 8 && $links[1] === $ids);
check('an arrow before each link', substr_count($with_toc, '<span class="isb-toc-arrow" aria-hidden="true">&rarr;</span><span class="isb-toc-text">') === 8);
check('link text: tags gone, entities decoded and written once ("&amp;", not "&amp;amp;")', strpos($with_toc, '<span class="isb-toc-text">Venue access, exclusivity &amp; accommodation</span>') !== false && strpos($with_toc, '<span class="isb-toc-text">Food, beverage and service</span>') !== false && strpos($with_toc, '&amp;amp;') === false);
check('curly quotes and accents come through as text', strpos($with_toc, "<span class=\"isb-toc-text\">Planning \u{2018}the\u{2019} day</span>") !== false && strpos($with_toc, '<span class="isb-toc-text">Perché è così caro?</span>') !== false && strpos($with_toc, "Let\u{2019}s Create Your Story</span>") !== false);
check('"<b>" written as text in a heading stays text', strpos($with_toc, '<span class="isb-toc-text">Empty id &lt;b&gt;</span>') !== false);
check('the headings carry their ids in the page', strpos($with_toc, substr($ids_text, strlen('<div class="cps-single-content">'))) !== false);
check('everything outside the article\'s text is unchanged', str_replace(isb_toc_markup($entries, 'en') . substr($ids_text, strlen('<div class="cps-single-content">')), substr($text, strlen('<div class="cps-single-content">')), $with_toc) === $live);
check('ten headings or more: two columns', strpos(isb_toc_markup(array_fill(0, 10, array('id' => 'a', 'text' => 'A')), 'en'), '<nav class="isb-toc isb-toc-long"') === 0 && strpos(isb_toc_markup(array_fill(0, 9, array('id' => 'a', 'text' => 'A')), 'en'), '<nav class="isb-toc"') === 0);
$two = $page('<div class="cps-single-content"><h2>One</h2><p>a</p><h2>Two</h2></div>', $back, $related);
$three = $page('<div class="cps-single-content"><h2>One</h2><p>a</p><h2>Two</h2><h2>Three</h2></div>', $back, $related);
check('two H2s: no box, page unchanged', isb_add_extras($two, $toc_only) === $two);
check('three H2s: a box with three links', substr_count(isb_add_extras($three, $toc_only), '<li><a href="#') === 3);
check('H2s only in the excerpt do not count', isb_add_extras($page('<div class="cps-single-content"><p>No headings.</p></div>', $back, $related), $toc_only) === $page('<div class="cps-single-content"><p>No headings.</p></div>', $back, $related));
check('switched off: page unchanged', isb_add_extras($live, array('toc' => false, 'faq' => array(), 'lang' => 'en')) === $live);
check('Italian: "In questo articolo"', strpos(isb_add_extras($live, array('toc' => true, 'faq' => array(), 'lang' => 'it')), '<nav class="isb-toc" aria-label="In questo articolo"><p class="isb-toc-title">In questo articolo</p>') !== false);
$one_question = array('toc' => true, 'faq' => array(array('q' => 'Q', 'a' => 'A')), 'lang' => 'en');
$once = isb_add_extras($live, $one_question);
check('added once, even if the page is filtered twice', isb_add_extras($with_toc, $toc_only) === $with_toc && isb_add_extras($once, $one_question) === $once);
check('a page without .cps-single-content is unchanged', isb_add_extras('<html><body><h2>A</h2><h2>B</h2><h2>C</h2></body></html>', $toc_only) === '<html><body><h2>A</h2><h2>B</h2><h2>C</h2></body></html>');
check('not "cps-single-content-more"', isb_add_extras('<div class="cps-single-content-more"><h2>A</h2><h2>B</h2><h2>C</h2></div>', $toc_only) === '<div class="cps-single-content-more"><h2>A</h2><h2>B</h2><h2>C</h2></div>');
check('an unclosed text block: unchanged', isb_add_extras('<div class="cps-single-content"><h2>A</h2><h2>B</h2><h2>C</h2>', $toc_only) === '<div class="cps-single-content"><h2>A</h2><h2>B</h2><h2>C</h2>');

echo "FAQ\n";
$faq = array(
    array('q' => 'How far ahead should we book?', 'a' => "Twelve months.\nEighteen for June.\n\nAsk us <b>first</b> & early."),
    array('q' => 'Is "travel" included? It\'s <the> question', 'a' => 'Yes. </script><script>alert(1)</script> "quoted" \'single\''),
    array('q' => 'Half written', 'a' => ''),
);
$with_faq = isb_add_extras($live, array('toc' => false, 'faq' => $faq, 'lang' => 'en'));
$section_at = strpos($with_faq, '<section class="isb-faq"');
check('the FAQ goes after the article\'s text, before the bottom "Back to Editorial"', $section_at !== false && strpos($with_faq, substr($text, -40) . '<section class="isb-faq" id="isb-faq" aria-labelledby="isb-faq-title"><h2 class="isb-faq-title" id="isb-faq-title">FAQ</h2>') !== false && preg_match('~</section><script type="application/ld\+json">[^<]*</script>' . preg_quote($back, '~') . '~', $with_faq) === 1);
check('the top "Back to Editorial" link is not the one', strpos($with_faq, '<div class="cps-single-wrap"><a href="https://imagestudio.com/editorial/" class="cps-single-back">&larr; Back to Editorial</a><p class="cps-single-byline">') !== false);
check('each question a <details> row, its answer inside; a half-written one not shown', substr_count($with_faq, '<details class="isb-faq-item"><summary class="isb-faq-question"><span class="isb-faq-q">') === 2 && strpos($with_faq, 'Half written') === false);
check('the answer\'s paragraphs and lines, as written, as text', strpos($with_faq, '<div class="isb-faq-answer"><p>Twelve months.<br>Eighteen for June.</p><p>Ask us &lt;b&gt;first&lt;/b&gt; &amp; early.</p></div>') !== false);
check('questions are text too', strpos($with_faq, '<span class="isb-faq-q">Is &quot;travel&quot; included? It&#039;s &lt;the&gt; question</span>') !== false);
check('a chevron on the right, hidden from screen readers', substr_count($with_faq, '</span><svg class="isb-faq-icon" aria-hidden="true"') === 2);
check('"</script>" in an answer cannot end anything', substr_count($with_faq, '</script>') === 1 && substr_count($with_faq, '<script') === 1);
preg_match('~<script type="application/ld\+json">(.*?)</script>~s', $with_faq, $ld);
$data = json_decode($ld[1], true);
check('FAQPage data: the two questions and answers, word for word', $data['@context'] === 'https://schema.org' && $data['@type'] === 'FAQPage' && count($data['mainEntity']) === 2
    && $data['mainEntity'][1] === array('@type' => 'Question', 'name' => $faq[1]['q'], 'acceptedAnswer' => array('@type' => 'Answer', 'text' => $faq[1]['a'])));
check('in the data, < > & and quotes are JSON escapes', strpos($ld[1], '\u003C/script\u003E') !== false && strpos($ld[1], '\u0022quoted\u0022') !== false && strpos($ld[1], '\u0027single\u0027') !== false && strpos($ld[1], '\u0026 early') !== false && strpbrk($ld[1], "<>'&") === false);
$no_back = isb_add_extras($page($text, '', $related), array('toc' => false, 'faq' => $faq, 'lang' => 'en'));
check('no bottom link: before "Read more"', strpos($no_back, '</script><div class="cps-related-wrap">') !== false && strpos($no_back, substr($text, -40) . '<section class="isb-faq"') !== false);
check('neither: no FAQ, page unchanged', isb_add_extras($page($text, '', ''), array('toc' => false, 'faq' => $faq, 'lang' => 'en')) === $page($text, '', ''));
check('a "Back to Editorial" after "Read more" is not used', strpos(isb_add_extras($page($text, '', $related . $back), array('toc' => false, 'faq' => $faq, 'lang' => 'en')), '</script><div class="cps-related-wrap">') !== false);
check('no question with an answer: no FAQ', isb_add_extras($live, array('toc' => false, 'faq' => array(array('q' => 'Only a question', 'a' => ' ')), 'lang' => 'en')) === $live);
check('Italian: "Domande frequenti"', strpos(isb_add_extras($live, array('toc' => false, 'faq' => $faq, 'lang' => 'it')), '<h2 class="isb-faq-title" id="isb-faq-title">Domande frequenti</h2>') !== false);
$both = isb_add_extras($live, array('toc' => true, 'faq' => $faq, 'lang' => 'en'));
check('with the box too: the FAQ heading is not in the box, the box still opens the text', substr_count($both, '<li><a href="#') === 8 && strpos($both, 'href="#isb-faq') === false && strpos($both, $excerpt . '<div class="cps-single-content"><nav class="isb-toc"') !== false && strpos($both, '</div><section class="isb-faq"') !== false);
check('at most 20 questions shown', count(isb_faq_items(array_fill(0, 25, array('q' => 'Q', 'a' => 'A')))) === 20);
check('stored rows of the wrong shape are skipped', isb_faq_items(array('x', array('q' => array('a'), 'a' => 'b'), array('q' => 'Q'), array('q' => ' Q ', 'a' => ' A '))) === array(array('q' => 'Q', 'a' => 'A')) && isb_faq_items('') === array());

echo "From the settings and the article\n";
$wp['types'][42] = 'custom_post';
$article42 = (object) array('ID' => 42);
$wp['meta'][42] = array('_isb_faq' => $faq);
$extras = isb_article_extras($article42);
check('by default: the box on, the article\'s FAQ, English', $extras['toc'] === true && count($extras['faq']) === 2 && $extras['lang'] === 'en');
$filtered = isb_filter_article($live, 'https://imagestudio.com/author/imagestudio/', null, $extras);
check('the article filter adds the byline link, the box and the FAQ', strpos($filtered, 'isb-byline-link') !== false && strpos($filtered, '<nav class="isb-toc"') !== false && strpos($filtered, '<section class="isb-faq"') !== false);
check('called without extras (as before 2.1.0): only the byline link', isb_filter_article($live, 'https://x.test/', null) === isb_link_byline($live, 'https://x.test/'));
$wp['meta'][42]['_isb_hide_toc'] = '1';
$extras = isb_article_extras($article42);
check('hidden on this article: no box, the FAQ still there', $extras['toc'] === false && strpos(isb_filter_article($live, 'https://x.test/', null, $extras), '<nav class="isb-toc"') === false && strpos(isb_filter_article($live, 'https://x.test/', null, $extras), '<section class="isb-faq"') !== false);
unset($wp['meta'][42]['_isb_hide_toc']);
$wp['options']['isb_settings'] = array('show_toc' => false);
check('switched off in the settings: no box', isb_article_extras($article42)['toc'] === false);
$wp['options']['isb_settings'] = array('paypal_email' => 'dimoncic@live.it');
check('settings saved before 2.1.0 (no show_toc yet): the box is on', isb_article_extras($article42)['toc'] === true);
$wp['lang'] = 'it';
check('an Italian page (WPML): Italian', isb_article_extras($article42)['lang'] === 'it');
$wp['lang'] = null;

echo "The Article extras box\n";
$wp['meta'][42] = array('_isb_hide_toc' => '1', '_isb_faq' => array(array('q' => '"Quoted" <q>', 'a' => "Line & </textarea>\nnext")));
ob_start();
isb_extras_box($article42);
$box = ob_get_clean();
check('carries a nonce made for this article', strpos($box, 'name="isb_extras_nonce" value="nonce:isb_extras_42"') !== false);
check('"Hide" is ticked when the article hides the box', preg_match('~<input type="checkbox" name="isb_hide_toc" value="1"\s+checked=\'checked\'>~', $box) === 1);
check('saved questions and answers come back escaped', strpos($box, 'name="isb_faq[0][q]" value="&quot;Quoted&quot; &lt;q&gt;"') !== false && strpos($box, 'name="isb_faq[0][a]">Line &amp; &lt;/textarea&gt;' . "\n" . 'next</textarea>') !== false);
check('a template row for "Add question", numbered on from the saved rows', strpos($box, '<template data-isb-faq-template><div class="isb-faq-row"><p><label for="isb-faq-q-__i__">') !== false && strpos($box, 'data-max="20" data-next="1"') !== false);
$wp['meta'][43] = array();
ob_start();
isb_extras_box((object) array('ID' => 43));
$empty_box = ob_get_clean();
check('an article without a FAQ: one empty question to fill in, "Hide" not ticked', substr_count($empty_box, 'name="isb_faq[0][q]" value=""') === 1 && strpos($empty_box, 'name="isb_faq[1]') === false && strpos($empty_box, "checked='checked'") === false);

echo "Saving the box\n";
$wp['meta'][42] = array();
$wp['editable'] = array(42);
$rows = array(
    array('q' => "  <b>How far</b>\n ahead?  ", 'a' => "Line one\r\nLine <i>two</i>\r\n\r\nC:\\Studio\\Photos"),
    array('q' => '', 'a' => ''),
    array('q' => '   ', 'a' => "\n"),
    array('q' => 'Only a question', 'a' => ''),
    'not a row',
    array('q' => array('nested'), 'a' => 'Answer to a question that is not text'),
);
for ($i = 0; $i < 25; $i++) $rows[] = array('q' => "Question $i", 'a' => "Answer $i");
// WordPress adds slashes to everything posted.
$posted = wp_slash(array('isb_extras_nonce' => 'nonce:isb_extras_42', 'isb_hide_toc' => '1', 'isb_faq' => $rows));
$save = function ($id, array $post) {
    $_POST = $post;
    isb_save_extras($id);
    return $GLOBALS['wp']['meta'][$id] ?? array();
};
$saved = $save(42, $posted);
check('"Hide" saved as "1"', ($saved['_isb_hide_toc'] ?? null) === '1');
check('a question as one line of text, tags gone', $saved['_isb_faq'][0]['q'] === 'How far ahead?');
check('an answer keeps its line breaks (as \n) and its backslashes, tags gone', $saved['_isb_faq'][0]['a'] === "Line one\nLine two\n\nC:\\Studio\\Photos");
check('empty rows dropped; a half-written one kept for later', $saved['_isb_faq'][1] === array('q' => 'Only a question', 'a' => '') && $saved['_isb_faq'][2] === array('q' => '', 'a' => 'Answer to a question that is not text'));
check('at most 20 rows', count($saved['_isb_faq']) === 20 && $saved['_isb_faq'][19] === array('q' => 'Question 16', 'a' => 'Answer 16'));
$wp['meta'][42] = array('_isb_faq' => array(array('q' => 'Kept', 'a' => 'Kept')));
$before = $wp['meta'][42];
check('no nonce (the block editor\'s own save, a quick edit, an import): nothing changes', $save(42, wp_slash(array('isb_hide_toc' => '1', 'isb_faq' => array()))) === $before);
check('a nonce made for another article: nothing changes', $save(42, array_merge($posted, array('isb_extras_nonce' => 'nonce:isb_extras_7'))) === $before);
$wp['editable'] = array();
check('someone who may not edit the article: nothing changes', $save(42, $posted) === $before);
$wp['editable'] = array(42, 50, 51, 52);
$wp['revisions'] = array(50);
$wp['autosaves'] = array(51);
$wp['types'] += array(50 => 'custom_post', 51 => 'custom_post', 52 => 'page');
foreach (array(50 => 'a revision', 51 => 'an autosave', 52 => 'another post type') as $id => $what) {
    $wp['meta'][$id] = array();
    check("$what: nothing saved", $save($id, array_merge($posted, array('isb_extras_nonce' => 'nonce:isb_extras_' . $id))) === array());
}
$cleared = $save(42, wp_slash(array('isb_extras_nonce' => 'nonce:isb_extras_42', 'isb_faq' => array(array('q' => ' ', 'a' => '')))));
check('"Hide" unticked and every question removed: both cleared', $cleared === array());
$wp['meta'][42] = $before;
define('DOING_AUTOSAVE', true);
check('during an autosave: nothing changes', $save(42, $posted) === $before);
$_POST = array();

echo $failures ? "\n$failures FAILED\n" : "\nALL PASSED\n";
exit($failures ? 1 : 0);
