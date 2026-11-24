import "server-only";

import { and, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";

import { videoIdeas } from "@/lib/db/schema";

/**
 * The customer's lists of video_ideas (lib/video/customer-view.ts), shared by
 * the Social Content page and the AI chat. Deleted videos (status "deleted")
 * are in none of them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A video whose files were made. */
export const hasFilesSql = sql`(${videoIdeas.videoUrl} is not null or (jsonb_typeof(${videoIdeas.slideUrls}) = 'array' and ${videoIdeas.slideUrls} <> '[]'::jsonb))`;

/** A make that failed (its credit was returned). */
export const returnedSql = sql`(${videoIdeas.status} = 'failed' and ${hasFilesSql} is not true)`;

/** Today's ideas: the day's not yet made or skipped, and the ones a failed make brought back in the last day. */
export function todaysIdeasWhere(websiteId: string, now: Date = new Date()): SQL {
  const today = now.toISOString().slice(0, 10);
  return and(
    eq(videoIdeas.websiteId, websiteId),
    or(
      and(eq(videoIdeas.day, today), eq(videoIdeas.status, "new")),
      and(returnedSql, or(eq(videoIdeas.day, today), gte(videoIdeas.updatedAt, new Date(now.getTime() - DAY_MS)))),
    ),
  )!;
}

/** Saved Videos: being made or made, and not scheduled or published - a publish that failed included (Ready to publish). */
export function savedVideosWhere(websiteId: string, now: Date = new Date()): SQL {
  return and(
    eq(videoIdeas.websiteId, websiteId),
    or(inArray(videoIdeas.status, ["approved", "making", "ready", "draft"]), and(eq(videoIdeas.status, "failed"), hasFilesSql)),
    gte(videoIdeas.updatedAt, new Date(now.getTime() - 30 * DAY_MS)),
  )!;
}
