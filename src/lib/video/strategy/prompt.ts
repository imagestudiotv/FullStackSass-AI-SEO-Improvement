import { z } from "zod/v4";

import { dataBlock, dataRule } from "@/lib/ai/untrusted";

import {
  CREATIVE_DIRECTIONS,
  HOOK_TYPES,
  VIRAL_TECHNIQUES,
  isHookTechnique,
  type ContentGoal,
  type CreativeDirection,
  type HumorLevel,
  type IdeaCategory,
  type IdeaOverrides,
  type NarrationStyle,
  type ResolvedAudio,
  type TonePreset,
  type VideoFormat,
  type ViralTechnique,
} from "../formats";
import type { LengthPlan } from "./duration";
import { POV_LINE_MAX } from "./pov";

/**
 * The idea writer's instructions and answer format (client, 2026-11-12).
 * Every batch is planned slot by slot before the model runs (category,
 * direction, format, audio, techniques, length: lib/video/strategy/*), and
 * the model writes each slot's concept, script, shots and claims.
 *
 * The core protections below are always in the prompt; they are not
 * settings. The customer's noncritical preferences (humour, controversy,
 * stronger language) only add or relax the style rules.
 */

export const ideaSchema = z.object({
  ideas: z.array(
    z.object({
      slot: z.number().int(),
      title: z.string(),
      article: z.number().int().nullable(),
      direction: z.enum(CREATIVE_DIRECTIONS),
      audio: z.enum(["voiceover", "text_music"]),
      hook: z.string(),
      points: z.array(
        z.object({
          title: z.string(),
          detail: z.string(),
          stat: z.object({ value: z.number(), suffix: z.string(), label: z.string() }).nullable(),
        }),
      ),
      proof: z.string(),
      cta: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
      why: z.string().nullable(),
      techniques: z.array(z.enum(VIRAL_TECHNIQUES)),
      visualHook: z.object({ type: z.enum(HOOK_TYPES), clip: z.string() }).nullable(),
      /** A POV clip slot's chosen clip id (POV CLIP VIDEO); null for every other idea (client, 2026-11-21). */
      povClip: z.string().nullable(),
      scenes: z.array(
        z.object({
          query: z.string(),
          kind: z.enum(["video", "image"]),
          overlay: z.string().nullable(),
          reaction: z.string().nullable(),
        }),
      ),
      claims: z.array(z.object({ text: z.string(), source: z.string().nullable() })),
      controversial: z.boolean(),
      sensitive: z.boolean(),
    }),
  ),
});

export type WrittenIdea = z.infer<typeof ideaSchema>["ideas"][number];

/** One idea to write, as planned. */
export type SlotBrief = {
  slot: number;
  category: IdeaCategory;
  direction: CreativeDirection;
  /** Other directions the writer may switch to when the concept clearly needs it. */
  alternatives: CreativeDirection[];
  format: VideoFormat;
  /** Fixed by the settings, or "choose" (Auto): the writer picks per concept. */
  audio: ResolvedAudio | "choose";
  techniques: ViralTechnique[];
  length: LengthPlan;
  /** A POV clip video slot (client, 2026-11-21: "POV clip: 5, others: 5"): one POV line over an AI POV clip, music, no points or proof. */
  pov?: boolean;
};

export type WriterStrategy = {
  goal: ContentGoal;
  tonePreset: TonePreset;
  humor: HumorLevel;
  allowControversial: boolean;
  strongLanguage: boolean;
  trendInspired: boolean;
  priorityTopics: string | null;
  includeCta: boolean;
  defaultCta: string | null;
  narration: NarrationStyle;
};

export type IdeaInput = {
  count: number;
  /** The content language's English name ("Romanian"), as the profile stores it. */
  language: string;
  profile: Record<string, unknown>;
  articles: { title: string; keyword: string | null; summary: string | null }[];
  avoidTitles: string[];
  slots: SlotBrief[];
  strategy: WriterStrategy;
  /** "What has worked" lines from the website's posted videos (learning.ts), possibly empty. */
  learning: string[];
  /** A rewrite of one idea: its current title and hook, and the video's own overrides. */
  rewrite?: { title: string; hook: string; overrides: IdeaOverrides };
  /** The AI POV clips a POV slot picks from (footage/ai-library.ts AI_POV_LIBRARY); empty or absent without a POV slot. */
  povClips?: { id: string; shows: string }[];
};

const DIRECTION_TEXT: Record<CreativeDirection, string> = {
  meme: "MEME: a relatable POV or reaction situation from the audience's everyday life, comic timing, quick reaction cuts. Each scene has an \"overlay\" (the top caption, e.g. \"POV: ...\") and a short \"reaction\" beat (\"wait...\", \"😳\"). Funny or relatable, never mocking a person or group.",
  footage: "REAL-WORLD FOOTAGE: authentic-looking people, places and work situations (licensed stock or the customer's own clips), full screen, kinetic captions. The scenes are concrete moments you could film.",
  storytelling: "STORYTELLING: a short story - a situation, a mistake or surprise, the lesson - told over footage or pictures. Each scene's \"overlay\" is a short chapter caption. A real-feeling story, never presented as a true customer story unless the material says so.",
  text_music: "TEXT + MUSIC: no narration. Fast animated typography over strong visuals and music. Every word is read on screen: point titles are the screens, details at most 10 words.",
  voiceover: "AI VOICEOVER: narration over relevant footage, with transitions, captions and music. Natural, like a creator talking, not an advert.",
  animated: "ANIMATED: the brand's motion-graphics templates - big words, an animated checklist or figures, the brand colours.",
  editorial: "EDITORIAL: a premium, magazine-style carousel or reel on the business's OWN photographs (from its articles and website, chosen by RepGet): one strong statement per slide or scene in very big type over the photo, with real substance from the article - the kind of post people save. See EDITORIAL below.",
};

const CATEGORY_TEXT: Record<IdeaCategory, string> = {
  viral: "VIRAL: reach-first - built to be watched to the end, saved and shared, with its techniques. It must deliver what its hook promises with real, useful substance. \"why\": one sentence on why it COULD perform well (never a promise of views or virality).",
  educational: "EDUCATIONAL: genuinely useful - tips, how-to steps, mistakes to avoid, checklists, questions customers ask.",
  authority: "AUTHORITY: the business's expertise and way of working - behind the scenes, what it looks for, why it does things a certain way. Never invent credentials, awards, years, client numbers or results.",
  promotional: "PROMOTIONAL: one of the business's own services, products or pages (only what the profile or the articles state), ending with a clear next step. Never invent prices, offers, discounts, guarantees or results.",
};

const TECHNIQUE_TEXT: Record<ViralTechnique, string> = {
  curiosity_hooks: "curiosity hook (open a question the video answers)",
  trend_inspired: "trend-inspired (a proven short-video format such as POV, \"things nobody tells you\", myth vs fact, day-in-the-life - never claimed as currently trending)",
  myth_busting: "myth-busting (a common belief, then what is actually true per the material)",
  hot_takes: "hot take (a confident, constructive opinion about the field - never about people, groups or competitors)",
  before_after: "before and after",
  unexpected_facts: "unexpected fact (only a fact from the material)",
  comparisons: "comparison (options or approaches, never named competitors; facts only from the material)",
  storytelling: "story arc",
  anticipation_hook: "anticipation hook: an opening clip whose ending the viewer HAS to see",
  impossible_hook: "impossible hook: an opening clip of something that should not be possible, so they stop to figure out how",
  danger_hook: "danger hook: an opening clip where one wrong move and it is over, so they cannot look away",
};

/** The visual hook rules (client, 2026-11-18), for batches with a hook slot. */
const VISUAL_HOOK_TEXT = `VISUAL HOOK (slots whose techniques include anticipation_hook, impossible_hook or danger_hook): the video OPENS on a short licensed stock clip that stops the scroll - it need not show the business. The clip is cut just before its climax, keeps running small in a corner while the video talks, and its ending plays behind the proof line. So:
- "visualHook": {"type": anticipation, impossible or danger (the slot's), "clip": 3-8 concrete English stock-search words for ONE continuous clip with a clear climax}. Every other idea: null.
- "hook": the bridge line over the clip that ties it to this video's subject ("Booking a photographer without checking this?"), at most 60 characters. The "proof" lands the payoff.
- anticipation: an outcome they have to see ("domino chain toppling", "golf putt rolling to the hole", "dart flying to the bullseye", "basketball rolling around the rim", "skateboard kickflip landing").
- impossible: something that looks like it should not work but is real ("plasma ball lightning", "flower blooming timelapse", "ink cloud in water", "soap bubble freezing into crystals", "rainbow swirl on soap film"). Never a fake claim, never about the business's own results.
- danger: controlled tension where one wrong move ends it, by trained people ("surfer inside a big wave barrel", "acrobat balancing on a partner's hands", "paraglider launching off a ridge", "climber on a rock face"). Never real injury, accidents, crashes, fire, weapons, vehicles at speed, animals or children at risk, or anything people could copy dangerously.
- Never a real person, brand or famous stunt in "clip".`;

/**
 * The editorial rules (client, 2026-11-26: "it looks cheap and simple, we need
 * something stronger ... so clients takes real benefits"), for batches with an
 * editorial slot. The *asterisks* are read by src/remotion and taken out of
 * everything else (lib/video/editorial-images.ts plainText).
 */
const EDITORIAL_TEXT = `EDITORIAL (slots with direction editorial): each slide or scene is ONE of the business's own photographs with ONE short, strong statement on it in very big type - a premium post, not a list of tips. So:
- "hook" is the cover: a bold statement or promise of at most 8 words ("Instagram just gave you *an advantage*").
- Each point "title" is the statement on its slide: at most 12 words, complete and strong on its own ("Answer every review the same day: *trust* starts there"). "detail": at most 12 words that add the how or the why, or "" when the title says it all.
- "proof": one short line of real substance from the article or profile. "cta": at most 8 words, no link and no web address.
- Highlight: in the hook, each point title, the proof and the cta, mark the one or two words that matter most with asterisks: "*Use it*". Never more than two marked spans per text, never a whole sentence. Asterisks ONLY there: never in the title, caption, hashtags, claims, overlays or reactions.
- Substance: base it on its article ("article"), with the article's real advice, steps or facts - specific and useful, nothing generic. Never a web address or domain anywhere in the video.
- "scenes": one per spoken part as usual; "query": 3-6 English words for what the slide's photograph should ideally show; "kind": image; "overlay" and "reaction": null.`;

/** The POV clip video rules (client, 2026-11-21), for batches with a POV slot. The clips are RepGet's own and have no text in them. */
function povClipText(clips: { id: string; shows: string }[], language: string): string {
  return `POV CLIP VIDEO (slots marked POV CLIP): one of RepGet's own funny reaction clips plays full screen for about 10 seconds with music and no voice, and the idea's POV line sits on top of it for its whole length. The clip has no text: the line makes it this business's video. So:
- "povClip": the id of the clip below whose situation best fits a relatable moment for THIS business's audience. A different clip for each POV CLIP slot of the batch.
- "hook": the POV line, starting "POV:" (or its natural equivalent in ${language}), at most ${POV_LINE_MAX} characters, about this business's customers or owner - funny or relatable, never mocking anyone, never claiming a fact that is not in the material. The tone of these examples, adapted to the business (never mention RepGet): "POV: calling the shop because ChatGPT just recommended it", "POV: your bookings fill up while you stay horizontal".
- "points": [] and "proof": "". "direction": meme. "audio": text_music. "visualHook": null.
- "scenes": exactly one: "query" = the chosen clip's description below, "kind": video, "overlay" = the hook, "reaction": null.
- "cta", "caption", "hashtags", "why", "techniques" and "claims" as for any viral idea.
Every idea that is not a POV CLIP slot: "povClip": null.
The clips (id: what it shows):
${clips.map((clip) => `- ${clip.id}: ${clip.shows}`).join("\n")}`;
}

const TONE_TEXT: Record<TonePreset, string> = {
  professional: "professional: clear, refined and confident",
  bold: "bold: more energy and stronger openers",
  playful: "playful: witty, informal and engaging",
};

const HUMOR_TEXT: Record<HumorLevel, string> = {
  none: "No jokes: earnest and helpful.",
  light: "Light humour where it fits (memes are funny; the others stay mostly straight).",
  bold: "Bold humour is welcome: punchy, self-aware jokes - still kind, never at anyone's expense.",
};

const GOAL_TEXT: Record<ContentGoal, string> = {
  reach: "The goal is reach: discoverability, saves and shares; soft calls to action (follow, save).",
  balanced: "The goal is balanced growth: useful content, trust and shareability.",
  leads: "The goal is leads: proof from the material, the services, stronger calls to action (contact, book, visit the website by name).",
};

/** Rules that hold for every idea, whatever the settings. */
const CORE_PROTECTIONS = `CORE RULES (always, whatever else is asked):
- Never invent facts, statistics, figures, rankings, customer testimonials, reviews, case results, prices, offers, discounts, guarantees, awards or credentials. A number or fact about the business appears only when the business profile or an article states it.
- No misleading clickbait: the video must deliver exactly what its hook promises.
- No impersonation: never speak as or about a real person, celebrity or influencer; no copyrighted characters, film/TV/music references to copy; never ask for film clips, celebrity footage or downloaded social videos. Scene "query" words describe generic filmable situations only (no brand names, logos, famous places' trademarks or real people).
- Stock actors are never presented as the business's customers, staff or endorsers ("our client", "our team" only over the customer's own media; otherwise neutral wording).
- No claims about competitors or other brands.
- Nothing unlawful, hateful, sexual, dangerous or harassing; no medical, legal or financial promises.
- Never say or suggest that something is trending, viral right now or currently popular, and never promise views or virality: RepGet has no trend data.`;

function slotLine(slot: SlotBrief): string {
  if (slot.pov) {
    return [
      `Slot ${slot.slot}: ${slot.category}`,
      "POV CLIP slot (POV CLIP VIDEO above): direction meme",
      `format ${slot.format}`,
      "audio: text_music (music, no voice)",
      slot.techniques.length ? `techniques: ${slot.techniques.join(", ")}` : null,
      `one POV line of at most ${POV_LINE_MAX} characters over a ${slot.length.seconds.min} s clip; no points, no proof`,
    ]
      .filter(Boolean)
      .join("; ");
  }
  const parts = [
    `Slot ${slot.slot}: ${slot.category}`,
    slot.direction === "editorial" ? "EDITORIAL slot (EDITORIAL above): the business's own photographs, *highlighted* words" : null,
    `direction ${slot.direction}${slot.alternatives.length ? ` (or, only when the concept clearly needs it: ${slot.alternatives.join(", ")})` : ""}`,
    `format ${slot.format}`,
    slot.format === "carousel" ? "slides, no audio" : slot.audio === "choose" ? "audio: choose voiceover or text_music for this concept" : `audio: ${slot.audio}`,
    slot.techniques.length ? `techniques: ${slot.techniques.join(", ")}` : null,
    slot.format === "carousel"
      ? `${slot.length.words.min}-${slot.length.words.max} words over the slides`
      : `${slot.length.seconds.min}-${slot.length.seconds.max} s: ${slot.length.words.min}-${slot.length.words.max} ${slot.audio === "text_music" ? "on-screen" : "spoken"} words`,
    `${slot.length.points.min}-${slot.length.points.max} points`,
  ];
  return parts.filter(Boolean).join("; ");
}

export function systemPrompt(input: IdeaInput): string {
  const s = input.strategy;
  const directions = [...new Set(input.slots.flatMap((slot) => [slot.direction, ...slot.alternatives]))];
  const categories = [...new Set(input.slots.map((slot) => slot.category))];
  const techniques = [...new Set(input.slots.flatMap((slot) => slot.techniques))];
  const narrated = input.slots.some((slot) => slot.audio !== "text_music" && slot.format !== "carousel");
  // POV clip videos (client, 2026-11-21): only with a POV slot and clips to pick from.
  const pov = input.slots.some((slot) => slot.pov) && (input.povClips?.length ?? 0) > 0;
  const editorial = input.slots.some((slot) => slot.direction === "editorial" && !slot.pov);
  return `You plan and write short vertical social videos (TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, LinkedIn) and photo carousels for a business, from its website's public content and business profile. They must feel native to those platforms - made by a sharp creator, not a conventional advert - and genuinely different from each other: different situations, angles, hooks, pacing and visuals.

Write exactly ${input.count} ideas, one per slot below, in the order given. Write every customer-facing text (title, hook, points, proof, cta, caption, hashtags, why, overlays, reactions, claims) in ${input.language}${input.language === "Romanian" ? " (română, with correct diacritics: ă, â, î, ș, ț)" : ""}. Only scenes[].query is in English.

${CORE_PROTECTIONS}

PRODUCTION DIRECTIONS (each is a different kind of video, not a different hook):
${directions.map((direction) => `- ${DIRECTION_TEXT[direction]}`).join("\n")}

CATEGORIES:
${categories.map((category) => `- ${CATEGORY_TEXT[category]}`).join("\n")}
${techniques.some(isHookTechnique) ? `\n${VISUAL_HOOK_TEXT}\n` : ""}${editorial ? `\n${EDITORIAL_TEXT}\n` : ""}${pov ? `\n${povClipText(input.povClips ?? [], input.language)}\n` : ""}${techniques.length ? `\nTECHNIQUES (for the slots that name them; they shape the angle, they never justify invented claims):\n${techniques.map((technique) => `- ${technique}: ${TECHNIQUE_TEXT[technique]}`).join("\n")}\n` : ""}
STYLE:
- Tone: ${TONE_TEXT[s.tonePreset]}, together with the business's own tone and words to avoid (business profile).
- ${HUMOR_TEXT[s.humor]}
- ${s.allowControversial ? "Controversial angles about the field are allowed when they are fair and constructive (set \"controversial\": true on them)." : "No controversial or divisive angles: keep opinions mild and constructive."}
- ${s.strongLanguage ? "Informal, punchy language is allowed; no slurs, no explicit or offensive words." : "Clean language: no swearing or crude words."}
- ${GOAL_TEXT[s.goal]}
- ${s.trendInspired ? "Be trend-inspired: use proven short-video formats and niche knowledge of what this audience cares about - without ever claiming anything is trending." : "Evergreen: no trend formats; timeless angles only."}
${s.priorityTopics ? "- Prioritise the topics the profile lists under priorityTopics where they fit.\n" : ""}${narrated ? `- Narration style when there is a voice: ${s.narration}.\n` : ""}
EACH IDEA:
- "slot": the slot number. "title": a short name for the owner's list (at most 60 characters), never repeating an earlier title.
- "article": the number of the article it is based on, or null. Base most ideas on the articles; promotional ideas on the services in the profile.
- "direction": the slot's direction, or one of its alternatives. "audio": voiceover or text_music as the slot says (carousels: text_music).
- "hook": what is said or shown in the first 1-2 seconds: a scroll-stopping line (at most 60 characters) that the video delivers on. Vary hook types across ideas (question, bold statement, POV, mistake, surprise, number from the material).
- "points": as many as the slot asks. Each "title" at most 40 characters (shown big), "detail" one sentence (at most 20 words; Text + Music: at most 10). "stat": only a figure the material states for that point, else null. NEVER invent a number.
- "proof": one line that makes it credible: a fact from the material or what the business does.
- "cta": the closing line without a link${s.includeCta ? (s.defaultCta ? `, in the spirit of the business's default call to action: "${s.defaultCta.replace(/"/g, "'")}"` : "") : " (a soft one: the business shows its own only on some videos)"}.
- "caption": the post text: 1-3 short sentences that add value, conversational, at most one emoji, no links. "hashtags": 3-5 relevant ones without "#" (never #trending or #viral).
- "why": viral ideas only (else null): one sentence on why it could perform well, never a guarantee.
- "techniques": the slot's techniques this idea really uses (viral only, else []).
- "visualHook": only for a slot with a hook technique (VISUAL HOOK above); null for every other idea.
- "povClip": ${pov ? "only for a POV CLIP slot (POV CLIP VIDEO above, which also sets its hook, points, proof and scenes); null for every other idea" : "null"}.
- "scenes": exactly one per spoken part, in order: the hook, each point, the proof, the cta (points + 3 scenes). "query": 3-8 concrete, filmable English stock-search words ("barista pouring latte art close-up"); "kind": video, or image for carousels and still pictures; "overlay" and "reaction": memes and stories only (else null), in ${input.language}.
- "claims": every factual statement in the script or caption (figures, rankings, comparisons, facts about the business) with its "source": "article:N" for the N-th article, "profile" for the business profile, or null when it is not in the material.
- "controversial": true for a provocative angle or hot take. "sensitive": true for health, legal, financial, safety or other regulated topics.
The script's length follows its slot (spoken words for a voice, on-screen words for Text + Music).

SLOTS:
${input.slots.map(slotLine).join("\n")}
${dataRule("business_profile")}
${dataRule("website_page")}`;
}

export function userContent(input: IdeaInput): string {
  const profile = input.rewrite
    ? {
        ...input.profile,
        ...(input.rewrite.overrides.audience ? { targetAudience: input.rewrite.overrides.audience } : {}),
        ...(input.rewrite.overrides.tone ? { tone: input.rewrite.overrides.tone } : {}),
        ...(input.rewrite.overrides.avoid ? { avoid: input.rewrite.overrides.avoid } : {}),
        ...(input.rewrite.overrides.tonePreset ? { tonePreset: input.rewrite.overrides.tonePreset } : {}),
      }
    : input.profile;
  return [
    dataBlock("business_profile", JSON.stringify(profile)),
    dataBlock("website_page", JSON.stringify(input.articles.map((article, index) => ({ article: index + 1, ...article })))),
    `Earlier titles (do not repeat): ${JSON.stringify(input.avoidTitles.slice(0, 120))}`,
    input.learning.length ? `What has worked on this website so far (soft hints, keep the variety):\n${input.learning.join("\n")}` : "",
    input.rewrite
      ? `Rewrite this idea as a fresh take on the same subject for this one video (its own audience/tone above): ${JSON.stringify({ title: input.rewrite.title, hook: input.rewrite.hook })}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Output tokens for one call: each idea's script, shots and claims (about 700
 * tokens written) plus the model's own thinking, which counts against the limit.
 * 1,100 and then 2,500 an idea ran out ("did not finish (max_tokens)"), so a call
 * is given 5,000 an idea; calls are WRITE_CHUNK ideas and streamed (ideas.ts).
 */
export const maxTokensFor = (count: number) => Math.min(32_000, 2_000 + count * 5_000);
