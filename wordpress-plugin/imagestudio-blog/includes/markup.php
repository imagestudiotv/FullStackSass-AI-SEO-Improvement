<?php
/**
 * The plugin's pure parts: copy in English and Italian, the changes made to
 * an article's HTML, the PayPal "Buy Now" address and the checks on PayPal's
 * payment notice. No database, no hooks - tests/imagestudio-blog.php runs
 * them on their own.
 */

defined('ABSPATH') || exit;

/** The price: one time, in US dollars (client, 2026-10-08). */
const ISB_PRICE = '99.00';
const ISB_CURRENCY = 'USD';

/**
 * Copy, in the page's language. Image Studio is English and Italian (WPML);
 * the Italian speaks to the reader as "tu", like the site's own Italian pages.
 */
function isb_text($key, $lang = 'en') {
    static $copy = array(
        'en' => array(
            'trigger' => 'Get Featured in This Article',
            'eyebrow' => 'Sponsored feature opportunity',
            'title' => 'Get Your Website Featured in This Article.',
            'description' => 'Reach readers already interested in this topic. Showcase your business with a relevant sponsored mention and website link inside this article.',
            'one_time' => 'One-time payment',
            'no_subscription' => 'No subscription',
            'per_article' => 'Per article placement',
            'buy' => 'Get Featured for $99',
            'approval' => 'Subject to editorial approval',
            'details' => 'Tell us what to feature',
            'back' => 'Back',
            'email' => 'Your email',
            'website' => 'Your website',
            'website_hint' => 'yourwebsite.com',
            'message' => 'What should the mention say about your business?',
            'message_hint' => 'A sentence or two: what you offer, and who it is for.',
            'continue' => 'Continue to PayPal - $99',
            'opening' => 'Opening PayPal…',
            'secure' => 'Secure payment by PayPal. Subject to editorial approval.',
            'close' => 'Close',
            'thanks' => 'Thank you. Once PayPal confirms your payment, we will review your request and write to you at the email you gave.',
            'cancelled' => 'Payment cancelled - you were not charged. You can start again whenever you like.',
            'error_fields' => 'Enter your email, your website and what you would like mentioned.',
            'error_website' => 'Enter your website\'s address, for example yourwebsite.com.',
            'error_busy' => 'Too many requests in a short time. Please try again later.',
            'error_unavailable' => 'Online payment is not available right now. Please contact us about a placement.',
            'author' => 'Author',
            'articles_one' => '%d article',
            'articles_many' => '%d articles',
            'bio' => 'Articles, guides and real stories from the Image Studio team.',
            'back_editorial' => 'Back to Editorial',
            'read_more' => 'Read more',
            'newer' => 'Newer',
            'older' => 'Older',
            'pages' => 'Article pages',
            'page_of' => 'Page %1$d of %2$d',
            'none' => 'No articles yet.',
        ),
        'it' => array(
            'trigger' => 'Fatti citare in questo articolo',
            'eyebrow' => 'Opportunità di menzione sponsorizzata',
            'title' => 'Fai comparire il tuo sito in questo articolo.',
            'description' => 'Raggiungi lettori già interessati a questo argomento. Presenta la tua attività con una menzione sponsorizzata pertinente e un link al tuo sito all\'interno di questo articolo.',
            'one_time' => 'Pagamento unico',
            'no_subscription' => 'Nessun abbonamento',
            'per_article' => 'Per singolo articolo',
            'buy' => 'Fatti citare per $99',
            'approval' => 'Soggetto ad approvazione editoriale',
            'details' => 'Dicci cosa presentare',
            'back' => 'Indietro',
            'email' => 'La tua email',
            'website' => 'Il tuo sito web',
            'website_hint' => 'iltuosito.it',
            'message' => 'Cosa deve dire la menzione sulla tua attività?',
            'message_hint' => 'Una o due frasi: cosa offri e a chi.',
            'continue' => 'Continua su PayPal - $99',
            'opening' => 'Apertura di PayPal…',
            'secure' => 'Pagamento sicuro con PayPal. Soggetto ad approvazione editoriale.',
            'close' => 'Chiudi',
            'thanks' => 'Grazie. Quando PayPal avrà confermato il pagamento, esamineremo la tua richiesta e ti scriveremo all\'email indicata.',
            'cancelled' => 'Pagamento annullato: non ti è stato addebitato nulla. Puoi ricominciare quando vuoi.',
            'error_fields' => 'Inserisci la tua email, il tuo sito web e cosa vorresti citato.',
            'error_website' => 'Inserisci l\'indirizzo del tuo sito, per esempio iltuosito.it.',
            'error_busy' => 'Troppe richieste in poco tempo. Riprova più tardi.',
            'error_unavailable' => 'Il pagamento online non è disponibile in questo momento. Contattaci per una menzione.',
            'author' => 'Autore',
            'articles_one' => '%d articolo',
            'articles_many' => '%d articoli',
            'bio' => 'Articoli, guide e storie vere dal team di Image Studio.',
            'back_editorial' => 'Torna a Editoriale',
            'read_more' => 'Leggi di più',
            'newer' => 'Più recenti',
            'older' => 'Meno recenti',
            'pages' => 'Pagine degli articoli',
            'page_of' => 'Pagina %1$d di %2$d',
            'none' => 'Ancora nessun articolo.',
        ),
    );
    $lang = isset($copy[$lang]) ? $lang : 'en';
    return isset($copy[$lang][$key]) ? $copy[$lang][$key] : $copy['en'][$key];
}

/**
 * The article's byline - the template's <p class="cps-single-byline">Image
 * Studio</p> - as a link to the author page (client: "author name inside
 * articles clickable, leading to the author page"). Only the first one, and
 * only plain text: a byline that already holds a link is left alone.
 */
function isb_link_byline($html, $author_url) {
    return preg_replace_callback(
        '~(<p\b[^>]*\bclass="[^"]*\bcps-single-byline\b[^"]*"[^>]*>)([^<]+)(</p>)~',
        function ($m) use ($author_url) {
            return $m[1] . '<a class="isb-byline-link" href="' . esc_url($author_url) . '" rel="author">' . $m[2] . '</a>' . $m[3];
        },
        $html,
        1
    );
}

/**
 * Puts the "Get Featured" button in the article's date line - on its right,
 * as in the client's design, where the author row would be - and the panel
 * it opens just before </body>.
 *
 * Inside the date's own <p>, not in a new wrapper: the site's header add-on
 * paints the black band behind the title by styling each of those lines
 * (.cps-single-wrap > .cps-single-date ...), so a wrapper would break the
 * band. A <button> is allowed in a <p>; the panel, a <div>, is not, hence
 * the end of the page. Without a date line (a changed template) the button
 * goes after the title instead; without either, the HTML is unchanged.
 */
function isb_place_feature($html, $trigger, $panel) {
    $count = 0;
    $html = preg_replace_callback(
        '~(<p\b[^>]*\bclass="[^"]*\bcps-single-date\b)([^"]*"[^>]*>)([^<]*)(</p>)~',
        function ($m) use ($trigger) {
            return $m[1] . ' isb-has-feature' . $m[2] . '<span class="isb-date-text">' . $m[3] . '</span>' . $trigger . $m[4];
        },
        $html,
        1,
        $count
    );
    if (!$count) {
        $html = preg_replace_callback(
            '~<h1\b[^>]*\bclass="[^"]*\bcps-single-title\b[^"]*"[^>]*>.*?</h1>~s',
            function ($m) use ($trigger) {
                return $m[0] . '<div class="isb-feature-row">' . $trigger . '</div>';
            },
            $html,
            1,
            $count
        );
    }
    if (!$count) return $html;
    $at = strripos($html, '</body>');
    return $at === false ? $html . $panel : substr($html, 0, $at) . $panel . substr($html, $at);
}

/**
 * The website a buyer typed, as a full address. People type "example.com" as
 * often as "https://example.com", so a missing scheme means https; anything
 * that is not a public web address is refused (null).
 */
function isb_website_address($value) {
    $value = trim((string) $value);
    if ($value === '' || strlen($value) > 2000) return null;
    if (!preg_match('~^[a-z][a-z0-9+.-]*://~i', $value)) $value = 'https://' . $value;
    $parts = parse_url($value);
    if (!$parts || empty($parts['host']) || !in_array(strtolower($parts['scheme'] ?? ''), array('http', 'https'), true)) return null;
    if (strpos($parts['host'], '.') === false || isset($parts['user']) || isset($parts['pass'])) return null;
    return $value;
}

/**
 * A PayPal "Buy Now" address (PayPal Payments Standard): $99 to the
 * configured PayPal email, for this request. Needs no API keys - PayPal
 * takes the payment into the account that email belongs to.
 *
 * custom carries the request's id and a secret, which PayPal sends back in
 * its payment notice, so a notice can be matched to its request and nobody
 * can confirm a request they did not pay for.
 */
function isb_paypal_url(array $args) {
    $host = !empty($args['sandbox']) ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
    $title = function_exists('mb_substr') ? mb_substr($args['article_title'], 0, 100) : substr($args['article_title'], 0, 100);
    return $host . '/cgi-bin/webscr?' . http_build_query(array(
        'cmd' => '_xclick',
        'business' => $args['email'],
        'item_name' => ($args['lang'] === 'it' ? 'Menzione sponsorizzata: ' : 'Featured placement: ') . $title,
        'item_number' => 'IS-' . $args['request_id'],
        'amount' => ISB_PRICE,
        'currency_code' => ISB_CURRENCY,
        'quantity' => 1,
        'no_shipping' => 1,
        'no_note' => 1,
        'charset' => 'utf-8',
        'lc' => $args['lang'] === 'it' ? 'IT' : 'US',
        'custom' => $args['request_id'] . ':' . $args['secret'],
        'return' => $args['return_url'],
        'cancel_return' => $args['cancel_url'],
        'notify_url' => $args['notify_url'],
        'rm' => 1,
    ), '', '&', PHP_QUERY_RFC3986);
}

/**
 * What is wrong with a payment notice (PayPal IPN) for a request, or null
 * when it pays for it: completed, a single "Buy Now" payment, to the
 * configured PayPal email, exactly $99 in US dollars, and carrying the
 * request's own secret. PayPal's VERIFIED answer is checked separately, by
 * the caller.
 */
function isb_ipn_problem(array $ipn, array $expect) {
    $receiver = strtolower(trim($ipn['receiver_email'] ?? ($ipn['business'] ?? '')));
    $business = strtolower(trim($ipn['business'] ?? $receiver));
    $email = strtolower(trim($expect['email']));
    if (($ipn['payment_status'] ?? '') !== 'Completed') return 'not completed';
    if (($ipn['txn_type'] ?? '') !== 'web_accept') return 'not a Buy Now payment';
    if ($receiver !== $email && $business !== $email) return 'paid to another account';
    if (($ipn['mc_gross'] ?? '') !== ISB_PRICE) return 'wrong amount';
    if (strtoupper($ipn['mc_currency'] ?? '') !== ISB_CURRENCY) return 'wrong currency';
    if (empty($ipn['txn_id'])) return 'no transaction id';
    if (!hash_equals((string) $expect['secret'], (string) ($ipn['custom_secret'] ?? ''))) return 'wrong request secret';
    return null;
}

/** custom = "<request id>:<secret>", as isb_paypal_url() sends it; null when malformed. */
function isb_parse_custom($custom) {
    if (!preg_match('~\A(\d{1,12}):([A-Za-z0-9]{16,64})\z~', (string) $custom, $m)) return null;
    return array('id' => (int) $m[1], 'secret' => $m[2]);
}
