import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { adminEmails } from "@/lib/admin/guard";
import { ALL_REPGET_COUPONS, REPGET_CODE, repgetCouponFor, type OfferPlan } from "@/lib/billing/repget-offer";
import { db } from "@/lib/db";
import { billingCheckouts, plans, subscriptions } from "@/lib/db/schema";
import { emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { stripe } from "@/lib/stripe/client";

/**
 * The REPGET coupon after Checkout (lib/billing/repget-offer.ts).
 *
 * The coupon goes on at Checkout, and Stripe keeps it through a free period for the
 * first paid invoice (checked in Stripe's test mode, 2026-11-06). One case needs
 * help: each coupon is limited to its own plan's product, so a plan changed before
 * then would lose the discount, and a move between the same plan's monthly and
 * yearly prices would keep the other interval's coupon (the prices share a
 * product), with the wrong amount off.
 *
 * A PLAN CHANGE CAN END THE FREE PERIOD AND CHARGE AT ONCE, so a webhook is too late.
 *   - Change plan in Billing carries the new plan's coupon in the same Stripe request
 *     as the change (offerForPlanChange). A coupon Stripe refuses stops the change.
 *   - The portal opened from Billing offers no plan change while the offer waits
 *     (hasWaitingOffer, lib/stripe/portal.ts).
 *   - matchOfferToPlan is what is left: a change made some other way, in Stripe's
 *     dashboard say. During the free period it corrects the coupon. Once charged, it
 *     cannot, so staff are told.
 */
export const OFFER_KEY = "repget_offer";

function couponIdOf(discount: string | Stripe.Discount | Stripe.DeletedDiscount): string | null {
  if (typeof discount === "string") return null;
  const coupon = discount.source.coupon;
  return typeof coupon === "string" ? coupon : (coupon?.id ?? null);
}

/** Stripe answered and said no: the coupon is deleted, expired or does not fit. Trying again will not change that. */
export function isCouponRefusal(error: unknown): boolean {
  return (error as { type?: string } | null)?.type === "StripeInvalidRequestError";
}

/** Tells the administrators. Never throws: whatever called this has its own answer to give. */
export async function alertStaffAboutOffer(reason: string, detail: string): Promise<void> {
  console.error(`[billing] ${REPGET_CODE} needs staff: ${reason}`, detail);
  try {
    const lines = [
      `The ${REPGET_CODE} discount could not be applied.`,
      `Why: ${reason}`,
      detail,
      `What to do: check the plan's coupon in Stripe (${ALL_REPGET_COUPONS.join(", ")}).`,
    ];
    const html = emailLayout({
      heading: `${REPGET_CODE} discount needs attention`,
      preheader: "A customer's discount was refused by Stripe.",
      body: lines.map((line) => emailText(escapeHtml(line))).join(""),
    });
    for (const address of adminEmails()) {
      await sendEmail({ to: address, subject: `Action needed: ${REPGET_CODE} coupon refused`, html, text: lines.join("\n\n") });
    }
  } catch (error) {
    console.error("[billing] could not tell staff about a REPGET coupon", error);
  }
}

const OURS = ALL_REPGET_COUPONS as readonly (string | null)[];

/**
 * What a plan change owes a subscription whose REPGET discount is not used yet, for
 * the Stripe request that makes the change. Needs `discounts` expanded.
 *   coupon  the new plan's, to go in that request: a monthly price's monthly
 *           coupon, a yearly price's yearly one (2026-11-11).
 *   refuse  the new plan has none (an older catalogue's price, say), so the
 *           change waits until the discount is used.
 */
export function offerForPlanChange(
  subscription: Pick<Stripe.Subscription, "status" | "metadata" | "discounts">,
  plan: OfferPlan,
): { coupon?: string; refuse?: string } {
  // Only a subscription that took the offer through RepGet. The same coupons reached by a Stripe promotion code are Stripe's to handle, as before.
  if (!subscription.metadata?.[OFFER_KEY]) return {};
  const onIt = subscription.discounts.some((discount) => OURS.includes(couponIdOf(discount)));
  const waiting = subscription.status === "trialing";
  if (!onIt && !waiting) return {};
  const coupon = repgetCouponFor(plan);
  if (coupon) return { coupon };
  return { refuse: `Your ${REPGET_CODE} discount does not cover this plan. You can move to it after your first paid payment.` };
}

/** A website of this workspace is on its free period with a REPGET discount waiting. */
export async function hasWaitingOffer(organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .innerJoin(billingCheckouts, eq(billingCheckouts.websiteId, subscriptions.websiteId))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.status, "trialing"),
        eq(billingCheckouts.status, "completed"),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * A subscription carrying the offer has changed. During the free period its coupon
 * follows its plan and interval: the new price's, or none on a price the offer
 * does not cover. After it, the first
 * paid invoice is read once: if the discount was owed and is not on it, staff are
 * told, because that money is already charged. Reads Stripe afresh, so a late,
 * repeated or out-of-order event does no harm, and asks nothing unless the event's
 * subscription carries the offer.
 */
export async function matchOfferToPlan(event: Pick<Stripe.Subscription, "id" | "metadata">): Promise<void> {
  if (!event.metadata?.[OFFER_KEY]) return;
  const live = await stripe.subscriptions.retrieve(event.id, { expand: ["discounts", "latest_invoice"] });
  if (!live.metadata?.[OFFER_KEY]) return;
  const priceId = live.items.data[0]?.price.id;
  const [plan] = priceId
    ? await db
        .select({ tier: plans.tier, interval: plans.interval, currency: plans.currency, priceCents: plans.priceCents })
        .from(plans)
        .where(eq(plans.stripePriceId, priceId))
        .limit(1)
    : [];
  const wanted = plan ? repgetCouponFor(plan) : null;
  if (live.status !== "trialing") {
    const invoice = live.latest_invoice;
    if (!invoice || typeof invoice === "string" || invoice.subtotal <= 0) return;
    const discounted = (invoice.total_discount_amounts ?? []).some((row) => row.amount > 0);
    if (wanted && !discounted) {
      await alertStaffAboutOffer(
        "The first paid invoice went out without the discount.",
        `Stripe subscription: ${live.id}, invoice: ${invoice.id}. The customer was promised it and may be owed a refund of the discount. This is not corrected automatically.`,
      );
    }
    await stripe.subscriptions.update(live.id, { metadata: { [OFFER_KEY]: "" } });
    return;
  }
  const ours = OURS;
  const others = live.discounts.filter((discount) => !ours.includes(couponIdOf(discount)));
  const current = live.discounts.filter((discount) => ours.includes(couponIdOf(discount))).map(couponIdOf);
  if (wanted ? current.length === 1 && current[0] === wanted : current.length === 0) return;
  const kept = others.map((discount) => ({ discount: typeof discount === "string" ? discount : discount.id }));
  const discounts = [...kept, ...(wanted ? [{ coupon: wanted }] : [])];
  try {
    await stripe.subscriptions.update(live.id, { discounts: discounts.length > 0 ? discounts : "" });
  } catch (error) {
    if (!isCouponRefusal(error)) throw error;
    await alertStaffAboutOffer(
      error instanceof Error ? error.message : String(error),
      `A plan changed during its free period, and the new plan's coupon was refused. Stripe subscription: ${live.id}. Unless this is fixed before the free period ends, the first invoice is full price.`,
    );
  }
}
