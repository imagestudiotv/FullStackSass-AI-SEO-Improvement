# Blog autopilot

The autopilot writes RepGet's own blog for it (client request, 2026-10-16): **Admin → Blog → Autopilot** (`/admin/blog/autopilot`). It is separate from the articles RepGet writes for customers.

The client chose:

1. One English article a day, plus the same article in each chosen language (Spanish, French, Italian, German) as a **linked translation**.
2. **Everything is a draft.** An administrator reads and publishes each one. Translations still need the "reviewed by a native speaker" tick before they can be published.
3. **Topics:** his own list first, in its order. When it runs out, topics RepGet chooses from search data.
4. **Pictures** are made for every article, and they may contain text.

## Using it

- **The daily article** is the switch on the page. It is off until turned on. Also set there:
  - the hour, in UTC (Rome time is shown next to it);
  - **articles a day**, 1 to 5 (client, 2026-10-20). The first is written at the hour, then one an hour after it;
  - the languages.
- **Topics** are written top first:
  - Add one with its search phrase and notes, or paste a list (one per line, `topic | search phrase`).
  - Reorder, edit and remove them. A topic that is being written cannot be changed.
  - The client's topics always come before ones RepGet chose, including topics he adds later.
  - **Suggest topics** asks RepGet to choose some now; that takes about a minute.
- **Write the next one now** writes the first topic straight away, whether or not the daily article is on. A second press is refused while an article is being written.
- **Each run** shows:
  - its length and translations;
  - its AI cost, split into writing, pictures and translations;
  - what to check in the draft;
  - why it failed, if it did. **Try again** on a failed topic puts it back at the front of the queue.
- **Email:** when a run finishes, every administrator (`ADMIN_EMAILS`) gets one email that links to each draft. It also says what to check and what the run cost.

## What a run does (`src/inngest/functions/blog-autopilot.ts`)

| Step | Where | What |
|---|---|---|
| Plan | `lib/blog/autopilot/write.ts` | Claude Sonnet 5 (`MODELS.BLOG`; Opus 5.5 until 2026-10-18), high effort. It returns every field: title, address, SEO title, description, keywords, category, short answer, 10-13 sections with their H3s, tables and links, 2 picture ideas and 6-8 FAQ questions. |
| Body | same | Written in parts of at most 4 sections, each part reading what came before it. The instructions are cached across the calls. They hold the house style and the two newest long English posts as examples. They also hold a fixed fact sheet about RepGet, and the RepGet pages it may link to. |
| Checks | `write.ts`, `links.ts` | Internal links stay only if they point to pages the writer was given. External links stay only if they go to official documentation (`SOURCE_HOSTS`) and the page loads. Anything else is unwrapped, keeping the words. Shortfalls against the house style are listed on the run: length, tables, dashes, FAQs, keyword placement. |
| Pictures | `pictures.ts` | Two diagrams in the blog's look, every word spelled out. Made with OpenAI's image model at medium quality (high until 2026-10-18), saved as WebP in `blog/posts/<locale>/`, and placed in the section they illustrate. |
| English draft | `run.ts` | Saved by the same field rules as an administrator's save (`lib/blog/post-fields.ts`). Author: "RepGet team". Logged as "Blog autopilot". |
| Translations | `translate.ts` | For each chosen language, Claude Haiku 5.5 (`MODELS.BLOG_TRANSLATION`, since 2026-10-20; Sonnet 5 before) at medium effort, using the editor's translation rules. Its links lead to that language's pages (`lib/blog/translation-links.ts`). It translates the fields and the words in the pictures, then the body in the same parts. A part that loses a heading, table, picture or link is refused and asked again. Each language gets its own pictures. Each translation is saved linked to the English draft and marked "needs review". |
| Close | `run.ts`, `notify.ts` | The topic is marked written, the run done, and the email is sent. |

Every model call and every picture is its own Inngest step:

- **Retries:** a failure retries that step only, and nothing already paid for is paid again.
- **Costs:** each is recorded per step and replaced, never added, so a retry is not counted twice.
- **Before the English draft is saved,** a run that fails all its retries fails, and its topic can be tried again.
- **After the English draft is saved,** nothing stops the run. A picture or language that still fails on its last try is listed on the run and in the email, and the rest goes on. A missing translation can be made with **Translate** on the English draft.

**One article at a time.** Two things enforce this:

- Inngest concurrency is 1.
- Each topic is taken ("writing") in the same transaction that records its run and its outbox job (`startAutopilotRun`), so the page shows it at once. A job the outbox can never deliver fails its run and hands the topic back.

## The schedule

`blog-autopilot-schedule` runs every hour at five past (`5 * * * *`):

- **Every hour,** even while the autopilot is off, a run still "running" after 3 hours is failed with "The writing stopped without finishing", so its topic can be tried again.
- **When it is on,** once the day's hour has come (UTC), it starts the next topic in the day's next slot (1, 2... up to **articles a day**), one each hourly tick, one at a time. A partial unique index allows one `schedule` run per `run_date` and `slot`, so no slot is ever written twice. Because it runs on or after the hour, a missed tick or an article still being written only moves the next one an hour later.
- **If the list is empty,** it first lets RepGet choose topics. If there is still nothing to write, it records the day with the reason ("Nothing was written today", or "Only 1 of today's 2 articles were written"), shown on the page, and doesn't try again that day.

## Topics from search data (`lib/blog/autopilot/suggest.ts`)

1. **Keyword ideas** come from the existing provider (cached), for RepGet's subjects, in the United States in English.
2. **Phrases are dropped** if they are:
   - one word long, rarer than 30 searches a month, or harder than 70;
   - navigational or transactional;
   - competitors' brands, or about jobs, courses or logging in;
   - already covered by the blog (any English post's keywords, or any topic waiting or written).
3. **Sonnet 5 chooses** from what is left. Each topic must target one of the phrases exactly. Its notes give the angle and the search data.

## Setup

Everything uses keys the platform already has. Without one, that part is skipped and the run says so:

| Needed for | Variables |
|---|---|
| Writing and translating | `ANTHROPIC_API_KEY` |
| Pictures | `IMAGE_PROVIDER=openai`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Topics from search data | the DataForSEO login and password |
| The email | `RESEND_API_KEY`, `ADMIN_EMAILS` |

Migration `0060_blog_autopilot` creates the three tables. Migration `0068_blog_autopilot_articles_per_day` adds the articles-a-day setting (1 by default) and the run's slot (1 for every existing run). **Apply each before deploying the code that uses it.**

**Rough cost of one article** in five languages with ten pictures is about $0.90. Each run shows its real cost. Earlier: about $1.60 until 2026-10-20 (translations on Sonnet 5: $0.73 of it), about $4.30 before 2026-10-18 (Opus 5.5 and high-quality pictures).

| Part | Cost |
|---|---|
| Writing (Sonnet 5) | ~$0.50 |
| Each translation (Haiku 5.5, since 2026-10-20) | ~$0.01 |
| Each picture (gpt-image, medium quality) | ~$0.04 |
| Choosing topics | a few cents |
