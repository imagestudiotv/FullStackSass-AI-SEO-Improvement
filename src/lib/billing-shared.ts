import type { plans } from "@/lib/db/schema";

/**
 * Billing types and pure helpers.
 *
 * Deliberately free of any database or Stripe import: this module is pulled
 * into the CLIENT bundle by the billing UI, and importing lib/billing.ts there
 * would drag the Postgres driver into the browser build (which fails outright).
 * Only `import type` from the schema, which is erased at compile time.
 */

export type PlanRow = typeof plans.$inferSelect;

export type CurrentSubscription = {
  status: string;
  planId: string | null;
  planName: string | null;
  tier: string | null;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  /** "stripe" | "paypal". Decides where the customer manages billing. */
  provider: string;
};

/** Statuses that grant access. Mirrors ENTITLED_STATUSES in lib/usage.ts. */
const ENTITLED = new Set(["active", "trialing", "past_due"]);

export function isEntitled(status: string | null | undefined): boolean {
  return status ? ENTITLED.has(status) : false;
}

/**
 * Formats minor units in the plan's own currency.
 *
 * Intl handles the symbol, placement and separators per locale, so a EUR price
 * does not have to be hand-formatted with an assumed symbol position.
 */
/**
 * A payment record that moved no money: a paid invoice for zero. Stripe issues
 * one at checkout for a free trial (the plan's first charge comes when the
 * trial ends) and for a fully discounted period. Shown as "No charge", never
 * as a payment, and never offered for refund - there is nothing to return,
 * and the refund action refuses a zero amount anyway.
 *
 * Not labelled "trial": a 100% coupon produces the same record, and the
 * invoice description is in the customer's language, so nothing reliable
 * tells the two apart.
 */
export function isNoCharge(payment: { amountCents: number; status: string }): boolean {
  return payment.status === "paid" && payment.amountCents === 0;
}

export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * One website and the plan paying for it.
 *
 * Declared here rather than in lib/billing because the billing page is a
 * client component: importing from there would drag the Postgres driver into
 * the browser bundle.
 */
export type WebsiteSubscription = CurrentSubscription & {
  websiteId: string;
  domain: string;
};
