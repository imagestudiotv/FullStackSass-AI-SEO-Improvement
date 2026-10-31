"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import { spendCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { socialAccounts, socialTeams, videoIdeas, videoMedia } from "@/lib/db/schema";
import { ensureTeam, removeAccount } from "@/lib/social/accounts";
import { disconnectAccount, isBundleConfigured, portalLink } from "@/lib/social/bundle";
import { siteUrl } from "@/lib/site-url";
import { requireEditor } from "@/lib/websites/require-editor";

import {
  isVideoPlatform,
  isVideoStyle,
  isVoice,
  VIDEO_PLATFORM_SPECS,
  type VideoScript,
} from "./formats";
import { nextPublishTime, spendKey } from "./make";
import { musicTrack } from "./music";
import { readVideoSettings, saveVideoSettings, videoAccess, type VideoSettings } from "./settings";
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
  | "not_configured"
  | "connect_failed"
  | "bad_file"
  | "too_big"
  | "bad_time";

export type VideoResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: VideoError; price?: number; available?: number };

const fail = (error: VideoError): { ok: false; error: VideoError } => ({ ok: false, error });

const pagePath = (websiteId: string) => `/websites/${websiteId}/videos`;

async function guard(websiteId: string) {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return { ok: false as const, error: "view_only" as const };
  if ((await videoAccess(websiteId)) === "none") return { ok: false as const, error: "no_plan" as const };
  return { ok: true as const, site: editor.context.site };
}

async function ideaFor(websiteId: string, id: string) {
  const [row] = await db.select().from(videoIdeas).where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)));
  return row ?? null;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || siteUrl();
}

// ---------------------------------------------------------------- ideas

/** Asks for today's ideas, up to the day's twenty (the page does on opening when there are none). */
export async function requestVideoIdeas(websiteId: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  await queueJob({ name: "video/ideas.requested", data: { websiteId } });
  return { ok: true, data: null };
}

export type IdeaEdit = {
  script?: VideoScript;
  caption?: string;
  style?: string;
  format?: string;
  voice?: string | null;
  musicTrack?: string | null;
  captions?: boolean;
};

/** An edit held to what the templates can show; null when it does not fit. */
function cleanEdit(edit: IdeaEdit): Partial<typeof videoIdeas.$inferInsert> | null {
  const out: Partial<typeof videoIdeas.$inferInsert> = {};
  if (edit.script) {
    const { hook, points, proof, cta } = edit.script;
    const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
    const clean: VideoScript = {
      hook: text(hook, 80),
      points: (Array.isArray(points) ? points : []).slice(0, 4).map((point) => ({
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
    out.script = clean;
  }
  if (edit.caption !== undefined) {
    const caption = edit.caption.trim().slice(0, 2200);
    if (!caption) return null;
    out.caption = caption;
  }
  if (edit.style !== undefined) {
    if (!isVideoStyle(edit.style)) return null;
    out.style = edit.style;
  }
  if (edit.format !== undefined) {
    if (edit.format !== "reel" && edit.format !== "carousel") return null;
    out.format = edit.format;
  }
  if (edit.voice !== undefined) {
    if (edit.voice !== null && !isVoice(edit.voice)) return null;
    out.voice = edit.voice;
  }
  if (edit.musicTrack !== undefined) {
    if (edit.musicTrack !== null && edit.musicTrack !== "none" && !musicTrack(edit.musicTrack)) return null;
    out.musicTrack = edit.musicTrack;
  }
  if (edit.captions !== undefined) out.captions = Boolean(edit.captions);
  return out;
}

/** Saves an edit to an idea that is not made yet. */
export async function editVideoIdea(websiteId: string, id: string, edit: IdeaEdit): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const changes = cleanEdit(edit);
  if (!changes) return fail("bad_script");
  const [row] = await db
    .update(videoIdeas)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId), inArray(videoIdeas.status, ["new", "failed"])))
    .returning({ id: videoIdeas.id });
  if (!row) return fail("already_handled");
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/**
 * Approves an idea (a swipe to the right): charges its credit, once, and has
 * it made into its video. An edit sent along is saved first. A failed idea
 * can be approved again - its credit was given back when it failed.
 */
export async function approveVideoIdea(websiteId: string, id: string, edit: IdeaEdit = {}): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const changes = cleanEdit(edit);
  if (!changes) return fail("bad_script");
  const settings = await readVideoSettings(websiteId);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)))
      .for("update");
    if (!row) return fail("not_found");
    if (!["new", "failed"].includes(row.status)) return fail("already_handled");
    // A retry is a new charge: the failed attempt's credit was returned.
    const key = row.status === "failed" ? `${spendKey(id)}:${Date.now()}` : spendKey(id);
    const spent = await spendCredits(tx, { organizationId: checked.site.organizationId, action: "video_post", key, websiteId });
    if (!spent.ok) return { ok: false as const, error: "not_enough_credits" as const, price: spent.price, available: spent.available };
    const now = new Date();
    await tx
      .update(videoIdeas)
      .set({
        ...changes,
        status: "approved",
        approvedAt: now,
        creditSpendKey: spent.spendId ? key : null,
        platforms: settings.platforms,
        // A script changed after a failed attempt is voiced again.
        ...(changes.script || changes.voice !== undefined ? { voiceUrl: null, timing: null, durationMs: null } : {}),
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

// ------------------------------------------------------------- publishing

/**
 * Publishes a ready video now, at the next good time ("best"), or at the
 * time the customer chose, to the platforms chosen.
 */
export async function publishVideoIdea(
  websiteId: string,
  id: string,
  options: { platforms: string[]; when: "now" | "best" | string },
): Promise<VideoResult<{ at: string }>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, id);
  if (!row) return fail("not_found");
  if (!["ready", "scheduled", "failed"].includes(row.status) || (!row.videoUrl && !row.slideUrls?.length)) return fail("already_handled");

  const carousel = row.format === "carousel";
  const connected = await db
    .select({ platform: socialAccounts.platform, bundle: socialAccounts.bundleAccountId })
    .from(socialAccounts)
    .where(eq(socialAccounts.websiteId, websiteId));
  const platforms = [...new Set(options.platforms)]
    .filter(isVideoPlatform)
    .filter((platform) => (!carousel || VIDEO_PLATFORM_SPECS[platform].carousel) && connected.some((row) => row.platform === platform && row.bundle));
  if (platforms.length === 0 || !isBundleConfigured()) return fail("no_accounts");

  const now = new Date();
  let at: Date;
  if (options.when === "now") at = now;
  else if (options.when === "best") at = await nextPublishTime(websiteId, now);
  else {
    at = new Date(options.when);
    if (Number.isNaN(at.getTime()) || at.getTime() < now.getTime() - 60_000 || at.getTime() > now.getTime() + 60 * 24 * 3_600_000) return fail("bad_time");
  }
  await db
    .update(videoIdeas)
    .set({ status: "scheduled", platforms, scheduledFor: at, error: null, updatedAt: now })
    .where(and(eq(videoIdeas.id, id), inArray(videoIdeas.status, ["ready", "scheduled", "failed"])));
  await queueJob({ name: "video/publish.scheduled", data: { ideaId: id, at: at.toISOString() } });
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { at: at.toISOString() } };
}

/** Takes a scheduled video off the schedule; it stays ready. */
export async function unscheduleVideoIdea(websiteId: string, id: string): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  await db
    .update(videoIdeas)
    .set({ status: "ready", scheduledFor: null, updatedAt: new Date() })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.status, "scheduled")));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- settings

export async function saveVideoSettingsAction(websiteId: string, input: Partial<VideoSettings>): Promise<VideoResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const current = await readVideoSettings(websiteId);
  const next: VideoSettings = {
    style: input.style && isVideoStyle(input.style) ? input.style : current.style,
    voice: input.voice === undefined ? current.voice : input.voice && isVoice(input.voice) ? input.voice : null,
    music: input.music ?? current.music,
    captions: input.captions ?? current.captions,
    publishMode: input.publishMode === "auto" || input.publishMode === "manual" ? input.publishMode : current.publishMode,
    platforms: input.platforms ? [...new Set(input.platforms)].filter(isVideoPlatform) : current.platforms,
    logoUrl:
      input.logoUrl === undefined ? current.logoUrl : input.logoUrl && videoFilePath(input.logoUrl, websiteId) ? input.logoUrl : null,
  };
  await saveVideoSettings(websiteId, next);
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- accounts

/** The bundle.social page where the customer connects a video platform; they come back to /api/social/connected. */
export async function connectVideoPlatform(websiteId: string, platform: string, language = "en"): Promise<VideoResult<{ url: string }>> {
  if (!isVideoPlatform(platform)) return fail("not_found");
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!isBundleConfigured()) return fail("not_configured");
  try {
    const teamId = await ensureTeam(websiteId);
    const back = `${appUrl()}/api/social/connected?website=${encodeURIComponent(websiteId)}&platform=${platform}`;
    const url = await portalLink({
      teamId,
      type: VIDEO_PLATFORM_SPECS[platform].bundleType,
      redirectUrl: back,
      language,
      userName: checked.site.brandName ?? checked.site.domain,
    });
    return { ok: true, data: { url } };
  } catch (error) {
    console.error("[video] connect link failed", { websiteId, platform, error });
    return fail("connect_failed");
  }
}

export async function disconnectVideoPlatform(websiteId: string, platform: string): Promise<VideoResult> {
  if (!isVideoPlatform(platform)) return fail("not_found");
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
  if (account?.bundleAccountId && isBundleConfigured()) {
    const [team] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
    if (team) {
      await disconnectAccount(team.teamId, VIDEO_PLATFORM_SPECS[platform].bundleType).catch((error) =>
        console.error("[video] disconnect failed", error),
      );
    }
  }
  await removeAccount(websiteId, platform);
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Resumes a platform RepGet paused after a refusal. */
export async function resumeVideoPlatform(websiteId: string, platform: string): Promise<VideoResult> {
  if (!isVideoPlatform(platform)) return fail("not_found");
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  await db
    .update(socialAccounts)
    .set({ pausedAt: null, pausedReason: null, updatedAt: new Date() })
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
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

