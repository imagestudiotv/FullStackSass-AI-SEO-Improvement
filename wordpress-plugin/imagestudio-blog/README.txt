=== Image Studio Blog ===
Version: 2.3.0
Requires WordPress 6.4+, PHP 7.4+. Built for imagestudio.com (Astra child theme, WPML, Rank Math).

What it does
------------
1. Author page. WordPress's own author page for the editorial articles' author,
   https://imagestudio.com/author/imagestudio/ (and /it/author/imagestudio/),
   lists the Editorial articles - 30 per page, with Newer / page numbers / Older -
   in the Editorial page's style, instead of the theme's generic list of
   portfolio posts. It is made indexable (Rank Math keeps author pages out of
   search results by default on this site).
2. Clickable byline. "IMAGE STUDIO" above each English article's title links to
   that page. (The Italian article template shows no author name.)
3. "Get Featured in This Article". A button in each article's date line opens
   the offer (client design: €99, one-time, no subscription, per article
   placement, subject to editorial approval). The reader gives an email, a
   website and what the mention should say, then pays €99 through a PayPal
   "Buy Now" page to the PayPal email in the settings (dimoncic@live.it). No
   PayPal developer account or API keys are needed. Italian pages get Italian
   copy and PayPal in Italian.
4. Layout fixes (layout.css, layout.js):
   - The phone menu no longer lists Shop, in English or Italian, so it
     matches the desktop menu.
   - Homepage portfolio grid on phones: the two columns now stack on their
     own, so there is no gap under "Bridal Silhouette" and "The Lakeside
     Vows" is no longer hidden under the next picture. Desktop is unchanged.
   - Portfolio posts (for example /villa-il-lago-dei-cigni-wedding-rome/):
     the gallery fills the screen with no footer below it, the photos fit,
     "The story" scrolls on its own and CLOSE works on a computer, and the
     WhatsApp chat button stays. Other pages keep their footer.
   - Editorial articles (2.0.1): the footer is the homepage's - the small
     copyright line at the bottom, Services and Studio side by side, no
     second copyright line. (The articles also print the theme's own footer
     first, which confused the footer's script.)
   - "Next project" at the end of a portfolio post (2.0.1) stays in the
     page's language. The newest post of each language linked to a post in
     the other language (English villa post -> Italian Victoria & Matteo).
5. "In this article" (2.1.0, as on RepGet's blog). At the top of each
   article's text, between the excerpt and the article, a box lists the
   article's H2 headings as links, an arrow before each. A click jumps to
   that heading, which stops below the site's fixed header (the theme's own
   scrolling, which would leave it under the header, is kept off these
   links - assets/extras.js). It is made on its
   own whenever an article has at least 3 H2 headings - nothing to write.
   Each of those headings gets an id for its link, from its text ("Food,
   beverage and service" -> #food-beverage-and-service; a numbering at the
   start is left out: "1. Stop posing" -> #stop-posing); an id a heading
   already has is kept. Italian pages say "In questo articolo". A long list
   shows in two columns on a computer, one on a phone.
   - Off for every article: Settings -> Image Studio Blog -> Article extras
     -> untick "Show 'In this article' on articles".
   - Off for one article: edit the article -> "Article extras" box -> tick
     "Hide 'In this article' on this article" -> Update.
6. FAQ (2.1.0, optional, as on RepGet's blog). Questions and answers at the
   end of an article, after its text and before "Back to Editorial". Each
   question is a bordered row; a click opens its answer, another click
   closes it. Google also gets them as FAQ data (FAQPage). Italian pages
   head it "Domande frequenti". An article with no questions shows nothing.
   To add questions: edit the article and scroll to the "Article extras"
   box (below the text in the block editor, below the editor in the classic
   one). Fill in Question and Answer; "Add question" adds another (20 at
   most), "Remove" takes one away; then Update. In an answer, a line break
   starts a new line and an empty line a new paragraph. Answers are shown
   as plain text (no links or bold). A question without an answer, or an
   answer without a question, is kept in the box but not shown.
   Some articles already have questions written into their text (a
   "Frequently Asked Questions" heading with the questions as headings). If
   they are moved into the box, delete them from the text, or the article
   shows them twice.
   WPML: the FAQ is translated with the article (wpml-config.xml) - in
   WPML's Translation Editor each question and answer is offered for
   translation. An Italian article edited in WordPress itself has its own
   "Article extras" box. "Hide 'In this article'" is copied from the English
   article to its Italian translation.

After a payment
---------------
- PayPal emails the PayPal account owner, as for any payment. The item name says
  which article, and the reference IS-<number> matches the request in WordPress.
- PayPal also notifies the site (IPN). The site asks PayPal to confirm the
  notice is genuine and checks it: completed, to the configured PayPal email,
  exactly that request's price (99.00 EUR; a request made before 2.3.0:
  99.00 USD), for that request. The request is then marked
  "Paid - to review" and the site administrator (Settings -> General ->
  Administration Email Address) gets an email.
- In WordPress: Featured placements (left menu). Paid requests are listed
  first. Add the sponsored mention and link to the article by hand, then
  "Mark as published" - or "Decline" and reply to the buyer. "Mark as paid"
  is for a payment found in PayPal whose notice did not arrive.
- Requests are limited: 5 an hour and 20 a day per visitor, 5 an hour per
  email, 100 a day in all (see "Request limits" below).

Install
-------
1. Plugins -> Add Plugin -> Upload Plugin -> imagestudio-blog-2.3.0.zip -> Install Now ->
   Activate. When updating an installed copy, click "Replace current with uploaded".
   (If the earlier "Image Studio Layout Fixes" or "RepGet Blog Services" plugin is
   installed, deactivate and delete it first.)
2. Settings -> Image Studio Blog: check the PayPal email (dimoncic@live.it) and that
   "Show on articles" is ticked. Optional: an author bio in English and Italian.
3. Settings -> Permalinks -> Save (refreshes the addresses once).
4. Clear the Kinsta cache (MyKinsta -> Tools -> Clear cache) and the Cloudflare cache,
   so cached articles get the new byline link and button.
5. Check one article on a computer and a phone: the byline link, the button, the
   panel, "Continue to PayPal" reaching PayPal's page (no need to pay).
6. On a phone: open the menu (no Shop) and scroll the homepage grid past
   "Bridal Silhouette". Open a portfolio post on a phone and a computer:
   swipe or scroll the photos, open and close "The story", and check the
   WhatsApp button is there.
7. Open an article with at least 3 H2 headings: "In this article" is above
   its text; click a link. Add a question or two to one article (its
   "Article extras" box), Update, clear the caches again, and open it: the
   FAQ is at the end; click a question.
8. (2.2.0) Settings -> Image Studio Blog -> "Visitor address header": the line
   under it says which address this page was requested from. Open the page
   from a computer and from a phone on mobile data (not the same Wi-Fi):
   - each shows that device's own public address: nothing to do;
   - both show an address of the site's proxy (behind Cloudflare: an address
     from https://www.cloudflare.com/ips/): paste those published ranges into
     "Trusted proxies", choose CF-Connecting-IP, Save, and check again - the
     "counted as visitor" address must now be each device's own.
   Never add a range ordinary visitors can connect from.

9. (2.3.0) Open an article's "Get Featured" panel in English and in
   Italian: the price reads "€99" and "99 €", and "Continue to PayPal" opens
   PayPal's page for 99.00 EUR (no need to pay).

Price and currency (2.3.0)
--------------------------
Since 2.3.0 the price is 99.00 euros (client, 2026-10-16), shown as "€99" in
English and "99 €" in Italian. Each request remembers the price it was
offered at, and its payment must match it: a request made before 2.3.0 was
offered at 99.00 US dollars and is still paid by a 99.00 USD payment. The
PayPal account must accept euros (an Italian PayPal account does). The price
is ISB_PRICE / ISB_CURRENCY in includes/markup.php.

Testing a payment without real money: tick "PayPal test mode" and use a PayPal
sandbox buyer account; untick it afterwards.

Settings
--------
Settings -> Image Studio Blog: PayPal email, show/hide the button, PayPal test
mode, trusted proxies and the visitor address header (request limits), author
bio (English/Italian), which post type the articles are (Editorial,
custom_post), and "Show 'In this article' on articles" (Article extras).

Request limits (2.2.0)
----------------------
"Continue to PayPal" is limited to 5 requests an hour and 20 a day per
visitor, 5 an hour per email address, and 100 a day for everyone together.
Over a limit, the reader is asked to try again later.
- Who a visitor is: the address that connects to the server. Headers such
  as CF-Connecting-IP and X-Forwarded-For can be written by anyone, so they
  are read only when the request comes from one of the "Trusted proxies" in
  the settings, and only the header chosen there. (Before 2.2.0 they were
  believed from anyone, so a script could get new limits with every
  request.) IPv6 visitors are counted per /64 network.
- Each request is checked against the limits and recorded in one step (a
  database transaction), so requests sent at the same moment cannot all
  slip under a limit. Before 2.2.0, 12 requests sent together all got
  through a limit of 5.
- The limits are kept in two small tables, <prefix>isb_request_log and
  <prefix>isb_request_lock. They are created on activation, or by the first
  request after updating. They must be InnoDB tables (the usual kind); if
  they cannot be, requests are refused and the settings page says so.
- A request counts as soon as it is made, whether or not it is paid, and
  deleting it does not give the slot back. The counts start afresh after
  updating to 2.2.0.
- Developers: the limits can be changed with the isb_request_limits filter,
  and the proxy policy with isb_client_ip_policy.

Each article's edit screen: the "Article extras" box - hide "In this article"
on that article, and its FAQ.
