import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { heldFromCustomerSql } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, socialAccounts, socialSuggestions, videoIdeas, websites } from "@/lib/db/schema";
import { getLaunchState, type LaunchStepId } from "@/lib/onboarding/launch";
import { socialAccess } from "@/lib/social/accounts";
import { VIDEO_PLATFORMS } from "@/lib/video/formats";
import { videoAccess } from "@/lib/video/settings";

/**
 * The Tasks page (Home > Tasks): what the customer has to do, as a list.
 *
 * The client, 2026-11-03: "I see the task still showing all the dashboard.
 * Here should be as per reference the tasks to complete, like view the audit,
 * connect the account, the website, etc." Tasks pointed at /dashboard, the
 * SEO overview, so the menu item named a list and opened a report.
 *
 * Three kinds of task, each DERIVED FROM REAL STATE like the launch checklist
 * (lib/onboarding/launch.ts) - never a stored "done" flag that drifts:
 *  - today's work: things that arrive every day and wait for the customer
 *    (failed articles, drafts on manual publishing, social suggestions, the
 *    day's video ideas). Done when nothing is waiting;
 *  - set up: the launch checklist, the same rows and rules as /setup;
 *  - accounts: the social and video channels, connected or not.
 * "Needs attention" (publishing problems, audit errors, losing pages) is the
 * existing next-actions list, rendered by the page beside these.
 *
 * Owners only see set-up and accounts: an invited editor cannot connect the
 * owner's site or accounts, and listing chores they cannot do helps nobody.
 */

export type WorkTaskId = "failed" | "drafts" | "social" | "videos";

export type WorkTask = {
  id: WorkTaskId;
  /** How many are waiting. 0 means done for today. */
  count: number;
  href: string;
};

export type SetupTask = {
  id: Exclude<LaunchStepId, "launched">;
  done: boolean;
  optional: boolean;
  href: string;
};

export type AccountTask = {
  id: "social" | "video";
  connected: number;
  /** Channels this plan may use: a trial gets Quora only for social. */
  available: number;
  href: string;
};

export type Tasks = {
  work: WorkTask[];
  /** Empty for a guest (editor or viewer). */
  setup: SetupTask[];
  /** Empty for a guest, and for a website without a plan. */
  accounts: AccountTask[];
  /** Over set-up and accounts: the one-off tasks, for the progress ring. */
  done: number;
  total: number;
};

/** A day's suggestions stay on the Opportunities page for a week, as the chat reads them. */
const SOCIAL_WINDOW_MS = 7 * 86_400_000;

export async function getTasks(
  websiteId: string,
  ownerOrgId: string,
  canManage: boolean,
  now: Date = new Date(),
): Promise<Tasks | null> {
  const base = `/websites/${websiteId}`;
  /* The tenant check: the website must belong to the workspace the guard returned. */
  const [site] = await db
    .select({ autoPublish: websites.autoPublish })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, ownerOrgId)))
    .limit(1);
  if (!site) return null;

  const today = now.toISOString().slice(0, 10);
  const counted = { n: sql<number>`count(*)::int` };
  const [[failed], [drafts], [social], [ideas]] = await Promise.all([
    db.select(counted).from(articles).where(and(eq(articles.websiteId, websiteId), eq(articles.status, "failed"))),
    /* With auto-publish on, drafts release themselves: nothing for the customer to do. */
    site.autoPublish
      ? Promise.resolve([{ n: 0 }])
      : db.select(counted).from(articles).where(and(
          eq(articles.websiteId, websiteId),
          eq(articles.status, "draft"),
          // Under the two-step flow, an article the team is working on is not a task of the customer's.
          sql`not ${heldFromCustomerSql}`,
        )),
    db
      .select(counted)
      .from(socialSuggestions)
      .where(
        and(
          eq(socialSuggestions.websiteId, websiteId),
          // A saved draft still waits for the customer's click.
          inArray(socialSuggestions.status, ["new", "draft"]),
          gte(socialSuggestions.createdAt, new Date(now.getTime() - SOCIAL_WINDOW_MS)),
        ),
      ),
    db
      .select(counted)
      .from(videoIdeas)
      .where(and(eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.day, today), eq(videoIdeas.status, "new"))),
  ]);

  const work: WorkTask[] = [
    { id: "failed", count: Number(failed?.n ?? 0), href: `${base}/content` },
    { id: "drafts", count: Number(drafts?.n ?? 0), href: `${base}/content` },
    { id: "social", count: Number(social?.n ?? 0), href: `${base}/social` },
    { id: "videos", count: Number(ideas?.n ?? 0), href: `${base}/videos` },
  ];

  if (!canManage) return { work, setup: [], accounts: [], done: 0, total: 0 };

  const [launch, socialLevel, videoLevel, accounts] = await Promise.all([
    getLaunchState(websiteId),
    socialAccess(websiteId),
    videoAccess(websiteId),
    db
      .select({ platform: socialAccounts.platform, bundleAccountId: socialAccounts.bundleAccountId })
      .from(socialAccounts)
      .where(eq(socialAccounts.websiteId, websiteId)),
  ]);

  const setup: SetupTask[] = launch.steps.flatMap((step) =>
    step.id === "launched" ? [] : [{ id: step.id, done: step.done, optional: step.optional, href: step.href }],
  );

  /*
    Social: any account row counts - Quora is a username and nothing more, so
    it never has a bundle.social id. Video: only a bundle.social connection
    can post a video, so a bare username does not count.
  */
  const socialConnected = new Set(
    accounts.filter((a) => socialLevel.platforms.some((p) => p === a.platform)).map((a) => a.platform),
  ).size;
  const videoConnected = new Set(
    accounts
      .filter((a) => a.bundleAccountId && (VIDEO_PLATFORMS as readonly string[]).includes(a.platform))
      .map((a) => a.platform),
  ).size;
  const accountTasks: AccountTask[] = [];
  if (socialLevel.platforms.length > 0)
    accountTasks.push({ id: "social", connected: socialConnected, available: socialLevel.platforms.length, href: `${base}/social` });
  if (videoLevel !== "none")
    accountTasks.push({ id: "video", connected: videoConnected, available: VIDEO_PLATFORMS.length, href: `${base}/videos` });

  /* An account task is done with one channel: nobody is asked to be on every network. */
  const oneOff = [...setup.map((s) => s.done), ...accountTasks.map((a) => a.connected > 0)];
  return { work, setup, accounts: accountTasks, done: oneOff.filter(Boolean).length, total: oneOff.length };
}
