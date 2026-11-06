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
| Automatic, drafts | Nothing can send it | Sent to the CMS as a draft on its planned day. Publish makes it live. On a plugin site: see "Publish on a post held as a WordPress draft" |
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

An approval replaces the stored revision. An approval never republishes a live post by itself: the customer's Update does. On a plugin site that needs plugin 1.10.0 or later, which updates the post it already has for the article, featured image included. An older plugin is refused with a message to update it.

### Publish on a post held as a WordPress draft (plugin sites)

A site in the automatic "drafts" mode already holds the article as a WordPress draft, and somebody may have worked on it there. RepGet cannot see that, so the plugin decides, on the site, when the customer presses Publish. Only a person's press does this: the feed sends the instruction (`existingDraft`) from the claim, and automatic paths never carry it.

Plugin 1.10.0 records, after every write, a fingerprint of the post as WordPress saved it (title, text, excerpt, address, password, featured image) and the RepGet revision it was. A date set in the future also counts as a change. Saving with no change does not, nor do categories, tags or SEO fields, which are not part of what the team approved.

| The plugin finds | What it does | What the customer sees |
| --- | --- | --- |
| A draft, unchanged, holding this revision | Publishes that post, changing its status and giving it a date and a unique address | Live on your website, with the real address |
| A draft, unchanged, holding an older approved revision | Writes exactly the sent revision to that post, then publishes it. A save landing first refuses it (see "Updating a post" below) | The same |
| A draft that was changed | Nothing | The draft was changed in WordPress and must be published there |
| A draft written by plugin 1.9.0 or older | Publishes it only if it holds exactly what RepGet sends now. Otherwise nothing, because nothing proves it is unchanged | The same result, or RepGet cannot confirm it is unchanged and it must be published there |
| Pending, scheduled or private | Nothing | The draft was changed in WordPress |
| Open in WordPress by somebody else | Nothing | Somebody has it open: ask them to close it, then try again |
| Already published | Nothing is written. Recorded as live with its real address, marked `publishedInWordPress` on the delivery | Live on your website, and that what is live may differ from this version. Update stays off until the team approves a newer one |
| In the trash | Nothing, and it stays there | Restore it, then press Publish again |
| Deleted | Nothing, and no new post | It was deleted. Contact the team |

A refusal ends that delivery as failed and answers the press, so nothing retries it and nothing resolves it. Publish stays, and pressing again asks the site again: after the customer publishes in WordPress, that records the post as live. There is no duplicate under any retry: the post is found by the article's identity, a press never creates a post RepGet has on record, a repeated hand-over finds it already live, and a parked report settles its own delivery.

**Plugin 1.9.0 and older** cannot do this, and would overwrite the draft and leave it a draft, so they never receive these presses. The page shows no Publish button on such a draft and says to update the plugin to 1.10 or later, or publish from WordPress. The version is the one the site last reported, so a site updated moments ago shows this until its next check.

**With the flow off** nothing changes: a delivered draft is not offered to the plugin, and the page shows what it showed before.

### Updating a post that is already on the website

Plugin and direct connections alike, with the switch on or off: an update is sent only if the post can be shown unchanged since RepGet last sent it. Otherwise it is refused, with a translated reason on the panel and one notification, nothing is retried, and pressing again asks the site again. There is no override.

| The site | What protects the post | Refused when |
| --- | --- | --- |
| WordPress, plugin 1.10.0 | **Compare-and-swap in the database.** One `UPDATE` whose `WHERE` holds the exact bytes (MD5) of the title, text, excerpt, address and password, plus status and date. A save reaching the row first makes it match nothing. See "What is not atomic" below | Changed, no record and not proved, somebody has it open, trashed, deleted |
| Ghost | **Ghost's own optimistic lock.** The post is read and compared, and the update carries the `updated_at` read; Ghost refuses it if that is not what it holds. Its timestamps have a resolution of a second. Not exercised against a real Ghost here | Changed, or refused by Ghost (409), deleted |
| WordPress, direct | **Check, then write: not atomic.** The REST API has no `If-Match`. A save landing between the read and the write, a window of one request, is replaced; WordPress keeps it as a revision where revisions are on | Changed, trashed, deleted, cannot be shown |
| Shopify, Webflow, Wix | **Check, then write: not atomic**, the same window, and no revision to fall back on. Written from their documentation with stubbed requests, not against real stores. Wix's last-edit field could not be confirmed from its reference, so Wix leans on the hash | Changed, deleted, archived (Webflow), cannot be shown |
| Webhook | Nothing can be read, so **no update is sent at all** | Every update |

**How a direct connection tells.** Each send keeps what the platform answered, its last-saved time and a hash of what a reader sees (`request_snapshot.remoteBaseline`), with no migration. The post counts as unchanged if either still matches: the hash lets a Save with no change through, the time allows for a platform that answers a write and a read differently. An edit within the same second as the send is not seen. Re-reading after the write to report a later change is left out: it would narrow nothing, and could not tell our write from the next save.

**Posts sent before this existed** (`SEND_TIME_TOLERANCE_MS`, 2 minutes): sent directly, they count as unchanged only if the platform's last-saved time is no later than the send, plus the tolerance. An edit within the tolerance is not seen. Anything else that moves the time is refused, including a plugin touching the post or a Save with no change: the safe direction. Through the plugin, they have no record: an update is refused unless the post already holds exactly what RepGet sends.

**The switch off is not exempt**, so this is a change for existing customers even with the flow off: pressing Update on a direct connection is now refused where it used to overwrite, and every update over a webhook is refused. Nothing changes for a first send.

**A retry after a lost answer.** The send itself changes the post, so a retry finds it different. An attempt that got no answer is recorded as possibly landed (`mayHaveLanded`), and covers the change if the post's last-saved time falls within that attempt, plus the tolerance, and, on WordPress, the post carries that attempt's ownership marker. A refused attempt, or one the site answered with a 4xx, covers nothing. On a platform without a marker, an edit in that same stretch is not seen.

**Through the plugin, a hand-over nobody pressed** (a repeat after a lost report, an automatic release, the flow off) uses the same comparison, but one it may not write is reported as it stands, marked `publishedInWordPress` when live. A refusal would bring it back at every check, with nobody to tell. The same revision again writes nothing. An automatic direct release of the same revision is refused once out loud, and quietly on later days.

**What is not atomic through the plugin.**

- The featured image and post meta are not in the row. The image is read once more just before the `UPDATE`, so a change before that refuses. One made in that instant is not seen by the swap: the text goes in, and the picture stays, because nothing here replaces a featured image somebody chose. The record then includes it.
- The record of what was written is its own query, just after the swap. A process killed in between leaves a post that reads as changed: refused, never overwritten.
- Pictures, SEO fields and save hooks follow the swap and can stop part way. The same revision again does not rewrite the text.
- The edit lock (`wp_check_post_lock`) is **advisory**: a time and a user in post meta, good for 150 seconds. A closed tab can hold it that long, and REST clients and other editors do not take or respect it. Somebody with unsaved work who opens the post just after the check, and then saves, replaces this write, as any later save does.
- A table not in a UTF-8 character set hashes other bytes than PHP does: every write there is refused, none overwrites.

`repget_localize_older_posts` (a post's pictures, copied later) was already a guarded `UPDATE`, of the text only. It now compares every fingerprinted column, and writes nothing else. It does not respect the edit lock, because it replaces no words: a person saving over it brings RepGet's picture addresses back, and the next check copies them again.

The hooks a guarded write fires, in `wp_insert_post`'s order: `wp_transition_post_status`, `edit_post`, `post_updated` (revisions, the redirect from a changed address), `save_post`, `wp_insert_post`, `wp_after_insert_post`. The columns go through `sanitize_post` and the `wp_insert_post_data` filter first, so they hold what `wp_update_post` would have stored. What was replaced is kept as a revision where revisions are on.

Concurrency across real processes is in `wordpress-plugin/tests/real-wordpress-concurrency.php`, cases 8 and 9, which CI runs on MySQL and which fail if the writer and the editor did not overlap.

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
| Live, or a CMS draft | Never republished. What stands is stored as source `published`: the customer keeps reading it, and no path sends it. A later change, or a Publish press on a CMS draft, goes to the team, whose approval is what makes anything sendable | `delivered` |
| Live, with sources still held | The same | `delivered_with_held_sources` |
| Live, approved, but its hash no longer matches | The approval is withdrawn and the article goes back to the queue, so the post may need the team again even when only the old publish job's picture address changed. The post stays online. The customer sees the text last sent if its hash proves it, otherwise the pending state. Nothing goes out until the team approves the exact revision | `moves_on_site_approval_no_longer_stands` |
| Live, with a change waiting for the team, last sent text provable | The latest settled send's hash matches a mix of the working copy, earlier saved bodies and the send's title and slug. That text is stored as source `published`: the customer reads it, no path sends it, and the change stays in the queue | `on_site_change_waiting_sent_text_recovered` |
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
- `lib/publishing/overwrite-guard.ts`: `checkBeforeUpdate`, `judgeUpdate`, `refuseUpdate`. The plugin's side: `repget_overwrite_post`, `repget_swap_row`, `repget_press_step`.
- `lib/articles/release.ts`: `releaseAfterApproval`, `notifyReady`.
- `lib/backlinks/managed.ts`: `approveArticle`, which stores the revision, stamps the sources and clears an older press.
- `lib/articles/actions.ts`: `getArticle`, `listArticles`.
- `app/(app)/websites/[websiteId]/articles/[articleId]/article-preparing.tsx`, `article-publishing.tsx`.
- `lib/i18n/article-delivery.ts`: the customer's words, five languages.
- `scripts/two-step-transition-dry-run.mjs`.
- Tests: `lib/articles/two-step.test.ts`, `lib/articles/two-step-delivery.test.ts`, `lib/articles/two-step-delivery.postgres.test.ts`, `inngest/functions/generation-network.test.ts`.
