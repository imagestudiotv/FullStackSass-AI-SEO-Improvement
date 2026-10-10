import { and, eq, inArray, ne } from "drizzle-orm";

import { cancellationOps } from "@/lib/billing/checkout-providers";
import { reportFirstPayment } from "@/lib/conversions/conversions";
import {
  syncProviderSubscription,
  type SubscriptionSnapshot,
  type SyncResult,
} from "@/lib/billing/subscription-sync";
import { db } from "@/lib/db";
import type { Executor } from "@/lib/db/types";
import { billingCheckouts, organization, payments, plans, subscriptions } from "@/lib/db/schema";
import { PayPalError } from "@/lib/paypal/client";
import { convertReferral, reverseReferralReward } from "@/lib/referrals/core";
import {
  getSubscription,
  mapStatus,
  parseCustomId,
  parseExactCustomId,
  type PayPalSubscription,
} from "@/lib/paypal/subscriptions";

/**
 * What a verified PayPal event does. Shared by the webhook route, the
 * webhook-recovery job and the in-app PayPal cancel; the sync also by the
 * PayPal return and the checkout reconciler (checkouts.ts), so a missed
 * webhook does not leave a paying customer without a plan.
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
    /** On a refund or reversal: the sale it returns money from. */
    sale_id?: string;
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

/**
 * Whether a PayPal subscription is one of OURS, and the ids it carries.
 *
 * The PayPal business account can hold subscriptions other integrations made
 * - another site, PayPal's own buttons, a plugin - each with its own
 * custom_id ("ORDER-123"), and their events can reach this webhook. Reading
 * that as a workspace id made the sync take the workspace for deleted and
 * cancel somebody else's subscription. So a subscription is ours only when:
 *  - its custom_id has exactly the shape our checkout writes and names a
 *    PayPal checkout of ours, in that workspace;
 *  - its plan is one of our PayPal plans (the older custom_id forms are
 *    read only then);
 *  - or we created or recorded it already (a checkout or subscription row
 *    holds its id).
 * Anything else is null: left alone, never recorded and never cancelled.
 */
async function ownIds(
  reader: Pick<Executor, "select">,
  subscriptionId: string,
  live: PayPalSubscription,
  ourPlan: boolean,
): Promise<ReturnType<typeof parseCustomId> | null> {
  const exact = parseExactCustomId(live.custom_id);
  if (exact) {
    const [checkout] = await reader
      .select({ id: billingCheckouts.id })
      .from(billingCheckouts)
      .where(
        and(
          eq(billingCheckouts.id, exact.checkoutId),
          eq(billingCheckouts.provider, "paypal"),
          eq(billingCheckouts.organizationId, exact.organizationId),
        ),
      )
      .limit(1);
    if (checkout) return exact;
  }
  if (ourPlan || (await createdOrRecorded(reader, subscriptionId))) {
    return parseCustomId(live.custom_id);
  }
  return null;
}

async function createdOrRecorded(reader: Pick<Executor, "select">, subscriptionId: string): Promise<boolean> {
  const [created] = await reader
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.provider, "paypal"),
        eq(billingCheckouts.providerSubscriptionId, subscriptionId),
      ),
    )
    .limit(1);
  if (created) return true;
  const [recorded] = await reader
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);
  return Boolean(recorded);
}

async function snapshotOf(
  reader: Pick<Executor, "select">,
  subscriptionId: string,
  live: PayPalSubscription,
): Promise<SubscriptionSnapshot> {
  let planId: string | null = null;
  if (live.plan_id) {
    const [plan] = await reader
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.paypalPlanId, live.plan_id))
      .limit(1);
    planId = plan?.id ?? null;
  }

  const custom = await ownIds(reader, subscriptionId, live, planId !== null);
  const status = mapStatus(live.status, live.billing_info);
  if (!custom) {
    // Not ours: no workspace and none claimed, which the sync leaves alone.
    return {
      organizationId: null,
      claimedOrganizationId: null,
      claimedWebsiteId: null,
      checkoutId: null,
      values: { status },
    };
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
      status,
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
          return await snapshotOf(tx, subscriptionId, await getSubscription(subscriptionId));
        } catch (error) {
          if (error instanceof PayPalError && error.kind === "not_found") return null;
          throw error;
        }
      },
    },
    cancellationOps,
  );

  if (result.outcome === "ignored_no_owner") {
    console.warn(
      `[paypal-webhook] subscription ${subscriptionId} names no RepGet workspace (another integration on the PayPal account?) - left alone`,
    );
  } else if (!["updated", "attached", "replaced"].includes(result.outcome)) {
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
    /*
      RE-ACTIVATED and PAYMENT.FAILED change what mapStatus stores: a
      suspended subscription is "unpaid" (not entitled) until PayPal reports
      it active again, and a failed renewal is past_due while PayPal retries.
    */
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
      if (!resource.id) return;
      await syncPayPalSubscription(resource.id);
      return;
    }

    case "PAYMENT.SALE.COMPLETED":
    case "PAYMENT.SALE.DENIED": {
      const billingId = resource.billing_agreement_id ?? null;
      if (!billingId) return;

      const synced = await syncPayPalSubscription(billingId);
      // Not one of ours: logged by the sync, and nothing of ours to record.
      if (synced.outcome === "ignored_no_owner") return;
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

        /*
          The referral converts on PayPal money as on Stripe's. It used to be
          Stripe-only, so a referred customer paying by PayPal stayed
          "waiting" forever. Idempotent, and thrown on failure so the event
          is retried; nothing for a zero sale.
        */
        if (status === "paid") {
          await convertReferral(synced.organizationId, Number.isFinite(total) ? Math.round(total * 100) : 0);
          // The first real payment, to Google Analytics, as on Stripe's (lib/conversions/conversions.ts).
          await reportFirstPayment(db, {
            provider: "paypal",
            providerSubscriptionId: billingId,
            externalId: resource.id,
            amountCents: Number.isFinite(total) ? Math.round(total * 100) : 0,
            currency: resource.amount?.currency ?? "EUR",
          });
        }
      }
      return;
    }

    /*
      Money returned outside RepGet: a refund made in PayPal's dashboard, or a
      reversal (chargeback). There is no PayPal refund in the admin, so these
      are the only way RepGet learns of it. The sale is marked refunded only
      when ALL of it went back - a partial refund leaves money paid - and a
      referral resting on it is then reversed (lib/referrals/core.ts decides,
      and does nothing while real money remains). Thrown on failure, so the
      event is retried. Needs these events enabled on the PayPal webhook.
    */
    case "PAYMENT.SALE.REFUNDED":
    case "PAYMENT.SALE.REVERSED": {
      const saleIds = [resource.sale_id, resource.id].filter((id): id is string => Boolean(id));
      if (saleIds.length === 0) return;
      const [sale] = await db
        .select({ id: payments.id, organizationId: payments.organizationId, amountCents: payments.amountCents })
        .from(payments)
        .where(and(eq(payments.provider, "paypal"), inArray(payments.externalId, saleIds)))
        .limit(1);
      if (!sale) {
        console.error(`[paypal-webhook] ${event.event_type} for an unknown sale - nothing recorded`);
        return;
      }
      const returned = Number.parseFloat(resource.amount?.total ?? "");
      const returnedCents = Number.isFinite(returned) ? Math.round(Math.abs(returned) * 100) : null;
      const full = event.event_type === "PAYMENT.SALE.REVERSED" || (returnedCents !== null && returnedCents >= sale.amountCents);
      if (!full) return;

      await db
        .update(payments)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(payments.id, sale.id));
      if (sale.organizationId) await reverseReferralReward(sale.organizationId);
      return;
    }

    default:
      return;
  }
}
