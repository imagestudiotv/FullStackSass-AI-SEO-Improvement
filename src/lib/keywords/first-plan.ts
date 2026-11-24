import { and, eq, gte, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { agencyWorkspaces, articles, calendarItems, spendReservations, websites } from "@/lib/db/schema";
import { researchSiteKey, startResearchJob } from "@/lib/keywords/research-job";
import { RESEARCH_STALE_MS, researchInFlight } from "@/lib/keywords/research-state";
import { articleAllowanceRule } from "@/lib/usage";

/**
 * The first content plan of a new website, started by itself.
 *
 * Keyword research - which builds the calendar every article is written
 * from - was started only by the last onboarding step ("Build my content
 * plan") or the Content page's button. A customer who stopped before that
 * step had a plan, a website and nothing to write: the first Free sign-up
 * (client, 2026-11-21: "I don't see any article generated") stopped at
 * Connect Google. And the growth plan now sends a paying customer straight
 * to the dashboard, past those steps.
 *
 * So a website that is analysed, has a plan (paid, trial or Free) and has
 * never been planned gets its first plan as soon as the last of those is
 * true: when the analysis finishes (analyze-website), when Free starts
 * (startFreePlanAction), and every few minutes for a new subscription
 * (first-content-plan, the safety net for everything else). Research wakes
 * the scheduler when it is done, so the first article follows within
 * minutes, exactly as after the onboarding step.
 *
 * UNTIL THERE IS A PLAN, AND NO LONGER. A website with a calendar, or an
 * article, has been planned. Until 2026-11-24 any research run counted, and any
 * keyword: one that failed after its first paid call, or ended with keywords
 * and nothing to write, left the website "already planned" for ever and its
 * customer without an article (three sign-ups on 21 November, one article).
 * So a run that brought no calendar is tried again, BOUNDED:
 *
 *  - FIRST_PLAN_ATTEMPTS runs that spent, whoever started them, then it is
 *    left to a person (lib/articles/first-article-status.ts says so);
 *  - waiting longer after each one (FIRST_PLAN_WAITS), including runs that
 *    failed before spending anything, so a provider outage is not knocked on
 *    every ten minutes;
 *  - never while a run is going, and not while Free's AI budget is used up
 *    (lib/billing/entitled.ts), where every run would only fail.
 *
 * Overlapping starts are one: startResearchJob marks the website researching
 * under its lock.
 *
 * Not for agency workspaces: their websites (the Partner Network's own) are
 * planned by hand, and a plan would set the scheduler writing for them.
 */

/** Only websites added this recently are swept: older ones without a plan were left that way by someone. */
export const FIRST_PLAN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Runs that spent something before the automatic start gives up. */
export const FIRST_PLAN_ATTEMPTS = 3;

/** How long to wait after the first, second, third... run that brought no plan; the last repeats. */
export const FIRST_PLAN_WAITS_MS = [30, 2 * 60, 6 * 60, 24 * 60].map((minutes) => minutes * 60 * 1000);

export type FirstPlanOutcome =
  /** A research run is queued: the first content plan is being built. */
  | "queued"
  /** The website is still being analysed (or gone). */
  | "not_ready"
  /** No plan: nothing may be researched yet. */
  | "not_entitled"
  /** An agency workspace's website: planned by hand. */
  | "agency"
  /** It has a calendar or an article already. */
  | "already_planned"
  /** A run brought no plan; the next one is due later. */
  | "waiting"
  /** FIRST_PLAN_ATTEMPTS runs brought no plan: it needs a person. */
  | "gave_up"
  /** Free's AI budget is used up for now. */
  | "paused"
  /** A run is going right now. */
  | "running"
  /** An hourly allowance is used up, or the automatic start was already taken: next sweep. */
  | "limited";

/** A website that is ready to be planned: analysed, or left "researching" by a run that never ended. */
export function plannable(now: Date) {
  return or(eq(websites.status, "ready"), and(eq(websites.status, "researching"), lt(websites.updatedAt, new Date(now.getTime() - RESEARCH_STALE_MS))));
}

/** Websites the sweep looks at: added recently, analysed, never planned, outside agency workspaces. */
export async function firstPlanCandidates(now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .select({ id: websites.id })
    .from(websites)
    .where(
      and(
        plannable(now),
        gte(websites.createdAt, new Date(now.getTime() - FIRST_PLAN_WINDOW_MS)),
        sql`not exists (select 1 from ${calendarItems} where ${calendarItems.websiteId} = ${websites.id})`,
        sql`not exists (select 1 from ${articles} where ${articles.websiteId} = ${websites.id})`,
        sql`not exists (select 1 from ${agencyWorkspaces} where ${agencyWorkspaces.organizationId} = ${websites.organizationId})`,
      ),
    )
    .orderBy(websites.createdAt);
  return rows.map((row) => row.id);
}

/** Starts the website's first content plan if it is due (see above). Safe to call any number of times. */
export async function planFirstIfDue(websiteId: string, now: Date = new Date()): Promise<FirstPlanOutcome> {
  const [site] = await db
    .select({ id: websites.id, status: websites.status, updatedAt: websites.updatedAt, organizationId: websites.organizationId })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  if (!site) return "not_ready";
  if (researchInFlight(site, now)) return "running";
  if (site.status !== "ready" && site.status !== "researching") return "not_ready";

  const [agency] = await db
    .select({ id: agencyWorkspaces.organizationId })
    .from(agencyWorkspaces)
    .where(eq(agencyWorkspaces.organizationId, site.organizationId))
    .limit(1);
  if (agency) return "agency";

  const [planned] = await db
    .select({
      articles: sql<boolean>`exists (select 1 from ${articles} where ${articles.websiteId} = ${site.id})`,
      calendar: sql<boolean>`exists (select 1 from ${calendarItems} where ${calendarItems.websiteId} = ${site.id})`,
    })
    .from(websites)
    .where(eq(websites.id, site.id));
  if (planned && (planned.articles || planned.calendar)) return "already_planned";

  // Paid, trial, Free: whoever may have articles may have their plan (the same check as the scheduler's).
  const allowance = await articleAllowanceRule(site.id);
  if (!allowance.ok) return "not_entitled";

  const runs = await researchRuns(site.id);
  if (runs.spent >= FIRST_PLAN_ATTEMPTS) return "gave_up";
  if (runs.last && now.getTime() - runs.last.getTime() < FIRST_PLAN_WAITS_MS[Math.min(runs.total, FIRST_PLAN_WAITS_MS.length) - 1]) return "waiting";

  // Free pauses when its AI budget is used: the run would be refused at its first paid call.
  if (!(await isEntitledToSpend(site.id, { freeArticles: true })).ok) return "paused";

  return startResearchJob(site.id, allowance.organizationId, {
    refuseIfRunning: true,
    rules: [{ key: `research:first:${site.id}`, limit: FIRST_PLAN_ATTEMPTS, window: { since: new Date(0) } }],
    trigger: "first",
  });
}

/**
 * The website's research runs, whoever started them: how many, how many spent
 * something, and when the last was reserved. A run reserved and never heard of
 * again counts as spent, as the ledger treats it (lib/billing/spend-quota.ts).
 */
export async function researchRuns(websiteId: string): Promise<{ total: number; spent: number; last: Date | null }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      spent: sql<number>`(count(*) filter (where ${spendReservations.state} in ('reserved', 'consumed')))::int`,
      last: sql<string | null>`to_char(max(${spendReservations.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
    })
    .from(spendReservations)
    .where(eq(spendReservations.key, researchSiteKey(websiteId)));
  return { total: Number(row?.total ?? 0), spent: Number(row?.spent ?? 0), last: row?.last ? new Date(row.last) : null };
}
