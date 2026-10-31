import "server-only";

import { and, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { member, user, videoIdeas, websites } from "@/lib/db/schema";
import { emailButton, emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { postStats, type PostStats } from "@/lib/social/bundle";

import { FILE_DAYS, isVideoPlatform, MILESTONE_VIEWS, VIDEO_PLATFORM_SPECS } from "./formats";
import { appUrl } from "./make";
import { deleteVideoFiles } from "./storage";

/**
 * After a video is out: its numbers, read daily from bundle.social, an email
 * when it passes MILESTONE_VIEWS views (client: "receive email updates, such
 * as when a Short hits 1,000 views"), and its files deleted FILE_DAYS after
 * posting.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a video's numbers are followed. */
const FOLLOW_DAYS = 30;

export const totalViews = (stats: Record<string, PostStats> | null | undefined) =>
  Object.values(stats ?? {}).reduce((sum, item) => sum + (item?.views ?? 0), 0);

async function ownerEmail(organizationId: string): Promise<string | null> {
  const rows = await db
    .select({ email: user.email, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organizationId));
  return rows.find((row) => row.role === "owner")?.email ?? rows[0]?.email ?? null;
}

async function sendMilestone(idea: typeof videoIdeas.$inferSelect, views: number): Promise<void> {
  const [site] = await db
    .select({ organizationId: websites.organizationId, domain: websites.domain })
    .from(websites)
    .where(eq(websites.id, idea.websiteId));
  if (!site) return;
  const to = await ownerEmail(site.organizationId);
  if (!to) return;
  const link = `${appUrl()}/websites/${idea.websiteId}/videos?tab=posted`;
  const count = views.toLocaleString("en-US");
  const subject = `Your video passed ${count} views`;
  const html = emailLayout({
    heading: `${count} views`,
    preheader: `"${idea.title}" on ${site.domain} is taking off.`,
    body: [
      emailText(`Your video <strong>${escapeHtml(idea.title)}</strong> for ${escapeHtml(site.domain)} has passed <strong>${count}</strong> views.`),
      emailButton(link, "See the results"),
    ].join(""),
  });
  const text = [`Your video "${idea.title}" for ${site.domain} has passed ${count} views.`, "", "See the results:", link].join("\n");
  await sendEmail({ to, subject, html, text });
}

/** Reads one video's numbers; sends the milestone email the first time it is passed. */
export async function refreshStats(id: string, now: Date = new Date()): Promise<{ views: number }> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea?.bundlePostId || idea.status !== "posted") return { views: 0 };
  const stats: Record<string, PostStats> = { ...(idea.stats ?? {}) };
  for (const platform of (idea.platforms ?? []).filter(isVideoPlatform)) {
    const latest = await postStats(idea.bundlePostId, VIDEO_PLATFORM_SPECS[platform].bundleType).catch(() => null);
    if (latest) stats[platform] = latest;
  }
  const views = totalViews(stats);
  const milestone = !idea.milestoneAt && views >= MILESTONE_VIEWS;
  await db
    .update(videoIdeas)
    .set({ stats, statsAt: now, ...(milestone ? { milestoneAt: now } : {}) })
    .where(eq(videoIdeas.id, id));
  if (milestone) await sendMilestone(idea, views).catch((error) => console.error("[video] milestone email failed", { id, error }));
  return { views };
}

/** The videos whose numbers are still followed. */
export async function videosToFollow(now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .select({ id: videoIdeas.id })
    .from(videoIdeas)
    .where(and(eq(videoIdeas.status, "posted"), isNotNull(videoIdeas.bundlePostId), gte(videoIdeas.postedAt, new Date(now.getTime() - FOLLOW_DAYS * DAY_MS))));
  return rows.map((row) => row.id);
}

/**
 * Deletes the files of videos posted FILE_DAYS ago, and of ideas approved
 * but never published within 30 days. The record stays, with its links and
 * numbers.
 */
export async function deleteOldFiles(now: Date = new Date()): Promise<number> {
  const rows = await db
    .select()
    .from(videoIdeas)
    .where(
      and(
        isNull(videoIdeas.filesDeletedAt),
        or(
          and(eq(videoIdeas.status, "posted"), lt(videoIdeas.postedAt, new Date(now.getTime() - FILE_DAYS * DAY_MS))),
          and(inArray(videoIdeas.status, ["ready", "failed"]), lt(videoIdeas.updatedAt, new Date(now.getTime() - 30 * DAY_MS))),
        ),
      ),
    )
    .limit(200);
  for (const row of rows) {
    await deleteVideoFiles(row.websiteId, [row.videoUrl, row.voiceUrl, ...(row.slideUrls ?? [])]);
    await db.update(videoIdeas).set({ filesDeletedAt: now }).where(eq(videoIdeas.id, row.id));
  }
  return rows.length;
}
