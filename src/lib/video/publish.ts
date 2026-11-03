import "server-only";

import { and, eq, gte, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { socialAccounts, socialTeams, videoIdeas } from "@/lib/db/schema";
import { BundleError, createMultiPost, getPost, isBundleConfigured, tiktokPostSettings, uploadFromUrl, type BundlePost } from "@/lib/social/bundle";

import { isVideoPlatform, MAX_POSTS_PER_DAY, VIDEO_PLATFORM_SPECS, type VideoPlatform, type VideoScript } from "./formats";
import { nextPublishTime } from "./make";

/**
 * Publishing a ready video through bundle.social to the website's connected
 * Instagram, TikTok, YouTube, Facebook and Pinterest - one post, each
 * platform in its own format: a Reel, a TikTok video, a YouTube Short, a
 * Facebook Reel, a video Pin on the board the social Pins use; a carousel as
 * a photo post (not on YouTube or Pinterest: VIDEO_PLATFORM_SPECS).
 *
 * A Pin needs its board. Without one, Pinterest is left out (the others still
 * go) and the video says why - NO_BOARD in its error, which the page shows in
 * the reader's language with where to choose the board.
 *
 * The anti-ban rules (client, 2026-10-29) are the social ones: at most
 * MAX_POSTS_PER_DAY videos a platform a day (more wait for the next good
 * hour), and a platform that refuses a video pauses that account's automatic
 * posting until the customer resumes it - a refusal repeated daily is how
 * accounts get banned.
 */

export type VideoPublishOutcome = "posting" | "posted" | "partly" | "skipped" | "failed" | "later";

const DAY_MS = 24 * 60 * 60 * 1000;

const short = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 300);

/** A video's error when Pinterest was chosen without a board (the code VideoError and the page share). */
export const NO_BOARD = "no_board";

export type PublishTarget = { platform: VideoPlatform; board: string | null };

/**
 * The platforms a video can go to now - chosen, connected through
 * bundle.social, not paused, taking the format - and, apart, the chosen ones
 * that need a board and have none.
 */
export async function publishTargets(
  websiteId: string,
  wanted: string[],
  carousel: boolean,
): Promise<{ targets: PublishTarget[]; noBoard: VideoPlatform[] }> {
  const accounts = await db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId));
  const targets: PublishTarget[] = [];
  const noBoard: VideoPlatform[] = [];
  for (const platform of [...new Set(wanted)].filter(isVideoPlatform)) {
    const account = accounts.find((row) => row.platform === platform);
    const spec = VIDEO_PLATFORM_SPECS[platform];
    if (!account?.bundleAccountId || account.pausedAt || (carousel && !spec.carousel)) continue;
    const board = account.target?.trim() || null;
    if (spec.board && !board) noBoard.push(platform);
    else targets.push({ platform, board });
  }
  return { targets, noBoard };
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

/** Each platform's settings for the post (bundle.social's data). */
async function platformData(
  platform: VideoPlatform,
  input: { teamId: string; uploadIds: string[]; caption: string; title: string; carousel: boolean; language: string; board: string | null },
): Promise<Record<string, unknown>> {
  const { uploadIds, caption, carousel } = input;
  switch (platform) {
    case "pinterest":
      // A video Pin (never a carousel: VIDEO_PLATFORM_SPECS). bundle.social takes the board by its name.
      return {
        boardName: input.board,
        text: input.title.slice(0, VIDEO_PLATFORM_SPECS.pinterest.titleMax ?? 100),
        description: caption.slice(0, VIDEO_PLATFORM_SPECS.pinterest.captionMax),
        uploadIds,
      };
    case "instagram":
      return carousel ? { type: "POST", text: caption, uploadIds } : { type: "REEL", text: caption, uploadIds, shareToFeed: true };
    case "facebook":
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
  }
}

async function pause(websiteId: string, platform: string, reason: string, now: Date) {
  await db
    .update(socialAccounts)
    .set({ pausedAt: now, pausedReason: short(reason), updatedAt: now })
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
}

/**
 * Hands a scheduled video to bundle.social. "posting" means it was accepted
 * and checkVideoPublished follows it; "later" that the day's posts are used
 * up and it moved to the next good hour (the job is queued again).
 */
export async function publishVideo(id: string, now: Date = new Date()): Promise<{ outcome: VideoPublishOutcome; at?: string }> {
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(videoIdeas).where(eq(videoIdeas.id, id)).for("update");
    if (!row || row.status !== "scheduled") return { outcome: "skipped" as const };
    const [team] = await tx.select().from(socialTeams).where(eq(socialTeams.websiteId, row.websiteId));
    if (!isBundleConfigured() || !team) {
      await tx.update(videoIdeas).set({ status: "ready", scheduledFor: null, error: "no_accounts", updatedAt: now }).where(eq(videoIdeas.id, id));
      return { outcome: "skipped" as const };
    }
    await tx.update(videoIdeas).set({ status: "posting", updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "claimed" as const, row, teamId: team.teamId };
  });
  if (claimed.outcome !== "claimed") return { outcome: claimed.outcome };
  const { row, teamId } = claimed;
  const carousel = row.format === "carousel";

  const { targets, noBoard } = await publishTargets(row.websiteId, row.platforms ?? [], carousel);
  const open: PublishTarget[] = [];
  for (const target of targets) if ((await postedToday(row.websiteId, target.platform, now, id)) < MAX_POSTS_PER_DAY) open.push(target);
  // Left out for want of a board: said on the video, never dropped in silence.
  const notes = noBoard.length > 0 ? [NO_BOARD] : [];
  if (targets.length === 0) {
    const error = notes[0] ?? "no_accounts";
    await db.update(videoIdeas).set({ status: "ready", scheduledFor: null, error, updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "skipped" };
  }
  if (open.length === 0) {
    const at = await nextPublishTime(row.websiteId, new Date(now.getTime() + DAY_MS / 2));
    await db.update(videoIdeas).set({ status: "scheduled", scheduledFor: at, updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "later", at: at.toISOString() };
  }

  try {
    const files = carousel ? (row.slideUrls ?? []) : row.videoUrl ? [row.videoUrl] : [];
    if (files.length === 0) throw new Error("The video file is missing");
    const uploadIds: string[] = [];
    for (const file of files) uploadIds.push(await uploadFromUrl(teamId, file));
    const script = row.script as VideoScript;
    const data: Record<string, Record<string, unknown>> = {};
    for (const { platform, board } of open) {
      data[VIDEO_PLATFORM_SPECS[platform].bundleType] = await platformData(platform, {
        teamId,
        uploadIds,
        caption: row.caption,
        title: row.title || script.hook,
        carousel,
        language: row.language,
        board,
      });
    }
    const platforms = open.map((target) => target.platform);
    const post = await createMultiPost({ teamId, data, title: row.title, referenceKey: `video:${id}`, now });
    // The note waits on the row for checkVideoPublished, which settles it later.
    await db
      .update(videoIdeas)
      .set({ bundlePostId: post.id, platforms, error: notes[0] ?? null, updatedAt: now })
      .where(eq(videoIdeas.id, id));
    return { outcome: await settle(id, row.websiteId, platforms, post, now, notes) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // A refusal that trying again will not change (not a rate limit): stop posting there.
    if (error instanceof BundleError && error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      for (const { platform } of open) await pause(row.websiteId, platform, reason, now);
    }
    await db.update(videoIdeas).set({ status: "failed", error: short(reason), updatedAt: now }).where(eq(videoIdeas.id, id));
    return { outcome: "failed" };
  }
}

/** Follows a video bundle.social accepted. */
export async function checkVideoPublished(id: string, now: Date = new Date()): Promise<VideoPublishOutcome> {
  const [row] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!row || row.status !== "posting" || !row.bundlePostId) return row?.status === "posted" ? "posted" : "skipped";
  const notes = row.error === NO_BOARD ? [NO_BOARD] : [];
  return settle(id, row.websiteId, (row.platforms ?? []).filter(isVideoPlatform), await getPost(row.bundlePostId), now, notes);
}

async function settle(
  id: string,
  websiteId: string,
  platforms: VideoPlatform[],
  post: BundlePost,
  now: Date,
  notes: string[] = [],
): Promise<VideoPublishOutcome> {
  if (post.status !== "POSTED" && post.status !== "ERROR" && post.status !== "DELETED") return "posting";
  const urls: Record<string, string> = {};
  const failed: string[] = [];
  for (const platform of platforms) {
    const type = VIDEO_PLATFORM_SPECS[platform].bundleType;
    const permalink = post.externalData?.[type]?.permalink;
    const refusal = post.errors?.[type];
    if (refusal || (post.status !== "POSTED" && !post.externalData?.[type]?.id)) {
      failed.push(`${VIDEO_PLATFORM_SPECS[platform].name}: ${refusal ?? post.error ?? "not published"}`);
      await pause(websiteId, platform, refusal ?? post.error ?? "The platform did not publish this video", now);
    } else if (permalink) {
      urls[platform] = permalink;
    } else {
      urls[platform] = "";
    }
  }
  const any = Object.keys(urls).length > 0;
  // Kept apart from the refusals' text, so the page can still read the code.
  failed.unshift(...notes);
  await db
    .update(videoIdeas)
    .set({
      status: any ? "posted" : "failed",
      postedUrls: urls,
      postedAt: any ? now : null,
      error: failed.length > 0 ? short(failed.join(" · ")) : null,
      updatedAt: now,
    })
    .where(eq(videoIdeas.id, id));
  return !any ? "failed" : failed.length > 0 ? "partly" : "posted";
}

/** A job that died while publishing: back to ready, so the customer can try again. */
export async function abandonVideoPublishing(id: string, now: Date = new Date()): Promise<void> {
  const [row] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (row?.status === "posting" && !row.bundlePostId) {
    await db.update(videoIdeas).set({ status: "ready", error: "Publishing did not finish", updatedAt: now }).where(eq(videoIdeas.id, id));
  }
}
