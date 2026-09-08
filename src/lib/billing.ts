import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { payments, plans, subscriptions } from "@/lib/db/schema";
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

/**
 * Deduplicated per request. The app layout reads it for the chat widget and
 * getOnboardingState reads it again on the same render, so without this the
 * join below ran twice on every signed-in page.
 */
export const getSubscription = cache(async function getSubscription(
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
      provider: subscriptions.provider,
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
    provider: row.provider,
  };
});

export type PaymentRow = {
  id: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  description: string | null;
  paidAt: Date;
};

/**
 * Subscription payments for an organization, newest first.
 *
 * Recorded by the webhooks as money moves, so this is a record of what
 * actually happened rather than a reconstruction. Stripe's hosted invoice is
 * linked when the event carried one; PayPal sends no such URL, so those rows
 * show the amount and date alone — which is still more than a PayPal
 * subscriber had before, which was nothing.
 */
export async function listPayments(orgId: string): Promise<PaymentRow[]> {
  return db
    .select({
      id: payments.id,
      provider: payments.provider,
      amountCents: payments.amountCents,
      currency: payments.currency,
      status: payments.status,
      invoiceUrl: payments.invoiceUrl,
      description: payments.description,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .where(eq(payments.organizationId, orgId))
    .orderBy(desc(payments.paidAt))
    // A year of monthly invoices plus retries; more than this belongs in the
    // processor's own dashboard rather than a panel on a billing page.
    .limit(24);
}
