# Two-step articles

Client requests 2026-11-02 and 2026-11-05: "Only 2 clear steps. 1. We receive the articles on the admin dashboard and do our work (editing, adding backlinks). 2. The client sees a ready version to publish."

The flow sits behind one switch: **Admin → Network → Operations → Two-step articles** (`platform_controls.two_step_articles`). It is off after a deploy, and nothing below applies until an operator turns it on. Everything new is behind this same switch. The earlier rules are kept as the switch-off branch so that the deploy is safe, and can be removed once the switch has been on for good.

RepGet's own blog editorial and translation review is a separate pipeline and is not touched by any of this.

## With the switch on

### 1. The team

Every new draft goes to the review queue (`/admin/network`): every website, Partner Network or not, and the free articles of new customers too. A new customer's first article is marked **First article** and listed first; articles whose sources are flagged are marked **Check sources**. The team edits, places links, and approves once. Their approval covers one exact revision (its hash) and, with it, the sources.

Until then the customer has an honest status and nothing else. No path gives them the text, excerpt, picture, sources, notes or links, and no action of theirs changes it or sends it. See "What is held" below.

The first article goes this way through the ordinary generation path as soon as it is queued. The customer approves nothing to start it.

### 2. The customer

After the approval that exact revision is **ready**. The customer gets one bell notification and the finished article with **one Publish button**. There is no "Approve research", no "Send as draft" and nothing else to press. Publish goes through the connected CMS or the WordPress plugin, and the panel reports the recorded result. A failure is shown and they can press again. A second press of a version already there is refused and tells them so.

Not connected: the page says the article is ready but not on their website, and leads to the connection page. Nothing claims it is live.

### How "one Publish action" fits with automatic publishing

Publishing modes a customer explicitly chose stay in force, and only ever send what the team approved. The first-article exception was not chosen by anyone, so it does not apply.

| Mode, or path | Before approval | After approval |
| --- | --- | --- |
| Manual (auto-publish off) | Nothing can send it | Goes out only when the customer presses Publish |
| Automatic, live | Nothing can send it | Goes live by itself on its planned day. Already due: at approval. Publish is still there to send it sooner |
| Automatic, drafts | Nothing can send it | Sent to the CMS as a draft on its planned day. Publish makes it live |
| Scheduled release (daily job) | Skips it | Sends approved articles on their day, for automatic sites only |
| First article | Nothing can send it | **Changed:** no longer goes live by itself. It follows the three modes above |
| Connecting a CMS | Sends nothing | **Changed:** no longer sends the first article. A due article on an automatic site goes at the next daily release |
| WordPress plugin | Not in its feed | The same rules as a direct connection |
| New website | Starts on manual | **Changed:** automatic publishing is the customer's choice on the Publishing page, not a default |

So: on manual sites, the customer's Publish is the only way out. On automatic sites the customer chose in advance not to press anything, the Publish button is an option to go sooner, and the "one action" is one button and no approval. A site's "Publish as: draft" setting still governs its automatic sends. A press is always Publish.

**Open point.** Until this flow, every new website was created with automatic publishing on, as an agreed default. Nothing records which existing customers chose it and which simply kept it, so all of them are treated as having chosen it and keep it. Their approved articles go out by themselves, and they rarely see the Publish step. The dry run counts these websites. Whether to move any of them to manual is a business decision and is not done here.

### A later change

A change to an approved revision goes back to the team, and the team's approval never follows an edit.

- **The customer edits or changes the picture before publishing.** The article returns to the queue and is hidden from the customer until the team approves it again, then comes back with one new notification. The Save bar and the picture panel say so before it happens. A save that changes nothing keeps the approval. A removed placed link stops the approval until the team restores or withdraws it.
- **The customer changes a post already on their website.** The post stays as it is. Their text stays readable. The article goes to the queue, Update waits for the team, and only the customer's Update then sends it. An approval never republishes a live post by itself.
- **The team edits or reopens it.** It returns to pending and is held from the customer again.
- **The customer rewrites it.** The new text goes to the team as a new draft. A rewrite is refused while the team has the article, since it would replace their work.
- **A dead link is found at sending.** The one change made without a person: a repair that only removes or re-points a broken link on the customer's own site keeps the approval and is logged as a version, as before. A repair that puts a different page in sends the article back to the team instead. Both already applied to approved articles; the sources' approval now follows the same way, because nobody could otherwise release it.

A press covers the revision it was made on. A new approval clears a press recorded for the plugin, and a job prepared from an older revision stops rather than sending the new one.

### What is held

`heldFromCustomer` and `heldFromCustomerSql` in `lib/articles/review.ts`: pending, or approved with a hash that no longer matches, unless the article is live on the website.

| Path | Result while held |
| --- | --- |
| Article page, its tab title, `getArticle` | Empty article, "preparing" status page |
| `listArticles`: list, search, calendar, chat | Planned title and "With the RepGet team" only |
| Dashboard card, next actions, Tasks | Planned title, no picture, no task and no approval request |
| AI chat tools | The two above |
| Sources panel | Renders nothing. After approval, one line: "Checked by the RepGet team" |
| Backlinks: hosted list and report | The team's link in the draft is not listed |
| Picture library | Its pictures are not offered |
| Traffic report | A rewrite of a live page is listed by address, without its new title |
| `updateArticle`, picture actions, rewrite, source approval, Publish | Refused |
| Plugin feed, publish job, daily release, connecting, approval | Refused by `releasableSql`, `releaseCheckFor` and `claimDispatch` at every attempt |
| Leaving the Partner Network | Does not release it |
| Emails, notifications | The "ready" message waits for the approval. Failure and live messages only follow a send |

Also only reading live posts: social suggestions, video ideas, indexing, link inventory, translations. Article versions have no customer read. The topics planner reads titles to avoid repeats and shows them to no one.

### Known gap: a live article changed in the general admin editor

An edit in **Admin → Articles** to a post already on the website saves over the stored article at once (`updateAnyArticle`). It goes back to pending, so nothing can send it, and the post on the website stays as it was. But the customer's article page reads that same row, so they see the staff text before anyone approved it. `two-step-delivery.test.ts` pins this. A pending article on the website is deliberately not hidden, because the customer's own change is what it usually holds.

Serving "the last approved or published revision" instead is not possible from what is stored today:

- `articles` holds one current revision.
- `article_versions` holds bodies only, and the general editor writes none, so the published body may be stored nowhere.
- `publication_dispatches.request_snapshot` holds title and slug, not body, excerpt or picture.
- `publish_logs` holds addresses and statuses. `article_versions` cannot be matched to `revision_hash` either, since that hash also needs the excerpt and picture.

To do it properly:

1. Capture the full delivered revision (title, slug, excerpt, body, picture, alt) at each send. This fits in `request_snapshot` with no migration, written in `claimDispatch` and read from the latest timely `sent` dispatch, at the cost of one article body per send. A dedicated column would be migration 0086.
2. Serve it to the customer while a live article is pending: `getArticle`, `listArticles`, the dashboard card, next actions, the backlink lists and report, the traffic report, the 7-day wins and best articles all name the title.
3. Decide what a customer edits and sees in that state. Their own pending change would disappear from their view, and Save must be refused or it overwrites the team's work from a stale base.
4. Decide what to show for every post delivered before the capture exists, which has no stored revision at all. Those would have to be hidden or stay as they are.

A smaller alternative is to refuse text edits on live articles in the general editor while the flow is on. It closes the gap in one check, but leaves staff no way to change a live article's stored text. Neither is built.

## With the switch off

Behaviour is exactly as before. Only Partner Network websites wait for the team, and only with managed review on. Customers read every draft, approve flagged sources themselves, and press Publish or Send as draft. Any edit after approval goes back to review. A first article goes out by itself.

## Transition

Run the dry run first. It reads whatever database it is pointed at, in a read-only transaction, and prints counts only:

```
TWO_STEP_DATABASE_URL=... node scripts/two-step-transition-dry-run.mjs
```

Turning the switch on then runs `activateTwoStep` once, in the switch's own transaction, under the lock generation saves take. No migration is needed. Nothing is approved, sent, republished or announced by it.

| Article, now | What happens | Dry-run class |
| --- | --- | --- |
| Draft waiting for a customer's source approval | Moves to the queue | `moves_waiting_for_customer_sources` |
| Draft on an automatic site, no press waiting | Moves to the queue, or the next release would send it unreviewed | `moves_automatic_publishing` |
| Team-approved draft that changed since, or still waiting for the customer's source approval | Back to the queue | `moves_approval_no_longer_stands` |
| Draft on a manual site, the customer already reads it | Stays. Only their own press sends it, and an automatic path refuses it | `stays_manual_draft_customer_reads` |
| Customer already pressed Publish (plugin) | Stays and goes out on that press | `stays_customer_press_waiting` |
| Team-approved draft, as approved | Stays ready, keeps its date. No retroactive notification | `stays_approved_ready` |
| Already in the queue | Stays. Hidden from the customer from now on | `already_in_queue` |
| Being written | Decided when it is saved: goes to the queue | `being_written` |
| Being delivered | Skipped, and the delivery finishes | `being_delivered` |
| Live, or a CMS draft | Untouched. Never republished | `delivered` |
| Live, with sources still held | Untouched. Goes to the queue if the customer changes it or presses Update | `delivered_with_held_sources` |
| Failed | Untouched | `failed` |

Assumptions:

- A draft the customer can already read on a manual site was delivered under the old rules. It is not taken back.
- The queue can grow at switch-on by the `moves_` counts. Plan the team's time from the dry run; the queue lists up to its existing limit.
- A website still waiting for a first article stops getting the first-article release. The dry run counts these websites.
- Automatic websites stay automatic (see the open point above). The dry run counts them by mode.

To turn the switch off again: new drafts follow the earlier rules, and first articles go out by themselves again. Articles in the queue stay there and their customers can read them again while they wait, so the team should finish the queue. No data is changed by either direction beyond what is listed above.

## Code

- `lib/publishing/controls.ts`: the `two_step_articles` control, `activateTwoStep`.
- `lib/articles/review.ts`: `twoStepArticles()`, `twoStepOffSql`, `heldFromCustomer`, `heldFromCustomerSql`, `reviewStatusForNewDraft`, `afterCustomerEdit`, `sendToTeam`.
- `lib/publishing/policy.ts`: `isFirstArticle`, where the first-article exception ends.
- `lib/publishing/dispatch.ts`: `claimDispatch`, the last check on every path and attempt.
- `lib/articles/release.ts`: `releaseAfterApproval`, `notifyReady`.
- `lib/backlinks/managed.ts`: `approveArticle`, whose approval also stamps the sources and clears an older press.
- `lib/articles/actions.ts`: `getArticle`, `listArticles`.
- `app/(app)/websites/[websiteId]/articles/[articleId]/article-preparing.tsx`, `article-publishing.tsx`.
- `lib/i18n/article-delivery.ts`: the customer's words, five languages.
- `scripts/two-step-transition-dry-run.mjs`.
- Tests: `lib/articles/two-step.test.ts`, `lib/articles/two-step-delivery.test.ts`, `lib/articles/two-step-delivery.postgres.test.ts`.
