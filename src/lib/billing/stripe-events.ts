import { eq, ne } from "drizzle-orm";
import type Stripe from "stripe";

import { fulfilAddonPurchase } from "@/lib/addons/fulfil";
import { cancellationOps } from "@/lib/billing/checkout-providers";
import {
  syncProviderSubscription,
  type SubscriptionSnapshot,
  type SyncResult,
} from "@/lib/billing/subscription-sync";
import { db } from "@/lib/db";
import type { Executor } from "@/lib/db/types";
import { billingCustomers, organization, payments, plans, subscriptions } from "@/lib/db/schema";
import { convertReferral } from "@/lib/referrals/core";
import { stripe } from "@/lib/stripe/client";

/**
 * What a verified Stripe event does. Shared by the webhook route and the
 * webhook-recovery job, which replays a stored event whose worker died.
 *
 * Every subscription change goes through syncProviderSubscription, which
 * reads the subscription from Stripe under a per-subscription lock: the
 * event body says only WHICH subscription changed, never what it is now.
 */

function periodFor(subscription: Stripe.Subscription) {
  /**
   * current_period_start/end were REMOVED from the Subscription object and now
   * live on each subscription ITEM. Reading them from the root yields
   * undefined, which becomes an Invalid Date in Postgres.
   */
  const item = subscription.items.data[0];
  return {
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
  };
}

type Reader = Pick<Executor, "select">;

async function planIdForSubscription(
  reader: Reader,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  const [plan] = await reader
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.stripePriceId, priceId))
    .limit(1);
  return plan?.id ?? null;
}

/**
 * Finds the organization a subscription belongs to.
 *
 * Metadata is only trusted while that workspace still EXISTS: Stripe keeps
 * the id it was given at checkout forever. A deleted workspace falls through
 * to the customer mapping, and when that finds nothing the subscription is
 * reported as having no owner.
 */
async function organizationIdFor(
  reader: Reader,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.organizationId;
  if (fromMetadata) {
    const [exists] = await reader
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, fromMetadata))
      .limit(1);
    if (exists) return fromMetadata;
    console.error(
      `[stripe-webhook] subscription ${subscription.id} names deleted organization ${fromMetadata}`,
    );
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [owner] = await reader
    .select({ organizationId: billingCustomers.organizationId })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, customerId))
    .limit(1);
  if (owner) return owner.organizationId;

  const [row] = await reader
    .select({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.organizationId ?? null;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "resource_missing"
  );
}

/**
 * Records a Stripe subscription as Stripe has it NOW. See subscription-sync.ts
 * for the rules; this only turns Stripe's object into a snapshot.
 */
export async function syncStripeSubscription(
  subscriptionId: string,
  stripeSessionId: string | null = null,
): Promise<SyncResult> {
  const result = await syncProviderSubscription(
    db,
    {
      provider: "stripe",
      providerSubscriptionId: subscriptionId,
      load: async (tx): Promise<SubscriptionSnapshot | null> => {
        let subscription: Stripe.Subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const planId = await planIdForSubscription(tx, subscription);
        return {
          organizationId: await organizationIdFor(tx, subscription),
          claimedOrganizationId: subscription.metadata?.organizationId ?? null,
          claimedWebsiteId: subscription.metadata?.websiteId ?? null,
          checkoutId: subscription.metadata?.checkoutId ?? null,
          stripeSessionId,
          values: {
            status: subscription.status,
            ...periodFor(subscription),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            stripeCustomerId: customerId,
            // Keep the existing plan if the price is not one of ours.
            ...(planId ? { planId } : {}),
          },
        };
      },
    },
    cancellationOps,
  );

  if (!["updated", "attached", "replaced"].includes(result.outcome)) {
    // Logged rather than thrown: none of these is fixed by a retry.
    console.warn(
      `[stripe-webhook] subscription ${subscriptionId}: ${result.outcome}${
        result.cancellationOwed ? (result.cancelled ? " (cancelled)" : " (cancellation owed)") : ""
      }`,
    );
  }
  return result;
}

/** Where the subscription id lives on an invoice, old and new API shapes. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const line = invoice.lines?.data?.[0];
  const fromParent = invoice.parent?.subscription_details?.subscription;
  return (
    (typeof fromParent === "string" ? fromParent : (fromParent?.id ?? null)) ??
    (typeof line?.subscription === "string"
      ? line.subscription
      : (line?.subscription?.id ?? null))
  );
}

/**
 * Handles one verified Stripe event. Throws when it should be retried.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      /**
       * One-off payments are add-ons. This is the ONLY place they are
       * recorded — the success redirect cannot be trusted.
       */
      if (session.mode === "payment") {
        const organizationId = session.metadata?.organizationId;
        const addonId = session.metadata?.addonId;
        if (!organizationId || !addonId) {
          console.error(
            `[stripe-webhook] payment session ${session.id} has no addon metadata`,
          );
          return;
        }
        await fulfilAddonPurchase({
          organizationId,
          addonId,
          stripeSessionId: session.id,
          amountTotal: session.amount_total,
          currency: session.currency,
        });
        return;
      }

      if (session.mode !== "subscription" || !session.subscription) return;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      await syncStripeSubscription(subscriptionId, session.id);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      /*
        Only the id is taken from the event. Its body is a snapshot from when
        the event was created, and a delayed "updated" carrying an old active
        snapshot after a "deleted" used to bring a cancelled plan back.
      */
      await syncStripeSubscription(event.data.object.id);
      return;
    }

    case "invoice.payment_failed":
    case "invoice.paid": {
      const invoice = event.data.object;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        console.error(
          `[stripe-webhook] ${event.type} ${invoice.id} carries no subscription id`,
        );
        return;
      }

      const synced = await syncStripeSubscription(subscriptionId);
      const orgId = synced.organizationId;
      if (!orgId) {
        console.error(
          `[stripe-webhook] ${event.type} ${invoice.id} has no workspace - payment not recorded`,
        );
        return;
      }

      const status = event.type === "invoice.paid" ? "paid" : "failed";
      if (invoice.id) {
        await db
          .insert(payments)
          .values({
            organizationId: orgId,
            provider: "stripe",
            externalId: invoice.id,
            amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
            currency: invoice.currency ?? "eur",
            status,
            invoiceUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
            description: invoice.lines?.data?.[0]?.description ?? null,
            paidAt: invoice.status_transitions?.paid_at
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : new Date(),
            /*
              The subscription this invoice belongs to, as Stripe says. A
              refund that also cancels uses THIS, never "the newest
              subscription in the workspace".
            */
            providerSubscriptionId: subscriptionId,
            subscriptionId: synced.subscriptionRowId,
          })
          // A retry updates rather than duplicating; the unique index on
          // (provider, external_id) is the guard. A REFUNDED payment stays
          // refunded: a replayed invoice.paid flipping it back to "paid"
          // would let it be refunded a second time.
          .onConflictDoUpdate({
            target: [payments.provider, payments.externalId],
            set: {
              status,
              providerSubscriptionId: subscriptionId,
              ...(synced.subscriptionRowId ? { subscriptionId: synced.subscriptionRowId } : {}),
              updatedAt: new Date(),
            },
            setWhere: ne(payments.status, "refunded"),
          });
      }

      /**
       * A referral converts on a PAID invoice for MONEY, never on an active
       * subscription. A trial start is a paid invoice for zero, and so is a
       * 100%-off period: convertReferral ignores both. It commits the reward
       * and its credit together and is idempotent; a failure is thrown so
       * this event is retried rather than the reward being lost.
       */
      if (event.type === "invoice.paid") {
        await convertReferral(orgId, invoice.amount_paid ?? 0);
      }
      return;
    }

    default:
      // Unhandled types are recorded and acknowledged.
      return;
  }
}
