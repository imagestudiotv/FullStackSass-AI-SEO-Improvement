import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  agencyWorkspaces,
  keywords,
  spendReservations,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import { researchSiteKey, startResearchJob } from "@/lib/keywords/research-job";
import { articleAllowanceRule } from "@/lib/usage";

/**
 * A new content plan when a website's monthly allowance renews.
 *
 * A re-plan only ever covers what is left of the current month (replan.ts),
 * and nothing started one when the month turned over - so once a month's
 * articles were written the calendar stayed empty until someone pressed
 * Refresh, and keywords added while the month was used up waited with it.
 * The client asked for the plan to rebuild on renewal by itself.
 *
 * "Renewal" is the start of a new ALLOWANCE WINDOW (usage.ts), not a payment:
 * an annual plan's allowance renews monthly with no invoice, and an agency
 * workspace's on the 1st. The same window the scheduler counts articles in.
 *
 * It runs the same research job as Refresh - so keywords and their figures
 * are refreshed too - at the same cost as one press, once a month.
 */

/**
 * How long after a window opens it still counts as just renewed. Hourly
 * checks get three days of retries through a queue or provider outage; past
 * that the month is under way, and a site that has had no plan built in it
 * is left for its owner rather than rebuilt by surprise mid-month.
 */
export const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export type RenewalOutcome =
  /** A research run is queued for the new month. */
  | "queued"
  /** No live plan, so nothing to renew. */
  | "not_entitled"
  /** This window opened more than RENEWAL_GRACE_MS ago. */
  | "not_renewed"
  /** A research run has already been reserved in this window. */
  | "already_planned"
  /** A run is going right now. */
  | "running"
  /** An hourly allowance is used up, or this window's re-plan was already taken: next hour. */
  | "limited";

/**
 * Websites that could be due: analysed and researched before (onboarding
 * builds the first plan), and on a live subscription or an agency workspace.
 * Whether a window has just opened is decided per site, by replanIfRenewed.
 */
export async function renewalCandidates(): Promise<string[]> {
  const rows = await db
    .select({ id: websites.id })
    .from(websites)
    .where(
      and(
        eq(websites.status, "ready"),
        sql`exists (select 1 from ${keywords} where ${keywords.websiteId} = ${websites.id})`,
        sql`(
          exists (
            select 1 from ${subscriptions}
            where ${subscriptions.websiteId} = ${websites.id}
              and ${subscriptions.status} in ('active', 'trialing', 'past_due')
          )
          or exists (
            select 1 from ${agencyWorkspaces}
            where ${agencyWorkspaces.organizationId} = ${websites.organizationId}
          )
        )`,
      ),
    )
    .orderBy(websites.id);
  return rows.map((row) => row.id);
}

/**
 * Re-plans a website if its allowance window has just opened and no plan has
 * been built in it yet.
 *
 * ONCE PER WINDOW, whatever happens. A run already reserved in this window -
 * by Refresh, by added keywords, or by an earlier check - is the month's plan.
 * The renewal's own reservation (`research:renewal:<id>`, limit one since the
 * window opened) makes overlapping checks safe, and a run that failed after
 * it started spending keeps it: one month, one automatic run, never a loop.
 * A run that failed before spending hands both back and is tried next hour.
 */
export async function replanIfRenewed(
  websiteId: string,
  now: Date = new Date(),
): Promise<RenewalOutcome> {
  const allowance = await articleAllowanceRule(websiteId);
  if (!allowance.ok) return "not_entitled";
  const window = allowance.rule.window;
  // Always "since" for articles; narrowed for the type.
  if (!("since" in window)) return "not_renewed";
  const opened = window.since;
  if (now.getTime() - opened.getTime() > RENEWAL_GRACE_MS) return "not_renewed";

  const [planned] = await db
    .select({ id: spendReservations.id })
    .from(spendReservations)
    .where(
      and(
        eq(spendReservations.key, researchSiteKey(websiteId)),
        inArray(spendReservations.state, ["reserved", "consumed"]),
        gte(spendReservations.countedAt, opened),
      ),
    )
    .limit(1);
  if (planned) return "already_planned";

  return startResearchJob(websiteId, allowance.organizationId, {
    refuseIfRunning: true,
    rules: [
      { key: `research:renewal:${websiteId}`, limit: 1, window: { since: opened } },
    ],
    trigger: "renewal",
  });
}
