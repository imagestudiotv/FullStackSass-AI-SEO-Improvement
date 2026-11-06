import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { adminEmails } from "@/lib/admin/guard";
import { REPGET_CODE, repgetCouponFor } from "@/lib/billing/repget-offer";
import { db } from "@/lib/db";
import { billingCheckouts, plans } from "@/lib/db/schema";
import { emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";

/**
 * The REPGET discount for a customer on a free period (lib/billing/repget-offer.ts).
 *
 * WHY IT WAITS. The discount is for the first paid month, and a coupon on the
 * subscription during the free period could be used up there. So Checkout puts no
 * coupon on: the offer is remembered in the subscription's metadata (PAID_START_KEY)
 * and the coupon goes on just before the first paid invoice:
 *
 *   - by settlePaidStartOffers, in the three days before a free period runs out;
 *   - or in the same update that ends it early (end-free-trial.ts).
 *
 * THE PLAN AT THAT MOMENT DECIDES, not the plan at Checkout, because the coupons are
 * per plan and the customer can change plan meanwhile. On an annual plan by then
 * there is no discount: annual handling is undecided.
 *
 * A COUPON STRIPE REFUSES NEVER MEANS FULL PRICE. The customer was promised it. The
 * paid start does not happen, the offer stays waiting, and staff are told
 * (holdPaidStart), until the coupon is put right and a later attempt succeeds.
 */
export const PAID_START_KEY = "paid_start_offer";

/** Once a day at most, per website, while it stays held. */
const ALERT_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * What to add to the update that starts the paid service, or null if no offer is
 * waiting. Clears the memory either way, so the coupon goes on once at most.
 */
export async function paidStartUpdate(
  subscription: Pick<Stripe.Subscription, "metadata" | "items">,
): Promise<Pick<Stripe.SubscriptionUpdateParams, "discounts" | "metadata"> | null> {
  if (!subscription.metadata?.[PAID_START_KEY]) return null;
  const priceId = subscription.items.data[0]?.price.id;
  const [plan] = priceId
    ? await db
        .select({ tier: plans.tier, interval: plans.interval, currency: plans.currency, priceCents: plans.priceCents })
        .from(plans)
        .where(eq(plans.stripePriceId, priceId))
        .limit(1)
    : [];
  const coupon = plan ? repgetCouponFor(plan) : null;
  return { ...(coupon ? { discounts: [{ coupon }] } : {}), metadata: { [PAID_START_KEY]: "" } };
}

/** Stripe answered and said no: the coupon is deleted, expired or does not fit. Waiting alone will not change that. */
export function isCouponRefusal(error: unknown): boolean {
  return (error as { type?: string } | null)?.type === "StripeInvalidRequestError";
}

/**
 * An idempotency key that changes each hour. Stripe can replay a stored refusal for
 * the same key for a day, which would keep failing after the coupon is put right.
 */
export function paidStartIdempotencyKey(subscriptionId: string, now: Date = new Date()): string {
  return `paid-start-offer:${subscriptionId}:${now.toISOString().slice(0, 13)}`;
}

/** What is known about this website's offer, kept with the checkout that took it. */
function offerRow(websiteId: string) {
  return and(
    eq(billingCheckouts.websiteId, websiteId),
    eq(billingCheckouts.status, "completed"),
    sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
  );
}

async function markOffer(websiteId: string, fields: Record<string, string>): Promise<void> {
  await db
    .update(billingCheckouts)
    .set({ requestParams: sql`${billingCheckouts.requestParams} || ${JSON.stringify(fields)}::jsonb` })
    .where(offerRow(websiteId));
}

/** The offer is done with: the coupon is on, or the plan no longer qualifies. */
export async function markOfferSettled(websiteId: string, now: Date = new Date()): Promise<void> {
  await markOffer(websiteId, { offerSettledAt: now.toISOString() });
}

/** Tells the administrators. Never throws, and counts as told only if an email went out. */
async function alertStaff(websiteId: string, subscriptionId: string, reason: string, now: Date): Promise<void> {
  console.error(`[billing] REPGET offer needs staff: ${reason}`, { websiteId, subscriptionId });
  try {
    const [row] = await db
      .select({ alerted: sql<string | null>`${billingCheckouts.requestParams} ->> 'offerAlertedAt'` })
      .from(billingCheckouts)
      .where(offerRow(websiteId))
      .limit(1);
    if (row?.alerted && now.getTime() - new Date(row.alerted).getTime() < ALERT_EVERY_MS) return;
    const to = adminEmails();
    if (to.length === 0) return;
    const lines = [
      `The ${REPGET_CODE} discount could not be applied. The customer has not been charged full price: their paid service waits until it can be.`,
      `Why: ${reason}`,
      `Website: ${websiteId}`,
      `Stripe subscription: ${subscriptionId}`,
      `What to do: check the plan's coupon in Stripe (LAUNCH40, GROW40, SCALE40). Once it is valid, RepGet tries again by itself, and this stops.`,
    ];
    const html = emailLayout({
      heading: `${REPGET_CODE} discount needs attention`,
      preheader: "A customer's paid service is waiting on a coupon Stripe refused.",
      body: lines.map((line) => emailText(escapeHtml(line))).join(""),
    });
    for (const address of to) {
      await sendEmail({ to: address, subject: `Action needed: ${REPGET_CODE} coupon refused`, html, text: lines.join("\n\n") });
    }
    await markOffer(websiteId, { offerAlertedAt: now.toISOString() });
  } catch (error) {
    console.error("[billing] could not tell staff about a REPGET offer", { websiteId, error });
  }
}

/**
 * Stripe refused the coupon. The offer stays waiting in the metadata, because the
 * refused update changed nothing, and settlePaidStartOffers keeps trying.
 */
export async function holdPaidStart(input: { websiteId: string; subscriptionId: string; error: unknown; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const reason = input.error instanceof Error ? input.error.message : String(input.error);
  await markOffer(input.websiteId, { offerHeldAt: now.toISOString() });
  await alertStaff(input.websiteId, input.subscriptionId, reason, now);
}

/** Something started the paid service with the offer still waiting. Should not happen: staff decide what is owed. */
export async function reportOfferMissed(input: { websiteId: string; subscriptionId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await alertStaff(input.websiteId, input.subscriptionId, "The paid service started without the discount. The customer may be owed it.", now);
  await markOfferSettled(input.websiteId, now);
}
