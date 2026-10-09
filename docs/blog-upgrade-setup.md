# Blog upgrade and the free-articles offer: what changed and how to release it

For whoever deploys this work: the client's requests of 8 October 2026 (RepGet blog, Image Studio blog) and the owner's answers of 9 October. Blog editing itself is described in [blog.md](blog.md).

## What changes for readers and customers

**RepGet blog**

- **Team author page** at `/blog/author/repget-team`. The "RepGet team" byline on every article links to it. It lists the team's articles, 30 per page.
- **Closing panel** ("Your website could be growing faster.") on the homepage, `/blog`, category pages, the author page and every article, in all five languages. Its buttons go to the free website check (`/audit`) and to sign-up ("Create 3 Articles for Free").
- **"Get Featured in This Article"**: a button beside the byline opens the offer ($99 one time, per article, subject to editorial approval). The buyer gives an email, a website and what the mention should say, then pays through Stripe Checkout. No refunds are promised.
- **30 articles per page** on the blog, category and author pages, with Newer / page numbers / Older.
- **Search engines** get each page's title, description, canonical address and social tags in the first HTML they download (Googlebot and the bots in Next's own list; people still get the faster streamed page).
- The support address shown on the site defaults to `support@repget.com`.

**New customers: "Create 3 Articles for Free"** (replaces the 3-day free trial)

- They confirm their email with a 6-digit code, choose a plan and add a card. Nothing is charged.
- Their first 3 articles are free: the research that plans them, the writing, the pictures and publishing. Audits, AI visibility, backlink credits and the Partner Network start with the plan.
- The plan starts, and is charged, right after the 3rd article is written, or 30 days after sign-up if they did not use all three. Cancelling before then costs nothing.
- One offer per workspace, ever. At most 100 free articles a day are written across all customers; past that, new ones wait.
- PayPal still starts the plan at once, without the free articles.
- Rules behind this are in `lib/billing/free-articles.ts`. A trial now earns no backlink credits, and the paid month starts with its full allowance. This replaces the 5 October rule that the trial was part of the first month.

## What changes for administrators

- **Admin → Blog editor**, panel "Search and cards":
  - SEO title: becomes the page's `<title>` exactly as typed. Left empty, the title is "Article title | RepGet". The article title stays the only heading on the page.
  - Description, with a length counter.
  - Primary keyword and secondary keywords (up to 30, separated by commas), with checks on where each appears in the article.
  - Breadcrumb label: optional, the article title when empty.
  - Saving only these fields does not mark the article "Updated". Search engines are told the page changed (IndexNow).
- **Admin → Blog → Featured placements** (`/admin/blog/sponsorships`): paid requests first. Add the mention to the article by hand, then mark it published, or decline it. Everyone in `ADMIN_EMAILS` gets an email when a request is paid. A refund, if the owner decides on one, is made in Stripe.
- **Stripe dashboard**: a new customer's subscription shows as "Trialing" with a 30-day trial. It turns active by itself after their 3rd article.

## Release steps

1. **Migrations, before deploying the code.** The new code reads the new columns, so they must exist first. From `platform/`, with production `DIRECT_URL`:

   ```
   npx drizzle-kit migrate
   ```

   - `0051_blog_seo` adds the SEO title, keywords and breadcrumb columns to `blog_posts`.
   - `0052_blog_sponsorships` adds the `blog_sponsorships` table.
   - Both only add things. The code that is live now keeps working with them applied. Production was last confirmed at 0049, so `0050_auth_rate_limits` may be applied in the same run.
2. **Environment.** Nothing new is required. The work uses the existing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` and `ADMIN_EMAILS`. `NEXT_PUBLIC_SUPPORT_EMAIL` is optional; it overrides `support@repget.com`.
3. **Stripe webhook.** "Get Featured" payments use the existing endpoint, `/api/stripe/webhook`. It must send `checkout.session.completed`, which subscriptions already need. Check it in Stripe → Developers → Webhooks.
4. **Recommended Stripe setting:** in Stripe's billing email settings, turn on the reminder email sent before a free trial ends. Customers then hear from Stripe before the 30-day limit charges them.
5. **Inngest.** No new functions. The article job has one new step ("end-free-trial"), which a normal deploy picks up.
6. **Deploy** (push `main`).

## Checks after deploying

- An article's page source (view-source) shows its SEO title, description, canonical address and Open Graph tags in `<head>`.
- The byline links to `/blog/author/repget-team`. `/blog?page=2` exists once there are more than 30 articles.
- "Get Featured in This Article" opens the offer and reaches Stripe Checkout. Close Checkout without paying; a real payment moves real money.
- Sign up with a new address: the plan step asks for the email code. "Start with 3 free articles" opens Stripe Checkout showing a free trial. Do not complete it with a real card unless you mean to; if you do, cancel the subscription in Stripe afterwards.

## Image Studio (WordPress)

Plugin `wordpress-plugin/imagestudio-blog` (version 2.0.0) adds:

- the author page `/author/imagestudio/` (30 per page) and the byline link;
- "Get Featured in This Article", paid with PayPal "Buy Now" to `dimoncic@live.it`. No PayPal API keys are needed.

It also carries the layout fixes the client asked for:

- **Phone menu:** no Shop, in English and Italian, matching the desktop menu.
- **Homepage grid on phones:** the columns stack on their own, so there is no gap under "Bridal Silhouette" and "The Lakeside Vows" is no longer covered.
- **Portfolio posts:** the gallery fills the screen without the footer, CLOSE works on a computer, and the WhatsApp chat button stays.

Install `wordpress-plugin/releases/imagestudio-blog-2.0.0.zip`, made with `node wordpress-plugin/build-imagestudio.mjs`. The install, cache-clearing and check steps are in the plugin's `README.txt`. Do not install the older "RepGet Blog Services" or "Image Studio Layout Fixes" packages; they are replaced.

## Articles in other languages

Not built. The RepGet blog is English-only; the five-language site translates the marketing pages, not blog articles. The recommendation sent to the client:

- Each article gets its own version per language at its own address (for example `/it/blog/...`).
  - The versions are linked with `hreflang`, and each one's canonical points to itself.
  - Each version has its own SEO title, description and keywords, researched for that country rather than translated.
- An editor button creates AI-translated drafts. A native speaker reviews them before publishing; Google treats unreviewed machine translation as low quality.
- Changing the English article marks its translations "needs review"; it never overwrites them.

Building this needs:

- a language and a translation-group column on `blog_posts` (a migration);
- the localized blog routes, sitemap and `hreflang` entries;
- the language switcher pointing at the equivalent article;
- the translate button and the review flag.

## Tests

- The full `vitest` suite, including new tests for the free articles, ending the trial, the email check at checkout, the blog SEO fields and pagination, and Get Featured.
- The billing tests that need separate database connections, run on a disposable Postgres (`TEST_POSTGRES_URL`).
- `npm run plugin:test` (includes `wordpress-plugin/tests/imagestudio-blog.php`), and 34 end-to-end checks of the built zip on a disposable WordPress.
- The layout fixes, measured on the live imagestudio.com pages with the plugin's CSS and JS added in a local browser only (phone and desktop, English and Italian).
- Browser checks on an isolated local copy:
  - the blog pages, the Get Featured panel and the admin list;
  - the plan step's email code and free-articles terms.

No real payment was made, and nothing here has been deployed.
