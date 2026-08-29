import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import type { CurrentSubscription, PlanRow } from "@/lib/billing-shared";

/**
 * Server-side billing queries.
 *
 * Types and pure formatting live in lib/billing-shared.ts so the client bundle
 * can use them without importing the database driver.
 */

export * from "@/lib/billing-shared";

/** Active plans, cheapest first. */
export async function listPlans(): Promise<PlanRow[]> {
  return db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder), asc(plans.priceCents));
}

export async function getSubscription(
  orgId: string,
): Promise<CurrentSubscription | null> {
  const [row] = await db
    .select({
      status: subscriptions.status,
      planId: subscriptions.planId,
      planName: plans.name,
      tier: plans.tier,
      interval: plans.interval,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      stripeCustomerId: subscriptions.stripeCustomerId,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.organizationId, orgId))
    .limit(1);

  if (!row) return null;

  return {
    status: row.status,
    planId: row.planId,
    planName: row.planName,
    tier: row.tier,
    interval: row.interval,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    hasCustomer: Boolean(row.stripeCustomerId),
  };
}
