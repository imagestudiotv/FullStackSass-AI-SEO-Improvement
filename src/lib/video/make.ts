import "server-only";

import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import { refundSpend } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { videoIdeas, videoMedia, websites } from "@/lib/db/schema";
import { activeProvider, generateArticleImage, generateOpenAiImage } from "@/lib/images/generate";
import { track } from "@/lib/usage";
import { coverFrame } from "@/remotion/cover";
import { productionParts, productionTimeline } from "@/remotion/production";
import type { ProductionReelProps, SceneMedia } from "@/remotion/props";

import { FOOTAGE_LED, identityClaim, resolveSceneAssets, storedAssets, type ResolverDeps, type StoredAsset } from "./assets";
import {
  BudgetExceededError,
  canAfford,
  productionChoicesOf,
  readLedger,
  recordCost,
  releaseCost,
  reserveCost,
  startAttempt,
} from "./cost";
import {
  imageEstimate,
  narrationEstimate,
  renderEstimate,
  round,
  sandboxCost,
  speechSecondsEstimate,
  storageEstimate,
  transcriptionEstimate,
} from "./cost-math";
import { STOCK_PROVIDERS, footageStatus, type StockCandidate } from "./footage";
import { collectionCost } from "./footage/collection";
import { AI_CLIP_SIZE, AI_HOOK_LIBRARY, AI_LICENCE, AI_PROVIDER, aiClipPath, povClipById, type AiHookClip, type AiPovClip } from "./footage/ai-library";
import { HOOK_LIBRARY, type HookLibraryClip } from "./footage/hook-library";
import { libraryPicks, opensOnAiClip, type HookCandidate } from "./footage/hooks";
import { pixabayVideoById } from "./footage/pixabay";
import { cachedAsset, cachedForQuery, storeCandidate } from "./footage/store";
import {
  DURATION_SECONDS,
  MAX_REEL_SECONDS,
  VIDEO_PLATFORM_SPECS,
  isCreativeDirection,
  isVideoPlatform,
  isVoice,
  silentTiming,
  slideCount,
  spokenParts,
  type CaptionWord,
  type CreativeDirection,
  type HookClipPick,
  type HookType,
  type MediaItem,
  type ProductionChoices,
  type ReelProps,
  type ShotPlan,
  type VideoFormat,
  type VideoScript,
  type VideoStyle,
  type Voice,
} from "./formats";
import { MUSIC_VOLUME, ideaTrack, musicTrack, musicUrl } from "./music";
import { remuxNoMusic, renderReelLocally, renderSlides, type CoverRequest } from "./render";
import { autoPublishTime, releaseScheduleSlot } from "./schedule";
import { readVideoSettings, websiteBrand } from "./settings";
import { deleteVideoFiles, sharedFileUrl, storeVideoFile } from "./storage";
import { stableHash } from "./strategy/creative";
import { canHook } from "./strategy/hooks";
import { isVoiceConfigured, speakScript, UnsupportedVoiceLanguageError, voiceLanguage, VOICE_COST_PER_MINUTE, VoiceServiceError } from "./voice";

/**
 * Making an approved idea into its video: the scenes' pictures and clips
 * (lib/video/assets.ts), the voice (its length sets every scene's time; none
 * for Text + Music), the music, then the render (lib/video/render.ts), the
 * file stored and the video ready - published by RepGet when the website
 * publishes automatically, otherwise waiting in Your videos.
 *
 * Every paid step is held against the video's production budget first
 * (lib/video/cost.ts): a step that would pass it is refused with the reason,
 * and the make fails with its credit returned.
 *
 * The idea's credit was charged when it was approved (lib/video/actions.ts);
 * a video that cannot be made gives it back (failMaking).
 */

export type VideoIdea = typeof videoIdeas.$inferSelect;
/** The voice's words and when each part starts; `parts` = the spokenParts indexes spoken (productions), absent = all. */
export type Timing = { words: CaptionWord[]; sceneStartsMs: number[]; parts?: number[] };

export const spendKey = (id: string) => `video:${id}`;

/**
 * A make that cannot succeed by trying again (over budget, an unsupported
 * voice language, a voice too long for its destination, a footage video
 * with nothing to show): the job fails at once with this reason.
 */
export class ProductionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionError";
  }
}

/** The running app's address: where the render machine fetches the music from. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.repget.com").replace(/\/+$/, "");
}

/** The idea's creative direction; "animated" (the original templates) for older rows and ideas without a plan. */
export function directionOf(idea: Pick<VideoIdea, "direction" | "plan">): CreativeDirection {
  const plan = idea.plan as ShotPlan | null;
  if (!plan || !Array.isArray(plan.scenes) || !isCreativeDirection(idea.direction)) return "animated";
  return idea.direction;
}

function formatOf(idea: Pick<VideoIdea, "format">): VideoFormat {
  return idea.format === "carousel" ? "carousel" : idea.format === "story" ? "story" : "reel";
}

/** Reels and Stories are videos; a carousel is slides. */
export function isVideoFormatIdea(idea: Pick<VideoIdea, "format">): boolean {
  return formatOf(idea) !== "carousel";
}

/** The production choices in effect (the idea's own, else what its older columns meant). */
export function choicesOf(idea: Pick<VideoIdea, "production" | "voice" | "captions" | "musicTrack">): ProductionChoices {
  return productionChoicesOf(idea);
}

/** The parts the production shows, as spokenParts indexes. */
function shownParts(idea: VideoIdea): number[] {
  const script = idea.script as VideoScript;
  if (directionOf(idea) === "animated") return spokenParts(script).map((_, i) => i);
  return productionParts(script, choicesOf(idea), idea.plan as ShotPlan).map((part) => part.part);
}

/** The props the templates are given for an idea, in its current state. */
export async function reelProps(idea: VideoIdea): Promise<ProductionReelProps> {
  const brand = await websiteBrand(idea.websiteId);
  if (!brand) throw new Error("The website is gone");
  const script = idea.script as VideoScript;
  const timing = idea.timing as Timing | null;
  const voiced = Boolean(idea.voiceUrl && timing);
  const track = musicTrack(idea.musicTrack);
  const direction = directionOf(idea);
  const base: ReelProps = {
    style: idea.style as VideoStyle,
    brand,
    script,
    voiceUrl: voiced ? idea.voiceUrl : null,
    words: voiced ? timing!.words : [],
    sceneStartsMs: voiced ? timing!.sceneStartsMs : silentTiming(script).sceneStartsMs,
    voiceMs: voiced ? (idea.durationMs ?? 0) : 0,
    music: track ? { url: musicUrl(track, appUrl()), volume: voiced ? MUSIC_VOLUME.underVoice : MUSIC_VOLUME.alone } : null,
    media: (idea.media as MediaItem[]) ?? [],
    captions: idea.captions,
  };
  if (direction === "animated") return { ...base, format: formatOf(idea), language: idea.language };
  const plan = idea.plan as ShotPlan;
  const production = choicesOf(idea);
  return {
    ...base,
    direction,
    plan,
    production,
    format: formatOf(idea),
    sceneMedia: sceneMediaFor(script, plan, production, storedAssets(idea.assets)),
    spokenParts: voiced ? (timing!.parts ?? null) : null,
    language: idea.language,
  };
}

/**
 * Each part's media from the resolved assets; stock or AI footage under words
 * that present people as the customer's own (identityClaim) is marked
 * illustrative, so stock actors never pass as real clients or staff.
 */
export function sceneMediaFor(script: VideoScript, plan: ShotPlan, production: ProductionChoices, assets: StoredAsset[]): (SceneMedia | null)[] {
  const spoken = spokenParts(script);
  return spoken.map((text, part) => {
    const asset = assets.find((a) => a.sceneIndex === part);
    if (!asset) return null;
    const scene = plan.scenes?.[part];
    const words = [text, scene?.overlay ?? "", part === spoken.length - 1 ? production.ctaText ?? "" : ""].join(" ");
    const illustrative = (asset.source === "stock" || asset.source === "ai_image") && identityClaim(words);
    return {
      url: asset.url,
      kind: asset.kind,
      source: asset.source,
      durationMs: asset.durationMs ?? null,
      ...(typeof asset.focalX === "number" ? { focalX: asset.focalX } : {}),
      ...(typeof asset.climaxMs === "number" ? { climaxMs: asset.climaxMs } : {}),
      ...(illustrative ? { illustrative: true } : {}),
    };
  });
}

/* ------------------------------------------------------------------ claim */

/** A make run that stopped this long ago without finishing may be taken over by another. */
const STALE_CLAIM_MS = 45 * 60 * 1000;

/**
 * The job's claim: approved -> making, starting a new attempt in the cost
 * ledger. A second run for the same idea (a duplicate event) only takes over
 * a "making" idea when it is the same run or the claim went stale - so a
 * duplicate never renders, or charges, twice.
 */
export async function claimMaking(id: string, run: string, now: Date = new Date()): Promise<{ format: string } | null> {
  const stale = new Date(now.getTime() - STALE_CLAIM_MS);
  const [row] = await db
    .update(videoIdeas)
    .set({ status: "making", updatedAt: now })
    .where(
      and(
        eq(videoIdeas.id, id),
        or(
          eq(videoIdeas.status, "approved"),
          and(eq(videoIdeas.status, "making"), or(sql`${videoIdeas.cost}->>'run' = ${run}`, lt(videoIdeas.updatedAt, stale))),
        ),
      ),
    )
    .returning({ format: videoIdeas.format, cost: videoIdeas.cost });
  if (!row) return null;
  const run0 = (row.cost as { run?: string } | null)?.run;
  // The same run claiming again (a retried step) is not a new attempt.
  if (run0 !== run) await startAttempt(id, run);
  return { format: row.format };
}

/** Whether an idea is still being made: not once its customer deleted it, so its job stops before the next paid step. */
export async function isMaking(id: string): Promise<boolean> {
  const [row] = await db.select({ status: videoIdeas.status }).from(videoIdeas).where(eq(videoIdeas.id, id));
  return row?.status === "making";
}

/* ------------------------------------------------------------------ budget */

function videoSecondsLimit(idea: VideoIdea): number {
  const production = choicesOf(idea);
  const story = formatOf(idea) === "story";
  const range = DURATION_SECONDS[production.duration] ?? DURATION_SECONDS["30-45"];
  const platforms = (idea.platforms ?? []).filter(isVideoPlatform);
  const destination = platforms.length
    ? Math.min(...platforms.map((p) => (story ? VIDEO_PLATFORM_SPECS[p].storyMaxSeconds ?? 60 : VIDEO_PLATFORM_SPECS[p].maxVideoSeconds)))
    : MAX_REEL_SECONDS;
  return Math.min(range.max, destination, story ? 60 : MAX_REEL_SECONDS);
}

/**
 * Holds every remaining paid step's estimate before anything is spent, so a
 * video that cannot fit its budget is refused first, for free; each step
 * then re-holds its own key with its refined estimate.
 */
export async function holdProductionBudget(id: string): Promise<void> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea) throw new Error("The idea is gone");
  const format = formatOf(idea);
  const production = choicesOf(idea);
  const seconds = videoSecondsLimit(idea);
  const parts = shownParts(idea).map((i) => spokenParts(idea.script as VideoScript)[i]);
  const speech = Math.min(seconds, speechSecondsEstimate(parts));
  try {
    if (format !== "carousel" && wantsVoice(idea) && !idea.voiceUrl) {
      await reserveCost(id, "narration", narrationEstimate(speech), "the AI voice");
      await reserveCost(id, "transcription", transcriptionEstimate(speech), "the caption timings");
    }
    await reserveCost(id, "render", renderEstimate(seconds, format), format === "carousel" ? "rendering the slides" : "rendering the video");
    await reserveCost(id, "storage", storageEstimate(format), "storing the files");
  } catch (error) {
    if (error instanceof BudgetExceededError) throw new ProductionError(error.message);
    throw error;
  }
}

/** A second render's hold, after the first one broke: refused (false) when the video's budget has no room for it. */
export async function holdSecondRender(id: string): Promise<boolean> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (idea?.status !== "making") return false;
  try {
    await reserveCost(id, "render", renderEstimate(videoSecondsLimit(idea), formatOf(idea)), "rendering the video again");
    return true;
  } catch (error) {
    if (error instanceof BudgetExceededError) return false;
    throw error;
  }
}

/* ------------------------------------------------------------------ assets */

function resolverDeps(idea: VideoIdea): ResolverDeps {
  return {
    customerMedia: async () =>
      (await db.select().from(videoMedia).where(eq(videoMedia.websiteId, idea.websiteId)).orderBy(desc(videoMedia.createdAt)).limit(24)).map((row) => ({
        url: row.url,
        kind: row.kind === "video" ? "video" : "image",
      })),
    providers: STOCK_PROVIDERS,
    findCached: (query, kind, exclude) => cachedForQuery(query, kind, exclude),
    storeStock: (candidate, query, cost) => storeCandidate(candidate, query, cost),
    stockCost: (candidate) => (candidate.provider === "collection" ? collectionCost(candidate.providerId) : Promise.resolve(null)),
    hookCandidates: (type, query, exclude) => hookCandidates(type, query, exclude, stableHash(idea.id), (idea.plan as ShotPlan | null)?.hookClip?.pick ?? null),
    ai: {
      provider: () => activeProvider(),
      estimateUsd: () => imageEstimate(activeProvider()),
      async generate(prompt) {
        // The cheapest quality that still looks photographic; text-free by prompt.
        if (activeProvider() === "openai") {
          const image = await generateOpenAiImage(prompt, "low");
          return { data: image.data, contentType: "image/png", costUsd: image.costUsd };
        }
        const image = await generateArticleImage("", null, prompt);
        return { data: image.data, contentType: image.contentType, costUsd: image.costUsd };
      },
      store: (data, contentType) => storeVideoFile(idea.websiteId, `ideas/${idea.id}`, data, contentType),
    },
    reserve: (key, usd, label) => reserveCost(idea.id, key, usd, label),
    canAfford: (key, usd) => canAfford(idea.id, key, usd),
    record: (item, key) => recordCost(idea.id, item, key),
  };
}

/**
 * Up to three hook clips for a video, in the order to try: the clip picked
 * when the idea was written (ShotPlan.hookClip.pick: the one its preview
 * showed), then RepGet's AI clips (in storage already) and the Pixabay
 * library's, about 70:30 across videos (opensOnAiClip), the other source
 * kept as the fallback. Pixabay clips already stored need no lookup, the
 * others are looked up by id (free).
 */
async function hookCandidates(type: HookType, query: string, exclude: Set<string>, seed: number, pick: HookClipPick | null = null): Promise<HookCandidate[]> {
  const picked = pick && !exclude.has(`${pick.provider}:${pick.id}`) ? await pickedCandidate(pick) : null;
  const skip = picked ? new Set([...exclude, `${picked.provider}:${picked.providerId}`]) : exclude;
  const ai = libraryPicks(type, query, seed, skip, AI_HOOK_LIBRARY, AI_PROVIDER).slice(0, 2).map(aiCandidate);
  const aiFirst = opensOnAiClip(seed);
  const stock = await pixabayCandidates(libraryPicks(type, query, seed, skip).slice(0, aiFirst ? 3 - ai.length : 3 - Math.min(1, ai.length)));
  return [...(picked ? [picked] : []), ...(aiFirst ? [...ai, ...stock] : [...stock, ...ai])];
}

async function pickedCandidate(pick: HookClipPick): Promise<HookCandidate | null> {
  if (pick.provider === AI_PROVIDER) {
    const clip = AI_HOOK_LIBRARY.find((entry) => entry.id === pick.id);
    return clip ? aiCandidate(clip) : null;
  }
  const clip = HOOK_LIBRARY.find((entry) => entry.id === pick.id);
  return clip ? ((await pixabayCandidates([clip]))[0] ?? null) : null;
}

async function pixabayCandidates(picks: readonly HookLibraryClip[]): Promise<HookCandidate[]> {
  const out: HookCandidate[] = [];
  for (const pick of picks) {
    const stored = await cachedAsset("pixabay", pick.id, "video");
    const candidate: StockCandidate | null = stored
      ? { provider: stored.provider, providerId: stored.providerId, kind: "video", downloadUrl: stored.url, width: stored.width ?? 0, height: stored.height ?? 0, durationMs: stored.durationMs, sizeBytes: null, licence: stored.licence, sourceUrl: stored.sourceUrl ?? stored.url, author: stored.author, tags: [] }
      : await pixabayVideoById(pick.id);
    if (candidate) out.push({ ...candidate, climaxMs: pick.climaxMs, focalX: pick.focalX ?? null });
  }
  return out;
}

/** A POV clip video's clip (client, 2026-11-21): in storage already, recorded like a hook clip. */
function povCandidate(clip: AiPovClip): StockCandidate {
  const url = sharedFileUrl(aiClipPath(clip.id));
  return { provider: AI_PROVIDER, providerId: clip.id, kind: "video", downloadUrl: url, ...AI_CLIP_SIZE, durationMs: clip.durationMs, sizeBytes: null, licence: AI_LICENCE, sourceUrl: url, author: "RepGet", tags: clip.tags };
}

function aiCandidate(clip: AiHookClip): HookCandidate {
  const url = sharedFileUrl(aiClipPath(clip.id));
  return {
    provider: AI_PROVIDER,
    providerId: clip.id,
    kind: "video",
    downloadUrl: url,
    ...AI_CLIP_SIZE,
    durationMs: clip.durationMs,
    sizeBytes: null,
    licence: AI_LICENCE,
    sourceUrl: url,
    author: "RepGet",
    tags: clip.tags,
    climaxMs: clip.climaxMs,
    focalX: null,
  };
}

/**
 * The scenes' pictures and clips, chosen now (never at idea time), once: a
 * retry keeps what was found. A footage-led video with nothing real to show
 * fails with the reason (stock not set up, nothing found) - it is never
 * turned into the old animated template to hide it.
 */
export async function prepareAssets(id: string): Promise<{ assets: number; notes: string[] }> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea) throw new Error("The idea is gone");
  const direction = directionOf(idea);
  if (direction === "animated") return { assets: 0, notes: [] };
  const plan = idea.plan as ShotPlan;
  const existing = storedAssets(idea.assets);
  if (plan.povClip) return preparePovClip(idea, plan.povClip.id, existing);
  let result;
  try {
    result = await resolveSceneAssets(
      { direction, hook: canHook(formatOf(idea), direction) ? (plan.hookClip?.type ?? null) : null, scenes: plan.scenes ?? [], parts: formatOf(idea) === "carousel" ? productionParts(idea.script as VideoScript, { ...choicesOf(idea), showHook: true }, plan).map((p) => p.part) : shownParts(idea), media: (idea.media as MediaItem[]) ?? [], existing },
      resolverDeps(idea),
    );
  } catch (error) {
    if (error instanceof BudgetExceededError) throw new ProductionError(error.message);
    throw error;
  }
  await db.update(videoIdeas).set({ assets: result.assets, updatedAt: new Date() }).where(eq(videoIdeas.id, id));
  if (FOOTAGE_LED.includes(direction) && result.assets.length === 0) {
    const status = footageStatus();
    throw new ProductionError(
      status.configured
        ? "No suitable footage or pictures were found for this video. Add your own clips or pictures in Videos -> Media, or choose Text + Music."
        : `${status.message} This video needs footage or pictures: add your own clips in Videos -> Media, or choose Text + Music.`,
    );
  }
  return { assets: result.assets.length, notes: result.notes };
}

/**
 * A POV clip video's one asset: its AI clip, already in RepGet's storage
 * (checked there once, recorded at no cost per video). A retry keeps it.
 */
async function preparePovClip(idea: VideoIdea, clipId: string, existing: StoredAsset[]): Promise<{ assets: number; notes: string[] }> {
  if (existing.some((asset) => asset.sceneIndex === 0)) return { assets: existing.length, notes: [] };
  const clip = povClipById(clipId);
  if (!clip) throw new ProductionError("This video's POV clip is no longer in the library. Choose another idea.");
  const deps = resolverDeps(idea);
  let stored;
  try {
    stored = await deps.storeStock(povCandidate(clip), clip.shows, 0);
  } catch (error) {
    throw new ProductionError(`The POV clip could not be loaded (${(error as Error).message}).`);
  }
  await deps.record({ kind: "footage", provider: AI_PROVIDER, usd: 0, basis: "measured", note: `RepGet AI POV clip ${clip.id} (made once, nothing per video)` });
  const asset: StoredAsset = {
    sceneIndex: 0,
    url: stored.url,
    kind: "video",
    source: "stock",
    provider: stored.provider,
    providerId: stored.providerId,
    licence: stored.licence,
    sourceUrl: stored.sourceUrl,
    author: stored.author,
    assetId: stored.id,
    durationMs: stored.durationMs ?? clip.durationMs,
    width: stored.width,
    height: stored.height,
  };
  await db.update(videoIdeas).set({ assets: [asset], updatedAt: new Date() }).where(eq(videoIdeas.id, idea.id));
  return { assets: 1, notes: [] };
}

/* ------------------------------------------------------------------ voice */

/** Whether the idea is spoken: Text + Music never is (no TTS, no Whisper). */
export function wantsVoice(idea: Pick<VideoIdea, "format" | "voice" | "production" | "captions" | "musicTrack">): boolean {
  if (!isVideoFormatIdea(idea)) return false;
  if (!idea.voice || !isVoice(idea.voice)) return false;
  return choicesOf(idea).audio !== "text_music";
}

/**
 * Speaks the idea's script, once: a retried job finds the voice already
 * there. Text + Music, a carousel, no voice chosen (or no OpenAI): the scenes
 * run on reading-speed (productions) or fixed (animated) times. A voice in a
 * language it cannot speak, or longer than the video may be, fails the make
 * clearly - it is never cut mid-word or spoken in English instead.
 */
export async function prepareVoice(id: string): Promise<VideoIdea> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea) throw new Error("The idea is gone");
  const video = isVideoFormatIdea(idea);
  const direction = directionOf(idea);
  if (!video || idea.voiceUrl || !wantsVoice(idea) || !isVoiceConfigured()) {
    if (video && !idea.voiceUrl) {
      await releaseCost(id, "narration");
      await releaseCost(id, "transcription");
      let durationMs = silentTiming(idea.script as VideoScript).totalMs;
      if (direction !== "animated") {
        const props = await reelProps(idea);
        const timeline = productionTimeline({ ...props, voiceUrl: null, voiceMs: 0 });
        if (!timeline.fits) {
          throw new ProductionError(
            `The words of this video need more time than its ${choicesOf(idea).duration} s length allows${formatOf(idea) === "story" ? " (a Story is at most 60 s)" : ""}. Shorten the text or choose a longer duration.`,
          );
        }
        durationMs = Math.round((timeline.durationInFrames / 30) * 1000);
      }
      const [row] = await db.update(videoIdeas).set({ durationMs, updatedAt: new Date() }).where(eq(videoIdeas.id, id)).returning();
      return row;
    }
    return idea;
  }

  const language = voiceLanguage(idea.language);
  if (!language) throw new ProductionError(new UnsupportedVoiceLanguageError(idea.language).message);
  const script = idea.script as VideoScript;
  const all = spokenParts(script);
  const parts = direction === "animated" ? all.map((_, i) => i) : shownParts(idea);
  const texts = parts.map((part) => (direction !== "animated" && part === all.length - 1 ? choicesOf(idea).ctaText?.trim() || all[part] : all[part]));
  // Spoken length: refused before paying when clearly too long, checked exactly after.
  const limitMs = videoSecondsLimit(idea) * 1000;
  const estimateSeconds = speechSecondsEstimate(texts);
  if (direction !== "animated" && estimateSeconds * 1000 > limitMs * 1.3) {
    throw new ProductionError(`The script is too long to narrate within ${Math.round(limitMs / 1000)} s (about ${Math.round(estimateSeconds)} s of speech). Shorten it or choose a longer duration.`);
  }
  try {
    await reserveCost(id, "narration", narrationEstimate(estimateSeconds), "the AI voice");
    await reserveCost(id, "transcription", transcriptionEstimate(estimateSeconds), "the caption timings");
  } catch (error) {
    if (error instanceof BudgetExceededError) throw new ProductionError(error.message);
    throw error;
  }

  let spoken;
  try {
    spoken = await speakScript(texts, idea.voice as Voice, language, direction === "animated" ? null : choicesOf(idea).narration);
  } catch (error) {
    const service = error instanceof VoiceServiceError ? error : null;
    const detail = service ? service.detail : String((error as Error).message);
    // A failed call may still have been billed: unmeasured, never free.
    await recordCost(id, { kind: "narration", provider: "openai", usd: null, basis: "unmeasured", note: `failed: ${detail.slice(0, 80)}` }, "narration");
    await recordCost(id, { kind: "transcription", provider: "openai", usd: null, basis: "unmeasured", note: "with a failed voice" }, "transcription");
    if (error instanceof UnsupportedVoiceLanguageError) throw new ProductionError(error.message);
    if (service) {
      // The customer is shown the code's words (the video's error); the owner the provider's own answer, here.
      console.error("[video] the AI voice failed", { ideaId: id, code: service.code, reason: service.reason, status: service.status, call: service.call, detail: service.detail });
      // Out of quota, a bad key, a refused request: trying again at once would fail the same way.
      if (!service.retryable) throw new ProductionError(service.code);
    }
    throw error;
  }
  const minutes = spoken.durationMs / 60_000;
  await recordCost(id, { kind: "narration", provider: "openai", usd: round(minutes * 0.015), basis: "estimated", note: `gpt-4o-mini-tts, ${Math.round(spoken.durationMs / 1000)} s at list price` }, "narration");
  await recordCost(id, { kind: "transcription", provider: "openai", usd: round(minutes * 0.006), basis: "estimated", note: `whisper-1, ${Math.round(spoken.durationMs / 1000)} s at list price` }, "transcription");

  const [site] = await db.select({ organizationId: websites.organizationId }).from(websites).where(eq(websites.id, idea.websiteId));
  if (site) {
    await track(site.organizationId, {
      kind: "llm",
      websiteId: idea.websiteId,
      provider: "openai",
      model: "gpt-4o-mini-tts",
      quantity: Math.round(spoken.durationMs / 1000),
      costUsd: minutes * VOICE_COST_PER_MINUTE,
      metadata: { purpose: "video_voice", ideaId: id, direction },
    });
  }
  if (direction !== "animated" && spoken.durationMs > limitMs) {
    // An over-long voice is never cut (mid-word or mid-sentence): the customer shortens the script.
    throw new ProductionError(`The narration is ${Math.round(spoken.durationMs / 1000)} s, longer than this video may be (${Math.round(limitMs / 1000)} s). Shorten the script or choose a longer duration.`);
  }
  const voiceUrl = await storeVideoFile(idea.websiteId, `ideas/${id}`, spoken.audio, "audio/wav");
  const [row] = await db
    .update(videoIdeas)
    .set({
      voiceUrl,
      timing: { words: spoken.words, sceneStartsMs: spoken.sceneStartsMs, ...(direction !== "animated" ? { parts } : {}) } satisfies Timing,
      durationMs: spoken.durationMs,
      updatedAt: new Date(),
    })
    .where(eq(videoIdeas.id, id))
    .returning();
  return row;
}

/* ------------------------------------------------------------------ music */

/** The music for an idea, chosen when it is made unless the customer chose one (or none). */
export async function chooseMusic(idea: VideoIdea): Promise<VideoIdea> {
  if (idea.musicTrack !== null) return idea;
  const direction = directionOf(idea);
  // The same pick as the idea's preview (music.ts ideaTrack).
  const legacy = direction === "animated" && !idea.production;
  const trackId =
    ideaTrack({
      id: idea.id,
      style: idea.style,
      musicTrack: null,
      direction,
      hasProduction: Boolean(idea.production),
      music: choicesOf(idea).music,
      planMood: (idea.plan as ShotPlan | null)?.musicMood ?? null,
      websiteMusic: legacy ? (await readVideoSettings(idea.websiteId)).music : true,
    })?.id ?? null;
  const [row] = await db
    .update(videoIdeas)
    .set({ musicTrack: trackId ?? "none", updatedAt: new Date() })
    .where(eq(videoIdeas.id, idea.id))
    .returning();
  return row;
}

/* ------------------------------------------------------------------ render */

/** The cover still to make with a reel: its own props, at the frame its opening is fully drawn (src/remotion/cover.ts). */
export function coverRequest(props: ProductionReelProps): CoverRequest {
  return { props, frame: coverFrame(props) };
}

/**
 * Stores a reel's cover still; null when there is none. A cover is a bonus:
 * its failure (not made, not stored) is logged for the owner and never fails
 * the video - the Videos page then shows the video's own frame.
 */
export async function storeCover(id: string, websiteId: string, file: Buffer | null, error: string | null): Promise<string | null> {
  if (!file) {
    if (error) console.warn("[video] the cover was not made", { ideaId: id, error });
    return null;
  }
  try {
    return await storeVideoFile(websiteId, `ideas/${id}`, file, "image/jpeg");
  } catch (stored) {
    console.warn("[video] the cover was not stored", { ideaId: id, error: (stored as Error).message });
    return null;
  }
}

/** A reel rendered on this machine (development) with its cover, stored. */
export async function makeReelLocally(idea: VideoIdea): Promise<{ videoUrl: string; coverUrl: string | null }> {
  const props = await reelProps(idea);
  const cover = coverRequest(props);
  const rendered = await renderReelLocally(props, cover.frame);
  const videoUrl = await storeVideoFile(idea.websiteId, `ideas/${idea.id}`, rendered.video, "video/mp4");
  await recordCost(idea.id, { kind: "render", provider: "local", usd: 0, basis: "estimated", note: "rendered on a development machine" }, "render");
  const coverUrl = await storeCover(idea.id, idea.websiteId, rendered.cover, rendered.cover ? null : "the local render made no cover");
  return { videoUrl, coverUrl };
}

/** A carousel's slides, rendered and stored. */
export async function makeCarousel(idea: VideoIdea): Promise<string[]> {
  const props = await reelProps(idea);
  // A production carousel: its parts, the hook always as the cover (src/remotion/directions/Slides.tsx).
  const count = directionOf(idea) === "animated" ? slideCount(props.script) : productionParts(props.script, { ...choicesOf(idea), showHook: true }, props.plan).length;
  const started = Date.now();
  const slides = await renderSlides(props, count);
  const urls: string[] = [];
  for (const slide of slides) urls.push(await storeVideoFile(idea.websiteId, `ideas/${idea.id}`, slide, "image/png"));
  const onVercel = Boolean(process.env.VERCEL);
  await recordCost(
    idea.id,
    onVercel
      ? { kind: "render", provider: "vercel-sandbox", usd: sandboxCost(Date.now() - started), basis: "estimated", note: `${count} slides, ${Math.round((Date.now() - started) / 1000)} s of a 4-vCPU sandbox at list price` }
      : { kind: "render", provider: "local", usd: 0, basis: "estimated", note: "rendered on a development machine" },
    "render",
  );
  return urls;
}

/** What a sandbox render cost, from its measured runtime (list prices; cost-math.ts). */
export async function recordRender(id: string, runtimeMs: number | null, vcpus: number): Promise<void> {
  await recordCost(
    id,
    runtimeMs === null
      ? { kind: "render", provider: "vercel-sandbox", usd: null, basis: "unmeasured", note: "runtime not measured" }
      : { kind: "render", provider: "vercel-sandbox", usd: sandboxCost(runtimeMs, vcpus), basis: "estimated", note: `${Math.round(runtimeMs / 1000)} s of a ${vcpus}-vCPU sandbox at list price` },
    "render",
  );
}

/** Stores the version without RepGet's music made with the render (remuxed on the same machine). */
export async function storeNoMusicVersion(id: string, file: Buffer): Promise<string> {
  const [idea] = await db.select({ websiteId: videoIdeas.websiteId }).from(videoIdeas).where(eq(videoIdeas.id, id));
  const url = await storeVideoFile(idea.websiteId, `ideas/${id}`, file, "video/mp4");
  await db.update(videoIdeas).set({ altVideoUrl: url, updatedAt: new Date() }).where(eq(videoIdeas.id, id));
  await recordCost(id, { kind: "audio_mux", provider: "vercel-sandbox", usd: 0, basis: "estimated", note: "remuxed on the render machine; its seconds are in the render's runtime" });
  return url;
}

/** Whether a made video has RepGet's music in it (then a version without it is worth making). */
export function hasRepgetMusic(idea: Pick<VideoIdea, "musicTrack">): boolean {
  return Boolean(musicTrack(idea.musicTrack));
}

/**
 * The same reel without RepGet's music (idea.altVideoUrl): what Instagram
 * gets when native Instagram audio is attached (lib/video/native-audio.ts,
 * Worker D). The voice alone - or silence for Text + Music - remuxed under
 * the already rendered picture (ffmpeg -c:v copy): no second render. Usually
 * made with the render; this makes it later when it is missing. A video with
 * no RepGet music is already that version.
 */
export async function makeNoMusicVersion(ideaId: string): Promise<string> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, ideaId));
  if (!idea) throw new Error("The idea is gone");
  if (idea.altVideoUrl) return idea.altVideoUrl;
  if (!idea.videoUrl) throw new Error("The video is not made yet");
  if (!hasRepgetMusic(idea)) {
    await db.update(videoIdeas).set({ altVideoUrl: idea.videoUrl, updatedAt: new Date() }).where(eq(videoIdeas.id, ideaId));
    return idea.videoUrl;
  }
  const onVercel = Boolean(process.env.VERCEL);
  // A small sandbox for a minute or two: held against the budget like any paid step.
  const estimate = onVercel ? round(sandboxCost(3 * 60_000, 2)) : 0;
  try {
    await reserveCost(ideaId, "audio_mux", estimate, "the version without music");
  } catch (error) {
    if (error instanceof BudgetExceededError) throw new ProductionError(error.message);
    throw error;
  }
  let result;
  try {
    result = await remuxNoMusic(idea.videoUrl, { voiceUrl: idea.voiceUrl, durationMs: idea.durationMs ?? 0 });
  } catch (error) {
    await recordCost(ideaId, { kind: "audio_mux", provider: onVercel ? "vercel-sandbox" : "local", usd: onVercel ? null : 0, basis: onVercel ? "unmeasured" : "estimated", note: "remux failed" }, "audio_mux");
    throw error;
  }
  await recordCost(
    ideaId,
    result.runtimeMs === null
      ? { kind: "audio_mux", provider: "local", usd: 0, basis: "estimated", note: "remuxed on a development machine" }
      : { kind: "audio_mux", provider: "vercel-sandbox", usd: sandboxCost(result.runtimeMs, result.vcpus), basis: "estimated", note: `${Math.round(result.runtimeMs / 1000)} s of a ${result.vcpus}-vCPU sandbox` },
    "audio_mux",
  );
  const url = await storeVideoFile(idea.websiteId, `ideas/${ideaId}`, result.file, "video/mp4");
  await db.update(videoIdeas).set({ altVideoUrl: url, updatedAt: new Date() }).where(eq(videoIdeas.id, ideaId));
  return url;
}

/* ------------------------------------------------------------------ finish */

/**
 * The video is made: ready, and on its way when the website publishes
 * automatically. Only while it is still being made: a video its customer
 * deleted meanwhile stays deleted, its slot is given back and the files that
 * were just stored are removed.
 */
export async function finishMaking(
  id: string,
  files: { videoUrl?: string; slideUrls?: string[]; altVideoUrl?: string | null; coverUrl?: string | null },
  now: Date = new Date(),
): Promise<{ autoAt: Date | null }> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea) return { autoAt: null };
  const discard = async () => {
    await deleteVideoFiles(idea.websiteId, [files.videoUrl, files.altVideoUrl, files.coverUrl, ...(files.slideUrls ?? [])]);
    return { autoAt: null };
  };
  if (idea.status === "deleted") return discard();
  if (idea.status !== "making") return { autoAt: null };
  const settings = await readVideoSettings(idea.websiteId);
  // Manual and draft keep it in Your videos; auto takes a slot within the posting frequency, unless a review is owed.
  const autoAt = await autoPublishTime(idea, settings, now);
  // The files' storage, estimated (kept FILE_DAYS after posting, fetched by the platforms).
  await recordCost(id, { kind: "storage", provider: "supabase", usd: storageEstimate(formatOf(idea)), basis: "estimated", note: "files and transfer at list price" }, "storage");
  const [finished] = await db
    .update(videoIdeas)
    .set({
      status: autoAt ? "scheduled" : "ready",
      videoUrl: files.videoUrl ?? null,
      slideUrls: files.slideUrls ?? null,
      // A reel's cover still (a carousel's cover is its first slide); a remake replaces the old one.
      coverUrl: files.coverUrl ?? null,
      ...(files.altVideoUrl ? { altVideoUrl: files.altVideoUrl } : {}),
      platforms: autoAt ? settings.platforms : idea.platforms,
      scheduledFor: autoAt,
      error: null,
      updatedAt: now,
    })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.status, "making")))
    .returning({ id: videoIdeas.id });
  if (finished) return { autoAt };
  // Deleted between the two: the hour it was just given is free again.
  await releaseScheduleSlot(id);
  const [fresh] = await db.select({ status: videoIdeas.status }).from(videoIdeas).where(eq(videoIdeas.id, id));
  return fresh?.status === "deleted" ? discard() : { autoAt: null };
}

/**
 * The video could not be made: the credit goes back, once, together with the
 * status and under its lock (a video deleted at that moment is neither failed
 * nor refunded). The reason stays for the team; the customer finds the idea
 * back in Today's ideas (customer-view.ts). The cost ledger keeps what was spent.
 */
export async function failMaking(id: string, reason: string, now: Date = new Date()): Promise<void> {
  const failed = await db.transaction(async (tx) => {
    const [idea] = await tx.select().from(videoIdeas).where(eq(videoIdeas.id, id)).for("update");
    if (!idea || !["approved", "making"].includes(idea.status)) return false;
    if (idea.creditSpendKey) await refundSpend(idea.creditSpendKey, tx, now);
    await releaseScheduleSlot(id, tx);
    await tx
      .update(videoIdeas)
      .set({ status: "failed", error: reason.replace(/\s+/g, " ").slice(0, 300), updatedAt: now })
      .where(eq(videoIdeas.id, id));
    return true;
  });
  if (!failed) return;
  // Holds of the failed attempt are released; recorded items stay (retries never reset the ledger).
  const ledger = await readLedger(id);
  for (const key of Object.keys(ledger.holds)) await releaseCost(id, key);
}
