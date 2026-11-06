import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { adminEmails } from "@/lib/admin/guard";
import { REPGET_CODE, REPGET_COUPONS, repgetCouponFor } from "@/lib/billing/repget-offer";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { stripe } from "@/lib/stripe/client";

/**
 * The REPGET coupon after Checkout (lib/billing/repget-offer.ts).
 *
 * The coupon goes on at Checkout, and Stripe keeps it through a free period for the
 * first paid invoice (checked in Stripe's test mode, 2026-11-06). One case needs
 * help: each coupon is limited to its own plan's product, so a plan changed during
 * the free period would lose the discount, and a move to the same plan's annual
 * price would keep it, on a full annual payment. So the subscription carries
 * OFFER_KEY, and while it is on its free period its coupon follows its plan.
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
      `What to do: check the plan's coupon in Stripe (${Object.values(REPGET_COUPONS).join(", ")}).`,
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

/**
 * Keeps the coupon on a subscription matching its plan during the free period: the
 * new plan's coupon after a change, none on an annual plan. Safe to repeat, and asks
 * Stripe nothing unless the event's subscription carries the offer.
 */
export async function matchOfferToPlan(event: Pick<Stripe.Subscription, "id" | "metadata">): Promise<void> {
  if (!event.metadata?.[OFFER_KEY]) return;
  const live = await stripe.subscriptions.retrieve(event.id, { expand: ["discounts"] });
  if (live.status !== "trialing") return;
  const priceId = live.items.data[0]?.price.id;
  const [plan] = priceId
    ? await db
        .select({ tier: plans.tier, interval: plans.interval, currency: plans.currency, priceCents: plans.priceCents })
        .from(plans)
        .where(eq(plans.stripePriceId, priceId))
        .limit(1)
    : [];
  const wanted = plan ? repgetCouponFor(plan) : null;
  const ours = Object.values(REPGET_COUPONS) as (string | null)[];
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
