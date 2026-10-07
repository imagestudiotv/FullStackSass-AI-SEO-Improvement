import { and, eq, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, calendarItems, clusters } from "@/lib/db/schema";
import type { PlannedArticle } from "@/lib/keywords/calendar";
import { checkLimit, UNLIMITED } from "@/lib/usage";

/**
 * What a re-plan may replace, and how much it may add.
 *
 * Research re-plans the calendar every time it runs - on Refresh, and when the
 * customer adds keywords. It used to plan the FULL monthly allowance from
 * today whatever was already written, so a Grow site (30 a month) with 12
 * articles out by the 13th ended up with 42 on its calendar. The client's
 * rule: keep what is written, and plan only what is left of the month.
 *
 * Two halves, both here so the job and its tests share them:
 *  - articlesToPlan: the month's allowance minus what it has used, counted by
 *    the same checkLimit the scheduler enforces;
 *  - replaceUnstartedPlan: clears only the items no article has started.
 */

type Executor = Pick<typeof db, "select" | "execute">;

/** Planned per run on a plan without an article limit: what research always used. */
const UNLIMITED_PLAN_SIZE = 12;

/**
 * An item no article has started: still "planned", and nothing written for it.
 *
 * The status alone is not enough. An item stays "planned" while its article is
 * queued or being written - generate-article marks it "generated" only at the
 * end - so a re-plan at that moment deleted the item under a running article,
 * which then fell off the calendar. Anything with an article attached is kept,
 * whatever state the article is in: its slot of the allowance is spent.
 */
const unstarted = sql`(${calendarItems.status} = 'planned' and not exists (
  select 1 from ${articles} where ${articles.calendarItemId} = ${calendarItems.id}
))`;

/**
 * How many new articles a re-plan may put on the calendar, and at what rate.
 *
 * `count` is the allowance left in this monthly window. `used` comes from the
 * allowance ledger, so an article deleted this month still counts - exactly
 * as it does when the scheduler decides whether to write another.
 *
 * `perDay` is the PLAN's rate, not the remainder's: see scheduleDates.
 */
export async function articlesToPlan(
  websiteId: string,
  executor: Executor = db,
): Promise<{
  count: number;
  perDay: number;
  /** The month's allowance is all used: nothing new can be planned until it renews. */
  usedUp: boolean;
  limit: number | "unlimited";
  used: number;
}> {
  const allowance = await checkLimit(websiteId, "articles", executor);
  if (allowance.limit === UNLIMITED) {
    return {
      count: UNLIMITED_PLAN_SIZE,
      perDay: 1,
      usedUp: false,
      limit: "unlimited",
      used: allowance.used,
    };
  }

  const count = Math.max(allowance.limit - allowance.used, 0);
  return {
    count,
    perDay: Math.max(1, Math.ceil(allowance.limit / 30)),
    // A site with no plan has a limit of 0; that is not "used up".
    usedUp: allowance.limit > 0 && count === 0,
    limit: allowance.limit,
    used: allowance.used,
  };
}

/**
 * Dates of the items a re-plan keeps, from today on: the days new topics
 * should not be doubled up on. Earlier ones cannot clash, so are not read.
 */
export async function keptDates(
  websiteId: string,
  from: Date = new Date(),
  executor: Executor = db,
): Promise<Date[]> {
  const startOfDay = new Date(from);
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await executor
    .select({ scheduledFor: calendarItems.scheduledFor })
    .from(calendarItems)
    .where(
      and(
        eq(calendarItems.websiteId, websiteId),
        isNotNull(calendarItems.scheduledFor),
        gte(calendarItems.scheduledFor, startOfDay),
        sql`not ${unstarted}`,
      ),
    );
  return rows.flatMap((row) => (row.scheduledFor ? [row.scheduledFor] : []));
}

/**
 * Swaps the unstarted items for a new plan, in one transaction.
 *
 * The allowance is counted AGAIN under the lock: the scheduler may have
 * started an article since the plan was drawn up, and that item is now kept
 * and its slot used - so the plan is trimmed rather than going one over.
 *
 * WHY THE ITEMS ARE LOCKED FIRST. Creating an article locks its calendar item
 * (the foreign key), and a delete already under way does not see an article
 * committed while it waited, so it could remove that item anyway. Waiting for
 * the lock up front means the delete, a new statement, sees the article and
 * keeps the item; a scheduler arriving after it finds the item gone and
 * skips it.
 */
export async function replaceUnstartedPlan(
  websiteId: string,
  /** From the plan-calendar step: dates arrive as strings once serialised. */
  planned: (Omit<PlannedArticle, "scheduledFor"> & { scheduledFor: Date | string })[],
): Promise<{ saved: number; usedUp: boolean }> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: calendarItems.id })
      .from(calendarItems)
      .where(
        and(
          eq(calendarItems.websiteId, websiteId),
          eq(calendarItems.status, "planned"),
        ),
      )
      .for("update");

    await tx
      .delete(calendarItems)
      .where(and(eq(calendarItems.websiteId, websiteId), unstarted));

    const { count, usedUp } = await articlesToPlan(websiteId, tx);
    const keep = planned.slice(0, count);
    if (keep.length === 0) return { saved: 0, usedUp };

    const clusterRows = await tx
      .select({ id: clusters.id, name: clusters.name })
      .from(clusters)
      .where(eq(clusters.websiteId, websiteId));
    const byName = new Map(clusterRows.map((row) => [row.name, row.id]));

    await tx.insert(calendarItems).values(
      keep.map((article) => ({
        websiteId,
        clusterId: byName.get(article.clusterName) ?? null,
        title: article.title,
        targetKeyword: article.targetKeyword,
        intent: article.intent,
        scheduledFor: new Date(article.scheduledFor),
        status: "planned",
      })),
    );
    return { saved: keep.length, usedUp };
  });
}
