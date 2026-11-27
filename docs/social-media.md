# Social media

Client decisions of 2026-10-27. Every day RepGet suggests up to 10 posts and replies for each website, on six platforms (seven with LinkedIn, below), with or without connected accounts (client, 2026-11-24). The customer's **own posts** are published automatically through bundle.social. **Replies** in other people's discussions are always posted by the customer, with one click.

| Platform | Connected by | Own posts | Replies |
|---|---|---|---|
| Reddit | bundle.social | Automatic, to the customer's profile (`u/name`), never into subreddits | One click: text copied, thread opened |
| Quora | Username only (no API) | None | One click: text copied, question opened |
| X | bundle.social | Automatic | One click: X's reply box opens with the text filled in |
| Threads | bundle.social | Automatic | One click: Threads' reply box opens with the text filled in |
| Pinterest | bundle.social | Automatic Pins on a chosen board, using the website's own article images; the same account and board also take the video Pins (docs/videos.md) | None |
| Bluesky | bundle.social | Automatic | One click: text copied, post opened |
| LinkedIn (2026-11-27) | bundle.social, the same connection as Videos | Automatic, to the profile or company page chosen on bundle.social's page; one click (LinkedIn's share box) without an account | None: LinkedIn's API cannot search or read other people's posts, and scraping is against its terms |

- **LinkedIn only exists in Social while `BUNDLE_SOCIAL_API_KEY` is set** (`NEEDS_BUNDLE`, `availablePlatforms` in `lib/social/platforms.ts`): hidden on the page, left out of the plan's platforms and of the daily run otherwise. No LinkedIn developer app is needed: bundle.social's own approved LinkedIn app posts for the member or the page (organisation posting included). A website that connected LinkedIn for Videos already has the account, and its own posts start the next morning (automatic, like X and Pinterest, which are shared the same way); they are not published until a profile or page is chosen (`social_accounts.target`).

- **Without `BUNDLE_SOCIAL_API_KEY`**, every platform is connected by username, and own posts are one-click like replies.
- **Trials:** since 2026-11-13 a new account's 3-day free trial has every social network its plan includes, with the plan's monthly social-post allowance pro-rated to the trial (`lib/usage.ts`). Before that, trials (the free articles) could use Quora only, with the other five platforms shown but locked.
- **Cost:** each post or reply costs `social_post` credits. The client set this at 1; it is in Admin → Credits and is free until set.
  - **One-click:** the credit is charged when the customer clicks Post, which copies the text and opens the platform. A second click on the same suggestion costs nothing. The text is copied inside the click, before the new tab opens: copied a moment later, the browser refuses it because the page has lost the focus, and Quora (and replies on Reddit and Bluesky, which have no prefilled reply link) would open with nothing to paste. If copying fails the page says so. The tab opens at the platform's address in the click itself, never empty: the page and the server work the address out with the same rule (`lib/social/post-target.ts`), and RepGet records and charges it behind the open tab. A refusal (no credits, the Free plan's posts used, a warm-up link) charges and moves nothing, and says why on the page; the opened tab stays open. **Copy** on every suggestion and every posted item copies the text without posting or charging.
  - **Posted by hand after a refusal:** RepGet's own try was charged and refunded under `social:<id>`; posting it by hand is charged once, under `social:<id>:hand` (charging the refunded key again would take nothing). A scheduled own post can be posted by hand too: the row lock makes sure it goes out once.
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
8. **Replies do not promote** (Daniel, 2026-11-27: "Generated Reddit replies are promotional... Reddit bans fast"; `lib/social/mention.ts`):
   - By default a reply never names or links the business. The prompt asks for a specific, human answer (varied openings, no marketing words, no calls to action, no long dashes), and code drops any reply with sales phrases (`soundsPromotional`) and turns long dashes into hyphens (`naturalise`).
   - A reply may name the business only when the discussion asks for recommendations, tools or services (`asksForRecommendations`), the community is not one known to remove self-promotion (`communityOf`: a list of large subreddits, and names such as r/Ask..., ...help, ...advice), the account is past its warm-up, and at most one reply in ten on that platform names it over 30 days (`mayMention`; waiting suggestions that name it count too). This is decided in code before the model writes (`mayMention` per discussion); a disclosure on any other discussion is dropped.
   - The same gate applies when the customer edits a reply to name the business: Post and Save draft refuse it (`mention_not_allowed`).
   - There is no rules text to read (discussions come from Google), so the review drawer links each subreddit's rules page and warns where self-promotion is removed.
9. **Honest mentions:** a reply that mentions the business says it is the writer's own (`replyText`).
   - Quora asks writers to disclose an affiliation, and Bluesky bans undisclosed commercial content (both checked on 2026-10-28).
   - The model keeps the name out of the reply and writes a separate disclosure sentence in the reply's language, such as "Disclosure: I run Image Studio." RepGet adds it at the end.
   - A reply whose body names the business is dropped, so the rule holds in code in any language.
10. **A refusal pauses automatic posting** for that account (`social_accounts.paused_at`, the reason in `paused_reason`), and its other waiting posts become one-click.
   - **Customers are not shown why** (client, 2026-11-24): the post is simply ready to post by hand (`customerStatus`; the reason and the post's `error` never reach the browser). In the database the post stays `failed` with its `error`, for Admin. Only "not enough credits" and "this month's free posts are used" are shown.
   - **A limit of our posting provider starts again by itself** (`pauseKind` "quota" in `lib/social/pause.ts`: the monthly post limit, the X balance): three days later or on the first of the next UTC month, whichever is sooner, checked by the daily job (`resumeQuotaPauses`). The next own post is the one try; a refusal pauses it again. The platform never saw such a post, so this cannot cause a ban.
   - **A platform's refusal, or any reason not recognised, never starts again by itself.** Account settings shows "Automatic posting is paused" with **Turn on again**, without the provider's words.

## How it works

- **Without a connected account** (client, 2026-11-24: "suggestions without social accounts connected, based on the website information"):
  - Every platform the plan includes gets suggestions, from the profile, keywords (else industry and services, else article titles) and articles. Connected accounts come first in the day's ten; the others' are posted by hand and written as in a warm-up (no links, no product names), because RepGet does not know the account.
  - Discussions are searched on Reddit and Quora only where no account is connected (`SEARCH_WITHOUT_ACCOUNT`).
  - **Which websites, every morning** (`lib/social/daily.ts`): those with an account, as before; paid ones without; Free ones without on one weekday of their own and in their first two days. With no account at all, the morning run stops while ten suggestions of the last week are still waiting (`DORMANT_WAITING`), so an unused page costs about one run a week. Find suggestions is not stopped by it.
  - Nothing is suggested before the website's analysis has finished; the page says so.
- **Daily run (07:00 UTC):** `social-suggestions-daily` → `suggest-social` per website → `lib/social/suggest.ts`. It tops up to 10 a day, so retries and the run after a new connection never exceed the day's 10.
  - **Finding discussions:** DataForSEO Google searches per platform, such as `site:reddit.com <keyword>`. Keywords rotate daily through the website's 20 best, and brand keywords are left out. It keeps organic results and Google's "Discussions and forums" block (`discussionSearch`, cached for a day). Costs are tracked as `seo_api` / `social_discovery`. Each search costs about USD 0.02, and a failed one USD 0.01 (measured 2026-10-28).
    - **Budget:** at most 2 searches per replying platform a day (`KEYWORDS_PER_PLATFORM`). Every platform is searched once. The rest go to the platforms still short of discussions, up to 3 each (`MAX_SEARCHES_PER_PLATFORM`). A platform that found plenty is not searched again. Google sometimes ignores `site:` (Quora got none in the first real test), and a failed search finds nothing.
    - **Recent Reddit threads only:** Reddit archives a thread after six months and then refuses comments, so Reddit searches ask Google for the last 5 months (`maxAgeMonths` in `lib/social/platforms.ts`) and drop any dated result older than that. A result without a date is kept. Suggestions saved before this rule are not removed.
    - **Reddit is searched first, and widens** (`searchQuery`; client, 2026-11-24: no Reddit discussions were found any more): the keyword on the site with Google's five-month filter; then its main words with `after:<date>` in the query; then the main words and "reddit" without `site:`. DataForSEO answers an empty result page with an error (40102), so identical narrow searches all failed the same way. While Reddit has nothing it is searched before the other platforms' second searches; the total stays 2 per replying platform. Up to five Reddit discussions are offered to the model. The job's log has each platform's counts (`discussions`: searches, failed, found, old, known, offered, written, kept).
    - **Any search counts:** a discussion counts for its platform whichever search found it. In the real test, the Reddit search found a Quora question.
    - **Quora languages:** Quora has a site per language (`it.quora.com`); `quora.com` is English. Only questions in the website's language are answered.
  - **Drafts:** one Claude call per website per day (`lib/social/write.ts`, tracked as `social_suggestions`). Discussion text is marked as untrusted data (`social_thread`).
- **Publishing:** `publish-social-post` waits until the post's time, then calls `lib/social/publish.ts`. It checks the post's status under a row lock, so publishing, "Publish now" and a retry publish a post only once. It then follows the post with `GET /post/{id}` every 2 minutes, up to 6 times, and records the permalink.
- **Connecting** (`lib/social/actions.ts` `startSocialConnect`):
  1. RepGet creates one bundle.social team per website (`social_teams`).
  2. The customer is sent to bundle.social's hosted connect page.
  3. The customer comes back through `/api/social/connected`. That route re-reads the team's accounts (`syncBundleAccounts`), starts the warm-up for a new account, and queues the first suggestions.
  4. It returns to the Opportunities page **at the Social connections panel** (`#social-connections`, `lib/social/connect-return.ts`) with `?social=connected|not_connected|connect_failed|not_configured&platform=…`; the panel shows the result as a toast, removes the query from the address (a reload does not repeat it) and keeps itself in view, so the next account is one click (client, 2026-11-11). A video platform (or Pinterest connected from Videos) returns to the Videos page as before.
- **Page:** `/websites/[id]/social`, **Opportunities** (redesigned from the client's design, 2026-11-03).
  - **Social connections** (client's design, 2026-11-11, `connections-panel.tsx`): "N of 6 connected" with a meter and a card per platform, each with Connect or Disconnect (Disconnect asks for confirmation). Connect goes to bundle.social; Quora, and every platform while bundle.social is not set up, asks for the username in a small dialog. A trial's locked platforms (the free-articles trials of before 2026-11-13) show "Included once your plan starts." and a disabled Connect; an account on a platform the plan no longer includes is not counted. A viewer sees the cards without buttons. A connected account's own settings (profile, warm-up, automatic posting, a pause, Pinterest board) are behind **Account settings** in the panel's footer (`accounts-dialog.tsx`).
  - One panel, **All conversations**, in tabs by stage: Suggested (`new`), Scheduled (`scheduled`, `posting`), Drafts (`draft`), Published (`posted`). Search, a platform filter and a sort (recommended, newest).
  - **One row per platform** (client, 2026-11-24, `platform-groups.tsx`): icon, name, "N opportunities · Connected / Not connected", "N new", "N total". It opens to that platform's opportunities; which are open is remembered in the browser, and a search or filter opens what matches.
  - **Every opportunity has a button to the real place:** "Open on Reddit" (the discussion) or "Create on Reddit" (the platform's new-post page, filled in where it can be). It is the one-click post: the text is copied, the place opens and it counts as posted, with the price on the button. The source (`r/...`) opens the discussion without copying or charging. Only an own post RepGet is handing over right now has none. A viewer can open discussions only.
  - A `failed` post for credits or the Free month is under All only, with what to do.
  - **Next to publish:** the soonest scheduled own post, with Publish now, Copy and Skip.
  - **Skip on a scheduled own post moves it to Drafts** (client, 2026-11-03): RepGet no longer publishes it, and the text is kept to edit and post later. Skip on anything else, or on a draft, dismisses it.
  - A row opens the **review drawer**: the discussion, the editable text with its length and warm-up hints, and Copy text, Save draft and Post. The Post button copies and opens the platform inside the click, as above.
  - **Drafts:** Save draft (`saveSocialDraft`) keeps an edit of a `new` suggestion without posting or charging, as status `draft`. It is checked against the same rules as a post. A draft stays one-click: RepGet never publishes it. It is shown, counted in Tasks and read by the chat like a new suggestion, for the same week.

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

## RepGet's own website (internal testing)

The owner's decision (2026-11-05): repget.com goes in Daniel's existing workspace, the one holding Image Studio, with scoped internal testing access and no paid subscription.

1. **Add the website.** `scripts/setup-repget-site.ts --workspace <id or slug>` shows what it would do; `--apply` does it. It refuses a workspace without `imagestudio.com`, makes one website however often it runs, and starts no blog, publishing or link job (`lib/websites/own-site-setup.ts`). It grants nothing.
2. **Open the two tools.** Add the website id it prints to `INTERNAL_TEST_WEBSITE_IDS` on the deployment and redeploy. Unset means nobody.

What that opens (`lib/billing/internal-testing.ts`):

- **Website audits and these social tools, on that website only, while it has no subscription.** A cancelled subscription stays refused. Buying a plan simply replaces the access.
- **Everything else stays closed:** articles, keywords, AI visibility, backlinks, chat, videos, translations. Other websites in the workspace, Image Studio included, are not affected.
- **It writes nothing:** no subscription, plan, credits or agency row. Priced actions are charged to the workspace's wallet as usual.

**Nothing posts by itself.** A paid plan's connected accounts publish own posts automatically, and `auto_post` defaults to on, so this access has its own setting: every platform is available, own posts wait for a click like replies, and the publishing job hands back anything it is given (`manualOnly` in `socialAccess`).

**It still costs something once an account is connected:** the daily suggestions make searches and a model call, as for any website (see Daily run above). Without keywords, which stay closed, replies are searched from the website's industry and services.

## Open

- **Bluesky was tested on a real account (2026-10-29)**, on the free bundle.social plan. The steps:
  - connect;
  - read the account back (`syncBundleAccounts`);
  - publish one post (`publishSuggestion`), confirmed as posted on the first check, with the permalink recorded and 1 credit charged once.
  - bundle.social connects Bluesky through Bluesky's own sign-in page (OAuth). That page takes the account's **real password**: Bluesky app passwords are refused there, though they work elsewhere. Customer help text should say so.
- Pinterest's field format follows bundle.social's documentation but has not been tried on a real account. Test it on the free plan first.
- Reddit own posts go to the profile only. Posting into chosen subreddits would need per-subreddit rules and flairs (`reddit:requirements`), and is a bigger ban risk.
