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
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
