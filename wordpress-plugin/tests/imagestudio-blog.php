<?php
/**
 * Image Studio Blog (wordpress-plugin/imagestudio-blog): the parts that need
 * no WordPress - the byline link, where "Get Featured" goes in an article,
 * the PayPal "Buy Now" address and the checks on PayPal's payment notice.
 * The article HTML below is imagestudio.com's own "cps" template, as served
 * on 2026-10-09.
 *
 *   php wordpress-plugin/tests/imagestudio-blog.php
 */

define('ABSPATH', __DIR__ . '/');
function esc_url($url) { return htmlspecialchars($url, ENT_QUOTES); }
function esc_attr($text) { return htmlspecialchars($text, ENT_QUOTES); }
function esc_html($text) { return htmlspecialchars($text, ENT_QUOTES); }

require __DIR__ . '/../imagestudio-blog/includes/markup.php';

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

echo "Copy\n";
check('English is the client\'s wording', isb_text('title', 'en') === 'Get Your Website Featured in This Article.' && isb_text('buy', 'en') === 'Get Featured for $99' && isb_text('approval', 'en') === 'Subject to editorial approval');
check('Italian pages get Italian; an unknown language gets English', isb_text('trigger', 'it') === 'Fatti citare in questo articolo' && isb_text('trigger', 'de') === 'Get Featured in This Article');
check('nothing promises a refund', stripos(json_encode(array(isb_text('thanks', 'en'), isb_text('secure', 'en'), isb_text('description', 'en'))), 'refund') === false);

echo $failures ? "\n$failures FAILED\n" : "\nALL PASSED\n";
exit($failures ? 1 : 0);
