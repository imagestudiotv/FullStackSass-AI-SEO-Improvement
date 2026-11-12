import { z } from "zod/v4";

import { dataBlock, dataRule } from "@/lib/ai/untrusted";

import {
  CREATIVE_DIRECTIONS,
  VIRAL_TECHNIQUES,
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
};

const DIRECTION_TEXT: Record<CreativeDirection, string> = {
  meme: "MEME: a relatable POV or reaction situation from the audience's everyday life, comic timing, quick reaction cuts. Each scene has an \"overlay\" (the top caption, e.g. \"POV: ...\") and a short \"reaction\" beat (\"wait...\", \"😳\"). Funny or relatable, never mocking a person or group.",
  footage: "REAL-WORLD FOOTAGE: authentic-looking people, places and work situations (licensed stock or the customer's own clips), full screen, kinetic captions. The scenes are concrete moments you could film.",
  storytelling: "STORYTELLING: a short story - a situation, a mistake or surprise, the lesson - told over footage or pictures. Each scene's \"overlay\" is a short chapter caption. A real-feeling story, never presented as a true customer story unless the material says so.",
  text_music: "TEXT + MUSIC: no narration. Fast animated typography over strong visuals and music. Every word is read on screen: point titles are the screens, details at most 10 words.",
  voiceover: "AI VOICEOVER: narration over relevant footage, with transitions, captions and music. Natural, like a creator talking, not an advert.",
  animated: "ANIMATED: the brand's motion-graphics templates - big words, an animated checklist or figures, the brand colours.",
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
};

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
  const parts = [
    `Slot ${slot.slot}: ${slot.category}`,
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
  return `You plan and write short vertical social videos (TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, LinkedIn) and photo carousels for a business, from its website's public content and business profile. They must feel native to those platforms - made by a sharp creator, not a conventional advert - and genuinely different from each other: different situations, angles, hooks, pacing and visuals.

Write exactly ${input.count} ideas, one per slot below, in the order given. Write every customer-facing text (title, hook, points, proof, cta, caption, hashtags, why, overlays, reactions, claims) in ${input.language}${input.language === "Romanian" ? " (română, with correct diacritics: ă, â, î, ș, ț)" : ""}. Only scenes[].query is in English.

${CORE_PROTECTIONS}

PRODUCTION DIRECTIONS (each is a different kind of video, not a different hook):
${directions.map((direction) => `- ${DIRECTION_TEXT[direction]}`).join("\n")}

CATEGORIES:
${categories.map((category) => `- ${CATEGORY_TEXT[category]}`).join("\n")}
${techniques.length ? `\nTECHNIQUES (for the slots that name them; they shape the angle, they never justify invented claims):\n${techniques.map((technique) => `- ${technique}: ${TECHNIQUE_TEXT[technique]}`).join("\n")}\n` : ""}
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

/** Output tokens for a batch: enough for each idea's script, shots and claims, bounded by the batch size. */
export const maxTokensFor = (count: number) => Math.min(32_000, 2_000 + count * 1_100);
