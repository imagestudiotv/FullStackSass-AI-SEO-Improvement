import { and, eq, notInArray, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { adminEmails } from "@/lib/admin/guard";
import { ALL_REPGET_COUPONS, REPGET_CODE, repgetCouponFor, type OfferPlan } from "@/lib/billing/repget-offer";
import { db } from "@/lib/db";
import { billingCheckouts, plans, subscriptions } from "@/lib/db/schema";
import { emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { stripe } from "@/lib/stripe/client";

/**
 * The REPGET launch price after Checkout (lib/billing/repget-offer.ts).
 *
 * The coupon goes on at Checkout, and Stripe keeps it through a free period and
 * then on every invoice: it is `forever`, so it is never used up. A subscription
 * that took it through RepGet says so in its metadata (OFFER_KEY), and that is
 * what keeps the launch price on it for good, through any plan change. One case
 * needs help: each coupon is limited to its own plan's product, so a changed plan
 * would lose the discount, and a move between the same plan's monthly and yearly
 * prices would keep the other interval's coupon (the prices share a product),
 * with the wrong amount off.
 *
 * A PLAN CHANGE CAN CHARGE AT ONCE (a free period ended, a proration invoiced), so
 * a webhook is too late.
 *   - Change plan in Billing carries the new plan's coupon in the same Stripe
 *     request as the change (offerForPlanChange). A coupon Stripe refuses stops
 *     the change.
 *   - The portal opened from Billing offers no plan change to a workspace with a
 *     subscription on the launch price (hasLaunchPrice, lib/stripe/portal.ts).
 *   - matchOfferToPlan is what is left: a change made some other way, in Stripe's
 *     dashboard say. It corrects the coupon for the payments to come, and tells
 *     staff when an invoice already went out without it.
 *
 * To end one customer's launch price by hand, remove the coupon AND clear the
 * subscription's repget_offer metadata in Stripe, or it is put back.
 */
export const OFFER_KEY = "repget_offer";

/** Statuses after which a subscription is not billed again, so there is nothing to correct. */
const ENDED = ["canceled", "incomplete_expired"];

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
 * What a plan change owes a subscription on the launch price, for the Stripe
 * request that makes the change, at any time.
 *   coupon  the new plan's, to go in that request: a monthly price's monthly
 *           coupon, a yearly price's yearly one.
 *   refuse  the new plan has none (an older catalogue's price, the bundle), so
 *           the change would end the launch price: not done from here.
 */
export function offerForPlanChange(
  subscription: Pick<Stripe.Subscription, "metadata">,
  plan: OfferPlan,
): { coupon?: string; refuse?: string } {
  // Only a subscription that took the offer through RepGet. The same coupons reached by a Stripe promotion code are Stripe's to handle, as before.
  if (!subscription.metadata?.[OFFER_KEY]) return {};
  const coupon = repgetCouponFor(plan);
  if (coupon) return { coupon };
  return { refuse: `Your ${REPGET_CODE} launch price does not cover this plan, and moving to it would end your discount. Please contact us if you want to change to it.` };
}

/** A website of this workspace pays by card on the launch price: a REPGET checkout started its subscription, which has not ended. */
export async function hasLaunchPrice(organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .innerJoin(
      billingCheckouts,
      and(eq(billingCheckouts.provider, "stripe"), eq(billingCheckouts.providerSubscriptionId, subscriptions.stripeSubscriptionId)),
    )
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        notInArray(subscriptions.status, ENDED),
        eq(billingCheckouts.status, "completed"),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * A subscription carrying the offer has changed, or was charged without it. Its
 * coupon follows its plan and interval: the new price's, or none on a price the
 * offer does not cover. An invoice paid without the discount on a price it
 * covers (`paidInFull`, from invoice.paid; or, after a correction outside the
 * free period, its latest invoice) means money already charged, so staff are
 * told. Reads Stripe afresh, so a late, repeated or out-of-order event does no
 * harm, and asks nothing unless the event's subscription carries the offer.
 */
export async function matchOfferToPlan(event: Pick<Stripe.Subscription, "id" | "metadata">, paidInFull?: string): Promise<void> {
  if (!event.metadata?.[OFFER_KEY]) return;
  const live = await stripe.subscriptions.retrieve(event.id, { expand: ["discounts", "latest_invoice"] });
  if (!live.metadata?.[OFFER_KEY] || ENDED.includes(live.status)) return;
  const priceId = live.items.data[0]?.price.id;
  const [plan] = priceId
    ? await db
        .select({ tier: plans.tier, interval: plans.interval, currency: plans.currency, priceCents: plans.priceCents })
        .from(plans)
        .where(eq(plans.stripePriceId, priceId))
        .limit(1)
    : [];
  const wanted = plan ? repgetCouponFor(plan) : null;
  const others = live.discounts.filter((discount) => !OURS.includes(couponIdOf(discount)));
  const current = live.discounts.filter((discount) => OURS.includes(couponIdOf(discount))).map(couponIdOf);
  const right = wanted ? current.length === 1 && current[0] === wanted : current.length === 0;
  if (!right) {
    const kept = others.map((discount) => ({ discount: typeof discount === "string" ? discount : discount.id }));
    const discounts = [...kept, ...(wanted ? [{ coupon: wanted }] : [])];
    try {
      await stripe.subscriptions.update(live.id, { discounts: discounts.length > 0 ? discounts : "" });
    } catch (error) {
      if (!isCouponRefusal(error)) throw error;
      await alertStaffAboutOffer(
        error instanceof Error ? error.message : String(error),
        `A plan changed outside Billing, and the new plan's coupon was refused. Stripe subscription: ${live.id}. Until this is fixed, its invoices are at full price.`,
      );
      return;
    }
  }
  if (!wanted) return;
  const latest = live.latest_invoice;
  const charged =
    paidInFull ??
    (!right && live.status !== "trialing" && latest && typeof latest !== "string" && latest.subtotal > 0 && !(latest.total_discount_amounts ?? []).some((row) => row.amount > 0)
      ? latest.id
      : null);
  if (!charged) return;
  await alertStaffAboutOffer(
    "An invoice was paid without the launch price.",
    `Stripe subscription: ${live.id}, invoice: ${charged}. Its plan was changed outside Billing. The discount is on for the payments to come, but this invoice was charged without it, so the customer may be owed a refund of the difference. This is not corrected automatically.`,
  );
}
