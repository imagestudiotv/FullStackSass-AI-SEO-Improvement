import "server-only";

import { and, eq, gte, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, socialAccounts, socialTeams, videoIdeas, websites } from "@/lib/db/schema";
import { inWarmup } from "@/lib/social/accounts";
import { BundleError, createMultiPost, getPost, isBundleConfigured, tiktokPostSettings, uploadFromUrl, type BundlePost } from "@/lib/social/bundle";

import { compatibility, emptyDestination, fitCaption, postedPlatforms, readDestinations, type DestinationCode } from "./destinations";
import {
  isVideoFormat,
  isVideoPlatform,
  MAX_POSTS_PER_DAY,
  VIDEO_PLATFORM_SPECS,
  type DestinationState,
  type NativeAudioSelection,
  type VideoFormat,
  type VideoPlatform,
  type VideoScript,
} from "./formats";
import { makeNoMusicVersion } from "./make";
import { isAudioRefusal, musicSoundInfo, nativeAudioApplies, readNativeAudio } from "./native-audio";
import { nextPublishTime, releaseScheduleSlot, reviewBlocksAutoPublish } from "./schedule";
import { chargeXSpend, releaseXSpend, reserveXSpend, trackXPost, xPostCostUsd, xSpendKey, xVideoStatus } from "./x-spend";

/**
 * Publishing a ready video through bundle.social to the website's connected
 * Instagram, TikTok, YouTube, Facebook, Pinterest, LinkedIn and X - each
 * platform in its own format: a Reel (or a real Story), a TikTok video, a
 * YouTube Short, a Facebook Reel (or Story), a video Pin on the board the
 * social Pins use, a LinkedIn video post on the chosen profile or page, an X
 * post; a carousel as a photo post where one is taken (VIDEO_PLATFORM_SPECS).
 *
 * One bundle.social post carries every platform but X. X goes as its own
 * post, after its cost is reserved against the monthly limit
 * (lib/video/x-spend.ts): a refusal or a used-up budget there never blocks or
 * repeats the others.
 *
 * Each destination's result is kept in video_ideas.destinations
 * (DestinationState): posted with its link, failed with the reason, or
 * skipped with a code (lib/video/destinations.ts). Publishing again only
 * sends to the destinations not posted yet.
 *
 * A Pin needs its board. Without one, Pinterest is left out (the others still
 * go) and the video says why - NO_BOARD in its error, which the page shows in
 * the reader's language with where to choose the board.
 *
 * The anti-ban rules (client, 2026-10-29) are the social ones: at most
 * MAX_POSTS_PER_DAY videos a platform a day (more wait for the next good
 * hour), and a platform that refuses a video pauses that account's automatic
 * posting until the customer resumes it - a refusal repeated daily is how
 * accounts get banned. (An Instagram refusal of a chosen native track does
 * not pause: the customer picks another track.)
 */

export type VideoPublishOutcome = "posting" | "posted" | "partly" | "skipped" | "failed" | "later";

const DAY_MS = 24 * 60 * 60 * 1000;

const short = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 300);

/** A video's error when Pinterest was chosen without a board (the code VideoError and the page share). */
export const NO_BOARD = "no_board";
/** A video scheduled automatically whose content needs a person's review first: back to ready. */
export const REVIEW_REQUIRED = "review_required";

type Account = typeof socialAccounts.$inferSelect;
type Idea = typeof videoIdeas.$inferSelect;
type Destinations = Partial<Record<VideoPlatform, DestinationState>>;

export type PublishTarget = {
  platform: VideoPlatform;
  board: string | null;
  /** The account is in its first days: no links yet (the same warm-up as the social posts). */
  warmup: boolean;
  account: Account;
};

const formatOf = (row: Pick<Idea, "format">): VideoFormat => (isVideoFormat(row.format) ? row.format : "reel");

/**
 * The platforms a video can go to now - chosen, connected through
 * bundle.social, not paused, taking the format and length (X: configured
 * with a spending limit) - and why each other one is left out.
 */
export async function publishTargets(
  websiteId: string,
  wanted: string[],
  video: { format: VideoFormat; durationSeconds: number | null },
  now: Date = new Date(),
): Promise<{ targets: PublishTarget[]; noBoard: VideoPlatform[]; skipped: Partial<Record<VideoPlatform, DestinationCode>> }> {
  const accounts = await db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId));
  const chosen = [...new Set(wanted)].filter(isVideoPlatform);
  // X with its limit used up is still a destination: its reservation says so (x_limit_reached), not "not configured".
  const x = chosen.includes("x") ? await xVideoStatus(now) : null;
  const xAvailable = Boolean(x && (x.available || x.reason === "limit_reached"));
  const { problems } = compatibility({ format: video.format, duration: video.durationSeconds, platforms: chosen, xAvailable });
  const targets: PublishTarget[] = [];
  const noBoard: VideoPlatform[] = [];
  const skipped: Partial<Record<VideoPlatform, DestinationCode>> = {};
  for (const platform of chosen) {
    const account = accounts.find((row) => row.platform === platform);
    const spec = VIDEO_PLATFORM_SPECS[platform];
    if (!account?.bundleAccountId) skipped[platform] = "not_connected";
    else if (account.pausedAt) skipped[platform] = "paused";
    else if (problems[platform]) skipped[platform] = problems[platform];
    else if (spec.board && !account.target?.trim()) {
      noBoard.push(platform);
      skipped[platform] = "no_board";
    } else if (platform === "linkedin" && !account.target) skipped[platform] = "linkedin_no_target";
    else targets.push({ platform, board: spec.board ? account.target!.trim() : null, warmup: inWarmup(account, now), account });
  }
  return { targets, noBoard, skipped };
}

/** Videos the website published (or is publishing) on a platform in the last day. */
async function postedToday(websiteId: string, platform: VideoPlatform, now: Date, exceptId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videoIdeas)
    .where(
      and(
        eq(videoIdeas.websiteId, websiteId),
        ne(videoIdeas.id, exceptId),
        or(eq(videoIdeas.status, "posting"), and(eq(videoIdeas.status, "posted"), gte(videoIdeas.postedAt, new Date(now.getTime() - DAY_MS)))),
        sql`${videoIdeas.platforms} ? ${platform}`,
      ),
    );
  return Number(n);
}

export type PlatformDataInput = {
  teamId: string;
  uploadIds: string[];
  caption: string;
  title: string;
  format: VideoFormat;
  language: string;
  board: string | null;
  /** Where a Pin leads (Pinterest only); null during the account's warm-up. */
  link: string | null;
  /** Instagram Reels only: the native track (the upload is then the version without RepGet's music). */
  nativeAudio: NativeAudioSelection | null;
};

/**
 * Each platform's settings for the post (bundle.social's `data`;
 * https://info.bundle.social/api-reference/platform-parameters.md).
 */
export async function platformData(platform: VideoPlatform, input: PlatformDataInput): Promise<Record<string, unknown>> {
  const { uploadIds, caption, format } = input;
  const carousel = format === "carousel";
  switch (platform) {
    case "pinterest":
      // A video Pin (never a carousel or Story: VIDEO_PLATFORM_SPECS). bundle.social takes the board by its name.
      return {
        boardName: input.board,
        text: input.title.slice(0, VIDEO_PLATFORM_SPECS.pinterest.titleMax ?? 100),
        description: caption.slice(0, VIDEO_PLATFORM_SPECS.pinterest.captionMax),
        uploadIds,
        ...(input.link ? { link: input.link } : {}),
      };
    case "instagram":
      // A Story is one file and no caption; native music only on a Reel.
      if (format === "story") return { type: "STORY", uploadIds: uploadIds.slice(0, 1) };
      if (carousel) return { type: "POST", text: caption, uploadIds };
      return {
        type: "REEL",
        text: caption,
        uploadIds,
        shareToFeed: true,
        ...(input.nativeAudio ? { musicSoundInfo: musicSoundInfo(input.nativeAudio) } : {}),
      };
    case "facebook":
      // "Stories have no text" (bundle.social's Facebook page).
      if (format === "story") return { type: "STORY", uploadIds: uploadIds.slice(0, 1) };
      return carousel ? { type: "POST", text: caption, uploadIds } : { type: "REEL", text: caption, uploadIds };
    case "youtube":
      return {
        type: "SHORT",
        text: input.title.slice(0, 100),
        description: caption.slice(0, 4900),
        uploadIds,
        privacy: "PUBLIC",
        madeForKids: false,
        defaultLanguage: input.language,
        defaultAudioLanguage: input.language,
      };
    case "tiktok": {
      // TikTok refuses a privacy level or an interaction the account does not allow.
      const settings = await tiktokPostSettings(input.teamId).catch(() => null);
      const options = settings?.privacyLevelOptions ?? [];
      const privacy = options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : (options[0] ?? "PUBLIC_TO_EVERYONE");
      return {
        type: carousel ? "IMAGE" : "VIDEO",
        text: caption.slice(0, 2200),
        uploadIds,
        privacy,
        disableComments: settings?.commentDisabled ?? false,
        disableDuet: settings?.duetDisabled ?? false,
        disableStitch: settings?.stitchDisabled ?? false,
        ...(carousel ? { photoCoverIndex: 0, autoAddMusic: true } : {}),
      };
    }
    case "linkedin":
      // One video (LinkedIn: 3 s to 30 min, 2 GB), text up to 3,000; no link with media; public.
      return {
        text: fitCaption(caption, VIDEO_PLATFORM_SPECS.linkedin.captionMax),
        uploadIds: uploadIds.slice(0, 1),
        mediaTitle: input.title.slice(0, 200),
        privacy: "PUBLIC",
      };
    case "x":
      // One video, 280 characters with the hashtags, and never a link: X bills a post with a URL about 13 times more.
      return { text: fitCaption(stripLinks(caption), VIDEO_PLATFORM_SPECS.x.captionMax), uploadIds: uploadIds.slice(0, 1) };
  }
}

/**
 * A caption without web addresses, bare domains included - X turns
 * "example.com" into a link, and a post with a URL is billed at the higher
 * rate (anything left is reserved at that rate: x-spend.ts mayCarryLink).
 */
export const stripLinks = (text: string) =>
  text
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|io|co|ai|app|dev|uk|de|fr|es|it|ro|eu|us|ca|au|in|info|biz|shop|store|online|site|me|tv|ly)\b(\/\S*)?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/**
 * Where a video Pin leads (client, 2026-11-03: "yes" to linking video Pins,
 * after the warm-up like the social Pins): the published article the idea
 * came from, else the website itself. A Pin without a link is a dead end on
 * Pinterest, where people tap through to the source.
 */
async function pinTarget(row: { websiteId: string; articleId: string | null }): Promise<string | null> {
  if (row.articleId) {
    const [article] = await db
      .select({ url: articles.publishedUrl })
      .from(articles)
      .where(and(eq(articles.id, row.articleId), eq(articles.websiteId, row.websiteId)));
    if (article?.url) return article.url;
  }
  const [site] = await db.select({ url: websites.url }).from(websites).where(eq(websites.id, row.websiteId));
  return site?.url ?? null;
}

async function pause(websiteId: string, platform: string, reason: string, now: Date) {
  await db
    .update(socialAccounts)
    .set({ pausedAt: now, pausedReason: short(reason), updatedAt: now })
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
}

/** A bundle.social error that trying again will not change (not a rate limit). */
const isPermanent = (error: unknown) => error instanceof BundleError && error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 429;

/**
 * The Instagram Reel without RepGet's music, for a native track: made by
 * makeNoMusicVersion (an audio-only remux, lib/video/make.ts) when it is missing.
 */
async function noMusicVersion(row: Idea): Promise<string | null> {
  if (row.altVideoUrl) return row.altVideoUrl;
  if (row.musicTrack === "none" && row.videoUrl) return row.videoUrl;
  try {
    const made = await makeNoMusicVersion(row.id);
    if (typeof made === "string" && made) return made;
    const [fresh] = await db.select({ url: videoIdeas.altVideoUrl }).from(videoIdeas).where(eq(videoIdeas.id, row.id));
    return fresh?.url ?? null;
  } catch (error) {
    console.error("[video] the version without music failed", { id: row.id, error });
    return null;
  }
}

async function organizationOf(websiteId: string): Promise<string | null> {
  const [site] = await db.select({ organizationId: websites.organizationId }).from(websites).where(eq(websites.id, websiteId));
  return site?.organizationId ?? null;
}

/** What is said on the video itself (video_ideas.error): the codes the page translates, then each refusal by platform. */
function summary(destinations: Destinations, extraNotes: string[] = []): string[] {
  const notes = new Set(extraNotes);
  if (destinations.pinterest?.status === "skipped" && destinations.pinterest.error === NO_BOARD) notes.add(NO_BOARD);
  if (destinations.x?.status === "skipped" && destinations.x.error === "x_limit_reached") notes.add("x_limit_reached");
  const failures = (Object.keys(destinations) as VideoPlatform[])
    .filter((platform) => destinations[platform]?.status === "failed")
    .map((platform) => `${VIDEO_PLATFORM_SPECS[platform].name}: ${destinations[platform]?.error ?? "not published"}`);
  return [...notes, ...failures];
}

/**
 * Hands a scheduled video to bundle.social. "posting" means it was accepted
 * and checkVideoPublished follows it; "later" that the day's posts are used
 * up and it moved to the next good hour (the job is queued again).
 *
 * `manual`: the customer pressed Publish (publish-actions.ts). Without it the
 * video was scheduled automatically, and a review that became required
 * meanwhile holds it (back to ready, REVIEW_REQUIRED). A customer's Publish
 * counts as their go-ahead for that publish only; it never marks the review
 * approved.
 */
export async function publishVideo(
  id: string,
  now: Date = new Date(),
  options: { manual?: boolean } = {},
): Promise<{ outcome: VideoPublishOutcome; at?: string }> {
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(videoIdeas).where(eq(videoIdeas.id, id)).for("update");
    if (!row || row.status !== "scheduled") return { outcome: "skipped" as const };
    if (!options.manual && reviewBlocksAutoPublish(row)) {
      await tx.update(videoIdeas).set({ status: "ready", scheduledFor: null, error: REVIEW_REQUIRED, updatedAt: now }).where(eq(videoIdeas.id, id));
      return { outcome: "released" as const };
    }
    const [team] = await tx.select().from(socialTeams).where(eq(socialTeams.websiteId, row.websiteId));
    if (!isBundleConfigured() || !team) {
      await tx.update(videoIdeas).set({ status: "ready", scheduledFor: null, error: "no_accounts", updatedAt: now }).where(eq(videoIdeas.id, id));
      return { outcome: "released" as const };
    }
    await tx.update(videoIdeas).set({ status: "posting", updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "claimed" as const, row, teamId: team.teamId };
  });
  if (claimed.outcome === "released") {
    await releaseScheduleSlot(id);
    return { outcome: "skipped" };
  }
  if (claimed.outcome !== "claimed") return { outcome: claimed.outcome };
  const { row, teamId } = claimed;
  const format = formatOf(row);
  const destinations = readDestinations(row.destinations);
  const already = postedPlatforms(destinations);
  // Never posted twice: only the destinations not on the platform yet.
  const wanted = (row.platforms ?? []).filter(isVideoPlatform).filter((platform) => !already.includes(platform));

  if (wanted.length === 0 && already.length > 0) {
    await db.update(videoIdeas).set({ status: "posted", scheduledFor: null, updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "skipped" };
  }

  const durationSeconds = row.durationMs ? row.durationMs / 1000 : null;
  const { targets, noBoard, skipped } = await publishTargets(row.websiteId, wanted, { format, durationSeconds }, now);
  for (const [platform, code] of Object.entries(skipped) as [VideoPlatform, DestinationCode][]) {
    destinations[platform] = { ...(destinations[platform] ?? emptyDestination()), status: "skipped", error: code };
  }
  const open: PublishTarget[] = [];
  const full: VideoPlatform[] = [];
  for (const target of targets) {
    if ((await postedToday(row.websiteId, target.platform, now, id)) < MAX_POSTS_PER_DAY) open.push(target);
    else full.push(target.platform);
  }

  if (targets.length === 0) {
    const error = noBoard.length > 0 ? NO_BOARD : "no_accounts";
    await db
      .update(videoIdeas)
      .set({ status: already.length > 0 ? "posted" : "ready", scheduledFor: null, error, destinations, updatedAt: now })
      .where(eq(videoIdeas.id, id));
    await releaseScheduleSlot(id);
    return { outcome: "skipped" };
  }
  if (open.length === 0) {
    const at = await nextPublishTime(row.websiteId, new Date(now.getTime() + DAY_MS / 2), id);
    await db.update(videoIdeas).set({ status: "scheduled", scheduledFor: at, destinations, updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "later", at: at.toISOString() };
  }
  // Some platforms had their videos today: the others go now, these are said to be left out.
  for (const platform of full) destinations[platform] = { ...(destinations[platform] ?? emptyDestination()), status: "skipped", error: "daily_limit" };

  const script = row.script as VideoScript;
  const title = row.title || script.hook;
  const files = format === "carousel" ? (row.slideUrls ?? []) : row.videoUrl ? [row.videoUrl] : [];
  const nativeAudio = readNativeAudio(row.nativeAudio);
  const posts = new Map<string, BundlePost>();
  const attempt = (platform: VideoPlatform) => (destinations[platform]?.attempts ?? 0) + 1;
  const mark = (platform: VideoPlatform, state: Partial<DestinationState>) => {
    destinations[platform] = { ...(destinations[platform] ?? emptyDestination()), ...state };
  };

  // Instagram with a native track: the Reel without RepGet's music, from an account on Facebook Login.
  let instagramFile: string | null = null;
  const instagram = open.find((target) => target.platform === "instagram");
  const useNative = Boolean(instagram && nativeAudio && nativeAudioApplies("instagram", format));
  if (instagram && useNative) {
    if (instagram.account.target !== "facebook_login") {
      mark("instagram", { status: "failed", error: "native_audio_login", attempts: attempt("instagram") });
    } else {
      instagramFile = await noMusicVersion(row);
      if (!instagramFile) mark("instagram", { status: "failed", error: "native_audio_file", attempts: attempt("instagram") });
    }
  }
  const sendable = open.filter((target) => !(target.platform === "instagram" && useNative && !instagramFile));
  const together = sendable.filter((target) => target.platform !== "x");
  const x = sendable.find((target) => target.platform === "x");

  let mainPostId: string | null = null;
  if (together.length > 0) {
    try {
      if (files.length === 0) throw new Error("The video file is missing");
      const uploadIds: string[] = [];
      for (const file of files) uploadIds.push(await uploadFromUrl(teamId, file));
      const instagramUploads = instagramFile ? [await uploadFromUrl(teamId, instagramFile)] : null;
      const pinLink = together.some((target) => target.platform === "pinterest" && !target.warmup) ? await pinTarget(row) : null;
      const data: Record<string, Record<string, unknown>> = {};
      for (const { platform, board, warmup } of together) {
        data[VIDEO_PLATFORM_SPECS[platform].bundleType] = await platformData(platform, {
          teamId,
          uploadIds: platform === "instagram" && instagramUploads ? instagramUploads : uploadIds,
          caption: row.caption,
          title,
          format,
          language: row.language,
          board,
          link: platform === "pinterest" && !warmup ? pinLink : null,
          nativeAudio: platform === "instagram" && instagramUploads ? nativeAudio : null,
        });
      }
      const round = Math.max(...together.map((target) => attempt(target.platform)));
      const post = await createMultiPost({ teamId, data, title: row.title, referenceKey: round > 1 ? `video:${id}:${round}` : `video:${id}`, now });
      posts.set(post.id, post);
      mainPostId = post.id;
      for (const { platform } of together) mark(platform, { status: "posting", bundlePostId: post.id, error: null, url: null, attempts: attempt(platform) });
    } catch (error) {
      const reason = short(error instanceof Error ? error.message : String(error));
      for (const { platform } of together) {
        if (isPermanent(error)) await pause(row.websiteId, platform, reason, now);
        mark(platform, { status: "failed", error: reason, attempts: attempt(platform) });
      }
    }
  }

  let xPostId: string | null = null;
  if (x) {
    const tries = attempt("x");
    const key = xSpendKey(id, tries);
    const xText = fitCaption(stripLinks(row.caption), VIDEO_PLATFORM_SPECS.x.captionMax);
    const reservation = await reserveXSpend({ key, websiteId: row.websiteId, ideaId: id, amountUsd: xPostCostUsd(xText), now });
    if (!reservation.ok) {
      mark("x", { status: "skipped", error: reservation.reason === "limit_reached" ? "x_limit_reached" : "x_not_configured" });
    } else {
      try {
        if (files.length === 0) throw new Error("The video file is missing");
        const uploadIds = [await uploadFromUrl(teamId, files[0])];
        const data = { TWITTER: await platformData("x", { teamId, uploadIds, caption: row.caption, title, format, language: row.language, board: null, link: null, nativeAudio: null }) };
        const post = await createMultiPost({ teamId, data, title: row.title, referenceKey: `video:${id}:x:${tries}`, now });
        posts.set(post.id, post);
        xPostId = post.id;
        mark("x", { status: "posting", bundlePostId: post.id, error: null, url: null, attempts: tries });
      } catch (error) {
        const reason = short(error instanceof Error ? error.message : String(error));
        await releaseXSpend(key, reason);
        const organizationId = await organizationOf(row.websiteId);
        if (organizationId) {
          await trackXPost({ organizationId, websiteId: row.websiteId, ideaId: id, key, amountUsd: 0, outcome: "failed", attempt: tries }).catch(() => undefined);
        }
        if (isPermanent(error)) await pause(row.websiteId, "x", reason, now);
        mark("x", { status: "failed", error: reason, attempts: tries });
      }
    }
  }

  const sent = (Object.keys(destinations) as VideoPlatform[]).filter((platform) => ["posting", "posted"].includes(destinations[platform]?.status ?? ""));
  const notes = summary(destinations);
  await db
    .update(videoIdeas)
    .set({
      bundlePostId: mainPostId ?? xPostId ?? row.bundlePostId,
      platforms: sent.length > 0 ? sent : (row.platforms ?? []),
      destinations,
      error: notes.length > 0 ? short(notes.join(" · ")) : null,
      updatedAt: now,
    })
    .where(eq(videoIdeas.id, id));
  return { outcome: await settle(id, now, posts) };
}

/** Follows a video bundle.social accepted. */
export async function checkVideoPublished(id: string, now: Date = new Date()): Promise<VideoPublishOutcome> {
  const [row] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!row || row.status !== "posting") return row?.status === "posted" ? "posted" : "skipped";
  return settle(id, now, new Map());
}

/**
 * Reads each destination still on its way from its bundle.social post (the
 * ones given, else fetched) and settles the video once none is left: posted
 * when any destination is, failed otherwise. A refusal pauses that account;
 * X's reservation is charged when it is posted and released when it is not.
 */
async function settle(id: string, now: Date, posts: Map<string, BundlePost>): Promise<VideoPublishOutcome> {
  const [row] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!row) return "skipped";
  const destinations = readDestinations(row.destinations);
  // A video handed over before per-destination results (2026-11-12): its platforms all ride on bundlePostId.
  if (Object.keys(destinations).length === 0 && row.bundlePostId) {
    for (const platform of (row.platforms ?? []).filter(isVideoPlatform)) {
      destinations[platform] = { ...emptyDestination("posting"), bundlePostId: row.bundlePostId, attempts: 1 };
    }
  }
  const nativeAudio = readNativeAudio(row.nativeAudio);
  const pending = (Object.keys(destinations) as VideoPlatform[]).filter((platform) => destinations[platform]?.status === "posting");
  for (const postId of new Set(pending.map((platform) => destinations[platform]?.bundlePostId).filter((value): value is string => Boolean(value)))) {
    const post = posts.get(postId) ?? (await getPost(postId));
    if (post.status !== "POSTED" && post.status !== "ERROR" && post.status !== "DELETED") continue;
    for (const platform of pending.filter((item) => destinations[item]?.bundlePostId === postId)) {
      const type = VIDEO_PLATFORM_SPECS[platform].bundleType;
      const external = post.externalData?.[type];
      const refusal = post.errors?.[type] ?? null;
      const state = destinations[platform]!;
      // On a POSTED post with the platform's id, its error is a warning (bundle.social: Instagram's dropped tags).
      const failed = post.status === "POSTED" ? !external?.id && Boolean(refusal) : Boolean(refusal) || !external?.id;
      if (failed) {
        const reason = refusal ?? post.error ?? "The platform did not publish this video";
        const audio = platform === "instagram" && nativeAudio && isAudioRefusal(reason);
        if (!audio) await pause(row.websiteId, platform, reason, now);
        destinations[platform] = { ...state, status: "failed", error: short(reason) };
      } else {
        destinations[platform] = { ...state, status: "posted", url: external?.permalink ?? null, error: null };
      }
      if (platform === "x") await settleXSpend(row, destinations[platform]!, failed);
    }
  }

  const all = Object.keys(destinations) as VideoPlatform[];
  if (all.some((platform) => destinations[platform]?.status === "posting")) {
    await db.update(videoIdeas).set({ destinations, updatedAt: now }).where(eq(videoIdeas.id, id));
    return "posting";
  }
  const posted = all.filter((platform) => destinations[platform]?.status === "posted");
  const urls: Record<string, string> = {};
  for (const platform of posted) urls[platform] = destinations[platform]?.url ?? "";
  const notes = summary(destinations);
  const any = posted.length > 0;
  await db
    .update(videoIdeas)
    .set({
      status: any ? "posted" : "failed",
      postedUrls: urls,
      postedAt: any ? (row.postedAt ?? now) : null,
      scheduledFor: any ? row.scheduledFor : null,
      destinations,
      error: notes.length > 0 ? short(notes.join(" · ")) : null,
      updatedAt: now,
    })
    .where(eq(videoIdeas.id, id));
  if (!any) await releaseScheduleSlot(id);
  return !any ? "failed" : notes.length > 0 ? "partly" : "posted";
}

/** X's reservation for this attempt: charged when posted, released when refused; the metered call recorded. */
async function settleXSpend(row: Idea, state: DestinationState, failed: boolean) {
  const key = xSpendKey(row.id, Math.max(1, state.attempts));
  const amount = failed ? await releaseXSpend(key, state.error) : await chargeXSpend(key);
  if (amount === null) return;
  const organizationId = await organizationOf(row.websiteId);
  if (!organizationId) return;
  await trackXPost({
    organizationId,
    websiteId: row.websiteId,
    ideaId: row.id,
    key,
    amountUsd: failed ? 0 : amount,
    outcome: failed ? "failed" : "accepted",
    attempt: state.attempts,
  }).catch((error) => console.error("[video] X usage not recorded", { id: row.id, error }));
}

/**
 * A job that died while publishing: back to the customer (ready, or posted
 * where some destinations already are), so they can try again; an X
 * reservation the attempt never used is released. Not when bundle.social has
 * any destination on its way - checkVideoPublished settles those.
 */
export async function abandonVideoPublishing(id: string, now: Date = new Date()): Promise<void> {
  const [row] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (row?.status !== "posting") return;
  const destinations = readDestinations(row.destinations);
  const handedOver = Object.values(destinations).some((state) => state?.status === "posting");
  // Before per-destination results: the video's one post.
  if (handedOver || (Object.keys(destinations).length === 0 && row.bundlePostId)) return;
  // A reservation made for the attempt that never got handed over (releasing is once per key, so this is safe to repeat).
  if (destinations.x?.status !== "posted") await releaseXSpend(xSpendKey(id, (destinations.x?.attempts ?? 0) + 1), "abandoned");
  const already = postedPlatforms(destinations);
  await db
    .update(videoIdeas)
    .set({ status: already.length > 0 ? "posted" : "ready", error: "Publishing did not finish", updatedAt: now })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.status, "posting")));
  if (already.length === 0) await releaseScheduleSlot(id);
}
