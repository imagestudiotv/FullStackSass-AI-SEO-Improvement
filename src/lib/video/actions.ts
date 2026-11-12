"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import { updateBrandVoice } from "@/lib/brand/actions";
import { refundSpend, spendCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { videoIdeas, videoMedia } from "@/lib/db/schema";
import { updateWebsiteDetails } from "@/lib/websites/actions";
import { requireEditor } from "@/lib/websites/require-editor";

import { dailyWritten, ideaAllowance, reserveExtraBatch, reserveRewrite, rewritesLeft, utcDay } from "./batches";
import {
  BATCH_KINDS,
  DAILY_BATCH_SIZE,
  isCreativeDirection,
  isIdeaCategory,
  isMakeVia,
  isVideoFormat,
  isVideoStyle,
  isVoice,
  UNDO_SECONDS,
  VOICES,
  type BatchKind,
  type CreativeDirection,
  type ExtraBatchKind,
  type FactClaim,
  type IdeaOverrides,
  type MakeVia,
  type ProductionChoices,
  type ShotPlan,
  type VideoFormat,
  type VideoScript,
} from "./formats";
import { rewriteIdea } from "./ideas";
import { spendKey } from "./make";
import { musicTrack } from "./music";
import { contentHash, reviewAfterEdit } from "./review";
import { readVideoSettings, resetVideoSettings, saveVideoSettings, validateVideoSettings, videoAccess, type SettingsInput, type VideoSettings } from "./settings";
import { durationFor } from "./strategy/allocation";
import { alignPlan, recipeOf } from "./strategy/creative";
import { maxPointsFor } from "./strategy/duration";
import { cleanOverrides, mergeProduction, productionOf } from "./strategy/production";
import { cleanVideoProfile, type VideoProfileInput } from "./strategy/profile";
import { CLIP_TYPES, isVideoStorageConfigured, MAX_CLIP_BYTES, MAX_PHOTO_BYTES, PHOTO_TYPES, signedUpload, videoFilePath } from "./storage";

/**
 * The Videos page's actions. Each checks, on the server: an editor of the
 * website (a viewer cannot spend its owner's credits) and a plan or trial
 * (client, 2026-10-29: videos in trials too). Errors are codes (VideoError)
 * the page shows in the reader's language.
 */

export type VideoError =
  | "view_only"
  | "no_plan"
  | "not_found"
  | "already_handled"
  | "not_enough_credits"
  | "bad_script"
  | "no_accounts"
  /** Pinterest chosen, and no board for its Pins yet (chosen on Opportunities). */
  | "no_board"
  | "not_configured"
  | "connect_failed"
  | "bad_file"
  | "too_big"
  | "bad_time"
  /** The day already has its DAILY_BATCH_SIZE ideas, made or skipped: the next ones come tomorrow. */
  | "day_full"
  /** The day's EXTRA_BATCHES_PER_DAY extra batches are used. */
  | "extra_used_up"
  /** A batch of ideas is being written: wait for it. */
  | "busy"
  /** Extra ideas were asked for moments ago (retryAt says when to ask again). */
  | "too_soon"
  /** A settings or profile field has a value it cannot have (field names it). */
  | "bad_settings"
  /** A content language RepGet does not write. */
  | "bad_language"
  /** The day's free rewrites are used. */
  | "rewrites_used_up"
  /** The idea writer did not answer usefully; nothing changed. */
  | "ai_failed";

export type VideoResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: VideoError; price?: number; available?: number; retryAt?: string; field?: string };

const fail = (error: VideoError): { ok: false; error: VideoError } => ({ ok: false, error });

const pagePath = (websiteId: string) => `/websites/${websiteId}/videos`;

async function guard(websiteId: string) {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return { ok: false as const, error: "view_only" as const };
  if ((await videoAccess(websiteId)) === "none") return { ok: false as const, error: "no_plan" as const };
  return { ok: true as const, site: editor.context.site, userId: editor.context.userId };
}

async function ideaFor(websiteId: string, id: string) {
  const [row] = await db.select().from(videoIdeas).where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)));
  return row ?? null;
}

// ---------------------------------------------------------------- ideas

export type IdeasRequested = {
  batchId: string;
  /** 1..EXTRA_BATCHES_PER_DAY. */
  slot: number;
  kind: ExtraBatchKind;
  /** The same request key asked again: the batch reserved the first time. */
  reused: boolean;
  /** Extra batches left today after this one. */
  extraLeft: number;
};

/**
 * Asks for ideas, free (client, 2026-11-12: idea exploration is never
 * charged; only making a video costs its credit).
 *
 *  - "daily": today's ideas, up to the day's twenty (the page asks on
 *    opening when there are none). The twenty are a day's worth however
 *    they were used - made, skipped or still waiting - so a full day says so
 *    ("day_full") instead of promising ideas that never come.
 *  - "mixed" | "viral" | "website": one of the day's EXTRA_BATCHES_PER_DAY
 *    extra batches of EXTRA_BATCH_SIZE, reserved before the job writes it
 *    (lib/video/batches.ts): "extra_used_up" once the three are used,
 *    "busy" while a batch is being written, "too_soon" within
 *    EXTRA_REQUEST_GAP_MS of the last request (retryAt says when).
 *
 * `requestKey` (any string the caller keeps for one click, e.g. a UUID)
 * makes a retried request return its first batch instead of taking another.
 * The page's buttons, the AI chat and direct requests share the allowance.
 */
export async function requestVideoIdeas(
  websiteId: string,
  kind: BatchKind = "daily",
  requestKey?: string | null,
  via: "button" | "chat" = "button",
): Promise<VideoResult<IdeasRequested | null>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!(BATCH_KINDS as readonly string[]).includes(kind)) return fail("not_found");
  const now = new Date();
  if (kind === "daily") {
    if ((await dailyWritten(websiteId, utcDay(now))) >= DAILY_BATCH_SIZE) return fail("day_full");
    await queueJob({ name: "video/ideas.requested", data: { websiteId } });
    return { ok: true, data: null };
  }
  const reserved = await reserveExtraBatch(
    websiteId,
    kind,
    { requestKey: typeof requestKey === "string" ? requestKey : null, requestedBy: checked.userId, via: via === "chat" ? "chat" : "button" },
    now,
  );
  if (!reserved.ok) {
    return { ok: false, error: reserved.error, ...(reserved.nextAllowedAt ? { retryAt: reserved.nextAllowedAt.toISOString() } : {}) };
  }
  const { batch } = reserved;
  // The event id is the reservation's: asked again with the same key, it is one job.
  if (batch.status === "reserved") {
    await queueJob({ id: `video-ideas-batch:${batch.id}:${batch.attempts}`, name: "video/ideas.requested", data: { websiteId, batchId: batch.id } });
  }
  const allowance = await ideaAllowance(websiteId, now);
  revalidatePath(pagePath(websiteId));
  return {
    ok: true,
    data: { batchId: batch.id, slot: batch.slot, kind: batch.kind as ExtraBatchKind, reused: reserved.reused, extraLeft: allowance.extraLeft },
  };
}

export type IdeaEdit = {
  title?: string;
  script?: VideoScript;
  caption?: string;
  style?: string;
  format?: string;
  voice?: string | null;
  musicTrack?: string | null;
  captions?: boolean;
  /** CreativeDirection. */
  direction?: string;
  /** IdeaCategory. */
  category?: string;
  /** Some ProductionChoices fields; the others keep their values. */
  production?: Partial<Record<keyof ProductionChoices, unknown>>;
  /** This video's own audience/tone/avoid/tone preset; null clears them. Never the global profile. */
  overrides?: IdeaOverrides | null;
};

type IdeaRow = typeof videoIdeas.$inferSelect;

/**
 * An edit held to what the productions can show; null when it does not fit.
 * The legacy voice/music columns follow the production choices (and the
 * other way round for an older page sending only a voice), the shot plan
 * keeps one scene per spoken part, and the review state follows the new
 * words: an approval holds only for the content it was given on.
 */
function cleanEdit(edit: IdeaEdit, row: IdeaRow, settings: VideoSettings): Partial<typeof videoIdeas.$inferInsert> | null {
  const out: Partial<typeof videoIdeas.$inferInsert> = {};
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

  let format: VideoFormat = isVideoFormat(row.format) ? row.format : "reel";
  if (edit.format !== undefined) {
    if (!isVideoFormat(edit.format)) return null;
    format = edit.format;
    out.format = edit.format;
  }
  let direction: CreativeDirection = isCreativeDirection(row.direction) ? row.direction : "animated";
  if (edit.direction !== undefined) {
    if (!isCreativeDirection(edit.direction)) return null;
    direction = edit.direction;
    out.direction = edit.direction;
  }
  if (edit.category !== undefined) {
    if (!isIdeaCategory(edit.category)) return null;
    out.category = edit.category;
  }
  if (edit.title !== undefined) {
    const title = text(edit.title, 90);
    if (!title) return null;
    out.title = title;
  }
  let script = row.script as VideoScript;
  if (edit.script) {
    const { hook, points, proof, cta } = edit.script;
    const clean: VideoScript = {
      hook: text(hook, 80),
      points: (Array.isArray(points) ? points : []).slice(0, maxPointsFor(direction, format)).map((point) => ({
        title: text(point?.title, 48),
        detail: text(point?.detail, 180),
        stat:
          point?.stat && Number.isFinite(Number(point.stat.value))
            ? { value: Number(point.stat.value), suffix: text(point.stat.suffix, 6), label: text(point.stat.label, 40) }
            : null,
      })),
      proof: text(proof, 160),
      cta: text(cta, 80),
    };
    if (!clean.hook || clean.points.length < 2 || clean.points.some((point) => !point.title)) return null;
    script = clean;
    out.script = clean;
  } else if (script.points.length > maxPointsFor(direction, format)) {
    // Back to the original templates or a carousel: they show four points at most.
    script = { ...script, points: script.points.slice(0, maxPointsFor(direction, format)) };
    out.script = script;
  }
  let caption = row.caption;
  if (edit.caption !== undefined) {
    caption = typeof edit.caption === "string" ? edit.caption.trim().slice(0, 2200) : "";
    if (!caption) return null;
    out.caption = caption;
  }
  if (edit.style !== undefined) {
    if (!isVideoStyle(edit.style)) return null;
    out.style = edit.style;
  }
  if (edit.captions !== undefined) out.captions = Boolean(edit.captions);

  // Production: the edit, then the direction's audio, then the legacy columns.
  const current = productionOf(row, settings);
  let production = edit.production ? mergeProduction(current, edit.production) : current;
  if (!production) return null;
  if (edit.voice !== undefined) {
    if (edit.voice !== null && !isVoice(edit.voice)) return null;
    if (edit.production?.audio === undefined) production = { ...production, audio: edit.voice === null ? "text_music" : "voiceover" };
  }
  if (direction === "text_music" || format === "carousel") production = { ...production, audio: "text_music" };
  else if (direction === "voiceover") production = { ...production, audio: "voiceover" };
  production = { ...production, duration: durationFor(format, production.duration) };
  if (edit.musicTrack !== undefined) {
    if (edit.musicTrack !== null && edit.musicTrack !== "none" && !musicTrack(edit.musicTrack)) return null;
    out.musicTrack = edit.musicTrack;
    if (edit.musicTrack === "none") production = { ...production, music: "none" };
    else if (production.music === "none" && edit.production?.music === undefined) production = { ...production, music: "auto" };
  } else if (production.music === "none" && row.musicTrack !== "none") out.musicTrack = "none";
  else if (production.music !== "none" && row.musicTrack === "none") out.musicTrack = null;
  if (production.audio === "text_music") out.voice = null;
  else out.voice = typeof edit.voice === "string" ? edit.voice : (row.voice ?? settings.voice ?? VOICES[0]);
  const productionChanged = JSON.stringify(production) !== JSON.stringify(row.production);
  if (edit.production || edit.voice !== undefined || edit.direction !== undefined || edit.format !== undefined || productionChanged) out.production = production;

  if (edit.overrides !== undefined) {
    const overrides = cleanOverrides(edit.overrides);
    if (!overrides) return null;
    out.overrides = overrides as Record<string, string>;
  }

  // The plan follows the script and the direction.
  let plan = (row.plan as ShotPlan | null) ?? null;
  if (plan && (out.script || out.direction)) {
    plan = alignPlan({ ...plan, direction }, script);
    plan = { ...plan, recipe: recipeOf(plan) };
    out.plan = plan;
  }
  // A new script, voice or production choice is voiced again; new words or shots pick their pictures and clips again.
  if (out.script || out.voice !== row.voice || out.production) Object.assign(out, { voiceUrl: null, timing: null, durationMs: null });
  if (out.script || out.plan) out.assets = [];

  // The review follows the published words only when they changed.
  const before = contentHash({ script: row.script as VideoScript, caption: row.caption, plan: row.plan as ShotPlan | null, production: current });
  if (contentHash({ script, caption, plan, production }) === before) return out;
  const review = reviewAfterEdit(
    { reviewStatus: row.reviewStatus, reviewReasons: row.reviewReasons ?? [], reviewedHash: row.reviewedHash, claims: (row.claims ?? []) as FactClaim[] },
    { script, caption, plan, production },
    settings,
  );
  if (review.reviewStatus !== row.reviewStatus || review.reviewReasons.join() !== (row.reviewReasons ?? []).join()) {
    out.reviewStatus = review.reviewStatus;
    out.reviewReasons = review.reviewReasons;
  }
  return out;
}

/** Saves an edit to an idea that is not made yet. */
export async function editVideoIdea(websiteId: string, id: string, edit: IdeaEdit): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const settings = await readVideoSettings(websiteId);
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)))
      .for("update");
    if (!row) return fail("not_found");
    if (!["new", "failed"].includes(row.status)) return fail("already_handled");
    const changes = cleanEdit(edit, row, settings);
    if (!changes) return fail("bad_script");
    await tx.update(videoIdeas).set({ ...changes, updatedAt: new Date() }).where(eq(videoIdeas.id, id));
    return { ok: true as const, data: null };
  });
  if (result.ok) revalidatePath(pagePath(websiteId));
  return result;
}

/**
 * Writes one idea again - its script, shots and claims - for this video's
 * own audience, tone and words to avoid (its overrides), keeping its
 * category, format and production. Free, REWRITES_PER_DAY a website a day.
 */
export async function rewriteVideoIdea(websiteId: string, id: string): Promise<VideoResult<{ rewritesLeft: number }>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, id);
  if (!row) return fail("not_found");
  if (!["new", "failed"].includes(row.status)) return fail("already_handled");
  if (!(await reserveRewrite(websiteId, checked.site.organizationId, id))) return fail("rewrites_used_up");
  try {
    const result = await rewriteIdea(websiteId, id);
    if (!result.ok) return fail(result.reason === "already_handled" ? "already_handled" : result.reason === "bad_script" ? "ai_failed" : "not_configured");
  } catch (error) {
    console.error("[video] rewrite failed", { websiteId, id, error });
    return fail("ai_failed");
  }
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { rewritesLeft: await rewritesLeft(websiteId) } };
}

/**
 * A person's approval of an idea that needs review (an unsourced figure, a
 * controversial angle, a sensitive topic): it holds for the content as it is
 * now (contentHash), so any later change of the words needs it again.
 */
export async function approveVideoReview(websiteId: string, id: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)))
      .for("update");
    if (!row) return fail("not_found");
    if (row.reviewStatus === "none" || ["posting", "posted"].includes(row.status)) return fail("already_handled");
    const hash = contentHash({ script: row.script as VideoScript, caption: row.caption, plan: row.plan as ShotPlan | null, production: row.production as ProductionChoices | null });
    const now = new Date();
    await tx
      .update(videoIdeas)
      .set({ reviewStatus: "approved", reviewedHash: hash, reviewedBy: checked.userId, reviewedAt: now, updatedAt: now })
      .where(eq(videoIdeas.id, id));
    return { ok: true as const, data: null };
  });
  if (result.ok) revalidatePath(pagePath(websiteId));
  return result;
}

/**
 * Approves an idea (a swipe to the right): charges its credit, once, and has
 * it made into its video. An edit sent along is saved first. A failed idea
 * can be approved again - its credit was given back when it failed.
 */
export async function approveVideoIdea(websiteId: string, id: string, edit: IdeaEdit = {}, via: MakeVia = "button"): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const settings = await readVideoSettings(websiteId);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)))
      .for("update");
    if (!row) return fail("not_found");
    if (!["new", "failed"].includes(row.status)) return fail("already_handled");
    const changes = cleanEdit(edit, row, settings);
    if (!changes) return fail("bad_script");
    // A retry, or a make after an Undo, is a new charge: the earlier credit was returned.
    const key = row.status === "failed" || row.creditSpendKey ? `${spendKey(id)}:${Date.now()}` : spendKey(id);
    const spent = await spendCredits(tx, { organizationId: checked.site.organizationId, action: "video_post", key, websiteId });
    if (!spent.ok) return { ok: false as const, error: "not_enough_credits" as const, price: spent.price, available: spent.available };
    const now = new Date();
    await tx
      .update(videoIdeas)
      .set({
        ...changes,
        status: "approved",
        approvedAt: now,
        approvedBy: checked.userId,
        approvedVia: isMakeVia(via) ? via : "button",
        creditSpendKey: spent.spendId ? key : null,
        // Each make renders anew, so the Instagram copy without music is made again too.
        altVideoUrl: null,
        platforms: settings.platforms,
        // A script or voice changed after a failed attempt is voiced again (cleanEdit clears the old voice).
        error: null,
        updatedAt: now,
      })
      .where(eq(videoIdeas.id, id));
    return { ok: true as const, data: null };
  });
  if (result.ok) await queueJob({ name: "video/make.requested", data: { ideaId: id } });
  revalidatePath(pagePath(websiteId));
  return result;
}

/**
 * Takes back a make from today's ideas within UNDO_SECONDS (a press or swipe
 * by mistake): the idea is back in the deck and its credit returned. Too late
 * once the video is being made.
 */
export async function undoVideoIdea(websiteId: string, id: string): Promise<VideoResult> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)))
      .for("update");
    if (!row) return fail("not_found");
    // A few seconds' grace past the toast, still inside the job's wait.
    const late = !row.approvedAt || now.getTime() - row.approvedAt.getTime() > (UNDO_SECONDS + 3) * 1000;
    if (row.status !== "approved" || late || !["button", "swipe", "key"].includes(row.approvedVia ?? "")) return fail("already_handled");
    if (row.creditSpendKey) await refundSpend(row.creditSpendKey, tx, now);
    await tx
      .update(videoIdeas)
      .set({ status: "new", approvedAt: null, approvedBy: null, approvedVia: null, updatedAt: now })
      .where(eq(videoIdeas.id, id));
    return { ok: true as const, data: null };
  });
  revalidatePath(pagePath(websiteId));
  return result;
}

/** Skips an idea (a swipe to the left): nothing is charged, and it is not shown again. */
export async function skipVideoIdea(websiteId: string, id: string): Promise<VideoResult> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  await db
    .update(videoIdeas)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId), inArray(videoIdeas.status, ["new", "failed"])));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Brings a skipped idea back (the swipe's undo). */
export async function restoreVideoIdea(websiteId: string, id: string): Promise<VideoResult> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  await db
    .update(videoIdeas)
    .set({ status: "new", updatedAt: new Date() })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.status, "skipped")));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- settings

/**
 * Saves the Videos settings. Every field is checked (validateVideoSettings):
 * a value a field cannot have refuses the Save with "bad_settings" and the
 * field's name, and nothing is stored. Only what is sent changes - automatic
 * posting and new platforms are never switched on by anything else.
 */
export async function saveVideoSettingsAction(websiteId: string, input: SettingsInput): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!input || typeof input !== "object") return fail("bad_settings");
  const current = await readVideoSettings(websiteId);
  const result = validateVideoSettings(input, current, { logoAllowed: (url) => Boolean(videoFilePath(url, websiteId)) });
  if (!result.ok) return { ok: false, error: "bad_settings", field: result.field };
  await saveVideoSettings(websiteId, result.settings);
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/**
 * Reset: the strategy, video, audio and safety settings back to the
 * defaults, keeping the customer's platforms, publishing mode, frequency,
 * logo and default CTA (resetVideoSettings): nothing is switched on.
 */
export async function resetVideoSettingsAction(websiteId: string): Promise<VideoResult<VideoSettings>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const next = resetVideoSettings(await readVideoSettings(websiteId));
  await saveVideoSettings(websiteId, next);
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: next };
}

/**
 * The Videos page's "Audience & topics", saved where they live (client,
 * 2026-11-12: one profile, never typed twice): audience, language and market
 * through the business profile's own action, tone and words to avoid through
 * Brand Voice's (other Brand Voice fields untouched), priority topics and the
 * tone preset in the video settings. The language must be one RepGet writes.
 */
export async function saveVideoProfileAction(websiteId: string, input: VideoProfileInput): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!input || typeof input !== "object") return fail("bad_settings");
  const clean = cleanVideoProfile(input);
  if (!clean.ok) return { ok: false, error: clean.field === "language" ? "bad_language" : "bad_settings", field: clean.field };
  const { website, voice, video } = clean.value;
  if (Object.keys(website).length > 0) {
    const saved = await updateWebsiteDetails(websiteId, website);
    if (!saved.ok) return fail("view_only");
  }
  if (Object.keys(voice).length > 0) {
    const saved = await updateBrandVoice(websiteId, voice);
    if (!saved.ok) return fail("view_only");
  }
  if (Object.keys(video).length > 0) {
    const current = await readVideoSettings(websiteId);
    await saveVideoSettings(websiteId, { ...current, ...video });
  }
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- media

/** A signed address the browser uploads a picture or clip to directly. */
export async function prepareVideoUpload(
  websiteId: string,
  file: { type: string; size: number },
): Promise<VideoResult<{ signedUrl: string; publicUrl: string; kind: "image" | "video" }>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!isVideoStorageConfigured()) return fail("not_configured");
  const kind = (CLIP_TYPES as readonly string[]).includes(file.type) ? "video" : (PHOTO_TYPES as readonly string[]).includes(file.type) ? "image" : null;
  if (!kind) return fail("bad_file");
  if (file.size > (kind === "video" ? MAX_CLIP_BYTES : MAX_PHOTO_BYTES)) return fail("too_big");
  const upload = await signedUpload(websiteId, file.type);
  return { ok: true, data: { ...upload, kind } };
}

/** Adds an uploaded picture or clip to the website's library. */
export async function addVideoMedia(websiteId: string, url: string, kind: string, name: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!videoFilePath(url, websiteId) || (kind !== "image" && kind !== "video")) return fail("bad_file");
  await db.insert(videoMedia).values({ websiteId, url, kind, name: name.slice(0, 200) || null });
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

export async function removeVideoMedia(websiteId: string, id: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  await db.delete(videoMedia).where(and(eq(videoMedia.id, id), eq(videoMedia.websiteId, websiteId)));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Adds the customer's picture or clip to an idea's scenes (first in line). */
export async function addMediaToIdea(websiteId: string, id: string, url: string, kind: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, id);
  if (!row || !["new", "failed"].includes(row.status)) return fail(row ? "already_handled" : "not_found");
  const own = await db.select().from(videoMedia).where(and(eq(videoMedia.websiteId, websiteId), eq(videoMedia.url, url)));
  if (own.length === 0 && !videoFilePath(url, websiteId)) return fail("bad_file");
  const media = [{ url, kind: kind === "video" ? "video" : "image" }, ...(row.media ?? []).filter((item) => item.url !== url)].slice(0, 6);
  await db.update(videoIdeas).set({ media, updatedAt: new Date() }).where(eq(videoIdeas.id, id));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

export async function removeMediaFromIdea(websiteId: string, id: string, url: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, id);
  if (!row || !["new", "failed"].includes(row.status)) return fail(row ? "already_handled" : "not_found");
  await db
    .update(videoIdeas)
    .set({ media: (row.media ?? []).filter((item) => item.url !== url), updatedAt: new Date() })
    .where(eq(videoIdeas.id, id));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

