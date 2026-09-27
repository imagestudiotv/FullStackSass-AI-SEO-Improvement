# Managed Partner Network, article defaults and delivery

This covers the changes agreed with the client in September 2026:

- 1280 × 720 article images.
- A ready-to-copy WordPress key on first setup.
- New-site defaults.
- The "Powered by RepGet" footer.
- The admin-managed Partner Network, with its review/release gate.

Internal links are covered separately in [internal-links.md](internal-links.md).

## Summary

| Area | Behaviour now | Where |
|---|---|---|
| Article images | Every generated or regenerated header image is stored as a 1280 × 720 JPEG, verified after encoding. Customer uploads are never cropped. | `src/lib/images/process.ts`, `generate.ts` |
| First WordPress key | Created by an authorised mutation when an editor first opens the setup screen, and shown once. It is never created on GET, SSR or prefetch. | `src/lib/plugin/keys.ts`, `actions.ts`, `plugin-keys.tsx` |
| New-site defaults | For new websites only: table of contents on, similar products on, publishing live on the planned day, and Partner Network participation on. Written by the application, not as database defaults. | `src/lib/websites/new-site-defaults.ts`, `websites/actions.ts` |
| Dispatch boundary | Every send to a customer site (every attempt, every path) re-checks the gate, the exact revision, the schedule and the freeze while holding the article's row lock. Edits wait while a send is in flight. | `src/lib/publishing/dispatch.ts` |
| Operator controls | A publication freeze, and a managed-review switch that is enabled after a deploy completes. | `src/lib/publishing/controls.ts`, `/admin/network/operations` |
| Reporting | Backlinks Overview, Earned Backlinks, Hosted links, Credit activity and the dashboard, all from one reporting layer. | [backlink-reporting.md](backlink-reporting.md) |
| Footer | When the setting is on, "Powered by RepGet" appears exactly once, at delivery. It is not stored in the article. | `src/lib/articles/delivery.ts` |
| Partner Network | Admins place links by hand, and each article is approved before release. Customers list and prioritise target pages. | `src/lib/backlinks/managed.ts`, `src/app/admin/network/` |

## Images

The image generator now asks for a size the provider supports:

- `gpt-image-*`: 1536 × 1024
- `dall-e-3`: 1792 × 1024
- anything else: 1024 × 1024

The prompt also asks for a landscape composition. `toArticleImage()` then produces exactly 1280 × 720:

- **Wide enough (aspect ≥ 1.5):** centre cover crop. From a 3:2 source this removes about 5.6 % from the top and bottom.
- **Narrower (for example a square fallback):** the whole image is fitted in the centre, over a blurred, darkened copy of itself. Nothing in the picture is cut off.

Every image is flattened on white, encoded as progressive JPEG at quality 85, then decoded again to confirm 1280 × 720. Other limits:

- Only PNG, JPEG and WebP input is accepted, up to 40 megapixels.
- EXIF orientation is applied before processing.

Storage, alt text, the `.jpg` extension and the `image/jpeg` MIME type are applied consistently on every path that produces an image: first generation, regeneration and the alternate provider.

The SSRF, response-size and spend checks run before processing and are unchanged.

When an article is delivered, each body image gets `style="max-width:100%;height:auto"` and `loading="lazy"`. It then scales on any WordPress theme without editing the theme. The editor preview does the same.

## First-time key setup

When an editor opens WordPress setup and the site has **never** had a key, the screen calls `startWordPressSetup`. This is a server action, so it is a POST that checks the editor's role. The action takes a per-website advisory lock and does one of three things:

- **creates** a key and returns its plaintext once;
- returns **exists** if another tab or request created one first;
- returns **revoked** if the site ever had a key.

Once a key has been revoked, no key is created automatically again. The customer presses "New key" when they want one.

- **Storage.** Only the hash and prefix are stored. The plaintext is never logged or put in a URL, analytics or `localStorage`.
- **Double calls.** A ref guard absorbs React StrictMode's double effect. A refresh, a second tab or a retry finds the key already there.
- **Lost response.** If the key was created but never shown here (a crashed tab, another tab), the screen explains that and offers **Replace unused key**. This only replaces a key that has never been used. A connected key is never rotated by this path.
- **Viewers** see the status only.

## Defaults

New websites get `auto_publish`, `table_of_contents` and `mention_similar_products` set to `true` **by the application** (`NEW_SITE_DEFAULTS` in `src/lib/websites/new-site-defaults.ts`, written by `addWebsite`).

The database column defaults stay `false`. The first version of migration 0043 changed them, but a changed column default also applies to websites created by an **older build** still serving during a deploy, or after a rollback. That build knows nothing of the review gate, and would have created live-publishing websites. 0043 was corrected before it was applied anywhere but disposable databases.

- `publish_as` already defaulted to `live`, and `powered_by_link` to `true`.
- `addWebsite` also creates the site's `network_sites` row, with participation on and a cap of 3 links a month.
- **No existing website is updated.** Each keeps its publishing mode and its opt-outs.

To see which existing websites differ from the new defaults, run the read-only dry run:

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/managed-network/preview-existing-site-defaults.sql
```

It runs inside `BEGIN TRANSACTION READ ONLY … ROLLBACK`. Switching an existing customer over is their decision, made in their own settings, so no bulk-update script ships.

**Table of contents.** The contents list is built from the article's own `h2` headings after writing, not by the model. Each heading gets a unique, sanitiser-safe id. The contents list is added only when there are at least two `h2` headings. Ids survive the editor, which has a `HeadingIds` extension, and WordPress. The model is no longer asked to write a contents list.

**Similar products and tools.** The prompt asks the writer to name real alternatives only where they fit naturally, with no invented prices, ratings or claims.

**First article.** The first article of a website that is **outside** the network is still published at once, as before. Inside the network, every article, the first included, waits for approval and its planned day. The copy in Publishing says so.

## "Powered by RepGet"

The footer is added by `prepareForDelivery()` when the article leaves RepGet (direct CMS publishing and the plugin feed). It is never stored in the article. Delivery:

1. removes any earlier "Powered by RepGet" paragraph;
2. appends exactly one:

```html
<p><small>Powered by <a href="https://<app domain>/" target="_blank" rel="noopener nofollow">RepGet</a></small></p>
```

The app domain is `NEXT_PUBLIC_APP_URL`. The footer is not counted as an internal or network link and is not charged. Internal-link repair runs before it is added, so it is never removed. With the setting off, no footer is sent. Articles already published are not edited.

## Partner Network (admin-managed)

### Customer: Settings → Backlink Exchange → Partner Network

- **Participation.** On by default, and a switch (`role="switch"`, keyboard operable).
  - Turning it off stops new placements. History and credits are kept.
  - Articles waiting for review that have no committed link are released back to normal publishing.
- **Target pages.** Up to 20 per website, each with high, medium or low priority. The order can be changed with the arrow buttons, which work from the keyboard. Each page must be on the customer's own site and is verified to exist before it is saved.
- **Minimum authority.** A minimum **DataForSEO Rank** (0-100) for the sites that link here, saved in `network_sites.min_source_rank`.
  - It can be set only when the metric is actually available: DataForSEO is configured, and the account has the Backlinks API.
  - Otherwise the card shows why it is not available, instead of a control that does nothing.
  - Admin placement enforces it. A host below the minimum is refused, and so is a host whose rank is unknown.
- **Progress and credits** are shown. A received link shows its credits as *held* until it is verified live. A hosted link shows *+N once live*.
- **Not offered to customers:** choosing partners, per-link approval, or requesting a link. `requestBacklink` now points the customer to target pages.

### Admin: `/admin/network`

**The queue.** It lists:

- articles waiting for review, oldest planned date first, with the website, workspace, language, planned date, link count and delivery route;
- articles that are approved but not yet published;
- participating websites and their prioritised target pages;
- credits per **workspace**: balance, reserved and available, each counted once per organisation.

**The review page (`/admin/network/<article>`).** It shows the article exactly as it will be delivered, with network links visible. An admin can:

- **Place a link.** Choose the receiving website and page, anchor words that are already in the article, credits and a reason. Each placement is checked:

  | Check | Rule |
  |---|---|
  | Target page | Verified again at the moment of placing |
  | Host article | Must be a draft that has not been published |
  | Hosts | The target must be on the beneficiary's own hosts |
  | Language and relevance | Same language; relevant niches |
  | Exclusions | No self-links, same-workspace links or reciprocal pairs |
  | Limits | Within the monthly cap; at most 3 network links per article; one per beneficiary; no duplicate URL |
  | Credits | Enough available credits, reserved atomically |

- **Withdraw** a link or **change its credits.** Both are allowed only while the link is drafted. An increase is reserved under the same lock.
- **Approve and release.** Approval without a link is allowed. **Reopen** returns an approved article to review.

Every action is recorded in the admin audit log with the actor, the change, the amount and the reason. Each edit carries the review version it started from, so two admins cannot overwrite each other. The later one is refused with "This article changed after you opened it".

Placements are structured rows (`placements.managed`, `created_by`, `reason`), linked to a `backlink_requests` row that holds the reservation. Internal-link validation preserves a placement's URL because it is a recorded placement. External links in general are not whitelisted.

Network links go out with `rel="noopener nofollow"`, like every external link and like the existing exchange. Changing that is a separate SEO-policy decision and was not made here.

### Review and release gate

`review_status` is `pending` for every new article on a participating website, **while the operator's `managed_review` switch is on** (`/admin/network/operations`). The switch is off after migration; turn it on once the deploy has finished. Every delivery path checks the gate on the server, at the dispatch boundary below:

- direct publishing
- plugin pull
- the daily scheduled release
- the first-article exception
- connection-triggered delivery
- job retries
- the customer's Publish button

Three rules apply:

1. **Approved content only.** An article is delivered only if it is approved **and** the SHA-256 of its title, slug, meta description, body, image URL and image alt still matches the approved hash.
2. **Edits invalidate approval.** Any later edit, by the customer or an admin, returns the article to review. The send itself is claimed against the exact revision (see the dispatch boundary), so no job can send an older or unapproved revision.
3. **Planned date and mode.** After approval, delivery follows the customer's publishing mode and planned **day** (UTC). An article approved after its planned day goes out at once. The calendar keeps the original date.

Articles with `review_status` null, meaning every existing article and every site outside the network, are not affected. Published articles are never reviewed after the fact.

## Credit policy

The current rule, verified in the code, is unchanged: **1 credit per link.** The requester pays and the host earns the same amount.

- An admin may set 1–10 credits per placement. The server validates the amount.
- **Placing reserves** the credits on the beneficiary's workspace. This is atomic under `pg_advisory_xact_lock('credits:<org>')`. Available = balance − reservations of pending or matched requests. Drafts cost nothing.
- **Settling** happens only when the verifier sees the link live on the published page. The charge and the host reward are written exactly once, using the idempotency keys `placement:<id>:charge` and `:host_reward`. This was tested with two concurrent verifiers on real Postgres.
- **Withdrawing** before publication releases the reservation.
- **Missing links.** A link that disappears after going live is refunded once (`:refund`), and the host reward is reversed once (`:host_reversal`). Only repeated "missing" results count; a temporary failure does not. A link that never went live was never charged, so nothing is refunded.
- **Settled amounts are never changed.** Credits can only be edited while the placement is drafted.
- The duplicate, relevance, self-link and reciprocal protections still apply. A reciprocal pair created *over time* is refused at placement. No delayed reciprocal detection was added.

The earlier customer-initiated `requestBacklink` path reserved credits without an org-wide lock. It is switched off for the managed launch (`MANAGED_NETWORK = true`).

## Publication dispatch boundary

Checking the gate when an article is *prepared* is not enough. The publish job used to check approval in its first step, then upload the image, then send the copy it had prepared. An approval withdrawn, or an edit saved, during the upload or before a retry still went out, because Inngest replays finished steps from cache. Checking again just before sending only narrows that window.

Every external send now **claims a dispatch** (`src/lib/publishing/dispatch.ts`, table `publication_dispatches`). One transaction locks the article row and re-checks:

- the publication freeze;
- the review gate: approved, and exactly the approved revision;
- that the article is still **exactly the revision this job prepared** (`reviewHash`);
- the schedule rule for **why** it was queued (the `trigger` on the event).

The same transaction then records that revision as **in flight**. The trigger decides the schedule rule:

| Trigger | Rule at send time |
|---|---|
| Publish button | None: the customer decides when. |
| Automatic release | Auto-publish must still be on, and the planned UTC day must have come. |
| First article / connection / approval | While it is still the first article, the first-article rule applies. A reviewed article never goes before its planned day. |
| Event without a trigger (queued by the previous build) | Treated as a Publish press, which is what that build applied at send time. The gate, the revision and the freeze are still checked. |

**Edits wait.** Every write to what an article delivers takes the same row lock and is refused while a revision is in flight:

- the customer's editor and the admin editor;
- image changes and rewrites;
- link repair;
- placing, withdrawing or re-crediting a network link;
- approval and reopen.

Whichever commits first wins. If the edit commits first, the claim sees a new revision and holds (`revision_changed`, and a fresh job prepares the new revision). If the claim commits first, the edit is refused with "being delivered right now; try again in a minute". On real Postgres, a claim and an edit racing on separate connections never both won, across repeated trials.

**When a send can no longer be recalled.** From the claim's commit until its outcome is recorded:

- `sent`;
- `failed`: the site answered with a refusal (4xx), so nothing was created;
- `uncertain`: no answer, or a 5xx on a create, so the post may exist.

A claim with no outcome after 10 minutes is presumed dead. A direct create is then marked `uncertain`, and a plugin hand-over `abandoned`.

**Uncertain outcomes are reconciled, never blindly retried.**

- Before creating anything, the next attempt looks the post up by slug on WordPress (`findPostBySlug`). If it finds the post, the article is recorded as published, or updated when the text has changed since. If the lookup finds nothing, the post is created.
- Providers without a reliable lookup (Ghost, Shopify, Webflow, Wix, webhook) hold. The article page then shows "the last attempt got no answer from your website". Once an editor has checked their site, "It is not on my site - allow publishing again" records who confirmed it.
- Updates of an existing post are idempotent and are simply repeated.
- **A second request for the same revision** (a repeated press, a release racing another path) sends nothing (`already_sent`).
- The database allows at most one in-flight dispatch per article.

**Plugin delivery.** Handing an article to the plugin (`GET /api/plugin/articles`) is a dispatch too.

- **Claim:** each article in the response is claimed as it is built, and the feed never offers an article that is in flight.
- **Settle:** the plugin's report (`POST /api/plugin/published`, success or error) settles it.
- **Timeout:** an unanswered hand-over is offered again after 10 minutes. This is safe because the plugin finds its own earlier post by article id (post meta `_repget_article_id` plus the GUID identity) and updates it instead of creating another.
- **Limit:** once a response has left RepGet, the content in it will be created by the plugin. The claim is that point of no return.

## Deploy, migrate, roll back

Migrations `0043` (managed network) and `0044` (dispatch, controls, authority, valuation) only add tables and nullable columns. **No default of an existing column changes and no existing row is updated.** Both were rehearsed on a disposable Postgres 17 database that already held websites, a live placement, link checks and ledger rows at 0042:

- all existing rows were unchanged;
- a website inserted the way the previous build inserts one still got the old defaults;
- the in-flight uniqueness rule was enforced.

**Deploy order**

1. Back up the database. Apply `0043` and `0044` with the normal migration process against `DIRECT_URL`. The previous build keeps working against them.
2. Deploy the application. Nothing is held for review yet, because `managed_review` is off, so an older instance that is still serving cannot publish a held article.
3. When the deploy is complete (no older instance serving, no queued jobs from it), turn on **Managed review** at `/admin/network/operations`.
4. Optional: publish a valuation policy, and configure authority collection (see [backlink-reporting.md](backlink-reporting.md)).

`sharp` is a direct dependency (0.35.4, already in the lockfile). `NEXT_PUBLIC_APP_URL` must be the canonical app URL, because it is the footer link. `AUTHORITY_DAILY_REQUESTS` (default 4) caps DataForSEO authority requests per day.

**Rollback: never redeploy the previous build unpatched.** It ignores `review_status`. Its Publish button and publish job only check that an article has content, so it would publish held articles, and reopening an article cannot protect it from code that never reads the field. Use a publication freeze plus a rollback-compatible build:

1. **Freeze publishing** at `/admin/network/operations`, or with the SQL in `scripts/managed-network/rollback/README.md`. Every path of the new build holds at its next dispatch claim. Wait until **in flight** reaches 0 (at most 10 minutes).
2. **Deploy the rollback-compatible previous release.** Check out `d62e257`, apply `scripts/managed-network/rollback/previous-release-gate.patch` and build. The patch makes that release honour the review gate (with the exact approved revision), the planned day for reviewed articles, the freeze and in-flight sends, on its plugin feed, first-article release, scheduled release, Publish button and publish job (at preparation and at every send attempt). It was rehearsed locally: the previous release's code ran against a database migrated through 0044, all 6 scenarios passed, its own suite passed with the patch (427 tests), and it typechecks.
3. Do **not** roll the migrations back. The patched build needs 0043 and 0044, and dropping them would lose review, placement, dispatch and ledger history.
4. **Unfreeze** when ready. Held articles stay held; the patched build cannot approve. Nothing is mass-approved. They are released when the newer build returns.

Residual risk in the patched previous build: it has no row lock between its check and its send, so an edit made in the same instant as a send could still go out on an invalidated approval. That is why step 1 freezes first.

**The WordPress plugin needs no update.** Plugin 1.5.2 stores the HTML it is sent and de-duplicates by article id. The footer, heading ids, image style and network link arrived intact on a disposable WordPress 6.8.3, with a 1280 × 720 featured image. The dispatch boundary uses the plugin's existing report endpoint.

## Operator action (separate from this change)

A client screenshot showed a WordPress integration key in full. If that key is still active:

1. Create a replacement in the customer's Integrations screen.
2. Paste it into their WordPress plugin.
3. Revoke the old key.

Do this with the customer, because revoking first would stop their publishing. This was not done as part of the implementation.
