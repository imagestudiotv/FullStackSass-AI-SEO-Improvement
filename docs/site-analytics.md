# Site analytics (RepGet's own Google Analytics)

RepGet counts visits to its own website two ways:

- **Vercel Web Analytics**: every page except `/admin` and `/api`, no cookies, no banner. Always on (`components/site-analytics.tsx`).
- **Google Analytics 4**: public pages and sign-in/sign-up only, and only for visitors who press **Accept** on the cookie banner. Read back on the admin page **Site analytics** (`/admin/analytics`).

This document is about the second one. It is not the customers' own Google connection (Search Console and Analytics per website), which is documented with the integrations.

## How it works

| Part | Where | What it does |
|---|---|---|
| Cookie banner | `components/consent-banner.tsx`, mounted in the marketing shell and the auth layout | Asks once and remembers the answer for 6 months in the `repget_consent` cookie. Accept and Decline carry equal weight. "Cookie settings" in the footer, and on the privacy page, opens it again. |
| Tag | `lib/google-analytics.ts` | Google Consent Mode v2: every signal denied before anything else, then the visitor's answer. Loads `gtag.js` only after Accept (or, in advanced consent mode, cookieless before an answer). On a later visit it loads once the page is idle. It sends our own `page_view` with a **cleaned** address: no query string, no fragment, invite codes and record IDs replaced (`lib/site-analytics.ts`, the same rules as Vercel). Another site's referrer is cut to its origin. Google signals and ad personalisation are off. GA cookies last 13 months. |
| Where it counts | the banner component's lifetime | Leaving the public pages (into the signed-in app or admin) unmounts the banner and silences GA with Google's `ga-disable-<ID>` flag. Signed-in page titles name customers' articles, so they are never sent. |
| Decline / withdraw | the banner | Silences GA and deletes `_ga` and `_ga_<ID>`. |
| Admin page | `lib/admin/ga4.ts`, `lib/admin/site-traffic.ts`, `app/admin/analytics` | Reads the property through the GA4 Data API as a read-only service account. Nothing is stored in the database. |
| CSP | `lib/security-headers.ts` | `*.googletagmanager.com` (script), plus `*.google-analytics.com` and `*.analytics.google.com` (connect). Google Ads' hosts only when `NEXT_PUBLIC_GTM_ID` is set. |
| Conversions | `lib/conversions/conversions.ts`, `components/conversion-events.tsx` | Sign-up, start of the free articles, first real payment. See "Google Ads" below. |

Expect lower figures than Vercel's: only visitors who accept are counted, and only on public pages.

## Owner setup

### 1. Create the property

In [Google Analytics](https://analytics.google.com/), go to Admin > Create > Property.

- **Reporting time zone**: the one you think in (the admin page uses the property's time zone for its days). **Currency**: EUR.
- Add a **Web** data stream for `https://www.repget.com`.
- Copy the stream's **Measurement ID** (`G-...`).
- Copy the **Property ID** (a number) from Admin > Property settings > Property details.

### 2. Settings that MUST be changed in Google Analytics

Code cannot enforce these, and the privacy policy relies on them.

1. **Turn off history-based page views.** Go to Admin > Data streams > the web stream > Enhanced measurement (gear icon) > Page views > Show advanced settings, and untick **"Page changes based on browser history events"**. Left on, GA sends its own page view with the raw address, query string included, on every in-site navigation.
2. **Turn off "Site search" and "Form interactions"** on the same screen. Site search reads query parameters out of the address. Form interactions adds noise and is not used. Scrolls, outbound clicks and file downloads can stay.
3. **Data retention**: under Admin > Data collection and modification > Data retention, set event data to **14 months**. The policy promises at most 14.
4. **Google signals**: leave **off** (Admin > Data collection). The tag also turns it off.
5. **Data processing terms**: under Admin > Account settings, accept the **data processing terms**. The policy says Google processes the data "for us under its data processing terms".
6. **Data sharing settings**: under Admin > Account settings, untick sharing with Google products and services and modelling contributions. Technical support can stay.
7. Recommended (defence in depth): under Admin > Data streams > the web stream > **Redact data**, keep email redaction on. Under query parameters, add `request, email, token, subscription_id, code, state`. The tag never sends a query string, so this only matters if the setting in item 1 is ever turned back on.

### 3. Read access for the admin page

1. In [Google Cloud](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com), in the project that holds RepGet's Google sign-in, **enable the Google Analytics Data API**.
2. Go to [IAM & Admin > Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) > Create service account. A name like `repget-analytics` works; it needs no roles. Then open it > Keys > Add key > Create new key > **JSON**. Keep the file private.
3. In Google Analytics, go to Admin > Property access management > + > Add users. Enter the service account's `...@...iam.gserviceaccount.com` address, choose role **Viewer**, and untick "Notify".

### 4. Vercel environment variables (Production), then redeploy

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | `G-...` from step 1. Production only: preview deployments must not send to the real property. |
| `GA4_PROPERTY_ID` | the property number from step 1 |
| `GA4_SERVICE_ACCOUNT_KEY` | the whole content of the JSON key file (or that file base64-encoded) |

`NEXT_PUBLIC_` values are baked in at build time, and server values are read by the running deployment, so **redeploy** after setting them. `npm run doctor` checks all three.

### 5. Check it

1. Open https://www.repget.com in a private window. The banner appears bottom left (along the bottom on a phone).
2. Press **Accept**, then open GA > Reports > Realtime: you appear within a minute.
3. In DevTools > Network, filter for `collect`. Each hit's `dl` parameter is the address **without** a query string. Visit `/sign-in?email=a@b.c` and confirm that `dl` is `https://www.repget.com/sign-in`.
4. Sign in and open the dashboard. No more `collect` requests appear.
5. Footer > Cookie settings > Decline. The `_ga` cookies are gone and no more hits are sent.
6. Open `/admin/analytics`. "Right now" counts you at once; full days appear after 24-48 hours.

## Google Ads: Consent Mode v2, Tag Manager and conversions

Added 2026-10-10 for the client's request to measure sign-ups, free trials and paid subscriptions before spending on Google Ads.

### What the site does

- **Consent Mode v2.** Before any Google tag runs, all four signals (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`) are set to `denied`. **Accept** grants all four; **Decline** denies all four, silences GA and deletes the `_ga*` and `_gcl_*` cookies. The banner now names Google Ads, so its answer has a new version: everyone who answered before is asked once more.
- **Consent mode setting** (`NEXT_PUBLIC_CONSENT_MODE`):
  - `basic` (the default): nothing is loaded from Google before Accept.
  - `advanced`: the tags also load, without cookies, while a visitor has not answered, so Google receives cookieless pings and models the visits it cannot count. A visitor who declines is silenced completely in both modes.
- **Campaign tags are kept.** Page addresses still lose their query string, except `utm_*`, `gclid`, `gbraid`, `wbraid`, `gad_source`, `gad_campaignid` and `dclid`. Without them GA could not credit a visit to an ad.
- **Conversions.** Only for visitors who accepted:

| Event | When | Sent by | Details |
|---|---|---|---|
| `sign_up` | The first signed-in page in the hour after an account is created | the browser | `method`: `email` or `google` |
| `start_trial` | The first signed-in page in the hour after a checkout with free articles completes | the browser | `plan` |
| `purchase` | A subscription's **first** payment for money, by Stripe or PayPal: at once for a checkout paid at once, otherwise when the free articles end (all three written, or after 30 days) | the server (GA4 Measurement Protocol) | `value`, `currency`, `transaction_id`, `items` (the plan), `payment_type` |

Renewals are not reported as new conversions. The browser remembers which conversions it has sent, so a reload does not count one twice. Signed-in pages send them with the title "RepGet" and a cleaned address, then silence GA again.

`purchase` comes from the server because, for most customers, the money arrives after they have left the site: when their third free article is written, or after 30 days. When they start paying, the checkout keeps their GA identity (the `_ga` cookie's client id, nothing else), and only if they had accepted.

- **Tag Manager** (optional, `NEXT_PUBLIC_GTM_ID`). The container is loaded **beside** GA, never instead of it. It receives the consent signals and `sign_up` / `start_trial` as dataLayer events with a `transaction_id`. `purchase` is not in the dataLayer, because it happens on the server.

### Owner setup (in this order)

1. **Database**: apply migration `0053_checkout_analytics` (one new empty column).
2. **GA4 Measurement Protocol secret**: in GA, go to Admin > Data streams > the web stream > Measurement Protocol API secrets > Create. Give it a nickname such as "RepGet server" and copy the **Secret value**.
3. **Vercel** (Production), then redeploy:
   - `GA4_API_SECRET`: the secret from step 2.
   - `NEXT_PUBLIC_CONSENT_MODE`: `advanced` only if the client wants modelled data from undecided visitors; otherwise leave it unset (basic).
   - `NEXT_PUBLIC_GTM_ID`: only if a Tag Manager container is wanted (step 7).
4. **Key events in GA**: go to Admin > Data display > Key events > New key event. Add `sign_up`, `start_trial` and `purchase`, spelled exactly like that.
5. **Link Google Ads to GA**: in GA, go to Admin > Product links > Google Ads links > Link, and choose the Ads account. In Google Ads, keep **auto-tagging** on (Admin > Account settings).
6. **Import the conversions into Google Ads**: go to Goals > Conversions > Summary > + New conversion action > Import > Google Analytics 4 properties > Web. Tick `purchase`, `start_trial` and `sign_up`. Make `purchase` (and, if wanted, `start_trial`) **Primary**, and `sign_up` **Secondary**, so bidding aims at paying customers.
7. **Tag Manager (optional)**: create a Web container for `www.repget.com` and put its `GTM-...` id in Vercel (step 3).
   - Add a **Conversion Linker** tag on All Pages.
   - Add one **Google Ads Conversion Tracking** tag per conversion. Use the Conversion ID and Label from Google Ads, a **Custom Event** trigger named `sign_up` or `start_trial`, and a **Data Layer Variable** `transaction_id` as the Transaction ID.
   - **Never add a Google tag or GA4 tag** for `G-...`: GA is already sent by the site, so it would count everything twice, with raw addresses.
   - Publish the container.
   - Without Tag Manager, step 6 alone is enough.

### Test end to end before any ad spend

1. In a private window, open `https://www.repget.com/?utm_source=test&utm_medium=cpc&utm_campaign=setup-test` and press **Accept**.
2. In GA, go to Reports > Realtime. You appear, with source `test`.
3. Sign up with a new email address and finish the first onboarding screen. Within a minute, Realtime > "Event count by Event name" shows `sign_up`.
4. Choose a plan with free articles and complete the Stripe page (nothing is charged). On the next screen, Realtime shows `start_trial`.
5. To test `purchase`, either let the test account's three free articles be written (the plan then starts and is charged), or buy a plan with a workspace that has had one before (it gets no free articles, so it pays at once). Then refund it from Admin > Payments. Within a few minutes of the charge, Realtime shows `purchase` with the amount.
6. Footer > Cookie settings > Decline. The `_ga` and `_gcl_` cookies disappear, and no more `collect` requests are sent.
7. With Tag Manager: use its **Preview** button (Tag Assistant) on www.repget.com and repeat steps 3-4. The Ads conversion tags fire on `sign_up` and `start_trial`.
8. In Google Ads, the imported conversions show "Recording conversions" within 24-48 hours.
