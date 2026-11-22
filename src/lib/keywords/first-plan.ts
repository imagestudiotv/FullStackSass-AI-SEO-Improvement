import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyWorkspaces, calendarItems, keywords, spendReservations, websites } from "@/lib/db/schema";
import { researchSiteKey, startResearchJob } from "@/lib/keywords/research-job";
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
 * ONCE PER WEBSITE, EVER. Any research run already reserved for the site -
 * by the onboarding step, the button, or an earlier automatic start - means
 * it has been planned; the automatic start's own reservation
 * (`research:first:<id>`, limit one since forever) keeps overlapping calls
 * from queueing twice. A run that fails before spending hands it back and
 * is tried again; one that spent and found nothing is left to the customer.
 *
 * Not for agency workspaces: their websites (the Partner Network's own) are
 * planned by hand, and a plan would set the scheduler writing for them.
 */

/** Only websites added this recently are swept: older ones without a plan were left that way by someone. */
export const FIRST_PLAN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type FirstPlanOutcome =
  /** A research run is queued: the first content plan is being built. */
  | "queued"
  /** The website is still being analysed (or gone). */
  | "not_ready"
  /** No plan: nothing may be researched yet. */
  | "not_entitled"
  /** An agency workspace's website: planned by hand. */
  | "agency"
  /** It has keywords, a calendar, or a research run already. */
  | "already_planned"
  /** A run is going right now. */
  | "running"
  /** An hourly allowance is used up, or the automatic start was already taken: next sweep. */
  | "limited";

/** Websites the sweep looks at: added recently, analysed, never planned, outside agency workspaces. */
export async function firstPlanCandidates(now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .select({ id: websites.id })
    .from(websites)
    .where(
      and(
        eq(websites.status, "ready"),
        gte(websites.createdAt, new Date(now.getTime() - FIRST_PLAN_WINDOW_MS)),
        sql`not exists (select 1 from ${keywords} where ${keywords.websiteId} = ${websites.id})`,
        sql`not exists (select 1 from ${calendarItems} where ${calendarItems.websiteId} = ${websites.id})`,
        sql`not exists (select 1 from ${agencyWorkspaces} where ${agencyWorkspaces.organizationId} = ${websites.organizationId})`,
      ),
    )
    .orderBy(websites.createdAt);
  return rows.map((row) => row.id);
}

/** Starts the website's first content plan if it is due (see above). Safe to call any number of times. */
export async function planFirstIfDue(websiteId: string): Promise<FirstPlanOutcome> {
  const [site] = await db
    .select({ id: websites.id, status: websites.status, organizationId: websites.organizationId })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  if (!site || site.status !== "ready") return site?.status === "researching" ? "running" : "not_ready";

  const [agency] = await db
    .select({ id: agencyWorkspaces.organizationId })
    .from(agencyWorkspaces)
    .where(eq(agencyWorkspaces.organizationId, site.organizationId))
    .limit(1);
  if (agency) return "agency";

  const [planned] = await db
    .select({
      keywords: sql<boolean>`exists (select 1 from ${keywords} where ${keywords.websiteId} = ${site.id})`,
      calendar: sql<boolean>`exists (select 1 from ${calendarItems} where ${calendarItems.websiteId} = ${site.id})`,
      researched: sql<boolean>`exists (
        select 1 from ${spendReservations}
        where ${spendReservations.key} = ${researchSiteKey(site.id)}
          and ${inArray(spendReservations.state, ["reserved", "consumed"])}
      )`,
    })
    .from(websites)
    .where(eq(websites.id, site.id));
  if (planned && (planned.keywords || planned.calendar || planned.researched)) return "already_planned";

  // Paid, trial, Free: whoever may have articles may have their plan (the same check as the scheduler's).
  const allowance = await articleAllowanceRule(site.id);
  if (!allowance.ok) return "not_entitled";

  return startResearchJob(site.id, allowance.organizationId, {
    refuseIfRunning: true,
    rules: [{ key: `research:first:${site.id}`, limit: 1, window: { since: new Date(0) } }],
  });
}
