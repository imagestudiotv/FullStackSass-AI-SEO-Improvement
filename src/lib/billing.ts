import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  billingCustomers,
  payments,
  plans,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import type { CurrentSubscription, PlanRow, WebsiteSubscription} from "@/lib/billing-shared";

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
 * Every website in a workspace with the plan paying for it.
 *
 * Each website is billed separately, so "the subscription" is no longer a
 * single thing: a customer with three sites has three plans, three renewal
 * dates and three invoices. Websites with no subscription are included with a
 * null plan — an unpaid site is the case the billing page most needs to show,
 * since it is the one that cannot generate anything.
 */
export async function listWebsiteSubscriptions(
  orgId: string,
): Promise<WebsiteSubscription[]> {
  const [rows, [customer]] = await Promise.all([
    db
      .select({
        websiteId: websites.id,
        domain: websites.domain,
        status: subscriptions.status,
        planId: subscriptions.planId,
        planName: plans.name,
        tier: plans.tier,
        interval: plans.interval,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        provider: subscriptions.provider,
      })
      .from(websites)
      // Left join: a website with no plan still belongs on this page.
      .leftJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(websites.organizationId, orgId))
      .orderBy(asc(websites.createdAt)),
    /*
      One customer for the whole workspace, not one per site: Stripe's
      customer is the payer, and the portal it opens shows every subscription
      they hold. Read once here rather than joined onto each row.
    */
    db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, orgId))
      .limit(1),
  ]);

  return rows.map((row) => ({
    websiteId: row.websiteId,
    domain: row.domain,
    /** No subscription row reads as inactive, which is what it means. */
    status: row.status ?? "inactive",
    planId: row.planId,
    planName: row.planName,
    tier: row.tier,
    interval: row.interval,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
    stripeCustomerId: customer?.stripeCustomerId ?? null,
    // Whether the Stripe portal can be opened for this workspace.
    hasCustomer: Boolean(customer?.stripeCustomerId),
    provider: row.provider ?? "stripe",
  }));
}

/**
 * Deduplicated per request. The app layout reads it for the chat widget and
 * getOnboardingState reads it again on the same render, so without this the
 * join below ran twice on every signed-in page.
 */
export const getSubscription = cache(async function getSubscription(
  orgId: string,
): Promise<CurrentSubscription | null> {
  const [[row], [customer]] = await Promise.all([
    db
      .select({
        status: subscriptions.status,
        planId: subscriptions.planId,
        planName: plans.name,
        tier: plans.tier,
        interval: plans.interval,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        provider: subscriptions.provider,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.organizationId, orgId))
      /*
        A workspace can have several subscriptions — one per website — and
        this returns ONE, so which one matters. A row carrying a plan comes
        first, then the newest: an unpaid or cancelled site must never be the
        row that decides whether the whole workspace is entitled.
      */
      .orderBy(desc(subscriptions.planId), desc(subscriptions.createdAt))
      .limit(1),
    /*
      The Stripe customer is org-wide and lives in its own table, so it exists
      as soon as someone reaches checkout — before any subscription row does.
      Read separately rather than joined: there may be no subscription at all,
      and "can this person open the billing portal" is a different question
      from "what are they paying for".
    */
    db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, orgId))
      .limit(1),
  ]);

  if (!row) return null;

  return {
    status: row.status,
    planId: row.planId,
    planName: row.planName,
    tier: row.tier,
    interval: row.interval,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    hasCustomer: Boolean(customer?.stripeCustomerId),
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
