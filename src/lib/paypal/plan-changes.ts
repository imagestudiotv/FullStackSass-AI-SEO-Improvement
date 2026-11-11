import "server-only";

import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import { adminEmails } from "@/lib/admin/guard";
import { syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { refundProviderOps } from "@/lib/billing/refund-providers";
import { executeRefund, reserveRefund, type RefundProviderOps } from "@/lib/billing/refunds";
import { REPGET_CODE, repgetFirstPaymentCents } from "@/lib/billing/repget-offer";
import { db as appDb } from "@/lib/db";
import { billingCheckouts, payments, paypalOrders, paypalPlanChanges, plans, subscriptions } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { PayPalError } from "@/lib/paypal/client";
import { startOrder, type Fulfilment, type OrderOps } from "@/lib/paypal/orders";
import { getSubscription, reviseSubscription, type PayPalSubscription } from "@/lib/paypal/subscriptions";

/**
 * Plan changes on a PayPal subscription (review P1; the owner's decision of
 * 2026-11-07: an upgrade charges the difference NOW).
 *
 * PayPal cannot prorate: a revised subscription is billed the new price from
 * its next billing date, and only once the buyer has approved the revision on
 * PayPal. So, as by card:
 *
 *  UPGRADE  1. The prorated difference for the rest of the period paid now, a
 *              one-off PayPal order (lib/paypal/orders.ts, purpose plan_upgrade).
 *           2. Only once that capture is COMPLETED, the revision is asked of
 *              PayPal and the buyer approves it (a second approval).
 *           3. When PayPal reports the subscription on the new plan, the sync
 *              records it and the new plan's allowances apply from then.
 *           Paid but never revised - not approved within 72 hours, refused by
 *           PayPal, or the subscription ended - the difference is refunded by
 *           itself and staff are told. If there is any sign the buyer DID
 *           approve (they came back through the success link, or PayPal sent
 *           BILLING.SUBSCRIPTION.UPDATED since), nothing is refunded by itself:
 *           a person looks (PayPal does not document when its subscription
 *           starts reporting the new plan).
 *  DOWNGRADE Nothing is charged. Revised (the buyer approves), and the paid
 *           plan stays until the next billing date (effective_at; paypal-events
 *           holds it), from which the lower price and allowances apply.
 *  Monthly <-> yearly through PayPal is refused: a revision cannot settle a
 *           different period's price fairly.
 *
 * A subscription on the REPGET launch price (2026-11-11) keeps it: the
 * difference is between the two launch prices, and the revision sets the new
 * plan's launch price on the subscription (PayPal does not carry an override
 * over to a revised plan). A plan the launch price does not cover is refused.
 *
 * Every step is idempotent and re-entered from the return page, the webhook
 * and the maintenance sweep alike (reconcilePlanChanges).
 */

export const APPROVAL_WINDOW_MS = 72 * 60 * 60_000;

export type PlanChangeOps = {
  getSubscription: (id: string) => Promise<PayPalSubscription>;
  reviseSubscription: typeof reviseSubscription;
  /** Records PayPal's subscription after a change; the webhook does the same. */
  sync: (paypalSubscriptionId: string) => Promise<unknown>;
  refunds: RefundProviderOps;
  orders?: OrderOps;
  notifyStaff: (subject: string, text: string) => Promise<void>;
};

async function notifyStaff(subject: string, text: string): Promise<void> {
  const to = adminEmails();
  if (to.length === 0) {
    console.warn(`[paypal-plan-change] ${subject}: ${text} (no ADMIN_EMAILS to tell)`);
    return;
  }
  try {
    const html = emailLayout({ heading: subject, preheader: text, body: emailText(escapeHtml(text)) });
    for (const address of to) await sendEmail({ to: address, subject, html, text });
  } catch (error) {
    console.error("[paypal-plan-change] staff notification failed", error);
  }
}

export const planChangeOps: PlanChangeOps = {
  getSubscription,
  reviseSubscription,
  sync: syncPayPalSubscription,
  refunds: refundProviderOps,
  notifyStaff,
};

type Options = { database?: Database; ops?: PlanChangeOps; now?: Date; baseUrl?: string };
type ChangeRow = typeof paypalPlanChanges.$inferSelect;

const OPEN = ["awaiting_payment", "awaiting_approval"] as const;

function baseUrlOf(options: Options): string {
  const url = options.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/$/, "");
}

export const planChangeReturnPath = (changeId: string, outcome: "success" | "cancelled") =>
  `/api/paypal/plan-change/return?change=${changeId}&outcome=${outcome}`;

/**
 * The difference for the rest of the current period, in cents: the higher
 * price minus the lower, for the share of the period still to run. Never
 * negative; nothing when the period is over or unknown.
 */
export function prorateDifference(input: {
  fromCents: number;
  toCents: number;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}): number {
  const length = input.periodEnd.getTime() - input.periodStart.getTime();
  if (!(length > 0) || input.toCents <= input.fromCents) return 0;
  const left = Math.min(Math.max(input.periodEnd.getTime() - input.now.getTime(), 0), length);
  return Math.round(((input.toCents - input.fromCents) * left) / length);
}

const dateOf = (value: Date) => value.toISOString().slice(0, 10);

/**
 * Whether this PayPal subscription was started on the REPGET launch price,
 * which it keeps on every payment and through a plan change: its checkout
 * carried the offer (lib/paypal/actions.ts).
 */
async function onLaunchPrice(database: Database, paypalSubscriptionId: string): Promise<boolean> {
  const [row] = await database
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.provider, "paypal"),
        eq(billingCheckouts.providerSubscriptionId, paypalSubscriptionId),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type StartPlanChangeResult = { kind: "redirect"; url: string } | { kind: "error"; error: string };

/**
 * Starts (or resumes) a change of plan for one PayPal subscription. The
 * caller has checked the workspace owns it and the target is a PayPal plan.
 */
export async function startPlanChange(
  input: { organizationId: string; subscriptionId: string; toPlanId: string; userId?: string | null },
  options: Options = {},
): Promise<StartPlanChangeResult> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? planChangeOps;
  const now = options.now ?? new Date();
  const base = baseUrlOf(options);

  const [sub] = await database
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.organizationId, input.organizationId)))
    .limit(1);
  if (!sub || sub.provider !== "paypal" || !sub.paypalSubscriptionId || !sub.planId) {
    return { kind: "error", error: "This website has no PayPal subscription to change." };
  }
  const paypalSubscriptionId = sub.paypalSubscriptionId;
  const planRows = await database.select().from(plans).where(inArray(plans.id, [sub.planId, input.toPlanId]));
  const from = planRows.find((plan) => plan.id === sub.planId);
  const to = planRows.find((plan) => plan.id === input.toPlanId);
  if (!from || !to || !to.paypalPlanId) return { kind: "error", error: "Plan not found" };
  if (from.id === to.id) return { kind: "error", error: `This website is already on ${to.name}.` };
  if (from.interval !== to.interval) {
    return {
      kind: "error",
      error:
        "Switching between monthly and yearly billing is not possible through PayPal. Cancel this subscription; when its paid period ends, you can choose the new plan by card or PayPal.",
    };
  }
  if (from.currency !== to.currency) return { kind: "error", error: "These plans are billed in different currencies." };
  // What each plan costs THIS subscriber: the launch prices, for a subscription on them.
  const launch = await onLaunchPrice(database, paypalSubscriptionId);
  const toLaunchCents = launch ? repgetFirstPaymentCents(to) : null;
  if (launch && toLaunchCents === null) {
    return { kind: "error", error: `Your ${REPGET_CODE} launch price does not cover ${to.name}, so this website stays on ${from.name}.` };
  }
  const fromCents = launch ? (repgetFirstPaymentCents(from) ?? from.priceCents) : from.priceCents;
  const toCents = toLaunchCents ?? to.priceCents;
  if (sub.status !== "active") {
    return {
      kind: "error",
      error: "A payment on this subscription has not gone through yet. Once PayPal has collected it, you can change the plan.",
    };
  }

  const existing = await database
    .select()
    .from(paypalPlanChanges)
    .where(eq(paypalPlanChanges.subscriptionId, sub.id));
  const scheduled = existing.find(
    (change) => change.kind === "downgrade" && change.status === "completed" && change.effectiveAt && change.effectiveAt > now,
  );
  if (scheduled) {
    const target = planRows.find((plan) => plan.id === scheduled.toPlanId)?.name ?? "the plan you chose";
    return {
      kind: "error",
      error: `This website moves to ${target} on ${dateOf(scheduled.effectiveAt!)}. You can choose another plan after that.`,
    };
  }

  const open = existing.find((change) => (OPEN as readonly string[]).includes(change.status));
  if (open) {
    const resumed = await resumeOpen(database, open, to.id, now);
    if (resumed) return resumed;
  }

  // What PayPal says now: the period still to run, and that it is still billing.
  let live: PayPalSubscription;
  try {
    live = await ops.getSubscription(paypalSubscriptionId);
  } catch (error) {
    if (error instanceof PayPalError) return { kind: "error", error: "PayPal could not change the plan. Please try again shortly." };
    throw error;
  }
  if (live.status !== "ACTIVE") {
    return { kind: "error", error: "PayPal is not billing this subscription at the moment, so its plan cannot be changed." };
  }
  const periodEnd = live.billing_info?.next_billing_time ? new Date(live.billing_info.next_billing_time) : sub.currentPeriodEnd;
  const periodStart = sub.currentPeriodStart;

  const upgrade = toCents >= fromCents;
  let difference = 0;
  if (upgrade && toCents > fromCents) {
    if (!periodStart || !periodEnd) {
      return { kind: "error", error: "We could not read this subscription's billing period. Please try again shortly." };
    }
    difference = prorateDifference({ fromCents, toCents, periodStart, periodEnd, now });
  }

  let change: ChangeRow;
  try {
    [change] = await database
      .insert(paypalPlanChanges)
      .values({
        organizationId: input.organizationId,
        subscriptionId: sub.id,
        paypalSubscriptionId,
        fromPlanId: from.id,
        toPlanId: to.id,
        kind: upgrade ? "upgrade" : "downgrade",
        status: difference > 0 ? "awaiting_payment" : "awaiting_approval",
        differenceCents: difference,
        currency: to.currency,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  } catch (error) {
    // Another tab opened one a moment ago (one open change per subscription).
    if (isUniqueViolation(error)) return { kind: "error", error: "A change of plan is already being made. Please try again in a moment." };
    throw error;
  }

  if (difference > 0) {
    const started = await startOrder(
      {
        purpose: "plan_upgrade",
        organizationId: input.organizationId,
        referenceId: change.id,
        amountCents: difference,
        currency: to.currency,
        description: `${to.name}: the difference until ${periodEnd ? dateOf(periodEnd) : "the next billing date"}`,
        userId: input.userId ?? null,
        returnUrl: (rowId) => `${base}/api/paypal/orders/return?row=${rowId}&outcome=success`,
        cancelUrl: (rowId) => `${base}/api/paypal/orders/return?row=${rowId}&outcome=cancelled`,
      },
      { database, ops: ops.orders },
    );
    if (started.kind === "error") {
      // The buyer was never sent to PayPal: nothing can be paid on it.
      await update(database, change.id, { status: "cancelled", orderRowId: started.rowId ?? null, error: started.error }, now);
      return { kind: "error", error: started.error };
    }
    await update(database, change.id, { orderRowId: started.rowId }, now);
    return { kind: "redirect", url: started.url };
  }

  const asked = await requestRevision(change.id, { ...options, database, ops, now });
  if (asked.kind === "approve") return { kind: "redirect", url: asked.url };
  if (asked.kind === "done") return { kind: "redirect", url: `${base}/billing?plan_change=completed&via=paypal` };
  if (asked.kind === "waiting") return { kind: "redirect", url: `${base}/billing?plan_change=pending&via=paypal` };
  return { kind: "error", error: asked.error };
}

/** An open change: the same target resumes it; another target replaces it only while nothing is paid. */
async function resumeOpen(database: Database, open: ChangeRow, toPlanId: string, now: Date): Promise<StartPlanChangeResult | null> {
  if (open.status === "awaiting_payment") {
    const [order] = open.orderRowId
      ? await database.select().from(paypalOrders).where(eq(paypalOrders.id, open.orderRowId)).limit(1)
      : [];
    const capturedOrClearing = order && (order.paypalCaptureId || order.status === "pending" || order.status === "completed");
    if (capturedOrClearing) {
      return { kind: "error", error: "Your payment for the previous change is still being confirmed by PayPal. Please try again shortly." };
    }
    if (open.toPlanId === toPlanId && order?.status === "created" && order.approveUrl) {
      return { kind: "redirect", url: order.approveUrl };
    }
    /*
      Replaced. Approval alone takes no money: RepGet captures, and a voided
      row is never captured (settleOrder). Should a capture still land (a
      return racing this), fulfilPlanUpgrade refunds it.
    */
    if (order && order.status !== "voided" && order.status !== "failed") {
      await database
        .update(paypalOrders)
        .set({ status: "voided", error: "replaced by another plan change", updatedAt: now })
        .where(and(eq(paypalOrders.id, order.id), isNull(paypalOrders.paypalCaptureId)));
    }
    await update(database, open.id, { status: "cancelled", error: "replaced by another plan change" }, now);
    return null;
  }

  // awaiting_approval
  if (open.toPlanId === toPlanId && open.approveUrl) return { kind: "redirect", url: open.approveUrl };
  if (open.differenceCents > 0) {
    return {
      kind: "error",
      error:
        "You have paid for a change of plan that is waiting for your approval on PayPal. Approve it from Billing, or it is refunded if not approved within 72 hours.",
    };
  }
  // Nothing paid: a revision not approved yet is simply replaced (the buyer approves only the newest link).
  await update(database, open.id, { status: "cancelled", error: "replaced by another plan change" }, now);
  return null;
}

type RevisionResult = { kind: "approve"; url: string } | { kind: "done" } | { kind: "waiting" } | { kind: "error"; error: string };

/**
 * Asks PayPal to revise the subscription to the change's plan (keyed by the
 * change, so a repeat is the same request). A definite refusal ends the
 * change - refunded if the difference was paid.
 */
export async function requestRevision(changeId: string, options: Options = {}): Promise<RevisionResult> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? planChangeOps;
  const now = options.now ?? new Date();
  const [change] = await database.select().from(paypalPlanChanges).where(eq(paypalPlanChanges.id, changeId)).limit(1);
  if (!change || change.status !== "awaiting_approval") return { kind: "error", error: "This change of plan is no longer open." };
  if (change.approveUrl) return { kind: "approve", url: change.approveUrl };
  const [to] = await database
    .select({ paypalPlanId: plans.paypalPlanId, tier: plans.tier, interval: plans.interval, currency: plans.currency, priceCents: plans.priceCents })
    .from(plans)
    .where(eq(plans.id, change.toPlanId))
    .limit(1);
  if (!to?.paypalPlanId) {
    await endUnrevised(database, ops, change, "the new plan has no PayPal plan any more", now);
    return { kind: "error", error: "This plan is no longer available through PayPal." };
  }
  // The launch price on the new plan's regular cycle (its plan has that one cycle) for a subscription on it.
  const launchCents = (await onLaunchPrice(database, change.paypalSubscriptionId)) ? repgetFirstPaymentCents(to) : undefined;
  if (launchCents === null) {
    await endUnrevised(database, ops, change, `the ${REPGET_CODE} launch price does not cover the new plan`, now);
    return { kind: "error", error: `Your ${REPGET_CODE} launch price does not cover this plan.` };
  }
  if (!change.revisionRequestedAt) await update(database, change.id, { revisionRequestedAt: now }, now);

  const base = baseUrlOf(options);
  try {
    const revised = await ops.reviseSubscription({
      subscriptionId: change.paypalSubscriptionId,
      planId: to.paypalPlanId,
      returnUrl: `${base}${planChangeReturnPath(change.id, "success")}`,
      cancelUrl: `${base}${planChangeReturnPath(change.id, "cancelled")}`,
      idempotencyKey: `plan-change:${change.id}`,
      prices: launchCents !== undefined ? [{ sequence: 1, totalCycles: 0, priceCents: launchCents, currency: to.currency }] : undefined,
    });
    if (!revised.approveUrl) {
      // No approval asked (PayPal did it at once): settled from what PayPal says.
      const settled = await settlePlanChange(change.id, { ...options, database, ops, now });
      return settled === "completed" ? { kind: "done" } : { kind: "waiting" };
    }
    await update(database, change.id, { approveUrl: revised.approveUrl, error: null }, now);
    return { kind: "approve", url: revised.approveUrl };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    if (error instanceof PayPalError && error.kind !== "unknown") {
      await endUnrevised(database, ops, change, `PayPal refused the revision: ${message}`, now);
      return { kind: "error", error: "PayPal could not change the plan." };
    }
    // Unanswered: the same request is repeated by the sweep (same key).
    await update(database, change.id, { error: `revision unanswered: ${message}` }, now);
    return { kind: "error", error: "PayPal did not answer. Please try again from Billing in a moment." };
  }
}

/**
 * A plan_upgrade order's grant (lib/paypal/order-fulfilment.ts): the
 * difference is paid, so the revision is asked now. Paid for a change that is
 * no longer wanted (replaced or cancelled meanwhile): refunded.
 */
export function planUpgradeFulfilment(options: Options = {}): Fulfilment {
  return async (order) => {
    const database = options.database ?? appDb;
    const now = options.now ?? new Date();
    const [change] = await database.select().from(paypalPlanChanges).where(eq(paypalPlanChanges.id, order.referenceId)).limit(1);
    if (!change) return false;
    return advanceAfterPayment(database, options.ops ?? planChangeOps, change, order.id, now, options);
  };
}

export const fulfilPlanUpgrade: Fulfilment = planUpgradeFulfilment();

export async function advanceAfterPayment(
  database: Database,
  ops: PlanChangeOps,
  change: ChangeRow,
  orderRowId: string,
  now: Date,
  options: Options = {},
): Promise<boolean> {
  if (change.status === "awaiting_payment" && change.orderRowId === orderRowId) {
    const moved = await database
      .update(paypalPlanChanges)
      .set({ status: "awaiting_approval", updatedAt: now })
      .where(and(eq(paypalPlanChanges.id, change.id), eq(paypalPlanChanges.status, "awaiting_payment")))
      .returning({ id: paypalPlanChanges.id });
    if (moved.length > 0) await requestRevision(change.id, { ...options, database, ops, now });
    return true;
  }
  if (change.orderRowId === orderRowId && change.status !== "cancelled") return true; // Already past this step.
  // This order's change was replaced or cancelled: the money goes back.
  if (change.status === "cancelled" || change.orderRowId !== orderRowId) {
    await database
      .update(paypalPlanChanges)
      .set({ status: "refunding", orderRowId, error: "paid after the change was replaced", updatedAt: now })
      .where(and(eq(paypalPlanChanges.id, change.id), eq(paypalPlanChanges.status, "cancelled")));
    await refundChange(change.id, { ...options, database, ops, now });
  }
  return true;
}

/** A change that will not be revised: refunded if paid, otherwise just over. */
async function endUnrevised(database: Database, ops: PlanChangeOps, change: ChangeRow, reason: string, now: Date) {
  if (change.differenceCents > 0 && change.orderRowId) {
    await update(database, change.id, { status: "refunding", error: reason.slice(0, 500) }, now);
    await refundChange(change.id, { database, ops, now });
    return;
  }
  await update(database, change.id, { status: "cancelled", error: reason.slice(0, 500) }, now);
}

/**
 * Refunds the difference of a change in "refunding" through the same
 * refund records as staff refunds (lib/billing/refunds.ts), keyed per
 * payment, then tells staff. An unanswered refund stays "refunding" and the
 * sweep repeats it.
 */
export async function refundChange(changeId: string, options: Options = {}): Promise<ChangeRow["status"] | null> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? planChangeOps;
  const now = options.now ?? new Date();
  const [change] = await database.select().from(paypalPlanChanges).where(eq(paypalPlanChanges.id, changeId)).limit(1);
  if (!change || change.status !== "refunding") return change?.status ?? null;
  const [order] = change.orderRowId
    ? await database.select().from(paypalOrders).where(eq(paypalOrders.id, change.orderRowId)).limit(1)
    : [];
  const [payment] = order?.paypalCaptureId
    ? await database
        .select({ id: payments.id, status: payments.status })
        .from(payments)
        .where(and(eq(payments.provider, "paypal"), eq(payments.externalId, order.paypalCaptureId)))
        .limit(1)
    : [];
  if (!payment) {
    await fail(database, ops, change, "no recorded payment to refund", now);
    return "failed";
  }
  if (payment.status === "refunded") {
    await update(database, change.id, { status: "refunded" }, now);
    return "refunded";
  }

  let refundId = change.refundId;
  if (!refundId) {
    const reserved = await reserveRefund(database, {
      paymentId: payment.id,
      reason: `PayPal plan change not completed (${change.error ?? "not revised"})`,
      actor: "system:paypal-plan-change",
    });
    if (reserved.kind === "refused") {
      if (!reserved.unresolvedRefundId) {
        await fail(database, ops, change, `refund refused: ${reserved.error}`, now);
        return "failed";
      }
      refundId = reserved.unresolvedRefundId;
    } else {
      refundId = reserved.refundId;
    }
    await update(database, change.id, { refundId }, now);
  }

  const outcome = await executeRefund(database, refundId, ops.refunds);
  if (outcome.kind === "unknown") return "refunding";
  if (outcome.kind === "failed") {
    await fail(database, ops, change, `refund failed: ${outcome.error}`, now);
    return "failed";
  }
  await update(database, change.id, { status: "refunded" }, now);
  await ops.notifyStaff(
    "PayPal plan change refunded",
    `The upgrade on PayPal subscription ${change.paypalSubscriptionId} (workspace ${change.organizationId}) was paid but not completed (${change.error ?? "not revised"}). The difference of ${(change.differenceCents / 100).toFixed(2)} ${change.currency.toUpperCase()} was refunded automatically (change ${change.id}).`,
  );
  return "refunded";
}

async function fail(database: Database, ops: PlanChangeOps, change: ChangeRow, reason: string, now: Date) {
  await update(database, change.id, { status: "failed", error: reason.slice(0, 500) }, now);
  await ops.notifyStaff(
    "PayPal plan change needs a person",
    `Plan change ${change.id} on PayPal subscription ${change.paypalSubscriptionId} (workspace ${change.organizationId}): ${reason}. Difference paid: ${(change.differenceCents / 100).toFixed(2)} ${change.currency.toUpperCase()}. Check the subscription in PayPal, then refund the difference from Admin > Payments if the plan did not change.`,
  );
}

/**
 * Brings one change to what PayPal says now. Safe from any caller, any number
 * of times. Returns the change's status afterwards.
 */
export async function settlePlanChange(changeId: string, options: Options = {}): Promise<ChangeRow["status"] | null> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? planChangeOps;
  const now = options.now ?? new Date();
  const [change] = await database.select().from(paypalPlanChanges).where(eq(paypalPlanChanges.id, changeId)).limit(1);
  if (!change) return null;

  if (change.status === "refunding") return refundChange(change.id, { ...options, database, ops, now });

  if (change.status === "awaiting_payment") {
    // Its order is settled by the order sweep and webhooks; a dead order ends the change.
    const [order] = change.orderRowId
      ? await database.select({ status: paypalOrders.status }).from(paypalOrders).where(eq(paypalOrders.id, change.orderRowId)).limit(1)
      : [];
    if (!order || order.status === "voided" || order.status === "failed") {
      await update(database, change.id, { status: "cancelled", error: "the difference was not paid" }, now);
      return "cancelled";
    }
    return change.status;
  }

  if (change.status !== "awaiting_approval") return change.status;
  if (!change.approveUrl) {
    const asked = await requestRevision(change.id, { ...options, database, ops, now });
    if (asked.kind === "done") return "completed";
    const [after] = await database.select({ status: paypalPlanChanges.status }).from(paypalPlanChanges).where(eq(paypalPlanChanges.id, change.id));
    if (after?.status !== "awaiting_approval") return after?.status ?? null;
  }

  const [to] = await database
    .select({ paypalPlanId: plans.paypalPlanId, paypalTrialPlanId: plans.paypalTrialPlanId })
    .from(plans)
    .where(eq(plans.id, change.toPlanId))
    .limit(1);
  let live: PayPalSubscription;
  try {
    live = await ops.getSubscription(change.paypalSubscriptionId);
  } catch (error) {
    if (error instanceof PayPalError && error.kind === "not_found") {
      await endUnrevised(database, ops, change, "PayPal no longer has the subscription", now);
      const [after] = await database.select({ status: paypalPlanChanges.status }).from(paypalPlanChanges).where(eq(paypalPlanChanges.id, change.id));
      return after?.status ?? null;
    }
    throw error;
  }

  if (live.plan_id && (live.plan_id === to?.paypalPlanId || live.plan_id === to?.paypalTrialPlanId)) {
    const effectiveAt =
      change.kind === "downgrade" && live.billing_info?.next_billing_time ? new Date(live.billing_info.next_billing_time) : now;
    await update(database, change.id, { status: "completed", effectiveAt, approveUrl: null, error: null }, now);
    // The new plan recorded now (the downgrade held until effective_at: paypal-events snapshotOf).
    await ops.sync(change.paypalSubscriptionId).catch((error) =>
      console.error(`[paypal-plan-change] ${change.id} completed; recording it failed, the webhook will`, error),
    );
    return "completed";
  }

  if (live.status === "CANCELLED" || live.status === "EXPIRED" || live.status === "SUSPENDED") {
    await endUnrevised(database, ops, change, `the subscription is ${live.status.toLowerCase()} at PayPal`, now);
    const [after] = await database.select({ status: paypalPlanChanges.status }).from(paypalPlanChanges).where(eq(paypalPlanChanges.id, change.id));
    return after?.status ?? null;
  }

  const askedAt = change.revisionRequestedAt ?? change.updatedAt;
  if (now.getTime() - askedAt.getTime() < APPROVAL_WINDOW_MS) return "awaiting_approval";

  // Not approved in time.
  if (change.differenceCents > 0 && change.approvalSignalAt) {
    await fail(
      database,
      ops,
      change,
      "the difference was paid and the buyer may have approved the revision, but PayPal still reports the old plan after 72 hours",
      now,
    );
    return "failed";
  }
  await endUnrevised(database, ops, change, "the revision was not approved within 72 hours", now);
  const [after] = await database.select({ status: paypalPlanChanges.status }).from(paypalPlanChanges).where(eq(paypalPlanChanges.id, change.id));
  return after?.status ?? null;
}

/** The buyer is back from PayPal's revision page. */
export async function returnFromRevision(
  changeId: string,
  outcome: "success" | "cancelled",
  options: Options = {},
): Promise<ChangeRow["status"] | null> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? planChangeOps;
  const now = options.now ?? new Date();
  if (outcome === "success") {
    await database
      .update(paypalPlanChanges)
      .set({ approvalSignalAt: now, updatedAt: now })
      .where(and(eq(paypalPlanChanges.id, changeId), eq(paypalPlanChanges.status, "awaiting_approval"), isNull(paypalPlanChanges.approvalSignalAt)));
  }
  const status = await settlePlanChange(changeId, { ...options, database, ops, now });
  if (outcome === "cancelled" && status === "awaiting_approval") {
    // Declined on PayPal: the plan stays, and a paid difference goes back now.
    const [change] = await database.select().from(paypalPlanChanges).where(eq(paypalPlanChanges.id, changeId)).limit(1);
    if (change && !change.approvalSignalAt) {
      await endUnrevised(database, ops, change, "the buyer declined the revision on PayPal", now);
      const [after] = await database.select({ status: paypalPlanChanges.status }).from(paypalPlanChanges).where(eq(paypalPlanChanges.id, changeId));
      return after?.status ?? null;
    }
  }
  return status;
}

/**
 * A verified BILLING.SUBSCRIPTION.* event for a subscription with an open
 * change: UPDATED after the revision was asked is a sign of approval; then
 * the change is settled from what PayPal says.
 */
export async function onSubscriptionEvent(
  paypalSubscriptionId: string,
  eventType: string,
  options: Options = {},
): Promise<void> {
  const database = options.database ?? appDb;
  const now = options.now ?? new Date();
  const open = await database
    .select({ id: paypalPlanChanges.id })
    .from(paypalPlanChanges)
    .where(
      and(
        eq(paypalPlanChanges.paypalSubscriptionId, paypalSubscriptionId),
        inArray(paypalPlanChanges.status, ["awaiting_approval", "refunding"]),
      ),
    );
  if (open.length === 0) return;
  if (eventType === "BILLING.SUBSCRIPTION.UPDATED") {
    await database
      .update(paypalPlanChanges)
      .set({ approvalSignalAt: now, updatedAt: now })
      .where(
        and(
          eq(paypalPlanChanges.paypalSubscriptionId, paypalSubscriptionId),
          eq(paypalPlanChanges.status, "awaiting_approval"),
          isNotNull(paypalPlanChanges.revisionRequestedAt),
          isNull(paypalPlanChanges.approvalSignalAt),
        ),
      );
  }
  for (const change of open) await settlePlanChange(change.id, { ...options, database, now });
}

/**
 * The maintenance sweep: open changes not touched for 10 minutes (abandoned,
 * unanswered, or past their 72 hours), refunds to repeat, and downgrades
 * whose date has come (recorded again so the lower plan applies).
 */
export async function reconcilePlanChanges(options: Options = {}): Promise<number> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? planChangeOps;
  const now = options.now ?? new Date();
  const due = await database
    .select({ id: paypalPlanChanges.id })
    .from(paypalPlanChanges)
    .where(
      and(
        inArray(paypalPlanChanges.status, ["awaiting_payment", "awaiting_approval", "refunding"]),
        lt(paypalPlanChanges.updatedAt, new Date(now.getTime() - 10 * 60_000)),
      ),
    )
    .limit(25);
  let handled = 0;
  for (const row of due) {
    try {
      await settlePlanChange(row.id, { ...options, database, ops, now });
      handled += 1;
    } catch (error) {
      console.error(`[paypal-plan-change] could not settle ${row.id}; the next run tries again`, error);
    }
  }

  const effective = await database
    .select({ id: paypalPlanChanges.id, paypalSubscriptionId: paypalPlanChanges.paypalSubscriptionId })
    .from(paypalPlanChanges)
    .innerJoin(subscriptions, eq(subscriptions.id, paypalPlanChanges.subscriptionId))
    .where(
      and(
        eq(paypalPlanChanges.kind, "downgrade"),
        eq(paypalPlanChanges.status, "completed"),
        lte(paypalPlanChanges.effectiveAt, now),
        // A week to be recorded; after that it is left to the renewal's own events (and not asked again every run).
        gt(paypalPlanChanges.effectiveAt, new Date(now.getTime() - 7 * 24 * 60 * 60_000)),
        // Still on the plan it left: recorded again now its date has come.
        eq(subscriptions.planId, paypalPlanChanges.fromPlanId),
        or(isNull(subscriptions.cancelAt), lt(paypalPlanChanges.effectiveAt, subscriptions.cancelAt)),
      ),
    )
    .limit(25);
  for (const row of effective) {
    try {
      await ops.sync(row.paypalSubscriptionId);
      handled += 1;
    } catch (error) {
      console.error(`[paypal-plan-change] could not record the downgrade ${row.id}; the next run tries again`, error);
    }
  }
  return handled;
}

export type PlanChangeNotice = NonNullable<Awaited<ReturnType<typeof planChangeNotice>>> & { toPlanName?: string };

/** The notice for a website's PayPal subscription in this workspace, with the target plan's name. */
export async function planChangeNoticeForWebsite(
  organizationId: string,
  websiteId: string,
  options: { database?: Database; now?: Date } = {},
): Promise<PlanChangeNotice | null> {
  const database = options.database ?? appDb;
  const [sub] = await database
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, organizationId), eq(subscriptions.websiteId, websiteId), eq(subscriptions.provider, "paypal")))
    .limit(1);
  if (!sub) return null;
  const notice = await planChangeNotice(sub.id, options);
  if (!notice || !("toPlanId" in notice)) return notice;
  const [plan] = await database.select({ name: plans.name }).from(plans).where(eq(plans.id, notice.toPlanId)).limit(1);
  return { ...notice, toPlanName: plan?.name };
}

/** What Billing shows for one subscription: an open change, or a downgrade waiting for its date. */
export async function planChangeNotice(
  subscriptionId: string,
  options: { database?: Database; now?: Date } = {},
): Promise<
  | null
  | { kind: "pay"; toPlanId: string; url: string | null; differenceCents: number; currency: string }
  | { kind: "approve"; toPlanId: string; url: string | null; paid: boolean }
  | { kind: "scheduled"; toPlanId: string; effectiveAt: Date }
  | { kind: "refunding"; differenceCents: number; currency: string }
> {
  const database = options.database ?? appDb;
  const now = options.now ?? new Date();
  const rows = await database.select().from(paypalPlanChanges).where(eq(paypalPlanChanges.subscriptionId, subscriptionId));
  const open = rows.find((row) => (OPEN as readonly string[]).includes(row.status));
  if (open?.status === "awaiting_payment") {
    const [order] = open.orderRowId
      ? await database.select({ approveUrl: paypalOrders.approveUrl, status: paypalOrders.status }).from(paypalOrders).where(eq(paypalOrders.id, open.orderRowId))
      : [];
    return { kind: "pay", toPlanId: open.toPlanId, url: order?.status === "created" ? order.approveUrl : null, differenceCents: open.differenceCents, currency: open.currency };
  }
  if (open?.status === "awaiting_approval") {
    return { kind: "approve", toPlanId: open.toPlanId, url: open.approveUrl, paid: open.differenceCents > 0 };
  }
  const refunding = rows.find((row) => row.status === "refunding");
  if (refunding) return { kind: "refunding", differenceCents: refunding.differenceCents, currency: refunding.currency };
  const scheduled = rows.find(
    (row) => row.kind === "downgrade" && row.status === "completed" && row.effectiveAt && row.effectiveAt > now,
  );
  return scheduled ? { kind: "scheduled", toPlanId: scheduled.toPlanId, effectiveAt: scheduled.effectiveAt! } : null;
}

async function update(database: Database, id: string, values: Partial<ChangeRow>, now: Date) {
  await database.update(paypalPlanChanges).set({ ...values, updatedAt: now }).where(eq(paypalPlanChanges.id, id));
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}
