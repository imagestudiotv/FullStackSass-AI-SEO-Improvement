=== Image Studio Blog ===
Version: 2.0.0
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
   the offer (client design: $99, one-time, no subscription, per article
   placement, subject to editorial approval). The reader gives an email, a
   website and what the mention should say, then pays $99 through a PayPal
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

After a payment
---------------
- PayPal emails the PayPal account owner, as for any payment. The item name says
  which article, and the reference IS-<number> matches the request in WordPress.
- PayPal also notifies the site (IPN). The site asks PayPal to confirm the
  notice is genuine and checks it: completed, to the configured PayPal email,
  exactly 99.00 USD, for that request. The request is then marked
  "Paid - to review" and the site administrator (Settings -> General ->
  Administration Email Address) gets an email.
- In WordPress: Featured placements (left menu). Paid requests are listed
  first. Add the sponsored mention and link to the article by hand, then
  "Mark as published" - or "Decline" and reply to the buyer. "Mark as paid"
  is for a payment found in PayPal whose notice did not arrive.
- Requests are limited: 5 an hour and 20 a day per visitor, 5 an hour per
  email, 100 a day in all.

Install
-------
1. Plugins -> Add New -> Upload Plugin -> imagestudio-blog-2.0.0.zip -> Install -> Activate.
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

Testing a payment without real money: tick "PayPal test mode" and use a PayPal
sandbox buyer account; untick it afterwards.

Settings
--------
Settings -> Image Studio Blog: PayPal email, show/hide the button, PayPal test
mode, author bio (English/Italian), and which post type the articles are
(Editorial, custom_post).
