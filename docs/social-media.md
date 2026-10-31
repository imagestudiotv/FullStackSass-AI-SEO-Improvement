# Social media

Client decisions of 2026-10-27. Every day RepGet suggests up to 10 posts and replies for each website, on six platforms. The customer's **own posts** are published automatically through bundle.social. **Replies** in other people's discussions are always posted by the customer, with one click.

| Platform | Connected by | Own posts | Replies |
|---|---|---|---|
| Reddit | bundle.social | Automatic, to the customer's profile (`u/name`), never into subreddits | One click: text copied, thread opened |
| Quora | Username only (no API) | None | One click: text copied, question opened |
| X | bundle.social | Automatic | One click: X's reply box opens with the text filled in |
| Threads | bundle.social | Automatic | One click: Threads' reply box opens with the text filled in |
| Pinterest | bundle.social | Automatic Pins on a chosen board, using the website's own article images | None |
| Bluesky | bundle.social | Automatic | One click: text copied, post opened |

- **Without `BUNDLE_SOCIAL_API_KEY`**, every platform is connected by username, and own posts are one-click like replies.
- **Trials** (the free articles) can use Quora only. The other five platforms are shown but locked.
- **Cost:** each post or reply costs `social_post` credits. The client set this at 1; it is in Admin → Credits and is free until set.
  - **One-click:** the credit is charged when the customer clicks Post, which copies the text and opens the platform. A second click on the same suggestion costs nothing. The text is copied inside the click, before the new tab opens: copied a moment later, the browser refuses it because the page has lost the focus, and Quora (and replies on Reddit and Bluesky, which have no prefilled reply link) would open with nothing to paste. If copying fails the page says so. **Copy** on every suggestion and every posted item copies the text without posting or charging.
  - **Automatic:** the credit is charged when RepGet hands the post to bundle.social, and refunded if the platform refuses it.

## Not getting accounts banned

The client asked for this explicitly. Every draft is checked in code (`lib/social/rules.ts`) before it is shown or published. The prompt is not relied on.

1. **Warm-up:** an account's first 7 days have no links and no product or brand names (`WARMUP_DAYS`). This is also enforced when the customer edits a draft.
2. **Links after the warm-up:**
   - At most one link, and only to the website itself.
   - Only one own post in three may carry a link (`LINK_EVERY`).
   - Replies never carry links.
   - Pins link to their article.
3. **Volume:** one own post per account per day, and at most half of the day's 10 suggestions are own posts.
4. **Uneven timing:** own posts go out 3 to 9 hours after the 07:00 UTC run, at an uneven minute (`postingTime`).
5. **No repeats:**
   - A text is never repeated (`isRepeat`).
   - A discussion is never suggested twice (a unique index on `social_suggestions`).
   - An article image is pinned only once (`nextPinImage` in `lib/social/suggest.ts`). Pinterest bans repetitive pins. A website with no unpinned image left gets no Pin until its next article.
6. **Platform limits:** each platform's length limit is enforced (`PLATFORMS[*].maxLength`).
7. **Replies stay with the customer:** RepGet never posts a reply itself.
8. **Honest mentions:** a reply that mentions the business says it is the writer's own (`replyText`).
   - Quora asks writers to disclose an affiliation, and Bluesky bans undisclosed commercial content (both checked on 2026-10-28).
   - The model keeps the name out of the reply and writes a separate disclosure sentence in the reply's language, such as "Disclosure: I run Image Studio." RepGet adds it at the end.
   - A reply whose body names the business is dropped, so the rule holds in code in any language.
   - It applies to what RepGet writes. A customer who edits a reply before posting it by hand is responsible for their own words.
9. **A refusal pauses automatic posting** for that account (`social_accounts.paused_at`).
   - The page explains why and offers Resume.
   - Until the customer resumes, own posts wait for a click instead of being retried into a ban.

## How it works

- **Daily run (07:00 UTC):** `social-suggestions-daily` → `suggest-social` per website → `lib/social/suggest.ts`. It tops up to 10 a day, so retries and the run after a new connection never exceed the day's 10.
  - **Finding discussions:** DataForSEO Google searches per platform, such as `site:reddit.com <keyword>`. Keywords rotate daily through the website's 20 best, and brand keywords are left out. It keeps organic results and Google's "Discussions and forums" block (`discussionSearch`, cached for a day). Costs are tracked as `seo_api` / `social_discovery`. Each search costs about USD 0.02, and a failed one USD 0.01 (measured 2026-10-28).
    - **Budget:** at most 2 searches per replying platform a day (`KEYWORDS_PER_PLATFORM`). Every platform is searched once. The rest go to the platforms still short of discussions, up to 3 each (`MAX_SEARCHES_PER_PLATFORM`). A platform that found plenty is not searched again. Google sometimes ignores `site:` (Quora got none in the first real test), and a failed search finds nothing.
    - **Any search counts:** a discussion counts for its platform whichever search found it. In the real test, the Reddit search found a Quora question.
    - **Quora languages:** Quora has a site per language (`it.quora.com`); `quora.com` is English. Only questions in the website's language are answered.
  - **Drafts:** one Claude call per website per day (`lib/social/write.ts`, tracked as `social_suggestions`). Discussion text is marked as untrusted data (`social_thread`).
- **Publishing:** `publish-social-post` waits until the post's time, then calls `lib/social/publish.ts`. It checks the post's status under a row lock, so publishing, "Publish now" and a retry publish a post only once. It then follows the post with `GET /post/{id}` every 2 minutes, up to 6 times, and records the permalink.
- **Connecting** (`lib/social/actions.ts` `startSocialConnect`):
  1. RepGet creates one bundle.social team per website (`social_teams`).
  2. The customer is sent to bundle.social's hosted connect page.
  3. The customer comes back through `/api/social/connected`. That route re-reads the team's accounts (`syncBundleAccounts`), starts the warm-up for a new account, and queues the first suggestions.
- **Page:** `/websites/[id]/social`, in the sidebar as **Social media**.

## Setup

1. Apply migration `0078_social_media` before deploying the code. It adds three tables: `social_accounts`, `social_teams` and `social_suggestions`.
2. Set up bundle.social:
   - Create the account with the client's business email, so the same account is upgraded later and nothing is lost.
   - Copy the API key into `BUNDLE_SOCIAL_API_KEY` on Vercel.
   - The free plan (3 websites, 20 posts a month) is enough to test.
   - Upgrade to Pro (USD 100/month) before customers use it.
   - X charges $0.015 per post and $0.20 per post with a link. This comes from bundle.social's prepaid balance.
3. In Admin → Credits, set "Social media post or reply" to 1.
4. DataForSEO and Anthropic keys must be set; they already are for articles.

## Open

- **Bluesky was tested on a real account (2026-10-29)**, on the free bundle.social plan. The steps:
  - connect;
  - read the account back (`syncBundleAccounts`);
  - publish one post (`publishSuggestion`), confirmed as posted on the first check, with the permalink recorded and 1 credit charged once.
  - bundle.social connects Bluesky through Bluesky's own sign-in page (OAuth). That page takes the account's **real password**: Bluesky app passwords are refused there, though they work elsewhere. Customer help text should say so.
- Pinterest's field format follows bundle.social's documentation but has not been tried on a real account. Test it on the free plan first.
- Reddit own posts go to the profile only. Posting into chosen subreddits would need per-subreddit rules and flairs (`reddit:requirements`), and is a bigger ban risk.
