import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";

import { cancellationOps } from "@/lib/billing/checkout-providers";
import { addMonthsClamped } from "@/lib/billing/entitlement-period";
import { reportFirstPayment } from "@/lib/conversions/conversions";
import {
  syncProviderSubscription,
  type SubscriptionSnapshot,
  type SyncResult,
} from "@/lib/billing/subscription-sync";
import { db } from "@/lib/db";
import type { Executor } from "@/lib/db/types";
import { billingCheckouts, organization, payments, paypalPlanChanges, paypalPlanVersions, plans, subscriptions } from "@/lib/db/schema";
import { recordProviderRefund } from "@/lib/billing/refunds";
import { PayPalError, payPalMode } from "@/lib/paypal/client";
import { fromPayPalAmount } from "@/lib/paypal/payments";
import { convertReferral, reverseReferralReward } from "@/lib/referrals/core";
import {
  getSubscription,
  inFreeDays,
  mapStatus,
  movedMoney,
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
    /** v1 (sales): total + currency. v2 (captures, refunds): value + currency_code. */
    amount?: { total?: string; currency?: string; value?: string; currency_code?: string };
    /** On a refund or reversal: the sale it returns money from. */
    sale_id?: string;
    /** v1 refund: our payment_refunds id, sent with the refund (lib/paypal/payments.ts). */
    invoice_number?: string;
    /** v1 refund state ("completed", "pending", "failed"). */
    state?: string;
    /** v2 refund or capture: the id we put on it (our refund row, or "<kind>:<id>" on a capture). */
    invoice_id?: string;
    links?: { href?: string; rel?: string }[];
    /** An Orders v2 order (CHECKOUT.ORDER.*): our custom_id is on its purchase unit. */
    purchase_units?: { custom_id?: string }[];
    /** A payout item (PAYMENT.PAYOUTS-ITEM.*): partners paid through PayPal. */
    payout_item_id?: string;
  };
};

/** The capture a v2 refund returns money from: its "up" link names it. */
function refundedCaptureId(resource: NonNullable<PayPalEvent["resource"]>): string | null {
  const up = resource.links?.find((link) => link.rel === "up")?.href ?? "";
  const match = /\/v2\/payments\/captures\/([^/?#]+)/.exec(up);
  return match ? decodeURIComponent(match[1]) : null;
}

/** A refund status PayPal reports, in payment_refunds' words. */
function settledOfRefund(status: string | undefined): "completed" | "pending" | "failed" {
  const value = (status ?? "completed").toUpperCase();
  if (value === "PENDING") return "pending";
  if (value === "FAILED" || value === "CANCELLED") return "failed";
  return "completed";
}

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

/**
 * The day a cancelled PayPal subscription is paid up to: its last payment
 * plus one billing interval of its plan (or, for a plan that is not ours,
 * the end of the period we last recorded). Null when nothing was paid, or
 * when the last payment was refunded in full - then there is no paid time
 * left to keep. A free-articles plan's free cycle moved no money: cancelled
 * during its free days, it ends at once.
 */
async function paidThrough(
  reader: Pick<Executor, "select">,
  subscriptionId: string,
  live: PayPalSubscription,
  interval: string | null,
): Promise<Date | null> {
  const lastPaid = live.billing_info?.last_payment?.time;
  if (!lastPaid || !movedMoney(live.billing_info?.last_payment)) return null;
  const [latest] = await reader
    .select({ status: payments.status })
    .from(payments)
    .where(and(eq(payments.provider, "paypal"), eq(payments.providerSubscriptionId, subscriptionId)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  // "refunded" means ALL of it (lib/billing/refunds.ts): a partial refund keeps the paid time.
  if (latest?.status === "refunded") return null;
  if (interval === "month" || interval === "year") {
    return addMonthsClamped(new Date(lastPaid), interval === "year" ? 12 : 1);
  }
  const [recorded] = await reader
    .select({ currentPeriodEnd: subscriptions.currentPeriodEnd })
    .from(subscriptions)
    .where(eq(subscriptions.paypalSubscriptionId, subscriptionId))
    .limit(1);
  return recorded?.currentPeriodEnd ?? null;
}

/** The plan a downgrade to `planId` keeps until its date, if one is waiting for it. */
async function heldPlan(
  reader: Pick<Executor, "select">,
  subscriptionId: string,
  planId: string,
  live: PayPalSubscription,
  now: Date,
): Promise<string | null> {
  const [change] = await reader
    .select({ fromPlanId: paypalPlanChanges.fromPlanId, effectiveAt: paypalPlanChanges.effectiveAt })
    .from(paypalPlanChanges)
    .where(
      and(
        eq(paypalPlanChanges.paypalSubscriptionId, subscriptionId),
        eq(paypalPlanChanges.kind, "downgrade"),
        eq(paypalPlanChanges.toPlanId, planId),
        inArray(paypalPlanChanges.status, ["awaiting_approval", "completed"]),
      ),
    )
    .orderBy(desc(paypalPlanChanges.createdAt))
    .limit(1);
  if (!change) return null;
  const next = live.billing_info?.next_billing_time ? new Date(live.billing_info.next_billing_time) : null;
  const effective = change.effectiveAt ?? next;
  return effective && effective.getTime() > now.getTime() ? change.fromPlanId : null;
}

async function snapshotOf(
  reader: Pick<Executor, "select">,
  subscriptionId: string,
  live: PayPalSubscription,
  now: Date = new Date(),
): Promise<SubscriptionSnapshot> {
  let planId: string | null = null;
  let interval: string | null = null;
  let freeArticlesPlan = false;
  if (live.plan_id) {
    /*
      Any of a plan's PayPal plans: with or without the free articles first,
      and either again with the REPGET offer's intro cycle (review P5).
    */
    const [plan] = await reader
      .select({ id: plans.id, interval: plans.interval, paypalTrialPlanId: plans.paypalTrialPlanId, paypalTrialOfferPlanId: plans.paypalTrialOfferPlanId })
      .from(plans)
      .where(
        or(
          eq(plans.paypalPlanId, live.plan_id),
          eq(plans.paypalTrialPlanId, live.plan_id),
          eq(plans.paypalOfferPlanId, live.plan_id),
          eq(plans.paypalTrialOfferPlanId, live.plan_id),
        ),
      )
      .limit(1);
    if (plan) {
      planId = plan.id;
      interval = plan.interval;
      freeArticlesPlan = plan.paypalTrialPlanId === live.plan_id || plan.paypalTrialOfferPlanId === live.plan_id;
    } else {
      /*
        A PayPal plan the row no longer names (recreated since): its history
        (paypal_plan_versions, review P3) still maps it to the row the
        subscriber bought - and says whether it was the free-articles kind,
        so its free days stay "trialing" rather than full paid access. An id
        recorded under the other PayPal mode is not ours here.
      */
      const mode = payPalMode();
      const [old] = await reader
        .select({ planId: paypalPlanVersions.planId, kind: paypalPlanVersions.kind, interval: plans.interval })
        .from(paypalPlanVersions)
        .innerJoin(plans, eq(plans.id, paypalPlanVersions.planId))
        .where(
          and(
            eq(paypalPlanVersions.paypalPlanId, live.plan_id),
            mode ? or(isNull(paypalPlanVersions.environment), eq(paypalPlanVersions.environment, mode)) : isNull(paypalPlanVersions.environment),
          ),
        )
        .limit(1);
      planId = old?.planId ?? null;
      interval = old?.interval ?? null;
      freeArticlesPlan = old?.kind === "trial" || old?.kind === "trial_offer";
    }
  }

  const custom = await ownIds(reader, subscriptionId, live, planId !== null);
  /*
    A downgrade (lib/paypal/plan-changes.ts): PayPal may report the lower
    plan as soon as the buyer approves, but the paid plan stays until the
    next billing date, as by card. Held here, so every sync agrees.
  */
  if (planId && custom) planId = (await heldPlan(reader, subscriptionId, planId, live, now)) ?? planId;
  /*
    In its free days, a free-articles plan is "trialing", as a card trial is
    (2026-10-22): the free articles, the features that wait for the plan and
    the managed network's wait all read that status.
  */
  const status = freeArticlesPlan && inFreeDays(live, now) ? "trialing" : mapStatus(live.status, live.billing_info);
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
  const lastPayment = live.billing_info?.last_payment;
  const start = (movedMoney(lastPayment) ? lastPayment?.time : null) ?? live.start_time ?? null;
  const nextBilling = live.billing_info?.next_billing_time ?? null;

  /*
    Cancelled in PayPal: the customer keeps what they paid for (review M1,
    2026-10-20), as a card customer does - active, set to end, until the
    last payment's period is over; then canceled (the maintenance job reads
    it again on that day: endPayPalCancellations). It used to end that very
    day, paid time lost, and the paid-through date overwritten with null.
  */
  let ending: Pick<SubscriptionSnapshot["values"], "status" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "cancelAt"> = {
    status,
    currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
  };
  if (live.status === "CANCELLED") {
    const until = await paidThrough(reader, subscriptionId, live, interval);
    ending =
      until && until.getTime() > now.getTime()
        ? { status: "active", currentPeriodEnd: until, cancelAtPeriodEnd: true, cancelAt: until }
        : { status, currentPeriodEnd: until, cancelAtPeriodEnd: false, cancelAt: null };
  }

  return {
    organizationId: await existingOrganization(reader, custom.organizationId),
    claimedOrganizationId: custom.organizationId,
    claimedWebsiteId: custom.websiteId,
    checkoutId: custom.checkoutId,
    values: {
      ...ending,
      ...(start ? { currentPeriodStart: new Date(start) } : {}),
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
  } else if (result.outcome === "replaced_free_articles") {
    console.warn(
      `[paypal-webhook] subscription ${subscriptionId} started its website's plan in place of the free articles of ${result.replacedSubscriptionId}${
        result.replacedCancelled ? " (cancelled)" : " (cancellation owed)"
      }`,
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

/**
 * Ends the PayPal subscriptions cancelled in PayPal once the time they paid
 * for is over (review M1). PayPal sends nothing on that day - it reported
 * the cancellation weeks before - so each is read from PayPal again, and the
 * snapshot, finding its paid-through day passed, records it canceled. Run by
 * the maintenance job every few minutes; a PayPal error leaves one for the
 * next run.
 */
export async function endPayPalCancellations(now: Date = new Date(), limit = 25): Promise<number> {
  const due = await db
    .select({ id: subscriptions.paypalSubscriptionId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.provider, "paypal"),
        eq(subscriptions.cancelAtPeriodEnd, true),
        ne(subscriptions.status, "canceled"),
        isNotNull(subscriptions.paypalSubscriptionId),
        lte(subscriptions.currentPeriodEnd, now),
      ),
    )
    .limit(limit);
  let ended = 0;
  for (const row of due) {
    try {
      await syncPayPalSubscription(row.id!);
      ended += 1;
    } catch (error) {
      console.error(`[paypal] could not end the cancelled subscription ${row.id}; the next run tries again`, error);
    }
  }
  return ended;
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
      // An open plan change on it (review P1): approved, ended, or still waiting.
      const { onSubscriptionEvent } = await import("@/lib/paypal/plan-changes");
      await onSubscriptionEvent(resource.id, event.event_type);
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
            // A v1 sale: refunded at /v1/payments/sale (lib/paypal/payments.ts).
            providerObject: "paypal_sale",
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
          /*
            The cash partner program (review P7): the commission this sale may
            earn, recorded as durable work in this same attempt (thrown on
            failure, so the event is retried). Imported on demand, as on
            Stripe's side: billing does not depend on the partner module graph.
          */
          const { recordPartnerPayPalWork } = await import("@/lib/partners/presentation/webhooks");
          await recordPartnerPayPalWork({ id: event.id, eventType: event.event_type, saleId: resource.id });
          await convertReferral(synced.organizationId, Number.isFinite(total) ? Math.round(total * 100) : 0);
          // The first real payment, to Google Analytics, as on Stripe's (lib/conversions/conversions.ts).
          await reportFirstPayment(db, {
            provider: "paypal",
            providerSubscriptionId: billingId,
            externalId: resource.id,
            amountCents: Number.isFinite(total) ? Math.round(total * 100) : 0,
            currency: resource.amount?.currency ?? "EUR",
          });
          // "Welcome to your plan" on the first payment for money, as on Stripe's (stripe-events.ts).
          await import("@/lib/email/lifecycle-triggers")
            .then(({ emailFirstPayment }) =>
              emailFirstPayment({
                provider: "paypal",
                providerSubscriptionId: billingId,
                amountCents: Number.isFinite(total) ? Math.round(total * 100) : 0,
              }),
            )
            .catch((error) => console.error(`[paypal-webhook] plan-started email for ${billingId} could not run`, error));
        }
      }
      return;
    }

    /*
      Money returned: a refund made in RepGet's admin (lib/billing/refunds.ts)
      or in PayPal's dashboard, or a reversal (chargeback). Each is one
      payment_refunds row, matched to our own when we made it, so a partial
      refund is recorded too - it used to be dropped, leaving no trace and
      the full amount still shown as kept. The referral resting on the
      payment is reversed once it is refunded IN FULL (lib/referrals/core.ts
      decides, and does nothing while real money remains). Thrown on
      failure, so the event is retried. Needs these events on the webhook.

      v1 events carry the sale; v2 (Orders) the capture, named by the refund's
      "up" link. A reversal without its own amount returns the whole payment.
    */
    case "PAYMENT.SALE.REFUNDED":
    case "PAYMENT.SALE.REVERSED":
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED": {
      const v2 = event.event_type.startsWith("PAYMENT.CAPTURE.");
      const reversal = event.event_type.endsWith(".REVERSED");
      const paymentIds = v2
        ? [refundedCaptureId(resource)].filter((id): id is string => Boolean(id))
        : [resource.sale_id, resource.id].filter((id): id is string => Boolean(id));
      if (paymentIds.length === 0 || !resource.id) return;

      const [paid] = await db
        .select({ amountCents: payments.amountCents, refundedCents: payments.refundedCents })
        .from(payments)
        .where(and(eq(payments.provider, "paypal"), inArray(payments.externalId, paymentIds)))
        .limit(1);
      if (!paid) {
        console.error(`[paypal-webhook] ${event.event_type} for an unknown payment - nothing recorded`);
        return;
      }
      const stated = fromPayPalAmount(v2 ? resource.amount?.value : resource.amount?.total);
      // A reversal that states no amount takes back all that is left.
      const amountCents = stated ?? (reversal ? Math.max(paid.amountCents - paid.refundedCents, 0) : 0);
      const recorded = await recordProviderRefund(db, {
        provider: "paypal",
        paymentExternalIds: paymentIds,
        providerRefundId: resource.id,
        amountCents,
        currency: (v2 ? resource.amount?.currency_code : resource.amount?.currency) ?? "EUR",
        settled: settledOfRefund(v2 ? resource.status : resource.state),
        ourRefundId: v2 ? resource.custom_id : resource.invoice_number,
        reason: reversal ? "Reversed by PayPal (dispute or chargeback)" : "Refunded in PayPal",
      });
      if (recorded.kind === "recorded" && recorded.becameFull) await reverseReferralReward(recorded.organizationId);
      // A subscription sale's commission follows the money back (review P7); one-off captures earn none.
      if (!v2 && recorded.kind === "recorded") {
        const { recordPartnerPayPalWork } = await import("@/lib/partners/presentation/webhooks");
        await recordPartnerPayPalWork({ id: event.id, eventType: event.event_type, saleId: paymentIds[0] });
      }
      return;
    }

    /*
      One-off purchases (lib/paypal/orders.ts, reviews P4 and P8). The event
      only says WHICH of our orders moved (custom_id "<purpose>:<row id>"):
      the order is read from PayPal and captured or granted from what PayPal
      says now, exactly as the return page does, so a buyer who closed the
      tab after approving still gets what they paid for, and a repeated or
      early event changes nothing. Another integration's order is left alone.
    */
    /*
      A PayPal payout to a PARTNER (partners paid through PayPal,
      lib/partners/application/use-cases/paypal-payouts.ts): recorded as the
      partner program's durable work in this attempt; the item is read from
      PayPal again there. A payout someone else made from this account is
      found to be nobody's and left alone.
    */
    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
    case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED":
    case "PAYMENT.PAYOUTS-ITEM.HELD":
    case "PAYMENT.PAYOUTS-ITEM.FAILED":
    case "PAYMENT.PAYOUTS-ITEM.RETURNED":
    case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
    case "PAYMENT.PAYOUTS-ITEM.CANCELED":
    case "PAYMENT.PAYOUTS-ITEM.DENIED":
    case "PAYMENT.PAYOUTS-ITEM.REFUNDED": {
      const itemId = resource.payout_item_id;
      if (!itemId) return;
      const { recordPartnerPayPalWork } = await import("@/lib/partners/presentation/webhooks");
      await recordPartnerPayPalWork({ id: event.id, eventType: event.event_type, saleId: itemId, kind: "paypal_payout_item" });
      return;
    }

    case "CHECKOUT.ORDER.APPROVED":
    case "CHECKOUT.ORDER.COMPLETED":
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.CAPTURE.PENDING":
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED": {
      const customId = event.event_type.startsWith("CHECKOUT.ORDER.")
        ? resource.purchase_units?.[0]?.custom_id
        : resource.custom_id;
      const { settleFromWebhook } = await import("@/lib/paypal/order-fulfilment");
      const settled = await settleFromWebhook(customId);
      // A PayPal answer missing now: thrown, so the event is retried.
      if (settled?.kind === "unknown") throw new Error(`[paypal-webhook] ${event.event_type}: ${settled.reason}`);
      return;
    }

    default:
      return;
  }
}
