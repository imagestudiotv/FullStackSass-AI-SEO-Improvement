import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, like, or, type SQL } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { organization, socialAccounts, socialSuggestions, videoIdeas, websites } from "@/lib/db/schema";

/**
 * Admin -> Social posting (ticket 2026-11-24): automatic posting the provider
 * paused or refused. Customers are no longer shown these ("I suggest to remove
 * all this failed part for clients view"), so the team is. Read only.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const FAILED_POSTS_DAYS = 30;

/**
 * What could not go out automatically, whatever its customer is shown: a
 * failed item, or one put back to be posted by hand that still carries the
 * provider's error. A video names each refusal by platform ("TikTok: ...");
 * its other errors are codes about its own settings, not failures.
 */
export const failedPostSql: SQL = or(
  eq(socialSuggestions.status, "failed"),
  and(inArray(socialSuggestions.status, ["new", "draft"]), isNotNull(socialSuggestions.error)),
)!;
export const failedVideoSql: SQL = or(eq(videoIdeas.status, "failed"), and(inArray(videoIdeas.status, ["new", "ready"]), like(videoIdeas.error, "%: %")))!;

export type PausedAccount = {
  id: string;
  websiteId: string;
  domain: string;
  organizationName: string;
  platform: string;
  username: string;
  pausedAt: Date;
  reason: string | null;
};

export type FailedPost = {
  id: string;
  kind: "post" | "video";
  domain: string;
  /** The platform of a post; a video goes to several. */
  platform: string | null;
  title: string;
  error: string | null;
  at: Date;
};

export async function getSocialPosting(now: Date = new Date()): Promise<{ paused: PausedAccount[]; failed: FailedPost[] }> {
  await requireAdmin();
  const since = new Date(now.getTime() - FAILED_POSTS_DAYS * DAY_MS);
  const [paused, posts, videos] = await Promise.all([
    db
      .select({
        id: socialAccounts.id,
        websiteId: socialAccounts.websiteId,
        domain: websites.domain,
        organizationName: organization.name,
        platform: socialAccounts.platform,
        username: socialAccounts.username,
        pausedAt: socialAccounts.pausedAt,
        reason: socialAccounts.pausedReason,
      })
      .from(socialAccounts)
      .innerJoin(websites, eq(websites.id, socialAccounts.websiteId))
      .innerJoin(organization, eq(organization.id, websites.organizationId))
      .where(isNotNull(socialAccounts.pausedAt))
      .orderBy(desc(socialAccounts.pausedAt))
      .limit(200),
    db
      .select({
        id: socialSuggestions.id,
        domain: websites.domain,
        platform: socialSuggestions.platform,
        title: socialSuggestions.title,
        body: socialSuggestions.body,
        error: socialSuggestions.error,
        at: socialSuggestions.updatedAt,
      })
      .from(socialSuggestions)
      .innerJoin(websites, eq(websites.id, socialSuggestions.websiteId))
      .where(and(failedPostSql, gte(socialSuggestions.updatedAt, since)))
      .orderBy(desc(socialSuggestions.updatedAt))
      .limit(100),
    db
      .select({ id: videoIdeas.id, domain: websites.domain, title: videoIdeas.title, error: videoIdeas.error, at: videoIdeas.updatedAt })
      .from(videoIdeas)
      .innerJoin(websites, eq(websites.id, videoIdeas.websiteId))
      .where(and(failedVideoSql, gte(videoIdeas.updatedAt, since)))
      .orderBy(desc(videoIdeas.updatedAt))
      .limit(100),
  ]);
  const failed: FailedPost[] = [
    ...posts.map((row) => ({ id: row.id, kind: "post" as const, domain: row.domain, platform: row.platform, title: row.title || row.body.slice(0, 120), error: row.error, at: row.at })),
    ...videos.map((row) => ({ id: row.id, kind: "video" as const, domain: row.domain, platform: null, title: row.title, error: row.error, at: row.at })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return { paused: paused.flatMap((row) => (row.pausedAt ? [{ ...row, pausedAt: row.pausedAt }] : [])), failed };
}
