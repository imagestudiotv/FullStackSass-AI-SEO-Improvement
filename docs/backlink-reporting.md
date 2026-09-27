# Backlink and dashboard reporting

Every backlink figure in the product comes from **one reporting layer**, `src/lib/reporting/backlinks.ts`. That covers the dashboard, the Backlinks Overview, Earned Backlinks, Hosted links and Credit activity, so a number means the same thing wherever it appears.

The layer covers **RepGet-managed network placements only**. Backlinks that a provider discovers elsewhere on the web are not mixed in, so nothing overlaps or double-counts.

## Routes

| Route | What it shows |
|---|---|
| `/websites/[id]/backlinks` | Overview: authority, portfolio, credits, Partner Network settings, the latest links in each direction |
| `/websites/[id]/backlinks/links` | **Earned Backlinks**: links this website *received* ("See all backlinks") |
| `/websites/[id]/backlinks/hosted` | Hosted links: partners' links this website carries, which earn its credits |
| `/websites/[id]/backlinks/credits` | Credit activity: the workspace ledger |
| `/dashboard` | The redesigned overview (authority, today's article, wins, best articles, achievements, search) |
| `/admin/network/operations` | Freeze, managed-review switch, authority collection, valuation policy |

Filters, sort, page and page size live in the URL (`?tab=&type=&q=&from=&to=&issue=&sort=&dir=&page=&size=`). Direct links, refresh, back/forward and website switching all work. Changing a filter returns to page 1.

## Definitions

**Direction.** *Received* means placements whose **request** belongs to the website (`backlink_requests.website_id`). *Given* (hosted) means placements where it is the host (`placements.host_website_id`). The old dashboard counted host placements as the site's own backlinks; that was the wrong direction.

**Lifecycle.** How each placement status is shown:

| Placement status | Shown as | Tab |
|---|---|---|
| pending, drafted | Awaiting publication | Pending |
| published | Awaiting verification | Pending |
| live | Verified | Verified |
| unverified | Not found, not charged | All; `?issue=not_found` |
| removed | Removed, refunded | Refunded, when a refund entry exists |
| cancelled | Withdrawn, no charge | All |
| anything else | Unknown state | All |

**Refunded** means a `refund` ledger entry exists for the placement. A withdrawn draft released its reservation and was never charged; it is **not** refunded.

**Credits** (the credits column on a row):

- *Received links:* reserved while awaiting, spent when verified, refunded when removed after verification, and no charge when never found or withdrawn.
- *Hosted links:* "+N once verified" while awaiting, earned when verified, reversed when removed.
- Credits belong to the **workspace**, shared by all its websites. Balances and ledger rows are shown only to workspace members, never to a guest invited to one website.

**Dates.** All dates come from recorded events, never from `updated_at`, and are shown in UTC:

- *First verified:* `placements.live_at`. Older rows fall back to the first "alive" link check, then the settlement ledger entry. If none exists, the date is **unknown**: it is never guessed, and such links are counted as "undated" and left off charts.
- *Published:* `placements.published_at`, else when the carrying article first went live (`articles.first_live_at`). A delivery the CMS kept as a draft is not publication. If neither is known, the date is unknown.
- *Removed:* `placements.removed_at`, else the refund entry.
- *The listed date:* each row shows its latest step (verified, removed, published or placed), labelled. The date filter applies to that same date.

**Windows.** One range (7, 30, 90 or 365 UTC days, ending today) drives everything on a card or page. Comparisons use the equal window before it, and no change is shown when that earlier window is incomplete. "7-day wins" is always the last 7 UTC days. Search Console and Analytics freshness (the latest day received) is shown beside their figures.

**History.** Two series, from events:

- *Active* counts links verified live at the end of each day. It **falls** when links are removed.
- *Cumulative* counts first verifications and never falls.

**Articles published** counts articles that first went **live** in the window: `articles.first_live_at`, set by the first delivery the CMS actually stored as `publish` (the direct connection reads the status WordPress returns; plugin 1.6.0+ reports `get_post_status()`). A draft delivered today and published next week counts next week, when RepGet delivers it live. Edits, repeated or late acknowledgements and republishing are not new publications.

*Historical articles.* Before migration 0045, a publish log meant "delivered", not "live". The migration sets `first_live_at` only where that is unambiguous (the article is published and has exactly one delivery on record). Other published articles have an **unknown** first-live date: they are not counted in any window, and the dashboard says how many there are. A post a customer publishes by hand in WordPress after a draft delivery is not seen by RepGet until it is delivered again.

**Article traffic** is **page-scoped**: Search Console clicks and impressions for the pages RepGet published. Google Analytics sessions on those pages are a separate measure and are never added to clicks. Site-wide Google totals are labelled "whole site".

*Page identity* (`src/lib/reporting/page-key.ts`, and its SQL twin `repget_page_key` from migration 0045, tested against each other) is conservative:

- ignored: the scheme, a leading `www.`, host case, a default port, a trailing slash, the `#fragment`, tracking parameters (`utm_*`, `gclid`, `gbraid`, `wbraid`, `dclid`, `fbclid`, `msclkid`, `yclid`, `igshid`, `mc_cid`, `mc_eid`, `_ga`, `_gl`) and the order of the remaining parameters;
- kept: **path case** and **every other query parameter**, so WordPress plain permalinks (`/?p=101`, `/?p=202`) and language variants (`?lang=fr`, `?lang=en`) are different pages;
- Google Analytics reports a path only; it is resolved against the website's own domain.

Each page is counted **once**, however many article rows point at it (it belongs to the article that went live first). No canonical or redirect mapping is stored in RepGet, so none is applied: a page reached under two genuinely different URLs is two pages.

*Totals* (headline, cards, chart) are computed over **every** page. The details list shows the top 200 pages by clicks and says so when there are more; the totals above it do not depend on it.

**Verification banner.** It counts distinct **articles** of this website where a partner's link was not found after repeated confirmed checks. Temporary errors and unpublished articles never count. "Review & resolve" opens the filtered view. Dismissing the banner is a per-browser preference keyed by an issue fingerprint: new issues bring it back, and no verification or credit state changes.

## Authority: DataForSEO Rank

`src/lib/authority/*` handles authority.

- **Source.** The DataForSEO **Backlinks API**, `POST /v3/backlinks/bulk_ranks/live` with `rank_scale: "one_hundred"`. It returns DataForSEO's own 0-100 rank, based on referring domains.
- **Label.** It is always shown as "DataForSEO Rank" with its scale. It is never labelled as another provider's metric, and never confused with the website-health audit score, which is shown separately.
- **Storage.** `domain_metrics` stores the domain, provider, metric, native scale, value, observation time, status and last error.
- **States.** A missing value is never a zero. Each state is shown as such:

  | State | Meaning |
  |---|---|
  | collecting | Not measured yet |
  | no_data | The provider has nothing for the domain |
  | no_access | DataForSEO answered 40204 (no Backlinks API access) for the configured account. Shown only when that answer was actually received. |
  | error | Temporary; retried |
  | not_configured | No credentials on this deployment |
  | stale | Older than 30 days (the value is still shown) |

- **Collection.** It runs only in the background (`collect-authority` Inngest function), daily or on an admin request.
  - It tracks only Partner Network websites with a live subscription, plus the sites linking to them, each domain once. Up to 200 domains go in one request.
  - Each request takes a spend reservation first (key `authority:dataforseo`), capped per day by `AUTHORITY_DAILY_REQUESTS`: unset or blank = **4**; `0` = collection disabled; a whole number = that limit; anything else (negative, fractional, `1e3`, `0x10`, text) = **invalid, collection disabled** (nothing is spent) and the operations page shows the setting as invalid. An earlier version read an unset value as 0 and so never collected; that is fixed and covered by tests that do not stub the setting.
  - A provable refusal returns the reservation.
  - Failures back off. An account without access is asked again only weekly.
  - **Page views, filters and pagination only read `domain_metrics`**; they never call the provider.
- **External prerequisite.** The Backlinks API is a separate DataForSEO product from the keyword APIs. Whether the configured account has access has **not** been observed from this environment: the 40204 behaviour is covered by a recorded-shape fixture, not by a call to the real account (no paid call was made). An earlier version of this document stated that the account lacks access; that was not established. If DataForSEO answers 40204, the product shows "Needs the DataForSEO Backlinks API". Nothing is purchased from the product.
- **Minimum authority** (customer setting) uses the same metric, and admin placement enforces it.

## Estimated equivalent value

`src/lib/valuation/policy.ts` defines the estimate; policies live in `valuation_policies`.

- There are **no hidden constants**. The old $2.50/click and $180/link figures are gone.
- An administrator publishes a **versioned, append-only policy** at `/admin/network/operations`, with:
  - currency (ISO 4217);
  - traffic mode: *keyword CPC*, *fixed rate per click* or *not valued*;
  - backlink value per verified link, by source DataForSEO Rank band (`minRank:value`, plus `unknown:value`);
  - sources (required, and shown to customers), notes and the effective date.
- The newest policy in effect applies. With no policy, the product shows **"Estimate not configured"**; it never shows invented prices.
- **Traffic value, keyword CPC:** each RepGet article's Search Console clicks × the CPC of the keyword it targets, taken from the website's own keyword research for its market. DataForSEO reports CPC in USD, so this mode requires a USD policy; any other currency shows "Needs a USD policy". **Fixed:** clicks × the fixed rate.
- **Backlink value** covers **verified** received links only. The dashboard values links first verified in the period that are still verified; the portfolio values all currently verified links. Never valued:
  - drafts;
  - links awaiting publication or verification;
  - links not found or removed;
  - internal links;
  - the "Powered by RepGet" footer.
- The wording is "Estimated equivalent value" and "an estimate of what equivalent ads or links would cost". It is never "savings", revenue or guaranteed return. The methodology (policy version, rates, sources, what is excluded) is in the dashboard's Details view and the Overview's "How is this estimated?".

## AI citations (Earned Backlinks column)

A **measured** value only: how many of the website's own AI Visibility answers (`geo_results.cited`, last 90 days) cited the page that carries the link, matched by the same page identity as article traffic (query strings and path case kept).

- If the website ran no AI checks in that period, or the page is not published, the column says **not measured**. It is never inferred from authority or verification.
- No paid AI checks are run to fill it.
- The dashboard's AI panel shows AI Visibility checks (answers checked, mentions, citations). It states that visits from AI assistants are not measured, because RepGet does not import traffic by referral source.

## Re-checks and "Recover credits"

`src/lib/reporting/recheck.ts` handles rechecks and recovery.

- **What a request does.** It marks the placement for the verifier and wakes the verification job. **It never moves credits.** Credits move only when the verifier sees the link live, once, through the existing idempotent settlement.
- **Who may ask.** Editors of the side that owns the link: the beneficiary for received links, the host for hosted links.
- **Limits.** One request per placement per 6 hours, decided under a row lock.
- **Recovery.** A hosted link that was **not found** returns to "awaiting verification" only if its request is still open and was not given to another placement, so a recovered link cannot be charged twice.
- Nothing is republished, and no approval is bypassed.

## Privacy and bounds

- Every query is scoped to one website and its owning workspace.
- A partner's **unpublished** article title and anchor words are hidden, and are not searchable, until that article is published.
- Link details show only the viewer's own workspace ledger entries.
- Outbound links render only for `http(s)` URLs, with `rel="noopener noreferrer"`. Fetched HTML is never rendered.
- Pagination is server-side, with a page size of 10, 25 or 50 and stable sorting (tie-broken by placement id). Tab counts and cards come from separate aggregate queries, never from the loaded page.
