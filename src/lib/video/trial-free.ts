import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { subscriptions, videoIdeas } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * The free trial's first payoff: THREE FREE VIDEOS (owner, 2026-11-27).
 *
 * A trial earns no monthly credits (lib/backlinks/credits.ts GRANTING_STATUSES),
 * so "Approve · 1 credit" on a video idea could not be pressed at a zero
 * balance - the trial's best feature locked behind the plan it was meant to
 * sell. A website in its free trial now makes up to TRIAL_FREE_VIDEOS videos
 * without credits; after them, the normal price. Paid plans are untouched.
 *
 * COUNTED FROM THE IDEAS THEMSELVES, no new table or column: an idea this
 * website approved since the trial started, with no credit charged
 * (creditSpendKey null), that is still a video - approved, being made, made,
 * scheduled, posted, or deleted after it was made. Everything that gives a
 * credit back gives the free video back too, by the same rows: an Undo or a
 * delete before the make clears approvedAt, a make that fails is "failed".
 *
 * The check runs on the server, in approveVideoIdea's transaction, under a
 * per-website lock (lockTrialFreeVideos), so two quick approvals cannot both
 * take the last free one. The button only says what the server will do.
 */
export const TRIAL_FREE_VIDEOS = 3;

/** Statuses that are not (or no longer) a made-or-making video: they do not use a free one. */
const NOT_A_VIDEO = ["new", "failed", "skipped"];

export type TrialFreeVideos = { used: number; left: number; total: number };

/**
 * The website's free trial videos, or null when the website is not in its
 * free trial (a paid plan, Free, no plan): then videos cost what they cost.
 */
export async function trialFreeVideos(websiteId: string, executor: Executor = db): Promise<TrialFreeVideos | null> {
  const [trial] = await executor
    .select({ start: subscriptions.currentPeriodStart, createdAt: subscriptions.createdAt })
    .from(subscriptions)
    .where(and(eq(subscriptions.websiteId, websiteId), eq(subscriptions.status, "trialing")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  if (!trial) return null;
  const since = trial.start ?? trial.createdAt;

  const [row] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(videoIdeas)
    .where(
      and(
        eq(videoIdeas.websiteId, websiteId),
        isNotNull(videoIdeas.approvedAt),
        gte(videoIdeas.approvedAt, since),
        isNull(videoIdeas.creditSpendKey),
        notInArray(videoIdeas.status, NOT_A_VIDEO),
      ),
    );
  const used = Number(row?.n ?? 0);
  return { used, left: Math.max(0, TRIAL_FREE_VIDEOS - used), total: TRIAL_FREE_VIDEOS };
}

/** Serialises the free-video decision per website, for the transaction's length. */
export async function lockTrialFreeVideos(websiteId: string, executor: Executor): Promise<void> {
  await executor.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`trial-free-videos:${websiteId}`}, 0))`);
}
