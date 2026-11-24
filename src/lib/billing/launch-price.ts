import "server-only";

import { and, eq, or, sql } from "drizzle-orm";

import { REPGET_CODE } from "@/lib/billing/repget-offer";
import { billingCheckouts, subscriptions } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * Whether this website's subscription, by card or PayPal, was started on the
 * REPGET launch price, which it keeps on every payment and through a plan
 * change (repget-subscription.ts offerForPlanChange, paypal/plan-changes.ts):
 * its checkout carried the offer.
 *
 * For the plan screen's prices only. What a change is billed at is decided
 * where the change is made.
 */
export async function onLaunchPrice(executor: Pick<Executor, "select">, websiteId: string): Promise<boolean> {
  const [row] = await executor
    .select({ id: billingCheckouts.id })
    .from(subscriptions)
    .innerJoin(
      billingCheckouts,
      or(
        and(
          eq(subscriptions.provider, "stripe"),
          eq(billingCheckouts.provider, "stripe"),
          eq(billingCheckouts.providerSubscriptionId, subscriptions.stripeSubscriptionId),
        ),
        and(
          eq(subscriptions.provider, "paypal"),
          eq(billingCheckouts.provider, "paypal"),
          eq(billingCheckouts.providerSubscriptionId, subscriptions.paypalSubscriptionId),
        ),
      ),
    )
    .where(
      and(eq(subscriptions.websiteId, websiteId), sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`),
    )
    .limit(1);
  return Boolean(row);
}
