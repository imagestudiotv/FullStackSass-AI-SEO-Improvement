import { and, eq, lte, or, sql } from "drizzle-orm";

import { endFreeTrialIfUsed } from "@/lib/billing/end-free-trial";
import {
  holdPaidStart,
  isCouponRefusal,
  markOfferSettled,
  PAID_START_KEY,
  paidStartIdempotencyKey,
  paidStartUpdate,
  reportOfferMissed,
} from "@/lib/billing/paid-start-coupon";
import { REPGET_CODE } from "@/lib/billing/repget-offer";
import { db } from "@/lib/db";
import { billingCheckouts, subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

const DAY_MS = 24 * 60 * 60 * 1000;
/** The coupon goes on inside this. Early enough for several tries, late enough that its one use is the first paid invoice. */
const APPLY_WINDOW_MS = 3 * DAY_MS;
/** With a refusal unresolved this close to the end, the free period is moved, or Stripe would charge full price. */
const PROTECT_WITHIN_MS = DAY_MS;

/**
 * Every REPGET offer still waiting that is due, from the billing-maintenance job.
 * A job rather than a webhook, so a missed event cannot cost a customer the discount.
 *
 *   - Inside the last three days of a free period: the coupon goes on.
 *   - Refused: staff are told, and if the period is about to end it is moved on, so
 *     Stripe cannot charge full price. The customer keeps the free period's limits
 *     meanwhile (isFreeArticlesTrial), and is charged nothing.
 *   - Held after the free articles ran out (end-free-trial.ts): that start is tried
 *     again here, which is what resumes it once the coupon is put right.
 */
export async function settlePaidStartOffers(now: Date = new Date()): Promise<{ applied: number; held: number }> {
  const due = await db
    .select({
      websiteId: subscriptions.websiteId,
      subscriptionId: subscriptions.stripeSubscriptionId,
      held: sql<string | null>`${billingCheckouts.requestParams} ->> 'offerHeldAt'`,
    })
    .from(subscriptions)
    .innerJoin(billingCheckouts, eq(billingCheckouts.websiteId, subscriptions.websiteId))
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        eq(subscriptions.provider, "stripe"),
        eq(billingCheckouts.status, "completed"),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
        sql`${billingCheckouts.requestParams} ->> 'offerSettledAt' is null`,
        or(
          lte(subscriptions.currentPeriodEnd, new Date(now.getTime() + APPLY_WINDOW_MS)),
          sql`${billingCheckouts.requestParams} ->> 'offerHeldAt' is not null`,
        ),
      ),
    )
    .limit(50);

  let applied = 0;
  let held = 0;
  for (const row of due) {
    const { websiteId, subscriptionId } = row;
    if (!websiteId || !subscriptionId) continue;
    try {
      const live = await stripe.subscriptions.retrieve(subscriptionId);
      if (live.status !== "trialing") {
        if (live.metadata?.[PAID_START_KEY]) await reportOfferMissed({ websiteId, subscriptionId, now });
        else await markOfferSettled(websiteId, now);
        continue;
      }
      const update = await paidStartUpdate(live);
      if (!update) {
        await markOfferSettled(websiteId, now);
        continue;
      }
      const endsAt = (live.trial_end ?? 0) * 1000;
      if (endsAt - now.getTime() > APPLY_WINDOW_MS) {
        // Held when the free articles ran out, with free days still to go.
        const outcome = await endFreeTrialIfUsed(websiteId);
        if (outcome === "offer_held") held += 1;
        continue;
      }
      try {
        await stripe.subscriptions.update(subscriptionId, update, { idempotencyKey: paidStartIdempotencyKey(subscriptionId, now) });
        await markOfferSettled(websiteId, now);
        applied += 1;
      } catch (error) {
        if (!isCouponRefusal(error)) throw error;
        held += 1;
        await holdPaidStart({ websiteId, subscriptionId, error, now });
        if (endsAt - now.getTime() < PROTECT_WITHIN_MS) {
          await stripe.subscriptions.update(subscriptionId, {
            trial_end: Math.floor((now.getTime() + APPLY_WINDOW_MS) / 1000),
            proration_behavior: "none",
          });
        }
      }
    } catch (error) {
      // One website's trouble does not stop the others. The next run tries again.
      console.error("[billing] could not settle a REPGET offer", { websiteId, error });
    }
  }
  return { applied, held };
}
