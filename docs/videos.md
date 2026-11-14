# Videos

Client decisions of 2026-10-29. Every day each website gets **20 video ideas** to swipe through. The ideas the customer keeps are made into **animated reels** (or **photo carousels**) and published to **Instagram, TikTok, YouTube Shorts, Facebook and Pinterest** (Pinterest since 2026-11-02) through bundle.social. The style follows the Ootto reel the client sent: faceless motion graphics in the brand's colours, big headlines, animated checklists and numbers, an AI voice with word-by-word captions, free music and a closing card with the brand.

| Step | What happens | Where |
|---|---|---|
| Ideas | Claude writes 20 scripts a day from the website's live articles and business profile (hook, 2–4 points, proof, call to action, post text, hashtags). About one in four is a carousel; most use the website's style, every fourth another style. | `lib/video/ideas.ts`, job `suggest-video-ideas` (06:00 UTC `video-ideas-daily` for websites that use videos; also when the Videos page is opened with no ideas today) |
| Swipe | Each idea is previewed in the page with the real template (Remotion's player): no voice, nothing rendered, so the 20 previews cost nothing. Right / → makes it, left / ← skips it, Edit changes anything first. Only a finger swipes (a mouse drag, or sliding through a carousel's slides, never makes a video), and → is ignored with Alt/Ctrl/Shift held or after a press on the preview. A make from the deck can be undone for 10 seconds (the credit comes back): the `make-video` job waits 15 s before it starts. Each make records who (`approved_by`) and how (`approved_via`: button, swipe, key, retry, chat). After 3 the day shows complete; more can be made. Above the tabs, three real numbers (client, 2026-11-02): ideas ready (today's not made or skipped), made today against the goal, and the credits available (owner only, the sidebar's balance). Today's ideas has a format filter and Focus mode (the preview and Create alone, remembered in the browser, Esc leaves it); beside the preview, a panel with the hook, the points, the post text and where it goes. | `app/(app)/websites/[websiteId]/videos` |
| Making | Approving charges **1 credit** (`video_post`, Admin → Credits). The voice is spoken part by part (OpenAI `gpt-4o-mini-tts`, PCM, so each scene starts exactly with its words), transcribed with word timestamps (Whisper) for the captions, then the reel is rendered. A video that cannot be made gives its credit back. | `lib/video/make.ts`, `lib/video/voice.ts`, job `make-video` |
| Rendering | On Vercel: a **Vercel Sandbox** (the client's Vercel account) renders detached; the job checks every 10 s and collects the MP4. Locally: `@remotion/renderer`. Carousels are rendered as PNG slides. | `lib/video/render.ts` |
| Publishing | Manual (Publish now / at the best time / at a chosen time) or automatic (Settings → Publish automatically: the next of 12:00, 18:00, 20:00 local). One bundle.social post per video, each platform in its own format. | `lib/video/publish.ts`, job `publish-video` |
| Results | Views, likes, comments, shares read daily from bundle.social; an email when a video passes 1,000 views. Files deleted 7 days after posting. | `lib/video/followup.ts`, job `video-followup-daily` |

## Formats

- Reel: 1080×1920, 30 fps, H.264 + AAC, 25–45 s (never over 60 s, inside every platform's short-video limit).
- Carousel: 1080×1350 slides (cover, one per point, proof, call to action). Not on YouTube, which takes videos only, nor on Pinterest: bundle.social's PINTEREST data is a single Pin (no post type, no carousel items), and Pinterest's carousel Pins take 2–5 images where a carousel here has 5–7 slides.
- Per platform (bundle.social `data`): Instagram `REEL` (carousel `POST`), Facebook `REEL` (carousel `POST`), YouTube `SHORT` (title = idea title, description = post text, public, not made for kids), TikTok `VIDEO` (carousel `IMAGE` with TikTok's own music), Pinterest a video Pin (`boardName`, title = idea title up to 100 characters, description = post text up to 800, and after the account's 7-day warm-up a `link` to the published article the idea came from, else the website - client, 2026-11-03), with the privacy and interaction settings the account allows (`/misc/tiktok/post-settings`).
- Text stays out of the bottom fifth and the right edge, where the apps put their buttons.
- Font: Inter (SIL Open Font License), served by RepGet from `public/video-fonts`; a render never waits on another site. Without an uploaded logo the closing card shows the brand's initial.
- The voice is turned up once when it is made, its loudest moment 1 dB under full scale (OpenAI's speech comes out at about -28 LUFS; a reel ends near -20 LUFS).
- The swipe preview starts muted: a player with sound follows the browser's audio clock, which stays suspended until the visitor clicks, and the preview would not move.

## Styles

- **Bold**: big headlines popping in, a white checklist card that builds point by point.
- **Numbers**: each point as a figure counting up, with a ring or bar. Figures only when the website states them; never invented.
- **Story**: the website's pictures and the customer's clips full-screen, slowly zooming, with the words over them.

## Keeping accounts safe

1. At most 3 videos a day on each platform (`MAX_POSTS_PER_DAY`); more wait for the next good hour.
2. Every idea is different: earlier titles are passed to the model and repeats are dropped.
3. A platform that refuses a video pauses that account until the customer resumes it on Settings (the same rule as social media).
4. Music: three free tracks from Mixkit (Stock Music Free License: commercial use in videos and on social media, no credit needed; not CDs, DVDs, games or broadcast) in `public/video-music`, trimmed to 75 s at -16 LUFS, listed in `lib/video/music.ts`. Pixabay's tracks cannot be downloaded outside its website.

## Accounts

The video platforms are `social_accounts` rows (`instagram`, `tiktok`, `youtube`, `facebook`) in the website's bundle.social team, connected on bundle.social's page and read back at `/api/social/connected` like the social platforms. They are not shown on the Social page - except Pinterest, which is both: one row, one account and one board for the social Pins and the video Pins. The board is chosen on Opportunities (`setPinterestBoard`). Publishing with Pinterest chosen and no board is refused (`no_board`, with where to choose it); a scheduled or automatic video without one goes to the others and says Pinterest was left out. Connecting Pinterest from the Videos page comes back there (`from=videos`); disconnecting it on either page disconnects both, and a refusal on either pauses both.

## Trials

Videos are included in the trial (client: "to convince people to stay"), with the trial's daily credits. Since 2026-11-13 that is the 3-day free trial, with the plan's monthly video allowance pro-rated to it (`lib/usage.ts`); before, the free-articles trial.

## Costs

- Ideas: one Claude Sonnet call a day per website, a few cents.
- Voice: about 2 cents a reel.
- Render: a few cents a reel on Vercel Sandbox (4 vCPUs for a few minutes). Set Spend Management on Vercel.
- Storage: Supabase bucket `video-files` (created on first use, public, random names).
- Remotion: free for companies of up to 3 people. Above that, a company licence before going live; set `REMOTION_LICENSE_KEY`.

## Setup

- Migration `0079_video_reels` (tables `video_ideas`, `video_media`, `video_settings`).
- Environment: `OPENAI_API_KEY` (voice; without it videos have no voice), `BUNDLE_SOCIAL_API_KEY` (publishing), `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (files), Vercel Sandbox (OIDC, automatic on Vercel), optional `REMOTION_LICENSE_KEY`.
- `npm run build` bundles the templates first (`scripts/remotion-bundle.mjs` → `.remotion-bundle`, shipped with `/api/inngest`).
- After deploying: resync the Inngest app (5 new functions), and set Admin → Credits "Video or carousel" to 1.

## Viral social content (client, 2026-11-12)

Daniel chose genuinely different productions ("Option B"), not catchier scripts in one template. Types and constants: the contract block at the end of `lib/video/formats.ts`; migration `0092_viral_social_content`.

### Ideas
- **Categories**: Viral, Educational, Authority, Promotional. The viral share is `video_settings.viral_mix` (0–100 in steps of 10, default 40). The rest is split by goal (`NON_VIRAL_SPLIT`: Balanced 50/30/20, Grow reach 60/30/10, Generate leads 30/30/40), rounded by largest remainder so totals are exact, and interleaved (`strategy/allocation.ts`).
- **Free allowance** (`lib/video/batches.ts`, table `video_idea_batches`): 20 daily ideas (slot 0, the 06:00 UTC job or the first visit), plus 3 extra batches of 10 a UTC day from the New ideas menu: New daily ideas (mixed), Generate viral ideas, Ideas from your website (verified services and pages). That is at most 50 a day.
  - A slot is reserved by a unique (website, day, slot) insert in a short transaction; no lock is held during the AI call. A request key makes retries idempotent.
  - Requests are refused while a batch is being written ("busy"), and must be 20 s apart. A batch that failed with 0 ideas may be asked for once more, in the same slot.
  - Skips never give a slot back. The same rules apply to buttons, the AI chat and jobs.
- **Creative direction** per idea (`strategy/creative.ts`): meme, footage, storytelling, text_music, voiceover or animated (the original templates, which keep the `style` column).
  - No direction takes more than 40% of a batch. Recipes are unique in a batch and against the last 7 days.
  - Each idea carries a `plan` (ShotPlan: per scene a visual request, transition, reaction/overlay; pacing, caption style, music mood) and `production` (audio, narration, captions, music, duration, hook and CTA): a snapshot of the settings, editable per video.
- **Audio**: Auto (default; the writer chooses per concept), Voiceover, or Text + Music (no narration or transcription call at all).
- **Length**: 15–30 / 30–45 / 45–60 / 60–90 s, with word budgets of 2.4 words/s narrated and 2.75 words/s on screen. A Story is at most 60 s.
- **Formats**: about 1 in 4 is a carousel and 1 in 10 a Story, when allowed.
- **Trends**: trend-inspired only (proven formats, niche knowledge). Nothing is ever called "currently trending" without provider data; such claims are stripped or the idea is dropped.
- **Learning** (`strategy/learning.ts`): views and engagement of the website's posted videos over the last 60 days give soft weights, with each direction kept between a 10% floor and the 40% cap.
- **Profile**: audience, language, market (country), tone and avoid are the website's profile and Brand Voice, saved there (`saveVideoProfileAction`). Only priority topics and the tone preset (Professional/Bold/Playful, next to the free-text tone) are video settings. Per-video overrides (`overrides`) never change the global profile. "Rewrite with these" is free, up to 10 a website a day.
- **Languages**: the 8 content languages plus Romanian (`ro`).

### Safety and review (`lib/video/review.ts`)
- **Always on, not settings**: no invented facts, figures, testimonials, results, prices or offers; no misleading clickbait; no impersonation, celebrities, film clips or downloaded social videos; no stock actors presented as customers; no unverifiable competitor claims; nothing unlawful.
- **The customer's choices**: humor level, controversial topics, stronger language.
- **Claims**: each idea lists its claims with a source. Unsourced figures need a check (when "Check figures" is on); controversial angles need approval; sensitive topics are always reviewed. Until a person approves, automatic posting holds the video.
- **Approval**: tied to a content hash. Any edit that changes the published words needs a new approval.
- **Content sources**: only public content is used (`publicRevisionSql`); never held articles or unpublished staff revisions.

### Publishing (`lib/video/publish.ts`, `publish-actions.ts`, `schedule.ts`)
- **Modes**:
  - Review before publishing (`manual`);
  - Save as draft (`draft`: kept in Your videos, never sent, not a bundle.social draft);
  - Auto-publish (`auto`, only when the customer chose it; it never makes or charges a video).
- **Frequency**: 3 or 5 a week, 1 or 2 a day. A `null` frequency (existing auto customers) keeps the old "each made video at the next best hour". Never more than 3 automatic posts a day, or 3 a platform a day.
  - Slots are reserved in `video_schedule_slots` (unique website + hour).
  - Websites have no timezone column: the country → offset table is applied in one helper (`localOffsetHours`), without daylight saving.
- **Per destination**: each platform's result is kept in `video_ideas.destinations`. A retry only sends to platforms not yet posted.
- **LinkedIn**: a profile or company page, connected through bundle.social (`social_accounts.target`). One video up to 30 min, 3,000 characters, no links, no carousels.
- **X**: reuses the social X account, posted as its own bundle.social post, text fitted to 280 with links removed. bundle.social passes X's charge through ($0.015 a post, $0.20 with a URL).
  - Available only with `X_VIDEO_POSTS_ENABLED=1` and a positive `X_VIDEO_MONTHLY_LIMIT_USD`. The optional `X_VIDEO_COST_PER_POST_USD` defaults to 0.02.
  - Each post reserves its cost atomically in `provider_spend` before posting. It is charged on success and released on failure; usage events have kind `social_api`.
  - When the limit is reached X is skipped and the others still go.
- **Stories**: real Instagram and Facebook Stories (one file, no caption, 3–60 s). Other platforms are skipped with a reason; a reel is never sent as a Story.
- **Instagram native audio**: search and selection through bundle.social (`/misc/instagram/audio`, `musicSoundInfo`, volumes 0–100), for Reels on accounts connected through Facebook Login.
  - Instagram then gets the no-music version (`alt_video_url`, an audio-only remux). Other platforms and the download keep RepGet's licensed music.
  - The final native mix can only be heard on Instagram. Nothing is labelled trending: the provider returns no trending data.
- **Analytics**: need a paid bundle.social plan. X stats are billed on demand, so the daily stats skip X and Stories.

### Setup after deploying
- Migration `0092_viral_social_content` (backfill: music off stays off; no voice becomes Text + Music; existing auto customers keep `frequency` null).
- Resync Inngest (no new functions; the video jobs moved into `videos-ideas.ts`, `videos-make.ts` and `videos-publish.ts`, with the same ids).
- Optional environment: `X_VIDEO_POSTS_ENABLED`, `X_VIDEO_MONTHLY_LIMIT_USD`, `X_VIDEO_COST_PER_POST_USD`, and the stock footage keys (see Production).

### Production (`lib/video/make.ts`, `assets.ts`, `footage/*`, `cost.ts`, `src/remotion/directions`)
- **Directions**: each has its own composition with its own structure, pacing, transitions and caption treatment, at 1080×1920 30 fps:
  - meme: a white "POV" top bar, reaction punch-ins, hard cuts;
  - footage: full-bleed clips with fast cuts and kinetic captions;
  - storytelling: chapter markers with a turn and a resolution, editorial captions;
  - text_music: animated typography timed by reading speed;
  - voiceover: clips with transitions and the voice;
  - animated: the original Bold, Numbers and Story templates, unchanged.
- **Captions**: bold, editorial or minimal, never under 44 px. A Story keeps its top 270 px and bottom 340 px clear. Carousels (1080×1350) get slides per direction.
- **Pictures and clips** are chosen when the video is made, scene by scene, from the customer's media, then permitted stock, the article's pictures, then AI images (the existing integration, at most 2 a video, only within the budget).
  - A footage-led video with nothing suitable fails with the reason, and its credit comes back. It never falls back to the old template.
  - Stock adapters:
    - Pixabay (`PIXABAY_API_KEY`; results cached 24 h, no permanent hotlinking, files stored in RepGet's bucket);
    - Pexels (`PEXELS_API_KEY`; new keys are paused at Pexels, so it is only usable with an existing key);
    - an admin-supplied licensed collection (`VIDEO_FOOTAGE_COLLECTION`).
  - Licence, source and author are kept in `video_stock_assets` and `video_ideas.assets`. Without a provider no stock request is made, and the page says footage needs setup.
  - Stock or AI footage paired with words about people is marked illustrative: stock actors are never shown as clients or staff.
- **Audio**:
  - Voiceover: OpenAI TTS with a narration style (natural, warm, energetic) and Whisper captions, in the 8 content languages plus Romanian. Any other language fails; there is no English fallback.
  - Text + Music never calls TTS or Whisper.
  - Music: 9 Mixkit tracks (Stock Music Free License), with source, licence and date in `lib/video/music.ts`. Tracks are 75 s and fade out on longer videos.
  - Instagram's no-music copy (`alt_video_url`) is an ffmpeg remux of the rendered picture with the voice only: no second render.
- **Cost**: internal, never a customer price. Budget is $0.30 a standard video, with a $0.03 margin.
  - `video_ideas.cost` keeps every attempt's items (planning, narration, transcription, images, footage, render, storage, audio mux), each measured, estimated or unmeasured. Unknown items are never counted as zero.
  - A paid step is held before it runs and refused when it would exceed the budget. A failed video still keeps its costs, and its credit is refunded.
  - Render cost comes from the measured sandbox runtime (Vercel Sandbox: $0.128 per vCPU-hour, $0.0212 per GB-hour, 1-minute minimum).
  - Estimates: about $0.10–0.15 for a 30–45 s video.
- **Duplicate events**: the make claim is tied to the job run (or a claim stale for 45 minutes), so a repeated event never renders or charges twice.
