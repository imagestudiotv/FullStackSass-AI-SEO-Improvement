import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { freePlanAccounts, socialAccounts, subscriptions, websites } from "@/lib/db/schema";
import { onFreePlan } from "@/lib/plans/free-plan-server";

/**
 * Which websites the daily job asks for suggestions (Daniel, 2026-11-24:
 * "enable suggestions without social accounts connected, based on the website
 * information").
 *
 *  - a website with a connected account: every day, as before;
 *  - a paid website with none: every day too, but suggest.ts stops while a
 *    day's worth of its suggestions is still waiting (DORMANT_WAITING), so a
 *    page nobody opens costs about one run a week;
 *  - a Free website with none: on one day of the week (its own, so they do
 *    not all spend the Free plan's daily AI budget on the same morning), and
 *    in its first two days.
 *
 * Only analysed websites ("ready") with a plan or Free.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The weekday (0-6, UTC) an unconnected Free website gets its suggestions on. */
export function freeWeekday(websiteId: string): number {
  return Number.parseInt(websiteId.replace(/-/g, "").slice(0, 8), 16) % 7;
}

export async function dailySuggestionWebsites(now: Date = new Date()): Promise<string[]> {
  const [connected, paid, free] = await Promise.all([
    db
      .selectDistinct({ id: socialAccounts.websiteId })
      .from(socialAccounts)
      .innerJoin(websites, eq(socialAccounts.websiteId, websites.id))
      .where(eq(websites.status, "ready")),
    db
      .selectDistinct({ id: websites.id })
      .from(websites)
      .innerJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
      .where(
        and(eq(websites.status, "ready"), isNotNull(subscriptions.planId), sql`${subscriptions.status} in ('active', 'trialing', 'past_due')`),
      ),
    db
      .selectDistinct({ id: websites.id, createdAt: websites.createdAt })
      .from(websites)
      .innerJoin(freePlanAccounts, eq(freePlanAccounts.websiteId, websites.id))
      .where(and(eq(websites.status, "ready"), onFreePlan(websites.id))),
  ]);
  const freeToday = free.filter(
    (site) => freeWeekday(site.id) === now.getUTCDay() || now.getTime() - site.createdAt.getTime() < 2 * DAY_MS,
  );
  return [...new Set([...connected, ...paid, ...freeToday].map((site) => site.id))];
}
