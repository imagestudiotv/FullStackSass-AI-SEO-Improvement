import { eq, ne } from "drizzle-orm";

import { cancellationOps } from "@/lib/billing/checkout-providers";
import {
  syncProviderSubscription,
  type SubscriptionSnapshot,
  type SyncResult,
} from "@/lib/billing/subscription-sync";
import { db } from "@/lib/db";
import type { Executor } from "@/lib/db/types";
import { organization, payments, plans } from "@/lib/db/schema";
import { PayPalError } from "@/lib/paypal/client";
import {
  getSubscription,
  mapStatus,
  parseCustomId,
  type PayPalSubscription,
} from "@/lib/paypal/subscriptions";

/**
 * What a verified PayPal event does. Shared by the webhook route, the
 * webhook-recovery job and the in-app PayPal cancel.
 *
 * As with Stripe, the event body only says WHICH subscription changed: the
 * subscription is read from PayPal under a per-subscription lock
 * (subscription-sync.ts), so a late event can never write an older state.
 */

export type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    billing_agreement_id?: string;
    amount?: { total?: string; currency?: string };
  };
};

/**
 * The workspace custom_id names, if it still exists. custom_id is fixed at
 * creation and PayPal sends it for as long as the subscription lives,
 * including after the workspace was deleted.
 */
async function existingOrganization(
  reader: Pick<Executor, "select">,
  id: string | null,
): Promise<string | null> {
  if (!id) return null;
  const [row] = await reader
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1);
  return row?.id ?? null;
}

async function snapshotOf(
  reader: Pick<Executor, "select">,
  live: PayPalSubscription,
): Promise<SubscriptionSnapshot> {
  const custom = parseCustomId(live.custom_id);

  let planId: string | null = null;
  if (live.plan_id) {
    const [plan] = await reader
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.paypalPlanId, live.plan_id))
      .limit(1);
    planId = plan?.id ?? null;
  }

  /*
    PayPal has no "current period start" field. The last payment is the start
    of the period it paid for; before the first payment, the start time. The
    monthly allowance windows are anchored on this (entitlement-period.ts):
    without it, an annual PayPal plan's start was guessed as one MONTH before
    its next billing date.
  */
  const start = live.billing_info?.last_payment?.time ?? live.start_time ?? null;
  const nextBilling = live.billing_info?.next_billing_time ?? null;

  return {
    organizationId: await existingOrganization(reader, custom.organizationId),
    claimedOrganizationId: custom.organizationId,
    claimedWebsiteId: custom.websiteId,
    checkoutId: custom.checkoutId,
    values: {
      status: mapStatus(live.status),
      ...(start ? { currentPeriodStart: new Date(start) } : {}),
      currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
      // Keep the existing plan if this PayPal plan is not one of ours.
      ...(planId ? { planId } : {}),
    },
  };
}

/** Records a PayPal subscription as PayPal has it NOW. */
export async function syncPayPalSubscription(subscriptionId: string): Promise<SyncResult> {
  const result = await syncProviderSubscription(
    db,
    {
      provider: "paypal",
      providerSubscriptionId: subscriptionId,
      load: async (tx) => {
        try {
          return await snapshotOf(tx, await getSubscription(subscriptionId));
        } catch (error) {
          if (error instanceof PayPalError && error.kind === "not_found") return null;
          throw error;
        }
      },
    },
    cancellationOps,
  );

  if (!["updated", "attached", "replaced"].includes(result.outcome)) {
    console.warn(
      `[paypal-webhook] subscription ${subscriptionId}: ${result.outcome}${
        result.cancellationOwed ? (result.cancelled ? " (cancelled)" : " (cancellation owed)") : ""
      }`,
    );
  }
  return result;
}

/** Handles one verified PayPal event. Throws when it should be retried. */
export async function processPayPalEvent(event: PayPalEvent): Promise<void> {
  const resource = event.resource ?? {};

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      if (!resource.id) return;
      await syncPayPalSubscription(resource.id);
      return;
    }

    case "PAYMENT.SALE.COMPLETED":
    case "PAYMENT.SALE.DENIED": {
      const billingId = resource.billing_agreement_id ?? null;
      if (!billingId) return;

      const synced = await syncPayPalSubscription(billingId);
      if (!synced.organizationId) {
        // A workspace that no longer exists: nothing to record against, and
        // a retry cannot bring it back.
        console.error(
          `[paypal-webhook] ${event.event_type} for ${billingId} has no workspace - payment not recorded`,
        );
        return;
      }

      if (resource.id) {
        // PayPal reports decimal strings ("29.00"); stored in minor units.
        const total = Number.parseFloat(resource.amount?.total ?? "0");
        const status = event.event_type === "PAYMENT.SALE.COMPLETED" ? "paid" : "failed";
        await db
          .insert(payments)
          .values({
            organizationId: synced.organizationId,
            provider: "paypal",
            externalId: resource.id,
            amountCents: Number.isFinite(total) ? Math.round(total * 100) : 0,
            currency: (resource.amount?.currency ?? "EUR").toLowerCase(),
            status,
            description: "Subscription payment",
            // The subscription this sale belongs to (issue 6).
            providerSubscriptionId: billingId,
            subscriptionId: synced.subscriptionRowId,
          })
          .onConflictDoUpdate({
            target: [payments.provider, payments.externalId],
            set: {
              status,
              providerSubscriptionId: billingId,
              ...(synced.subscriptionRowId ? { subscriptionId: synced.subscriptionRowId } : {}),
              updatedAt: new Date(),
            },
            // A refunded payment is never flipped back to paid by a replay.
            setWhere: ne(payments.status, "refunded"),
          });
      }
      return;
    }

    default:
      return;
  }
}
