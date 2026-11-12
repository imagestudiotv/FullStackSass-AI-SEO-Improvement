"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import { db } from "@/lib/db";
import { socialAccounts, socialTeams, videoIdeas } from "@/lib/db/schema";
import { ensureTeam, removeAccount } from "@/lib/social/accounts";
import { disconnectAccount, isBundleConfigured, portalLink, type InstagramAudio } from "@/lib/social/bundle";
import { siteUrl } from "@/lib/site-url";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";

import { compatibility, postedPlatforms, readDestinations, type DestinationProblem } from "./destinations";
import { DURATION_RANGES, isVideoFormat, isVideoPlatform, VIDEO_PLATFORM_SPECS, type DurationRange, type NativeAudioSelection, type VideoPlatform } from "./formats";
import { cleanNativeAudio, instagramAudioEligibility, searchNativeAudio, type NativeAudioUnavailable } from "./native-audio";
import { claimScheduleSlot, nextPublishTime, releaseScheduleSlot } from "./schedule";
import { videoAccess } from "./settings";
import { xVideoStatus, type XUnavailable } from "./x-spend";

/**
 * The Videos page's publishing and connection actions (moved here from
 * actions.ts, 2026-11-12, with the same guards: an editor of the website and
 * a plan or trial). Errors are codes the page shows in the reader's language.
 */

export type PublishError =
  | "view_only"
  | "no_plan"
  | "not_found"
  | "already_handled"
  | "no_accounts"
  /** Pinterest chosen, and no board for its Pins yet (chosen on Opportunities). */
  | "no_board"
  | "not_configured"
  | "connect_failed"
  | "bad_time"
  /** A chosen platform cannot take this video (a Story where there are none, too long, X not set up): see `problems`. */
  | "incompatible"
  /** LinkedIn is connected without a profile or page chosen: reconnect it and pick one. */
  | "linkedin_no_target"
  /** Native Instagram music: only on a Reel. */
  | "reel_only"
  /** Native Instagram music: the selection does not hold (id, volumes 0-100). */
  | "bad_audio"
  /** Native Instagram music: why it cannot be used (connect Instagram, reconnect it through Facebook Login). */
  | NativeAudioUnavailable
  | "search_failed";

export type PublishResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: PublishError; problems?: Partial<Record<VideoPlatform, DestinationProblem>> };

const fail = (error: PublishError): { ok: false; error: PublishError } => ({ ok: false, error });

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

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || siteUrl();
}

/** The video's length for the platforms' limits: the made video's, else the range chosen for it. */
function lengthOf(row: { durationMs: number | null; production: unknown }): number | DurationRange | null {
  if (row.durationMs) return row.durationMs / 1000;
  const range = (row.production as { duration?: unknown } | null)?.duration;
  return typeof range === "string" && (DURATION_RANGES as readonly string[]).includes(range) ? (range as DurationRange) : null;
}

const PUBLISHABLE = ["ready", "scheduled", "failed", "posted"];

// ------------------------------------------------------------- publishing

/**
 * Publishes a ready video now, at the next good time ("best"), or at the
 * time the customer chose, to the platforms chosen. Refused before anything
 * is scheduled: Pinterest without a board (no_board), LinkedIn without a
 * profile or page (linkedin_no_target), and a platform that cannot take the
 * video (incompatible, with each one's problem: a Story to a platform without
 * Stories, a video over its limit, X not set up). A carousel's platforms that
 * take no carousel are left out, as before. A video already on some
 * platforms (posted, or partly) is sent only to the others: never twice.
 *
 * The customer's Publish is their go-ahead for this publish only: it does
 * not approve a review (publishVideo gets `manual`).
 */
export async function publishVideoIdea(
  websiteId: string,
  id: string,
  options: { platforms: string[]; when: "now" | "best" | string },
): Promise<PublishResult<{ at: string }>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, id);
  if (!row) return fail("not_found");
  if (!PUBLISHABLE.includes(row.status) || (!row.videoUrl && !row.slideUrls?.length)) return fail("already_handled");

  const format = isVideoFormat(row.format) ? row.format : "reel";
  const carousel = format === "carousel";
  const destinations = readDestinations(row.destinations);
  const already = postedPlatforms(destinations);
  const connected = await db
    .select({ platform: socialAccounts.platform, bundle: socialAccounts.bundleAccountId, target: socialAccounts.target })
    .from(socialAccounts)
    .where(eq(socialAccounts.websiteId, websiteId));
  const platforms = [...new Set(options.platforms)]
    .filter(isVideoPlatform)
    .filter((platform) => !already.includes(platform))
    .filter((platform) => (!carousel || VIDEO_PLATFORM_SPECS[platform].carousel) && connected.some((item) => item.platform === platform && item.bundle));
  if (platforms.length === 0 || !isBundleConfigured()) return fail(row.status === "posted" && already.length > 0 ? "already_handled" : "no_accounts");
  const targetOf = (platform: VideoPlatform) => connected.find((item) => item.platform === platform)?.target?.trim() || null;
  if (platforms.some((platform) => VIDEO_PLATFORM_SPECS[platform].board && !targetOf(platform))) return fail("no_board");
  if (platforms.includes("linkedin") && !targetOf("linkedin")) return fail("linkedin_no_target");

  const x = platforms.includes("x") ? await xVideoStatus() : null;
  const { problems } = compatibility({ format, duration: lengthOf(row), platforms, xAvailable: Boolean(x?.available) });
  if (Object.keys(problems).length > 0) return { ok: false, error: "incompatible", problems };

  const now = new Date();
  let at: Date;
  if (options.when === "now") at = now;
  else if (options.when === "best") at = await nextPublishTime(websiteId, now, id);
  else {
    at = new Date(options.when);
    if (Number.isNaN(at.getTime()) || at.getTime() < now.getTime() - 60_000 || at.getTime() > now.getTime() + 60 * 24 * 3_600_000) return fail("bad_time");
  }
  if (options.when !== "best") await claimScheduleSlot(websiteId, id, at);
  for (const platform of platforms) {
    const state = destinations[platform];
    destinations[platform] = { status: "scheduled", bundlePostId: null, url: null, error: null, attempts: state?.attempts ?? 0 };
  }
  const [saved] = await db
    .update(videoIdeas)
    .set({ status: "scheduled", platforms, scheduledFor: at, error: null, destinations, updatedAt: now })
    .where(and(eq(videoIdeas.id, id), inArray(videoIdeas.status, PUBLISHABLE)))
    .returning({ id: videoIdeas.id });
  if (!saved) {
    await releaseScheduleSlot(id);
    return fail("already_handled");
  }
  await queueJob({ name: "video/publish.scheduled", data: { ideaId: id, at: at.toISOString(), manual: true } });
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { at: at.toISOString() } };
}

/** Takes a scheduled video off the schedule; it stays ready (or posted, where it already is) and its slot is given back. */
export async function unscheduleVideoIdea(websiteId: string, id: string): Promise<PublishResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, id);
  if (row?.status === "scheduled") {
    const destinations = readDestinations(row.destinations);
    for (const platform of Object.keys(destinations) as VideoPlatform[]) {
      if (destinations[platform]?.status === "scheduled") destinations[platform] = { ...destinations[platform]!, status: "pending" };
    }
    const already = postedPlatforms(destinations);
    await db
      .update(videoIdeas)
      .set({ status: already.length > 0 ? "posted" : "ready", scheduledFor: null, destinations, updatedAt: new Date() })
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.status, "scheduled")));
    await releaseScheduleSlot(id);
  }
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- accounts

/**
 * The bundle.social page where the customer connects a video platform; they
 * come back to /api/social/connected. LinkedIn: bundle.social's page asks for
 * the profile or the company page after LinkedIn's login. X is the same
 * account as the social posts (one social_accounts row). Instagram with
 * `facebookLogin` connects (or reconnects) it through Facebook Login, which
 * native Instagram music needs.
 */
export async function connectVideoPlatform(
  websiteId: string,
  platform: string,
  language = "en",
  options: { facebookLogin?: boolean } = {},
): Promise<PublishResult<{ url: string }>> {
  if (!isVideoPlatform(platform)) return fail("not_found");
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  if (!isBundleConfigured()) return fail("not_configured");
  try {
    const teamId = await ensureTeam(websiteId);
    // "from": Pinterest and X are on both pages, so the way back says which one it left.
    const back = `${appUrl()}/api/social/connected?website=${encodeURIComponent(websiteId)}&platform=${platform}&from=videos`;
    const url = await portalLink({
      teamId,
      type: VIDEO_PLATFORM_SPECS[platform].bundleType,
      redirectUrl: back,
      language,
      userName: checked.site.brandName ?? checked.site.domain,
      ...(platform === "instagram" && options.facebookLogin ? { instagramConnectionMethod: "FACEBOOK" as const } : {}),
    });
    return { ok: true, data: { url } };
  } catch (error) {
    console.error("[video] connect link failed", { websiteId, platform, error });
    return fail("connect_failed");
  }
}

/** Disconnects a platform (Pinterest and X: on both pages, as they are one account). */
export async function disconnectVideoPlatform(websiteId: string, platform: string): Promise<PublishResult> {
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
export async function resumeVideoPlatform(websiteId: string, platform: string): Promise<PublishResult> {
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

// ------------------------------------------------------ native Instagram music

/**
 * Instagram's permitted tracks for the website's account (Facebook Login
 * only). None is labelled trending: Instagram's audio API gives no such data.
 */
export async function searchInstagramAudio(websiteId: string, query: string): Promise<PublishResult<{ tracks: InstagramAudio[] }>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const result = await searchNativeAudio(websiteId, String(query ?? ""));
  return result.ok ? { ok: true, data: { tracks: result.tracks } } : fail(result.reason);
}

/**
 * Chooses (or, with null, removes) an Instagram track for a Reel. Instagram
 * then gets the version without RepGet's music, Instagram mixing in its own
 * track - a mix RepGet cannot preview; every other platform and the download
 * keep RepGet's licensed music. Not for Stories or carousels, and not once
 * the video is on Instagram.
 */
export async function setNativeAudio(websiteId: string, ideaId: string, selection: Partial<NativeAudioSelection> | null): Promise<PublishResult<{ nativeAudio: NativeAudioSelection | null }>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await ideaFor(websiteId, ideaId);
  if (!row) return fail("not_found");
  const destinations = readDestinations(row.destinations);
  if (["posting", "skipped"].includes(row.status) || destinations.instagram?.status === "posted" || destinations.instagram?.status === "posting") {
    return fail("already_handled");
  }
  let clean: NativeAudioSelection | null = null;
  if (selection !== null) {
    if ((isVideoFormat(row.format) ? row.format : "reel") !== "reel") return fail("reel_only");
    clean = cleanNativeAudio(selection);
    if (!clean) return fail("bad_audio");
    const eligibility = await instagramAudioEligibility(websiteId);
    if (!eligibility.available) return fail(eligibility.reason);
  }
  await db.update(videoIdeas).set({ nativeAudio: clean, updatedAt: new Date() }).where(eq(videoIdeas.id, ideaId));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { nativeAudio: clean } };
}

// ------------------------------------------------------------------ status

export type VideoPublishingStatus = {
  /** Whether videos can go to X now (no money figures: RepGet's own budget). */
  x: { available: boolean; reason: XUnavailable | null };
  /** Native Instagram music for Reels. */
  instagramAudio: { available: true } | { available: false; reason: NativeAudioUnavailable };
  /** LinkedIn's destination: the profile, a company page, or none chosen yet (null: not connected). */
  linkedin: { connected: boolean; target: string | null };
};

/** What the Videos page needs to show which destinations are open (readable by viewers too). */
export async function videoPublishingStatus(websiteId: string): Promise<PublishResult<VideoPublishingStatus>> {
  await requireWebsite(websiteId);
  const x = await xVideoStatus();
  const instagramAudio = await instagramAudioEligibility(websiteId);
  const [linkedin] = await db
    .select({ bundle: socialAccounts.bundleAccountId, target: socialAccounts.target })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "linkedin")));
  return {
    ok: true,
    data: {
      x: { available: x.available, reason: x.reason },
      instagramAudio,
      linkedin: { connected: Boolean(linkedin?.bundle), target: linkedin?.bundle ? (linkedin.target ?? null) : null },
    },
  };
}
