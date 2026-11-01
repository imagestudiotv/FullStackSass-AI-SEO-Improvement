# Videos

Client decisions of 2026-10-29. Every day each website gets **20 video ideas** to swipe through. The ideas the customer keeps are made into **animated reels** (or **photo carousels**) and published to **Instagram, TikTok, YouTube Shorts and Facebook** through bundle.social. The style follows the Ootto reel the client sent: faceless motion graphics in the brand's colours, big headlines, animated checklists and numbers, an AI voice with word-by-word captions, free music and a closing card with the brand.

| Step | What happens | Where |
|---|---|---|
| Ideas | Claude writes 20 scripts a day from the website's live articles and business profile (hook, 2–4 points, proof, call to action, post text, hashtags). About one in four is a carousel; most use the website's style, every fourth another style. | `lib/video/ideas.ts`, job `suggest-video-ideas` (07:00 UTC `video-ideas-daily` for websites that use videos; also when the Videos page is opened with no ideas today) |
| Swipe | Each idea is previewed in the page with the real template (Remotion's player): no voice, nothing rendered, so the 20 previews cost nothing. Right / → makes it, left / ← skips it, Edit changes anything first. Only a finger swipes (a mouse drag, or sliding through a carousel's slides, never makes a video), and → is ignored with Alt/Ctrl/Shift held or after a press on the preview. A make from the deck can be undone for 10 seconds (the credit comes back): the `make-video` job waits 15 s before it starts. Each make records who (`approved_by`) and how (`approved_via`: button, swipe, key, retry, chat). After 3 the day shows complete; more can be made. | `app/(app)/websites/[websiteId]/videos` |
| Making | Approving charges **1 credit** (`video_post`, Admin → Credits). The voice is spoken part by part (OpenAI `gpt-4o-mini-tts`, PCM, so each scene starts exactly with its words), transcribed with word timestamps (Whisper) for the captions, then the reel is rendered. A video that cannot be made gives its credit back. | `lib/video/make.ts`, `lib/video/voice.ts`, job `make-video` |
| Rendering | On Vercel: a **Vercel Sandbox** (the client's Vercel account) renders detached; the job checks every 10 s and collects the MP4. Locally: `@remotion/renderer`. Carousels are rendered as PNG slides. | `lib/video/render.ts` |
| Publishing | Manual (Publish now / at the best time / at a chosen time) or automatic (Settings → Publish automatically: the next of 12:00, 18:00, 20:00 local). One bundle.social post per video, each platform in its own format. | `lib/video/publish.ts`, job `publish-video` |
| Results | Views, likes, comments, shares read daily from bundle.social; an email when a video passes 1,000 views. Files deleted 7 days after posting. | `lib/video/followup.ts`, job `video-followup-daily` |

## Formats

- Reel: 1080×1920, 30 fps, H.264 + AAC, 25–45 s (never over 60 s, inside every platform's short-video limit).
- Carousel: 1080×1350 slides (cover, one per point, proof, call to action). Not on YouTube, which takes videos only.
- Per platform (bundle.social `data`): Instagram `REEL` (carousel `POST`), Facebook `REEL` (carousel `POST`), YouTube `SHORT` (title = idea title, description = post text, public, not made for kids), TikTok `VIDEO` (carousel `IMAGE` with TikTok's own music), with the privacy and interaction settings the account allows (`/misc/tiktok/post-settings`).
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

The video platforms are `social_accounts` rows (`instagram`, `tiktok`, `youtube`, `facebook`) in the website's bundle.social team, connected on bundle.social's page and read back at `/api/social/connected` like the social platforms. They are not shown on the Social page.

## Trials

Videos are included in the free-articles trial (client: "to convince people to stay"), with the trial's daily credits.

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
