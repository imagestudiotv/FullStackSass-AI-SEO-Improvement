# Two-step articles

Client requests 2026-11-02 and 2026-11-05: "Only 2 clear steps. 1. We receive the articles on the admin dashboard and do our work (editing, adding backlinks). 2. The client sees a ready version to publish."

The flow sits behind one switch: **Admin → Network → Operations → Two-step articles** (`platform_controls.two_step_articles`). It is off after a deploy, and nothing below applies until an operator turns it on. Everything new is behind this same switch. The earlier rules are kept as the switch-off branch so that the deploy is safe, and can be removed once the switch has been on for good.

**Deploy order:** apply migration 0086 before deploying this build, because reads select `articles.approved_revision`.

RepGet's own blog editorial and translation review is a separate pipeline and is not touched by any of this.

## With the switch on

### 1. The team

Every new draft goes to the review queue (`/admin/network`): every website, Partner Network or not, and the free articles of new customers too. A new customer's first article is marked **First article** and listed first; articles whose sources are flagged are marked **Check sources**. The team edits, places links, and approves once.

Their approval stores that exact revision and its hash (`articles.approved_revision`), and covers the sources too. The customer approves nothing, ever.

The first article goes this way through the ordinary generation path as soon as it is queued.

### 2. The customer

Until the first approval they get an honest status and nothing of the article: no text, excerpt, picture, sources, notes or links, and no stored title.

**The title they see.** A held article's stored title never appears, because generation and the team write it. What appears is the topic on the customer's own plan row (`calendar_items.title`). They could already see that row, and neither generation nor the team writes it. An article with no plan row, such as a translation or a removed topic, shows a translated fallback.

After approval the exact revision is **ready**. They get one bell notification in the workspace owner's language, and the finished article with **one Publish button**. There is no "Approve research", no "Send as draft" and nothing else to press. Publish goes through the connected CMS or the WordPress plugin, and the panel reports the recorded result. A failure is shown and they can press again. A second press of a version already there is refused and tells them so.

Not connected: the page says the article is ready but not on their website, and leads to the connection page. Nothing claims it is live.

### How "one Publish action" fits with automatic publishing

Publishing modes a customer explicitly chose stay in force, and only ever send an approved revision.

| Mode, or path | Before approval | After approval |
| --- | --- | --- |
| Manual (auto-publish off) | Nothing can send it | Goes out only when the customer presses Publish |
| Automatic, live | Nothing can send it | Goes live by itself on its planned day. Already due: at approval. Publish is still there to send it sooner |
| Automatic, drafts | Nothing can send it | Sent to the CMS as a draft on its planned day. Publish makes it live |
| Scheduled release (daily job) | Skips it | Sends approved revisions on their day, for automatic sites only |
| First article | Nothing can send it | **Changed:** no longer goes live by itself. It follows the three modes above |
| Connecting a CMS | Sends nothing | **Changed:** no longer sends the first article. A due article on an automatic site goes at the next daily release |
| WordPress plugin | Not in its feed | The same rules as a direct connection |
| New website | Starts on manual | **Changed:** automatic publishing is the customer's choice on the Publishing page, not a default |

On manual sites, the customer's Publish is the only way out. On automatic sites the customer chose in advance not to press anything, so Publish is an option to go sooner. A site's "Publish as: draft" setting still governs its automatic sends. A press is always Publish.

**Open point.** Until this flow, every new website was created with automatic publishing on, as an agreed default. Nothing records which existing customers chose it and which simply kept it, so all of them keep it. Their approved articles go out by themselves. The dry run counts these websites. Whether to move any of them to manual is a business decision and is not done here.

### Editing after approval: working copy and stored revision

A change to an approved or published article is a **working copy**, and it stays private until the team approves it. This covers:

- the customer's edit or picture change;
- the team's edit or reopening;
- an edit in the general admin editor;
- a rewrite.

The article can be live or not.

While a working copy waits:

- **The customer reads the stored revision:** its title, text, excerpt and picture, on every page. They are told the team is working on a change, and the text cannot be edited. Saving is refused because it would overwrite the team's work.
- **Publish stays on and sends exactly the stored revision.** If that version is already on the website, Update is disabled, since there is nothing new to send. The customer's own pending change is not in that version; it arrives after the team approves it, with one new notification.
- **Automatic modes and the plugin** also send only the stored revision, on the same schedule rules.
- **Public outputs** (translations, social suggestions, video ideas, internal-link suggestions) read the stored revision.

An approval replaces the stored revision. An approval never republishes a live post by itself: the customer's Update does. On a plugin site that needs plugin 1.10.0 or later, which updates the post it already has for the article, featured image included. An older plugin is refused with a message to update it. A post held as a WordPress draft is not updated from RepGet, because that would overwrite an editor's work: the page says it is on the site as a draft and is published from WordPress, with no Publish button.

**Reopening does not recall.** Reopening or editing an approved article leaves its stored revision in force. So on an automatic site the daily release can still send the old text on its day, and a customer's press still can.

A post with a change waiting at switch-on has no approved revision, so nothing can send it until the team approves one.

**One hold:** if the team withdraws a placed link, the stored revision still carries a link whose credits were released, so it does not go out until the team approves a new revision. The customer still reads it, and a press tells them the team is preparing it.

A press covers the revision it was made on. A new approval clears a press recorded for the plugin, and a job prepared from an older revision stops rather than sending the new one.

### What is checked at send time

Every path ends at `claimDispatch`, in one transaction under the article's row lock. It uses `sendableRevision`: the working copy if the team approved it as it stands, otherwise the stored revision if its contents still match its hash, otherwise nothing. What the claim returns is what is sent, and its hash is recorded on the dispatch. Only a person's press can send a stored revision nobody approved (what stood on the website at switch-on), and only as an update of the same post.

A send changes nothing in the revision:

- **Dead links** are not repaired at send time, because a repair would publish different text under the old approval. They go out as approved, and the defect is recorded on the dispatch (`request_snapshot.linkDefects`) and in the job's log. Returning the article to the team instead would turn the customer's press into a silent hold.
- **The header picture** stays the approved one on the article. The CMS's copy is used for that post but is not written back, so the hash never moves. A revision with no picture goes out with none: nothing is generated at send time.
- **Placements** count as published only if their link is in the text that actually went out.
- **Delivery-only changes** (the "Powered by" line, responsive images, section-link repair, link follow attributes) are computed from the claimed text at each send, are not stored, and are not part of the hash. This was already the case.

### What is held

`heldFromCustomer` and `heldFromCustomerSql` in `lib/articles/review.ts`: pending, or approved with a hash that no longer matches.

| Path | Result while held |
| --- | --- |
| Article page, tab title, `getArticle` | Stored revision, or an empty article with a preparing page |
| `listArticles`: list, search, calendar, chat | Stored revision's title; otherwise plan topic or fallback, and "With the RepGet team" |
| Dashboard card, 7-day wins, best articles | The same; no picture without a stored revision |
| Next actions, including failed tasks; Tasks | The same title; no approval is ever requested |
| AI chat tools | The two reads above, with the fallback in words |
| Sources panel | Renders nothing. After approval, one line: "Checked by the RepGet team" |
| Backlinks: hosted list and report | Links not yet on the page are not listed; live ones show the stored title |
| Traffic report | Stored title, or just the page's address |
| Picture library | Pictures of a held article are not offered |
| Edit, picture actions, rewrite, source approval | Refused |
| Bell, email, nofollow and indexed notices | The revision sent, or the stored title |
| Leaving the Partner Network | Does not release it |

Article versions have no customer read.

## With the switch off

Behaviour is as before. Only Partner Network websites wait for the team, and only with managed review on. Customers read every draft, approve flagged sources themselves, and press Publish or Send as draft. Any edit after approval goes back to review. A first article goes out by itself. The `approved_revision` column stays unused.

## Transition

Apply migration 0086, deploy, and run the dry run. It reads whatever database it is pointed at, in a read-only transaction, and prints counts only:

```
TWO_STEP_DATABASE_URL=... node scripts/two-step-transition-dry-run.mjs
```

Turning the switch on then runs `activateTwoStep` once, in the switch's own transaction, under the lock generation saves take. Nothing is approved, sent, republished or announced by it.

| Article, now | What happens | Dry-run class |
| --- | --- | --- |
| Draft never approved by the team, including a recorded press | Moves to the queue, and the customer stops reading it until approved | `moves_never_approved` |
| Team-approved draft that changed since, or still waiting for the customer's source approval | Back to the queue | `moves_approval_no_longer_stands` |
| Team-approved draft, as approved | Stays ready, keeps its date, stored revision taken. No retroactive notification | `stays_approved_ready` |
| Already in the queue | Stays. Hidden from the customer from now on | `already_in_queue` |
| Being written | Decided when it is saved: goes to the queue | `being_written` |
| Being delivered | Skipped, and the delivery finishes | `being_delivered` |
| Live, or a CMS draft | Never republished. What stands is stored as source `published`: the customer keeps reading it, and only their press can resend it | `delivered` |
| Live, with sources still held | The same | `delivered_with_held_sources` |
| Live, approved, but its hash no longer matches | The old publish job wrote the CMS's picture address without re-hashing, so this is what the post is. Stored as source `published` and taken out of the review: not approved, not queued, not resent | `on_site_approval_stale_stored_as_published` |
| Live, with a change waiting for the team, last sent text provable | The latest settled send's hash matches a mix of the working copy, earlier saved bodies and the send's title and slug. That text is stored as source `published`: the customer reads it, only their press can resend it, and the change stays in the queue | `on_site_change_waiting_sent_text_recovered` |
| Live, with a change waiting for the team, no proof | Nothing is stored, and the working copy is not shown. The post stays on the website; the customer sees that it is live, a link to it, and that the text appears once the team finishes. No path sends it and nothing is approved. Public outputs leave it out | `on_site_change_waiting_text_unavailable` |
| Failed | Untouched | `failed` |

A press still recorded on a delivered article is cleared at switch-on, unsent. The dry run counts them.


Assumptions:

- The queue can grow at switch-on by the `moves_` counts. Plan the team's time from the dry run.
- A website still waiting for a first article stops getting the first-article release. The dry run counts these websites.
- Automatic websites stay automatic (see the open point above). The dry run counts them by mode.

To turn the switch off again: new drafts follow the earlier rules, and first articles go out by themselves again. Articles in the queue stay there and their customers can read their working copies again, so the team should finish the queue first.

Rollback of the column: `ALTER TABLE "articles" DROP COLUMN "approved_revision";`, after deploying a build without it.

## Code

- `drizzle/0086_article_approved_revision.sql`.
- `lib/publishing/controls.ts`: the `two_step_articles` control, `activateTwoStep`.
- `lib/articles/review.ts`: `sendableRevision`, `StoredRevision`, `heldFromCustomer`, `customerTitleSql`, `afterArticleEdit`.
- `lib/publishing/policy.ts`: `isFirstArticle`, where the first-article exception ends.
- `lib/publishing/dispatch.ts`: `claimDispatch`, the last check on every path and attempt; `carriesWithdrawnLink`, `recordLinkFindings`.
- `lib/articles/release.ts`: `releaseAfterApproval`, `notifyReady`.
- `lib/backlinks/managed.ts`: `approveArticle`, which stores the revision, stamps the sources and clears an older press.
- `lib/articles/actions.ts`: `getArticle`, `listArticles`.
- `app/(app)/websites/[websiteId]/articles/[articleId]/article-preparing.tsx`, `article-publishing.tsx`.
- `lib/i18n/article-delivery.ts`: the customer's words, five languages.
- `scripts/two-step-transition-dry-run.mjs`.
- Tests: `lib/articles/two-step.test.ts`, `lib/articles/two-step-delivery.test.ts`, `lib/articles/two-step-delivery.postgres.test.ts`, `inngest/functions/generation-network.test.ts`.
