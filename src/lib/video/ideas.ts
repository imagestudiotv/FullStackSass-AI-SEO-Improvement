import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { customerTitleSql, publicRevisionSql, publicFieldSql } from "@/lib/articles/review";
import { mainLanguageCode } from "@/lib/articles/translation-languages";
import { db } from "@/lib/db";
import { articles, brandVoice, videoIdeaBatches, videoIdeas, videoMedia, websites } from "@/lib/db/schema";
import { PRICING, track } from "@/lib/usage";
import { normalizeLanguage } from "@/lib/websites/languages";

import { claimBatch, dailyBatch, dailyWritten, releaseBatch, utcDay, type BatchRow } from "./batches";
import {
  DAILY_BATCH_SIZE,
  EXTRA_BATCH_SIZE,
  isCreativeDirection,
  isIdeaCategory,
  isVideoFormat,
  PRODUCTION_BUDGET_USD,
  VIDEO_STYLES,
  VIRAL_TECHNIQUES,
  VOICES,
  type AudioMode,
  type BatchKind,
  type CostItem,
  type CostLedger,
  type CreativeDirection,
  type IdeaCategory,
  type IdeaOverrides,
  type MediaItem,
  type ProductionChoices,
  type ResolvedAudio,
  type ShotPlan,
  type VideoFormat,
  type VideoScript,
  type VideoStyle,
  type ViralTechnique,
} from "./formats";
import { assertsTrend, assessReview, checkClaims, isClaimHashtag, withoutClaimsOfTrendOrPromise } from "./review";
import { readVideoSettings, videoAccess, type VideoSettings } from "./settings";
import { batchCategories, durationFor, formatAt, type CategoryCounts } from "./strategy/allocation";
import { allowedDirections, assignDirections, buildPlan, enforceRecipes, settleDirections, stableHash, type Slot } from "./strategy/creative";
import { lengthPlan, maxPointsFor, MIN_POINTS, TEMPLATE_MAX_POINTS } from "./strategy/duration";
import { LEARNING_DAYS, learnFrom, NO_LEARNING, type Learning } from "./strategy/learning";
import { ideaSchema, maxTokensFor, systemPrompt, userContent, type IdeaInput, type SlotBrief, type WrittenIdea } from "./strategy/prompt";

/**
 * A website's video ideas (client, 2026-10-29: "20 swipes like the reference
 * website"; 2026-11-12: a viral mix, genuinely different productions, free
 * extra batches). One model call writes a batch, from the website's live
 * articles (public content only: publicRevisionSql) and its profile and
 * Brand Voice. An idea is a script, a shot plan and production choices; it
 * is previewed in the browser, and only an approved one is made into a video
 * (lib/video/make.ts) for its credit.
 *
 *  - suggestVideoIdeas: the day's batch, topped up to DAILY_BATCH_SIZE (the
 *    morning job, a retry and the page opening never add more);
 *  - writeExtraBatch: one of the day's free extra batches, reserved first
 *    (lib/video/batches.ts);
 *  - rewriteIdea: one idea written again with its own overrides.
 *
 * What the batch is (categories, directions, formats, audio, length) is
 * planned before the model runs (lib/video/strategy); its answer is then
 * held to the variety, honesty and safety rules (lib/video/review.ts).
 */

export type { IdeaInput } from "./strategy/prompt";
export type SuggestVideoResult = { created: number; reason?: string };

const servicesOf = (site: { services: unknown }): string[] =>
  Array.isArray(site.services) ? site.services.filter((service): service is string => typeof service === "string" && service.trim() !== "") : [];

const listOf = (value: unknown, max: number): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, max) : [];

const clip = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

/** A script as the templates can show it: the right number of points, each text within its space. */
export function cleanScript(idea: Pick<WrittenIdea, "hook" | "points" | "proof" | "cta">, maxPoints = TEMPLATE_MAX_POINTS): VideoScript | null {
  const points = idea.points
    .filter((point) => point.title.trim())
    .slice(0, maxPoints)
    .map((point) => ({
      title: clip(point.title, 48),
      detail: clip(point.detail, 180),
      stat:
        point.stat && Number.isFinite(point.stat.value) && point.stat.value >= 0 && point.stat.value < 1e9
          ? { value: point.stat.value, suffix: clip(point.stat.suffix, 6), label: clip(point.stat.label, 40) }
          : null,
    }));
  const hook = clip(idea.hook, 80);
  if (points.length < MIN_POINTS || !hook) return null;
  return { hook, points, proof: clip(idea.proof, 160), cta: clip(idea.cta, 80) };
}

/** The caption with its hashtags, within every platform's limit (TikTok and Instagram: 2,200). Claim hashtags (#trending) are left out. */
export function captionText(caption: string, hashtags: string[]): string {
  const tags = [...new Set(hashtags.map((tag) => tag.replace(/[^\p{L}\p{N}_]/gu, "")).filter((tag) => tag && !isClaimHashtag(tag)))]
    .slice(0, 5)
    .map((tag) => `#${tag}`);
  return [clip(caption, 1500), tags.join(" ")].filter(Boolean).join("\n\n");
}

/** The original templates' styles: mostly the website's own, every fourth another one, so the others are seen too. */
export function styleFor(index: number, chosen: VideoStyle): VideoStyle {
  if (index % 4 !== 3) return chosen;
  const others = VIDEO_STYLES.filter((style) => style !== chosen);
  return others[Math.floor(index / 4) % others.length];
}

/** The format of the day's idea at `index` with every format allowed (formatAt with the settings' formats). */
export function formatFor(index: number): VideoFormat {
  return formatAt(index, ["reel", "carousel"]);
}

export type IdeaDeps = {
  write: typeof writeIdeas;
};

/* ---------------------------------------------------------------- material */

type Site = typeof websites.$inferSelect;

type Material = {
  settings: VideoSettings;
  /** The settings' audio with the legacy "no voice" read as Text + Music. */
  audioMode: AudioMode;
  live: { id: string; title: string; keyword: string | null; summary: string | null; imageUrl: string | null }[];
  ownMedia: MediaItem[];
  recentTitles: string[];
  recentRecipes: string[];
  recentDirections: Partial<Record<CreativeDirection, number>>;
  learning: Learning;
  profile: Record<string, unknown>;
  services: string[];
  /** The content language's English name, as the prompt reads it ("Romanian"). */
  languageName: string;
  /** The idea rows' language code ("ro"). */
  languageCode: string;
};

async function readLearning(websiteId: string, now: Date): Promise<Learning> {
  const rows = await db
    .select({ direction: videoIdeas.direction, category: videoIdeas.category, techniques: videoIdeas.techniques, stats: videoIdeas.stats })
    .from(videoIdeas)
    .where(
      and(
        eq(videoIdeas.websiteId, websiteId),
        eq(videoIdeas.status, "posted"),
        isNotNull(videoIdeas.stats),
        gte(videoIdeas.postedAt, new Date(now.getTime() - LEARNING_DAYS * 86_400_000)),
      ),
    )
    .limit(200);
  return rows.length > 0 ? learnFrom(rows) : NO_LEARNING;
}

async function loadMaterial(site: Site, now: Date): Promise<Material> {
  const websiteId = site.id;
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [settings, live, own, recent, recipes, [voice], learning] = await Promise.all([
    readVideoSettings(websiteId),
    db
      .select({ id: articles.id, title: customerTitleSql, keyword: articles.targetKeyword, summary: publicFieldSql(articles.metaDescription, "metaDescription"), imageUrl: publicFieldSql(articles.imageUrl, "imageUrl") })
      .from(articles)
      .where(and(eq(articles.websiteId, websiteId), isNotNull(articles.publishedUrl), isNotNull(articles.firstLiveAt), sql`${publicRevisionSql}`))
      .orderBy(desc(articles.firstLiveAt))
      .limit(15),
    db.select().from(videoMedia).where(eq(videoMedia.websiteId, websiteId)).orderBy(desc(videoMedia.createdAt)).limit(12),
    db.select({ title: videoIdeas.title }).from(videoIdeas).where(eq(videoIdeas.websiteId, websiteId)).orderBy(desc(videoIdeas.createdAt)).limit(120),
    db
      .select({ recipe: sql<string | null>`${videoIdeas.plan}->>'recipe'`, direction: videoIdeas.direction })
      .from(videoIdeas)
      .where(and(eq(videoIdeas.websiteId, websiteId), gte(videoIdeas.createdAt, since)))
      .limit(400),
    db
      .select({ tone: brandVoice.tone, avoid: brandVoice.avoid, usps: brandVoice.usps, facts: brandVoice.facts })
      .from(brandVoice)
      .where(eq(brandVoice.websiteId, websiteId)),
    readLearning(websiteId, now),
  ]);
  const recentDirections: Partial<Record<CreativeDirection, number>> = {};
  for (const row of recipes) if (isCreativeDirection(row.direction)) recentDirections[row.direction] = (recentDirections[row.direction] ?? 0) + 1;
  const services = servicesOf(site);
  const languageName = normalizeLanguage(site.language) ?? (site.language?.trim() || "English");
  return {
    settings,
    // A website that turned the voice off (before audio modes) keeps its videos without narration.
    audioMode: settings.voice === null ? "text_music" : settings.audioMode,
    live,
    ownMedia: own.map((item) => ({ url: item.url, kind: item.kind === "video" ? "video" : "image" })),
    recentTitles: recent.map((row) => row.title),
    recentRecipes: recipes.flatMap((row) => (row.recipe ? [row.recipe] : [])),
    recentDirections,
    learning,
    services,
    languageName,
    languageCode: mainLanguageCode(site.language),
    profile: {
      brandName: site.brandName,
      domain: site.domain,
      description: site.description,
      industry: site.industry,
      services,
      targetAudience: site.targetAudience,
      country: site.country,
      tone: voice?.tone ?? null,
      avoid: voice?.avoid ?? null,
      // Facts and selling points a person confirmed (Brand Voice): the only specifics about the business besides the articles.
      facts: listOf(voice?.facts, 12),
      sellingPoints: listOf(voice?.usps, 8),
      priorityTopics: settings.priorityTopics,
      tonePreset: settings.tonePreset,
    },
  };
}

/* ---------------------------------------------------------------- planning */

type PlannedSlot = Slot & { slot: number; index: number; techniques: ViralTechnique[] };

/** The chosen techniques, in turn, for the viral slots (trend-inspired only while that switch is on). */
function techniquesFor(settings: VideoSettings, viralIndex: number, weights: Learning["techniqueWeights"]): ViralTechnique[] {
  const chosen = settings.techniques.filter((technique) => technique !== "trend_inspired" || settings.trendInspired);
  const pool = chosen.length > 0 ? chosen : (["curiosity_hooks", "myth_busting"] as ViralTechnique[]);
  // Learning puts the better techniques first in the turn; every chosen one still comes round.
  const ordered = [...pool].sort((a, b) => (weights[b] ?? 1) - (weights[a] ?? 1) || VIRAL_TECHNIQUES.indexOf(a) - VIRAL_TECHNIQUES.indexOf(b));
  const first = ordered[viralIndex % ordered.length];
  const second = ordered.length > 2 ? ordered[(viralIndex + 1 + Math.floor(viralIndex / ordered.length)) % ordered.length] : null;
  return second && second !== first ? [first, second] : [first];
}

function planSlots(categories: IdeaCategory[], formatOffset: number, material: Material): PlannedSlot[] {
  let viral = 0;
  return categories.map((category, index) => {
    const format = formatAt(formatOffset + index, material.settings.formats);
    return {
      slot: index + 1,
      index: formatOffset + index,
      category,
      format,
      techniques: category === "viral" ? techniquesFor(material.settings, viral++, material.learning.techniqueWeights) : [],
    };
  });
}

/** The audio of an idea: fixed by the settings or the direction, or the writer's choice under Auto. Carousels have none. */
function resolveAudio(direction: CreativeDirection, format: VideoFormat, mode: AudioMode, written: ResolvedAudio | null): ResolvedAudio {
  if (format === "carousel") return "text_music";
  if (direction === "text_music") return "text_music";
  if (direction === "voiceover") return "voiceover";
  if (mode !== "auto") return mode;
  return written ?? "voiceover";
}

function briefs(slots: PlannedSlot[], directions: CreativeDirection[], material: Material): SlotBrief[] {
  return slots.map((slot, k) => {
    const direction = directions[k];
    const fixed: ResolvedAudio | "choose" =
      slot.format === "carousel" || direction === "text_music" ? "text_music" : direction === "voiceover" ? "voiceover" : material.audioMode === "auto" ? "choose" : material.audioMode;
    return {
      slot: slot.slot,
      category: slot.category,
      direction,
      alternatives: allowedDirections(slot.category, slot.format, material.audioMode).filter((other) => other !== direction).slice(0, 2),
      format: slot.format,
      audio: fixed,
      techniques: slot.techniques,
      length: lengthPlan(durationFor(slot.format, material.settings.duration), fixed === "choose" ? "voiceover" : fixed, slot.format, direction),
    };
  });
}

function writerStrategy(settings: VideoSettings): IdeaInput["strategy"] {
  return {
    goal: settings.goal,
    tonePreset: settings.tonePreset,
    humor: settings.humor,
    allowControversial: settings.allowControversial,
    strongLanguage: settings.strongLanguage,
    trendInspired: settings.trendInspired,
    priorityTopics: settings.priorityTopics,
    includeCta: settings.includeCta,
    defaultCta: settings.defaultCta,
    narration: settings.narration,
  };
}

/* --------------------------------------------------------------- composing */

type Usage = { inputTokens: number; outputTokens: number; model: string };

/** What a writer call cost: measured from its tokens and the price table, or estimated at the generation model's price when the model is not in it. */
export function usageCost(usage: Usage): { usd: number; basis: "measured" | "estimated" } {
  const known = PRICING.llm[usage.model as keyof typeof PRICING.llm];
  const price = known ?? PRICING.llm["claude-sonnet-5"];
  const usd = (usage.inputTokens / 1000) * price.inputPer1k + (usage.outputTokens / 1000) * price.outputPer1k;
  return { usd, basis: known ? "measured" : "estimated" };
}

export function planningLedger(cost: { usd: number; basis: "measured" | "estimated" }, ideas: number, now: Date, earlier?: CostLedger | null): CostLedger {
  const item: CostItem = { kind: "planning", provider: "anthropic", usd: Number((cost.usd / Math.max(1, ideas)).toFixed(6)), basis: cost.basis, attempt: 0, at: now.toISOString() };
  return {
    budgetUsd: earlier?.budgetUsd ?? PRODUCTION_BUDGET_USD,
    reservedUsd: earlier?.reservedUsd ?? 0,
    items: [...(earlier?.items ?? []), item],
  };
}

type Composed = {
  slot: PlannedSlot;
  written: WrittenIdea;
  script: VideoScript;
  title: string;
  direction: CreativeDirection;
};

/** The writer's ideas matched to their slots and checked; an idea that claims a trend, repeats or does not fit is left out. */
function acceptIdeas(ideas: WrittenIdea[], slots: PlannedSlot[], planned: CreativeDirection[], material: Material, seenTitles: Set<string>): Composed[] {
  const bySlot = new Map<number, WrittenIdea>();
  ideas.forEach((idea, order) => {
    const key = Number.isInteger(idea.slot) && slots.some((slot) => slot.slot === idea.slot) ? idea.slot : slots[order]?.slot;
    if (key !== undefined && !bySlot.has(key)) bySlot.set(key, idea);
  });
  const hooks = new Set<string>();
  const accepted: { slot: PlannedSlot; written: WrittenIdea; k: number }[] = [];
  slots.forEach((slot, k) => {
    const written = bySlot.get(slot.slot);
    if (written) accepted.push({ slot, written, k });
  });
  const proposals = accepted.map(({ written }) => (isCreativeDirection(written.direction) ? written.direction : null));
  const settled = settleDirections(
    accepted.map(({ slot }) => slot),
    accepted.map(({ k }) => planned[k]),
    proposals,
    material.audioMode,
  );
  return accepted.flatMap(({ slot, written }, j) => {
    const checked = checkIdea(written, slot, settled[j], seenTitles, hooks);
    return checked ? [checked] : [];
  });
}

/** One written idea held to its slot: a script that fits, a new title and hook, no trend claim in what is shown big. */
function checkIdea(written: WrittenIdea, slot: PlannedSlot, direction: CreativeDirection, seenTitles: Set<string>, hooks: Set<string>): Composed | null {
  const script = cleanScript(written, maxPointsFor(direction, slot.format));
  const title = clip(written.title ?? "", 90);
  if (!script || !title || seenTitles.has(title.toLowerCase())) return null;
  // Left out rather than rewritten into something odd.
  if ([title, script.hook, ...script.points.map((point) => point.title)].some(assertsTrend)) return null;
  const hookKey = script.hook.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (hooks.has(hookKey)) return null;
  hooks.add(hookKey);
  seenTitles.add(title.toLowerCase());
  return { slot, written, script, title, direction };
}

type RowContext = {
  websiteId: string;
  day: string;
  batchId: string | null;
  now: Date;
  material: Material;
  seed: number;
  ledger: (count: number) => CostLedger;
};

function composeRows(composed: Composed[], context: RowContext): (typeof videoIdeas.$inferInsert)[] {
  const { material } = context;
  const { settings } = material;
  const pictures = material.live.flatMap((article) => (article.imageUrl ? [article.imageUrl] : []));
  const parts = composed.map((item) => {
    const { slot, written, script, direction } = item;
    const article = written.article && written.article >= 1 ? material.live[written.article - 1] : undefined;
    const audio = resolveAudio(direction, slot.format, material.audioMode, written.audio === "text_music" || written.audio === "voiceover" ? written.audio : null);
    const production: ProductionChoices = {
      audio,
      narration: settings.narration,
      captionStyle: settings.captionStyle,
      music: settings.musicDirection,
      duration: durationFor(slot.format, settings.duration),
      showHook: settings.showHook,
      includeCta: settings.includeCta,
      ctaText: settings.includeCta ? settings.defaultCta : null,
    };
    const planFor = (variant?: { pacing: number; transitions: number; mood: number }) =>
      buildPlan({
        direction,
        format: slot.format,
        script,
        scenes: Array.isArray(written.scenes) ? written.scenes : [],
        captionStyle: production.captionStyle,
        music: production.music,
        ownMedia: material.ownMedia.length > 0,
        articlePicture: Boolean(article?.imageUrl),
        variant,
        fallbackQuery: item.title,
      });
    return { item, article, audio, production, planFor };
  });
  const plans = enforceRecipes(parts, (part) => part.planFor(), (part, variant) => part.planFor(variant), material.recentRecipes, context.seed);
  const ledger = context.ledger(parts.length);

  return parts.map((part, j) => {
    const { item, article, audio, production } = part;
    const { slot, written, script, direction } = item;
    const plan: ShotPlan = plans[j];
    const index = slot.index;
    const caption = captionText(withoutClaimsOfTrendOrPromise(written.caption) ?? "", Array.isArray(written.hashtags) ? written.hashtags : []);
    const claims = checkClaims(Array.isArray(written.claims) ? written.claims : [], {
      articles: material.live.map((article) => [article.title, article.keyword, article.summary].filter(Boolean).join(" ")),
      profile: JSON.stringify(material.profile),
    });
    const techniques =
      slot.category === "viral"
        ? (() => {
            const used = (Array.isArray(written.techniques) ? written.techniques : []).filter((technique) => slot.techniques.includes(technique));
            return used.length > 0 ? used : slot.techniques;
          })()
        : [];
    const review = assessReview(
      { content: { script, caption, plan, production }, claims, controversial: Boolean(written.controversial), sensitive: Boolean(written.sensitive), techniques },
      settings,
    );
    // Its article's picture first, then the customer's own, then the website's others.
    const media: MediaItem[] = [
      ...(article?.imageUrl ? [{ url: article.imageUrl, kind: "image" as const }] : []),
      ...material.ownMedia.slice(index % Math.max(1, material.ownMedia.length)).concat(material.ownMedia).slice(0, 3),
      ...pictures.filter((url) => url !== article?.imageUrl).slice(index % 5, (index % 5) + 3).map((url) => ({ url, kind: "image" as const })),
    ].slice(0, 5);
    return {
      websiteId: context.websiteId,
      day: context.day,
      batchId: context.batchId,
      format: slot.format,
      // The original templates' style for animated videos; the others keep the website's style for their brand look.
      style: direction === "animated" ? styleFor(index, settings.style) : settings.style,
      language: material.languageCode,
      title: item.title,
      script,
      caption,
      articleId: article?.id ?? null,
      media,
      // The legacy columns follow the production choice: no narration, no voice.
      voice: audio === "voiceover" ? (settings.voice ?? VOICES[0]) : null,
      captions: settings.captions,
      musicTrack: production.music === "none" ? "none" : null,
      category: slot.category,
      direction,
      why: slot.category === "viral" ? (withoutClaimsOfTrendOrPromise(written.why ?? null)?.slice(0, 240) ?? null) : null,
      techniques,
      plan,
      production,
      claims,
      reviewStatus: review.reviewStatus,
      reviewReasons: review.reviewReasons,
      cost: ledger,
      createdAt: context.now,
      updatedAt: context.now,
    };
  });
}

/** One batch: plan, write (no transaction open), compose. */
async function writeBatchIdeas(
  site: Site,
  material: Material,
  categories: IdeaCategory[],
  formatOffset: number,
  seed: number,
  write: typeof writeIdeas,
  meta: { kind: BatchKind; batchId: string | null; day: string; now: Date },
): Promise<(typeof videoIdeas.$inferInsert)[]> {
  const slots = planSlots(categories, formatOffset, material);
  const planned = assignDirections(slots, material.audioMode, { seed, weights: material.learning.directionWeights, recent: material.recentDirections });
  const { ideas, usage } = await write({
    count: slots.length,
    language: material.languageName,
    profile: material.profile,
    articles: material.live.map((article) => ({ title: article.title, keyword: article.keyword, summary: article.summary })),
    avoidTitles: material.recentTitles,
    slots: briefs(slots, planned, material),
    strategy: writerStrategy(material.settings),
    learning: material.learning.summary,
  });
  const cost = usageCost(usage);
  await track(site.organizationId, {
    kind: "llm",
    websiteId: site.id,
    provider: "anthropic",
    model: usage.model,
    quantity: usage.inputTokens + usage.outputTokens,
    costUsd: cost.basis === "measured" ? cost.usd : undefined,
    metadata: { purpose: "video_ideas", ideas: slots.length, batchId: meta.batchId, kind: meta.kind },
  });
  const seen = new Set(material.recentTitles.map((title) => title.toLowerCase()));
  const composed = acceptIdeas(ideas, slots, planned, material, seen);
  return composeRows(composed, {
    websiteId: site.id,
    day: meta.day,
    batchId: meta.batchId,
    now: meta.now,
    material,
    seed,
    ledger: (count) => planningLedger(cost, count, meta.now),
  });
}

async function readySite(websiteId: string): Promise<{ site: Site } | { reason: string }> {
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site || site.status !== "ready") return { reason: "website not ready" };
  if ((await videoAccess(websiteId)) === "none") return { reason: "no plan" };
  if (!isAiConfigured()) return { reason: "AI is not configured" };
  return { site };
}

/**
 * Stores a batch's ideas and closes it, in one short transaction. Nothing is
 * stored when the batch is no longer this job's (it expired meanwhile).
 */
async function storeBatch(batch: BatchRow, rows: (typeof videoIdeas.$inferInsert)[], created: number, now: Date): Promise<number> {
  try {
    return await db.transaction(async (tx) => {
      const [closed] = await tx
        .update(videoIdeaBatches)
        .set({ status: created > 0 ? "done" : "failed", created, error: created > 0 ? null : "no usable ideas", finishedAt: now, updatedAt: now })
        .where(and(eq(videoIdeaBatches.id, batch.id), eq(videoIdeaBatches.status, "writing")))
        .returning({ id: videoIdeaBatches.id });
      if (!closed) throw new Error("batch no longer writing");
      if (rows.length > 0) await tx.insert(videoIdeas).values(rows);
      return rows.length;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "batch no longer writing") return 0;
    throw error;
  }
}

export type JobOptions = {
  /** This run is the job's retry (it may take a batch a crashed try left writing). */
  retry?: boolean;
  /** This run is the job's last attempt: a failure fails the batch. */
  final?: boolean;
};

/** The day's ideas, topped up to DAILY_BATCH_SIZE; extra batches never count towards them. */
export async function suggestVideoIdeas(
  websiteId: string,
  now: Date = new Date(),
  deps: Partial<IdeaDeps> = {},
  options: JobOptions = {},
): Promise<SuggestVideoResult> {
  const write = deps.write ?? writeIdeas;
  const ready = await readySite(websiteId);
  if ("reason" in ready) return { created: 0, reason: ready.reason };
  const { site } = ready;

  const day = utcDay(now);
  const written = await dailyWritten(websiteId, day);
  const wanted = DAILY_BATCH_SIZE - written;
  if (wanted <= 0) return { created: 0, reason: "the day has its ideas" };
  const batch = await dailyBatch(websiteId, now);
  const claimed = await claimBatch(batch.id, now, options);
  if (!claimed) return { created: 0, reason: "busy" };

  try {
    const material = await loadMaterial(site, now);
    const existing = await db
      .select({ category: videoIdeas.category, n: sql<number>`count(*)::int` })
      .from(videoIdeas)
      .leftJoin(videoIdeaBatches, eq(videoIdeas.batchId, videoIdeaBatches.id))
      .where(and(eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.day, day), sql`(${videoIdeas.batchId} is null or ${videoIdeaBatches.slot} = 0)`))
      .groupBy(videoIdeas.category);
    const counts: Partial<CategoryCounts> = {};
    for (const row of existing) if (isIdeaCategory(row.category)) counts[row.category] = Number(row.n);
    const categories = batchCategories({
      kind: "daily",
      viralMix: material.settings.viralMix,
      goal: material.settings.goal,
      services: material.services.length,
      existing: written > 0 ? counts : undefined,
      wanted,
    });
    const seed = stableHash(`${websiteId}:${day}:0:${written}`);
    const rows = (await writeBatchIdeas(site, material, categories, written, seed, write, { kind: "daily", batchId: batch.id, day, now })).slice(0, wanted);
    const stored = await storeBatch(claimed, rows, written + rows.length, now);
    return { created: stored };
  } catch (error) {
    await releaseBatch(batch.id, error instanceof Error ? error.message : "failed", options.final ?? true, now);
    throw error;
  }
}

/** One of the day's extra batches, reserved by requestVideoIdeas (lib/video/batches.ts). */
export async function writeExtraBatch(
  batchId: string,
  now: Date = new Date(),
  deps: Partial<IdeaDeps> = {},
  options: JobOptions = {},
): Promise<SuggestVideoResult> {
  const write = deps.write ?? writeIdeas;
  const [batch] = await db.select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, batchId));
  if (!batch || batch.slot === 0) return { created: 0, reason: "not an extra batch" };
  const ready = await readySite(batch.websiteId);
  if ("reason" in ready) {
    await db
      .update(videoIdeaBatches)
      .set({ status: "failed", error: ready.reason, finishedAt: now, updatedAt: now })
      .where(and(eq(videoIdeaBatches.id, batchId), eq(videoIdeaBatches.status, "reserved")));
    return { created: 0, reason: ready.reason };
  }
  const claimed = await claimBatch(batchId, now, options);
  if (!claimed) return { created: 0, reason: "not to be written" };
  const kind = (["mixed", "viral", "website"] as const).find((k) => k === claimed.kind) ?? "mixed";
  try {
    const material = await loadMaterial(ready.site, now);
    const categories = batchCategories({ kind, viralMix: material.settings.viralMix, goal: material.settings.goal, services: material.services.length });
    const offset = DAILY_BATCH_SIZE + (claimed.slot - 1) * EXTRA_BATCH_SIZE;
    const seed = stableHash(`${claimed.websiteId}:${claimed.day}:${claimed.slot}:${claimed.attempts}`);
    const rows = (await writeBatchIdeas(ready.site, material, categories, offset, seed, write, { kind, batchId, day: claimed.day, now })).slice(0, claimed.size);
    // Nothing usable: the job tries again while it has an attempt left.
    if (rows.length === 0 && !(options.final ?? true)) throw new Error("no usable ideas");
    const stored = await storeBatch(claimed, rows, rows.length, now);
    return { created: stored };
  } catch (error) {
    await releaseBatch(batchId, error instanceof Error ? error.message : "failed", options.final ?? true, now);
    throw error;
  }
}

/**
 * Writes one idea again (its own overrides of audience, tone and words to
 * avoid; same category, format and production), for the rewrite action -
 * which counts the day's free rewrites first.
 */
export async function rewriteIdea(websiteId: string, ideaId: string, now: Date = new Date(), deps: Partial<IdeaDeps> = {}): Promise<{ ok: boolean; reason?: string }> {
  const write = deps.write ?? writeIdeas;
  const ready = await readySite(websiteId);
  if ("reason" in ready) return { ok: false, reason: ready.reason };
  const [row] = await db.select().from(videoIdeas).where(and(eq(videoIdeas.id, ideaId), eq(videoIdeas.websiteId, websiteId)));
  if (!row || !["new", "failed"].includes(row.status)) return { ok: false, reason: "already_handled" };
  const material = await loadMaterial(ready.site, now);
  const category: IdeaCategory = isIdeaCategory(row.category) ? row.category : "educational";
  const format: VideoFormat = isVideoFormat(row.format) ? row.format : "reel";
  const direction: CreativeDirection = isCreativeDirection(row.direction) ? row.direction : "animated";
  const production = (row.production as ProductionChoices | null) ?? null;
  const audio: ResolvedAudio = production?.audio ?? (row.voice ? "voiceover" : "text_music");
  const techniques = (row.techniques ?? []).filter((t): t is ViralTechnique => (VIRAL_TECHNIQUES as readonly string[]).includes(t));
  const overrides = (row.overrides ?? {}) as IdeaOverrides;
  const slot: PlannedSlot = { slot: 1, index: 0, category, format, techniques: category === "viral" && techniques.length === 0 ? techniquesFor(material.settings, 0, {}) : techniques };
  const brief: SlotBrief = {
    slot: 1,
    category,
    direction,
    alternatives: [],
    format,
    audio: format === "carousel" ? "text_music" : audio,
    techniques: slot.techniques,
    length: lengthPlan(production?.duration ?? durationFor(format, material.settings.duration), audio, format, direction),
  };
  const { ideas, usage } = await write({
    count: 1,
    language: material.languageName,
    profile: material.profile,
    articles: material.live.map((article) => ({ title: article.title, keyword: article.keyword, summary: article.summary })),
    avoidTitles: material.recentTitles.filter((title) => title !== row.title),
    slots: [brief],
    strategy: writerStrategy({ ...material.settings, tonePreset: overrides.tonePreset ?? material.settings.tonePreset }),
    learning: [],
    rewrite: { title: row.title, hook: (row.script as VideoScript).hook, overrides },
  });
  const cost = usageCost(usage);
  await track(ready.site.organizationId, {
    kind: "llm",
    websiteId,
    provider: "anthropic",
    model: usage.model,
    quantity: usage.inputTokens + usage.outputTokens,
    costUsd: cost.basis === "measured" ? cost.usd : undefined,
    metadata: { purpose: "video_rewrite", ideaId },
  });
  // The idea's own production stays: only its words, shots and claims are new.
  const materialForIdea: Material = { ...material, audioMode: audio === "text_music" ? "text_music" : "voiceover" };
  const checked = ideas[0] ? checkIdea(ideas[0], slot, direction, new Set(), new Set()) : null;
  if (!checked) return { ok: false, reason: "bad_script" };
  const composed = [checked];
  const others = material.recentRecipes.filter((recipe) => recipe !== (row.plan as ShotPlan | null)?.recipe);
  const [next] = composeRows(composed, {
    websiteId,
    day: row.day,
    batchId: row.batchId,
    now,
    material: { ...materialForIdea, recentRecipes: others },
    seed: stableHash(`${ideaId}:${now.toISOString()}`),
    ledger: () => planningLedger(cost, 1, now, row.cost as CostLedger | null),
  });
  const [updated] = await db
    .update(videoIdeas)
    .set({
      title: next.title,
      script: next.script,
      caption: next.caption,
      articleId: next.articleId,
      plan: next.plan,
      claims: next.claims,
      why: next.why,
      techniques: next.techniques,
      reviewStatus: next.reviewStatus,
      reviewReasons: next.reviewReasons,
      reviewedHash: null,
      reviewedBy: null,
      reviewedAt: null,
      cost: next.cost,
      // Its earlier voice no longer matches the words.
      voiceUrl: null,
      timing: null,
      durationMs: null,
      updatedAt: now,
    })
    .where(and(eq(videoIdeas.id, ideaId), inArray(videoIdeas.status, ["new", "failed"])))
    .returning({ id: videoIdeas.id });
  return updated ? { ok: true } : { ok: false, reason: "already_handled" };
}

/** Slots one model call writes. A day's twenty in one answer ran past its output limit and past the SDK's ten-minute non-streaming cap. */
export const WRITE_CHUNK = 5;

/** Splits a batch into calls of WRITE_CHUNK slots, keeping each slot's number (acceptIdeas matches ideas to slots by it). */
export function writeChunks(input: IdeaInput): IdeaInput[] {
  if (input.rewrite || input.slots.length <= WRITE_CHUNK) return [input];
  const chunks: IdeaInput[] = [];
  for (let i = 0; i < input.slots.length; i += WRITE_CHUNK) {
    const slots = input.slots.slice(i, i + WRITE_CHUNK);
    chunks.push({ ...input, count: slots.length, slots });
  }
  return chunks;
}

/**
 * Writes a batch's ideas: the chunks in parallel, each answer streamed (the SDK
 * refuses a long answer that is not), so a day's batch takes about as long as
 * five ideas. One chunk that fails fails the batch, as before.
 */
export async function writeIdeas(input: IdeaInput): Promise<{ ideas: WrittenIdea[]; usage: Usage }> {
  const parts = await Promise.all(writeChunks(input).map(writeChunk));
  return {
    ideas: parts.flatMap((part) => part.ideas),
    usage: {
      inputTokens: parts.reduce((sum, part) => sum + part.usage.inputTokens, 0),
      outputTokens: parts.reduce((sum, part) => sum + part.usage.outputTokens, 0),
      model: MODELS.GENERATION,
    },
  };
}

async function writeChunk(input: IdeaInput): Promise<{ ideas: WrittenIdea[]; usage: Usage }> {
  const response = await anthropic.messages
    .stream(
      {
        model: MODELS.GENERATION,
        max_tokens: maxTokensFor(input.count),
        output_config: { format: zodOutputFormat(ideaSchema) },
        system: systemPrompt(input),
        messages: [{ role: "user", content: userContent(input) }],
      },
      { maxRetries: 0 },
    )
    .finalMessage();
  // The stop reason is kept: "max_tokens" and "refusal" need different fixes.
  if (response.stop_reason !== "end_turn") throw new Error(`Video ideas did not finish (${response.stop_reason})`);
  const ideas = ideaSchema.parse(JSON.parse(response.content.find((block) => block.type === "text")?.text ?? "")).ideas;
  return {
    ideas,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: MODELS.GENERATION },
  };
}
