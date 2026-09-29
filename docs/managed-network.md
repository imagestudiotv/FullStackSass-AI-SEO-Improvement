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
| Dispatch boundary | Every send to a customer site (every attempt, every path) re-checks the gate, the exact revision, the schedule, the publishing mode and the freeze while holding the article's row lock, and records its identity before sending. Edits wait while a send is in flight. Unknown outcomes are reconciled by ownership marker or an audited decision; plugin reports settle exactly their own hand-over. | `src/lib/publishing/dispatch.ts`, `reconcile.ts`, `acknowledge.ts` |
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
- `addWebsite` also creates the site's `network_sites` row, with participation on. The row still stores a monthly cap of 3, but since 2026-09-28 no cap applies to managed placements (see the limits below); only the switched-off automatic exchange would read it.
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
- participating websites, their prioritised target pages, and how many network links each has hosted **today** and **this month** (UTC) - for pacing by hand, since no hosting cap applies. Links are counted on the day they were placed, including published links the checker has not seen yet ("unverified"); withdrawn and removed links are not;
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
  | Limits | At most **15** network links per article (none is fine); one per receiving website (a website already linked is marked in the list); no duplicate URL. **No limit on how many links a website hosts** - the client's decision (2026-09-28), since every link is placed by hand. The review page shows the host's links today and this month instead |
  | Credits | Enough available credits, reserved atomically |

- **Withdraw** a link or **change its credits.** Both are allowed only while the link is drafted. An increase is reserved under the same lock.
- **Edit the article** (title, meta description, slug and text), with the editor customers use, while it is in review and unpublished (`editReviewedArticle`):
  - The save carries the review version **and** the hash of the text the admin opened. A customer's own edit does not move the review version, so the text is compared too; either change refuses the save and asks for a reload.
  - The text is sanitised as in the customer's editor. The previous body is kept in `article_versions`, and the edit is audited (`network.article_edited`).
  - Like any change in review, it returns the article to pending with a new version. An approved article must be approved again.
  - **A placed network link cannot be deleted by editing.** Its credits are reserved against it, so the save is refused, naming the website; use Withdraw. The linked words may be reworded, and the placement's recorded anchor follows them.
  - A placement whose link is missing from the text (a customer's edit can remove one) is marked on the page, because approval refuses it. The admin can put it back by editing, or withdraw it.
  - Links, credits and approval are paused while the editor is open, so nothing changes the saved article underneath an unsaved edit.
  - A link typed into the editor by hand is an ordinary link, not a network link: it is not tracked or credited.
- **Approve and release.** Approving with no network links is an ordinary choice ("Approve without network links"); the article is released as it is. **Reopen** returns an approved article to review.
  - An approval covers exactly the text the admin was shown. It carries the review version and the hash of that text, and is refused if the text changed since the page was opened ("This article's text changed after you opened it"). The customer's editor does not move the review version, so without the hash an edit made while the page was open would have been approved unseen.

The general admin editor (`/admin/articles/<id>`) does not edit an article that is in the review (a draft, never published, with a review status). It points to the review page instead, and its save is refused on the server under the article's lock. Every article therefore has one place where an admin edits it, and for articles in review that place has the checks above.

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
- **Settling** happens only when the verifier sees the link live on the published page. The charge and the host reward are written exactly once, using the idempotency keys `placement:<id>:charge` and `:host_reward`. This was tested with two concurrent verifiers on real Postgres. The verifier (`verify-backlinks`) runs every six hours, one run at a time, up to 300 links per run, and re-checks each link at most once a day. Links never checked go first (after rechecks a customer asked for). Each published page is fetched once per run for all the links on it, so an article with 15 links costs its host one request, not 15. It used to check 50 a day, which could not keep up with up to 15 links per article.
- **Withdrawing** before publication releases the reservation.
- **Missing links.** A link that disappears after going live is refunded once (`:refund`), and the host reward is reversed once (`:host_reversal`). Only repeated "missing" results count; a temporary failure does not. Its request is closed ("cancelled", nothing reserved), so the refund can be spent at once; an administrator places any replacement link by hand. A link that never went live was never charged, so nothing is refunded; its request keeps its hold, because a later recheck that finds the link revives it.
- **Settled amounts are never changed.** Credits can only be edited while the placement is drafted.
- The duplicate, relevance, self-link and reciprocal protections still apply. A reciprocal pair created *over time* is refused at placement. No delayed reciprocal detection was added.

The earlier customer-initiated `requestBacklink` path reserved credits without an org-wide lock. It is switched off for the managed launch (`MANAGED_NETWORK = true`).

## Publication dispatch boundary

Checking the gate when an article is *prepared* is not enough. The publish job used to check approval in its first step, then upload the image, then send the copy it had prepared. An approval withdrawn, or an edit saved, during the upload or before a retry still went out, because Inngest replays finished steps from cache. Checking again just before sending only narrows that window.

Every external send now **claims a dispatch** (`src/lib/publishing/dispatch.ts`, table `publication_dispatches`). One transaction locks the article row and re-checks:

- the publication freeze;
- the review gate: approved, and exactly the approved revision;
- that the article is still **exactly the revision this job prepared** (`reviewHash`);
- the schedule rule for **why** it was queued (the `trigger` on the event), and the status it goes out as.

The same transaction then records that revision as **in flight**. The trigger decides the schedule rule:

| Trigger | Rule at send time |
|---|---|
| Publish button | None: the customer decides when, and chooses live or draft. |
| Automatic release | Auto-publish must still be on, and the planned UTC day must have come. |
| First article / connection / approval | While it is still the first article, the first-article rule applies. A reviewed article never goes before its planned day. Otherwise the automatic rule. |
| Plugin hand-over | First-article rule; else a recorded Publish press; else the automatic rule. |
| Event without a trigger (queued by the previous build) | **The strict rule**: the first-article rule while it is the first article, otherwise the automatic rule. Nothing on such an event says whether a person pressed Publish, so it is never treated as a press. A press held this way is pressed again. |

**The status is decided at the claim, from the settings now.** Only a Publish press carries its own live/draft choice. Every other send reads `publish_as`, `auto_publish` and the first-article rule inside the claim, so a site switched to "draft" after an article was queued gets a draft, on the direct path and in the plugin feed alike. The first article is always live. A second request for the same revision **and the same effective status** sends nothing (`already_sent`).

**Edits wait.** Every write to what an article delivers takes the same row lock and is refused while a revision is in flight:

- the customer's editor, the admin editor and the review page's editor;
- image changes and rewrites;
- link repair;
- placing, withdrawing or re-crediting a network link;
- approval and reopen.

Whichever commits first wins. If the edit commits first, the claim sees a new revision and holds (`revision_changed`, and a fresh job prepares the new revision). If the claim commits first, the edit is refused with "being delivered right now; try again in a minute". On real Postgres, a claim and an edit racing on separate connections never both won, across repeated trials.

**Identity and request snapshot, recorded before sending.** The claim writes the dispatch id, the article, the website, the direct integration (`integration_id`) or the plugin protocol (`protocol`), and a `request_snapshot` (title, slug, effective status, revision hash, publish press at claim time, ownership marker) in the same transaction, before any request leaves. Reconciliation reads these, never the article's current, editable fields.

**Outcomes.** From the claim's commit until its outcome is recorded, the send cannot be recalled:

| Status | Meaning |
|---|---|
| `in_flight` | Claimed; the request may reach the site at any moment. |
| `sent` | Delivered. `remote_status` is what the CMS stored (`publish`, `draft`, `pending`, `future`, `private`). `late = true` when a newer dispatch of the article already existed. |
| `failed` | The site refused (4xx) or the plugin reported an error. |
| `uncertain` | A direct create got no answer, or a 5xx: the post may exist. |
| `expired` | A plugin hand-over whose 10-minute lease ran out unacknowledged (`abandoned` before 0045). The plugin may still report it. |
| `released` | An operator released an expired hand-over from a pre-1.6 plugin (audited). |

**A lease running out is not completion.** After 10 minutes a direct claim with no outcome becomes `uncertain` and a plugin hand-over `expired`, so it no longer blocks edits, but neither counts as delivered.

**Uncertain direct sends: proof of ownership, never a slug.** Every direct send carries an invisible marker in its content, `<!-- repget:v1 article=<id> website=<id> dispatch=<id> -->` (`src/lib/publishing/ownership.ts`). Before creating anything for an article whose last direct send is uncertain, the job searches the site **the dispatch was sent to** for that dispatch id (`searchPostsByMarker`, WordPress REST `search` with `context=edit`) and checks the marker in each candidate's stored content (`src/lib/publishing/reconcile.ts`):

- **exactly one** post carries this dispatch's marker for this article and website: it is adopted (`reconciled_by = system:ownership-marker`) and logged once; the next revision updates it;
- **none**: not proof. The dispatch stays `uncertain`, the lookup is counted (`lookup_attempts`, `last_lookup_at`, `lookup_result = none`), nothing is created, and another lookup is scheduled (5, 10, 20 … minutes, up to 8 automatic lookups);
- **several**, or a marker with another article/website: `ambiguous`, held for a person;
- content withheld, a send from before markers (no snapshot), a CMS without a lookup (Ghost, Shopify, Webflow, Wix, webhook), or the integration gone: held for a person.

Only a person ends an uncertainty without proof, and it is audited on the dispatch (`reconciled_by`, `reconciled_at`, `reconcile_note`): the customer's "It is not on my site - allow publishing again", or an operator at `/admin/network/operations` ("Checked: not on the site", or "Found the post" with its id and address, which the next publish then updates). The earlier slug lookup adopted an unrelated post that owned the slug, missed a suffixed slug (`-2`) and missed an edited slug; it has been removed.

**Plugin delivery.** Handing an article to the plugin (`GET /api/plugin/articles`) is a dispatch too.

- **Claim:** each article in the response is claimed as it is built; the feed never offers an article that is in flight; the response carries `dispatch: { id, revision }` and the effective status.
- **Report (`POST /api/plugin/published`):** `src/lib/publishing/acknowledge.ts` settles, in one transaction holding the article's row lock, **exactly** the hand-over the report answers.
  - Plugin **1.6.0+** sends `X-RepGet-Plugin-Version` and echoes `dispatchId`, with the status WordPress actually stored.
  - **Older plugins** report by article only. For them at most **one revision is outstanding per article**: after a lease runs out, the same revision is re-offered under the same dispatch; a different revision waits (`awaiting_plugin`) until the outstanding one is reported or an operator releases it. Their report therefore always settles the right hand-over. Their status is the one they were asked for, not necessarily what WordPress kept.
  - A report for an already-settled dispatch is a **duplicate**: nothing is written again (no second log, notification or first-article follow-up). Publish logs are unique per delivered dispatch.
  - A report for a dispatch that has a **newer** dispatch is **late**: recorded on its own row and log, but it does not change the article's current state, clear a newer Publish press, notify, or continue anything. A late report of a live post only sets the first-live date if none was known.
  - Only a post stored as `publish` makes the article published and sets `first_live_at`. A WordPress draft keeps the article a draft.
  - A report without a dispatch for a post already delivered, at a new address, is the plugin moving the post (content-type change): only the address is updated.
- **Limit:** once a response has left RepGet, the content in it will be created by the plugin. The claim is that point of no return.

## WordPress plugin 1.6.0 (protocol v2)

**An update is required for exact correlation.** Earlier versions of this document said the plugin needed no update; that is no longer true. Plugin 1.6.0 (`public/repget-connector.zip`, rebuilt with `npm run plugin:build`):

- sends `X-RepGet-Plugin-Version: 1.6.0` on every request;
- echoes each hand-over's `dispatchId` in its report;
- keeps unsent reports per hand-over (`dispatch:<id>`), so reports for an older and a newer revision of one article are both delivered (1.5.x kept only the last); reports parked by 1.5.x are still sent;
- reports `get_post_status()` after saving, not the requested status.

**Older plugins keep working, more conservatively:** one outstanding revision per article, as above; a revision edited while a hand-over is unacknowledged waits for the report (or an operator's release), and a draft kept by WordPress on an update may be reported as the requested status. Customers should be asked to update. Nothing on the server requires 1.6.0.

Verified: `npm run plugin:test` (the stubbed-WordPress harness, including the new protocol cases, which fail against 1.5.2), and the server-side endpoint tests in `src/lib/publishing/corrections.test.ts`. A disposable real WordPress run of 1.6.0 is listed under the remaining staging checks.

## Publication freeze and drain

**Enabling the freeze is serialized with admission.** Every claim holds `pg_advisory_xact_lock_shared(hashtext('repget:publication-freeze'))` while it reads the freeze and records the dispatch; switching the freeze on takes the same lock exclusively. When the switch returns, no claim that read "not frozen" is still open, and nothing more is admitted. Proven on real Postgres with a claim parked at a barrier (`src/lib/publishing/corrections.postgres.test.ts`); the same test fails with the lock removed.

**Drained means no delivery has an unknown outcome**, not "nothing was claimed in the last 10 minutes". The operations page counts, and lists with their lookups:

- in flight (within the lease);
- in flight past the lease with no outcome;
- uncertain direct sends;
- unacknowledged plugin hand-overs (`expired`/`abandoned`).

It says "Drained" only when all four are zero. Resolve the rest there (audited) before switching builds.

## Managed-review activation and the deploy cutover

Migration 0045 writes a cutover marker (`platform_controls` key `managed_review_cutover`, disabled, `updated_at` = migration time). Turning **Managed review** on:

1. takes `hashtext('repget:managed-review')` exclusively. The generation save step takes it shared while it decides a new draft's review state and writes it (`reviewStatusForNewDraft`), so no save that decided "not reviewed" can land after step 2;
2. holds for review (`review_status = pending`) every draft created **since the cutover** on a website in the network that is unpublished (`draft`/`generating`/`queued`, no `published_url`), not already under review, and not in flight. The number is recorded in the audit log.

So drafts written while the switch was off during the deploy, and drafts written by jobs the previous build queued and the new build ran, are brought under review. Drafts created **before** the migration keep the behaviour they were written under (as before). Proven on real Postgres with a save parked at a barrier; the same interleaving without the lock leaves the draft unreviewed.

## Deploy, migrate, roll back

Migrations `0043` (managed network), `0044` (dispatch, controls, authority, valuation) and `0045` (dispatch identity, acknowledgements, actual CMS outcomes, page identity) are forward-only. 0043 and 0044 may already be on a persistent database; 0045 is a new forward migration and does not assume otherwise. 0045:

- adds nullable or defaulted columns only (`publication_dispatches`: protocol, integration_id, request_snapshot, remote_status, late, lookup_*, reconciled_*; `publish_logs`: remote_status, dispatch_id; `articles`: first_live_at);
- adds the immutable SQL function `repget_page_key(url, fallback_host)`;
- renames the status `abandoned` to `expired` and backfills `protocol` (`plugin_legacy` for plugin rows, `direct` otherwise);
- backfills `first_live_at` **only** for a published article with exactly one delivery on record; everything else stays unknown (see [backlink-reporting.md](backlink-reporting.md));
- inserts the managed-review cutover marker (disabled).

A build older than 0045 ignores all of it; it treats an `expired` row as settled history, as it treated `abandoned`. The rollback patch holds such articles (below).

**Deploy order (exact cutover)**

1. Back up the database. Apply pending migrations (`0043`–`0045` as needed) against `DIRECT_URL`. The previous build keeps working against them.
2. Deploy the application. `managed_review` stays off, so an older instance still serving cannot publish a held article.
3. Wait until the deploy is complete: no older instance serving, and the Inngest app synced to the new build. Events the previous build queued are then run by the new code (with the strict rule for events without a trigger).
4. Turn on **Managed review** at `/admin/network/operations`. It waits for in-progress generation saves and holds the drafts written since the migration (step 2 above); the audit log records how many.
5. Ask plugin customers to update to 1.6.0.
6. Optional: publish a valuation policy, and configure authority collection (see [backlink-reporting.md](backlink-reporting.md)).

`sharp` is a direct dependency (0.35.4, already in the lockfile). `NEXT_PUBLIC_APP_URL` must be the canonical app URL, because it is the footer link. `AUTHORITY_DAILY_REQUESTS`: unset or blank = 4 per day; `0` = collection disabled; a whole number = that limit; anything else (negative, fractional, `1e3`, text) = **invalid, collection disabled**, and the operations page says so.

**Rollback: never redeploy the previous build unpatched.** It ignores `review_status`, the freeze and unknown outcomes. Use a publication freeze plus the rollback-compatible build:

1. **Freeze publishing** at `/admin/network/operations` (it waits for open claims). Then resolve every unresolved delivery listed there until it says **Drained**. A delayed send whose lease ran out still counts; an uncertain one needs its lookup or an audited decision.
2. **Deploy the rollback-compatible previous release.** Check out `d62e257`, apply `scripts/managed-network/rollback/previous-release-gate.patch` and build. Do not run or roll back migrations.
3. Verify on the rolled-back deployment that held articles appear neither in the plugin feed nor in the scheduled release.
4. **Unfreeze only if needed.** The patched build has no dispatch coordination, so it is deliberately stricter than the newer build: it holds **every** article under managed review (approved ones too) and every article with an unresolved delivery (in flight of any age, uncertain, expired/abandoned), on every path. After unfreezing it publishes only unreviewed articles without unresolved deliveries — what that release always published. **Limitation:** approved network articles wait for the newer build; nothing is mass-approved or mass-resolved.

The rollback was rehearsed locally: the previous release's code ran against a database migrated through 0045; 11/11 scenarios passed (including delayed and uncertain sends and expired/abandoned plugin hand-overs, 4 of which fail with the earlier patch); its own suite passed with the patch (432 passed, 19 skipped); `tsc` 0 errors. See `scripts/managed-network/rollback/README.md`.

## Operator action (separate from this change)

A client screenshot showed a WordPress integration key in full. If that key is still active:

1. Create a replacement in the customer's Integrations screen.
2. Paste it into their WordPress plugin.
3. Revoke the old key.

Do this with the customer, because revoking first would stop their publishing. This was not done as part of the implementation.
