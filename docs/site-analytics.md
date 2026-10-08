# Site analytics (RepGet's own Google Analytics)

RepGet counts visits to its own website two ways:

- **Vercel Web Analytics**: every page except `/admin` and `/api`, no cookies, no banner. Always on (`components/site-analytics.tsx`).
- **Google Analytics 4**: public pages and sign-in/sign-up only, and only for visitors who press **Accept** on the cookie banner. Read back on the admin page **Site analytics** (`/admin/analytics`).

This document is about the second one. It is not the customers' own Google connection (Search Console and Analytics per website), which is documented with the integrations.

## How it works

| Part | Where | What it does |
|---|---|---|
| Cookie banner | `components/consent-banner.tsx`, mounted in the marketing shell and the auth layout | Asks once and remembers the answer for 6 months in the `repget_consent` cookie. Accept and Decline carry equal weight. "Cookie settings" in the footer, and on the privacy page, opens it again. |
| Tag | `lib/google-analytics.ts` | Loads `gtag.js` only after Accept. On a later visit it loads once the page is idle. It sends our own `page_view` with a **cleaned** address: no query string, no fragment, invite codes and record IDs replaced (`lib/site-analytics.ts`, the same rules as Vercel). Another site's referrer is cut to its origin. Google signals and ad personalisation are off. GA cookies last 13 months. |
| Where it counts | the banner component's lifetime | Leaving the public pages (into the signed-in app or admin) unmounts the banner and silences GA with Google's `ga-disable-<ID>` flag. Signed-in page titles name customers' articles, so they are never sent. |
| Decline / withdraw | the banner | Silences GA and deletes `_ga` and `_ga_<ID>`. |
| Admin page | `lib/admin/ga4.ts`, `lib/admin/site-traffic.ts`, `app/admin/analytics` | Reads the property through the GA4 Data API as a read-only service account. Nothing is stored in the database. |
| CSP | `lib/security-headers.ts` | `*.googletagmanager.com` (script), plus `*.google-analytics.com` and `*.analytics.google.com` (connect). |

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
