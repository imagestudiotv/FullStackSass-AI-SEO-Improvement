"use server";

import { and, desc, eq, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { recordAdminAction } from "@/lib/admin/audit";
import { recordCredit, getBalance } from "@/lib/backlinks/credits";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";
import { db } from "@/lib/db";
import { syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { refundProviderOps } from "@/lib/billing/refund-providers";
import { executeRefund, reserveRefund, resolveRefund } from "@/lib/billing/refunds";
import {
  agencyWorkspaces,
  member,
  organization,
  paymentRefunds,
  payments,
  subscriptions,
  user,
  websites,
} from "@/lib/db/schema";
import { cancelSubscription as cancelPayPalSubscriptionById } from "@/lib/paypal/subscriptions";
import { reverseReferralReward } from "@/lib/referrals/core";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import type { ActionResult } from "@/lib/websites/actions";
import {
  deleteWebsiteIfBillingResolved,
  deleteWorkspaceIfBillingResolved,
} from "@/lib/websites/deletion";

/**
 * Operator actions: the things support actually has to do.
 *
 * Separate from actions.ts, which only reads. Everything here CHANGES
 * something across a tenant boundary, and two rules apply to all of it
 * without exception:
 *
 *   1. requireAdmin() first. A missing guard here is not a data leak, it is
 *      an unauthenticated refund.
 *   2. recordAdminAction() before the irreversible half. If the log write
 *      fails the action does not happen; a refund nobody can account for is
 *      worse than a refund that did not go through.
 */

/* ------------------------------------------------------------------------- */
/* Refunds                                                                    */
/* ------------------------------------------------------------------------- */

type PaymentForTarget = {
  id: string;
  organizationId: string;
  provider: string;
  externalId: string;
  subscriptionId: string | null;
  providerSubscriptionId: string | null;
};

type TargetSubscription = {
  id: string;
  websiteId: string | null;
  claimedWebsiteId: string | null;
  status: string;
  provider: string;
  stripeSubscriptionId: string | null;
  paypalSubscriptionId: string | null;
};

/**
 * The subscription a payment paid for - exactly that one, or null.
 *
 * WHAT WAS WRONG. Both the refund quote and refund-with-cancellation took
 * "the newest subscription in the workspace". In a workspace paying for
 * several websites that is whichever site was bought last, so refunding an
 * older invoice cancelled a different site's plan and prorated against the
 * wrong allowance.
 *
 * NOW, in order: the subscription recorded on the payment by the webhook;
 * the provider subscription id recorded on it; and for older Stripe rows,
 * the subscription Stripe itself names on the invoice. The row must belong
 * to the payment's workspace. Anything else is null - ambiguous - and the
 * caller refuses rather than guessing.
 */
async function subscriptionForPayment(
  payment: PaymentForTarget,
): Promise<TargetSubscription | null> {
  let providerId = payment.providerSubscriptionId;
  if (
    !payment.subscriptionId &&
    !providerId &&
    payment.provider === "stripe" &&
    payment.externalId.startsWith("in_") &&
    isStripeConfigured()
  ) {
    const invoice = await stripe.invoices.retrieve(payment.externalId);
    const fromParent = invoice.parent?.subscription_details?.subscription;
    const line = invoice.lines?.data?.[0]?.subscription;
    providerId =
      (typeof fromParent === "string" ? fromParent : (fromParent?.id ?? null)) ??
      (typeof line === "string" ? line : (line?.id ?? null));
  }

  const condition = payment.subscriptionId
    ? eq(subscriptions.id, payment.subscriptionId)
    : providerId
      ? payment.provider === "paypal"
        ? eq(subscriptions.paypalSubscriptionId, providerId)
        : eq(subscriptions.stripeSubscriptionId, providerId)
      : null;
  if (!condition) return null;

  const rows = await db
    .select({
      id: subscriptions.id,
      organizationId: subscriptions.organizationId,
      websiteId: subscriptions.websiteId,
      claimedWebsiteId: subscriptions.claimedWebsiteId,
      status: subscriptions.status,
      provider: subscriptions.provider,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      paypalSubscriptionId: subscriptions.paypalSubscriptionId,
    })
    .from(subscriptions)
    .where(condition)
    .limit(2);
  if (rows.length !== 1 || rows[0].organizationId !== payment.organizationId) {
    return null;
  }
  const [found] = rows;
  return {
    id: found.id,
    websiteId: found.websiteId,
    claimedWebsiteId: found.claimedWebsiteId,
    status: found.status,
    provider: found.provider,
    stripeSubscriptionId: found.stripeSubscriptionId,
    paypalSubscriptionId: found.paypalSubscriptionId,
  };
}

/**
 * What a payment is worth refunding, given what the customer already used.
 *
 * Usage based rather than time based: a customer who generated most of their
 * articles and then asked for their money back has had most of what they paid
 * for, and refunding by calendar days would ignore that entirely.
 *
 * Only articles are counted. They are the plan's headline entitlement and the
 * only one with a real per-unit cost to us; keywords and websites are limits
 * rather than consumption.
 *
 * Returns the FULL amount when there is nothing to prorate against — no plan,
 * an unlimited allowance, or a limit of zero. Refusing to guess is the right
 * answer there: a wrong proration takes money from a customer who is already
 * asking for it back.
 */
export async function quoteRefund(
  paymentId: string,
): Promise<
  ActionResult<{
    fullCents: number;
    suggestedCents: number;
    articlesUsed: number;
    articleLimit: number;
    currency: string;
  }>
> {
  await requireAdmin();

  const [row] = await db
    .select({
      id: payments.id,
      organizationId: payments.organizationId,
      provider: payments.provider,
      externalId: payments.externalId,
      subscriptionId: payments.subscriptionId,
      providerSubscriptionId: payments.providerSubscriptionId,
      amountCents: payments.amountCents,
      currency: payments.currency,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!row) return { ok: false, error: "Payment not found." };

  /**
   * Usage for the website THIS payment subscribed (subscriptionForPayment),
   * not the workspace's newest subscription: a workspace with three sites
   * would otherwise prorate against whichever plan was bought last.
   *
   * An unknown or deleted website means nothing to prorate against, and the
   * full amount is the honest answer there rather than a guess.
   */
  const target = await subscriptionForPayment(row).catch(() => null);
  const usage = target?.websiteId
    ? await checkLimit(target.websiteId, "articles")
    : { allowed: true, used: 0, limit: UNLIMITED, reason: null };

  /**
   * UNLIMITED is -1 and a zero limit cannot be divided by, so both fall back
   * to the full amount rather than producing a nonsense fraction.
   */
  const prorated =
    usage.limit === UNLIMITED || usage.limit <= 0
      ? row.amountCents
      : Math.round(
          row.amountCents *
            (Math.max(usage.limit - usage.used, 0) / usage.limit),
        );

  return {
    ok: true,
    data: {
      fullCents: row.amountCents,
      suggestedCents: prorated,
      articlesUsed: usage.used,
      articleLimit: usage.limit,
      currency: row.currency,
    },
  };
}


/**
 * Refunds a payment through the processor that took it: Stripe, or PayPal
 * (a subscription sale or an Orders capture - lib/billing/refund-providers.ts).
 *
 * The money rules live in lib/billing/refunds.ts: the refund is reserved under
 * the payment's lock before money moves, so a double press or two admins can
 * never send back more than was paid; a partial refund leaves the rest
 * refundable; an unanswered provider call is "unknown", resolved with
 * checkRefundAgain rather than retried blindly.
 *
 * The subscription is deliberately NOT cancelled unless asked. A refund and a
 * cancellation are different decisions - a goodwill refund on a customer who
 * is staying is the common case - and bundling them would take that choice
 * away. Asked for, it happens AFTER the money is back.
 *
 * Credits or a placement the payment bought are not taken back automatically:
 * the Terms say unused credits are not refunded for cash, and what to do with
 * them stays the operator's call (Credits, in the same admin).
 */
export async function refundPayment(
  paymentId: string,
  reason: string,
  options: {
    /** Amount to send back. Omit to refund all that remains. */
    amountCents?: number;
    /** Also end the subscription, for a customer who is leaving. */
    cancelSubscription?: boolean;
  } = {},
): Promise<
  ActionResult<{
    refunded: number;
    cancelled: boolean;
    referralReversalFailed: boolean;
    /** completed: money sent back. pending: the provider will send it. unknown: see checkRefundAgain. */
    state: "completed" | "pending" | "unknown";
    refundId: string;
  }>
> {
  const admin = await requireAdmin();

  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why this is being refunded." };
  }

  const [row] = await db
    .select({
      id: payments.id,
      organizationId: payments.organizationId,
      provider: payments.provider,
      externalId: payments.externalId,
      subscriptionId: payments.subscriptionId,
      providerSubscriptionId: payments.providerSubscriptionId,
      amountCents: payments.amountCents,
      currency: payments.currency,
      description: payments.description,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!row) return { ok: false, error: "Payment not found." };

  /**
   * The subscription to cancel is resolved BEFORE any money moves. When it
   * cannot be told for certain, nothing happens and the operator is told
   * why - a refund that then cancels the wrong website's plan, or silently
   * cancels nothing, is worse than asking them to cancel it by hand.
   */
  let target: TargetSubscription | null = null;
  if (options.cancelSubscription) {
    try {
      target = await subscriptionForPayment(row);
    } catch (error) {
      console.error("[admin] could not resolve the payment's subscription", error);
    }
    const providerId = target?.provider === "paypal" ? target.paypalSubscriptionId : target?.stripeSubscriptionId;
    if (!target || !providerId || target.provider !== row.provider) {
      return {
        ok: false,
        error: `Could not tell which subscription this payment belongs to, so nothing was refunded. Refund without cancelling, or cancel the subscription in ${row.provider === "paypal" ? "PayPal" : "Stripe"}.`,
      };
    }
  }

  const reserved = await reserveRefund(db, {
    paymentId: row.id,
    amountCents: options.amountCents,
    reason: note,
    actor: admin.email,
    cancelRequested: Boolean(options.cancelSubscription),
  });
  if (reserved.kind === "refused") return { ok: false, error: reserved.error };
  const amountCents = reserved.amountCents;
  const cancelTarget = target ? (target.provider === "paypal" ? target.paypalSubscriptionId : target.stripeSubscriptionId) : null;

  /**
   * Logged BEFORE the money moves. A refund cannot be undone, so the
   * ordering matters: if the log write fails nothing has happened yet - the
   * reserved row is released as failed - but if the refund succeeded and the
   * log then failed there would be money out the door with no record of who
   * sent it.
   */
  try {
    await recordAdminAction({
      actorEmail: admin.email,
      action: "payment.refunded",
      targetType: "payment",
      targetId: row.id,
      organizationId: row.organizationId,
      summary: `Refunded ${(amountCents / 100).toFixed(2)} ${row.currency.toUpperCase()}${
        reserved.partial ? ` of ${(row.amountCents / 100).toFixed(2)}` : ""
      } via ${row.provider}${cancelTarget ? `, cancelling ${cancelTarget}` : ""} - ${note}`,
      detail: {
        provider: row.provider,
        externalId: row.externalId,
        refundId: reserved.refundId,
        amountCents,
        originalAmountCents: row.amountCents,
        partial: reserved.partial,
        cancelSubscription: Boolean(options.cancelSubscription),
        cancelTarget,
        cancelTargetWebsiteId: target?.websiteId ?? target?.claimedWebsiteId ?? null,
        description: row.description,
        reason: note,
      },
    });
  } catch (error) {
    await db
      .update(paymentRefunds)
      .set({ status: "failed", error: "The audit entry could not be written; nothing was sent", updatedAt: new Date() })
      .where(eq(paymentRefunds.id, reserved.refundId));
    throw error;
  }

  const outcome = await executeRefund(db, reserved.refundId, refundProviderOps);
  revalidatePath("/admin/payments");
  if (outcome.kind === "failed") {
    // The audit row stays: it records an attempt, which is the honest account.
    return { ok: false, error: outcome.error.slice(0, 200) };
  }
  if (outcome.kind === "unknown") {
    return {
      ok: true,
      data: { refunded: 0, cancelled: false, referralReversalFailed: false, state: "unknown", refundId: reserved.refundId },
    };
  }

  const effects = await afterRefund(row.id, row.organizationId, outcome.becameFull, target);
  revalidatePath("/admin/organizations");
  return {
    ok: true,
    data: { refunded: amountCents, ...effects, state: outcome.kind, refundId: reserved.refundId },
  };
}

/**
 * What follows money sent back: the referral reward, once the payment is
 * refunded in full; and the cancellation the admin asked for, AFTER the
 * money (a stopped account with no refund is the worse half to be stuck
 * with). Neither failure undoes the refund: each is reported instead.
 */
async function afterRefund(
  paymentId: string,
  organizationId: string,
  becameFull: boolean,
  target: TargetSubscription | null,
): Promise<{ cancelled: boolean; referralReversalFailed: boolean }> {
  /*
    A FULL refund can leave a referred workspace having paid nothing, and
    then the referral that this payment converted no longer stands: its
    reward is taken back (lib/referrals/core.ts decides, and does nothing
    while real money remains). The money is already back, so a failure here
    does not fail the refund - it is reported instead.
  */
  let referralReversalFailed = false;
  if (becameFull) {
    try {
      await reverseReferralReward(organizationId);
    } catch (error) {
      referralReversalFailed = true;
      console.error("[admin] refund succeeded but reversing the referral reward failed", error);
    }
  }

  let cancelled = false;
  if (target?.provider === "stripe" && target.stripeSubscriptionId) {
    /**
     * Exactly the payment's own subscription, with an idempotency key so a
     * repeated press cancels once. The local row changes ONLY to what Stripe
     * answers. A failure leaves `cancelled: false`: cancel by hand.
     */
    try {
      const result = await stripe.subscriptions.cancel(
        target.stripeSubscriptionId,
        {},
        { idempotencyKey: `refund-cancel:${paymentId}` },
      );
      await db
        .update(subscriptions)
        .set({ status: result.status, updatedAt: new Date() })
        .where(eq(subscriptions.id, target.id));
      cancelled = result.status === "canceled";
    } catch (error) {
      console.error("[admin] refund succeeded but cancelling the subscription failed", error);
    }
  } else if (target?.provider === "paypal" && target.paypalSubscriptionId) {
    // The local row changes only to what PayPal says, read back through the webhook's own sync.
    try {
      await cancelPayPalSubscriptionById(target.paypalSubscriptionId, "Refunded and cancelled by RepGet support");
      const synced = await syncPayPalSubscription(target.paypalSubscriptionId);
      cancelled = synced.outcome !== "ignored_no_owner";
    } catch (error) {
      console.error("[admin] refund succeeded but cancelling the PayPal subscription failed", error);
    }
  }
  return { cancelled, referralReversalFailed };
}

/**
 * A refund whose provider call had no clear answer ("unknown"), or one left
 * "requested" by a crash: the SAME request is repeated with the SAME
 * idempotency key, so the provider returns what it did the first time - or
 * does it now, once. Never a second refund.
 */
export async function checkRefundAgain(
  refundId: string,
): Promise<ActionResult<{ state: "completed" | "pending" | "failed" | "unknown"; error?: string }>> {
  const admin = await requireAdmin();
  const [refund] = await db
    .select({ id: paymentRefunds.id, status: paymentRefunds.status, paymentId: paymentRefunds.paymentId, organizationId: paymentRefunds.organizationId, updatedAt: paymentRefunds.updatedAt })
    .from(paymentRefunds)
    .where(eq(paymentRefunds.id, refundId))
    .limit(1);
  if (!refund) return { ok: false, error: "Refund not found." };
  if (refund.status !== "unknown" && refund.status !== "requested") {
    return { ok: true, data: { state: refund.status as "completed" | "pending" | "failed" } };
  }
  // A "requested" row younger than a minute may be the first press still in flight.
  if (refund.status === "requested" && Date.now() - refund.updatedAt.getTime() < 60_000) {
    return { ok: false, error: "This refund is still being sent. Check again in a minute." };
  }
  await recordAdminAction({
    actorEmail: admin.email,
    action: "payment.refund_checked",
    targetType: "payment",
    targetId: refund.paymentId,
    organizationId: refund.organizationId,
    summary: `Checked refund ${refund.id} again (was ${refund.status})`,
    detail: { refundId: refund.id, previous: refund.status },
  });
  const outcome = await resolveRefund(db, refund.id, refundProviderOps);
  revalidatePath("/admin/payments");
  if (outcome.kind === "failed" || outcome.kind === "unknown") {
    return { ok: true, data: { state: outcome.kind, error: outcome.error } };
  }
  // The cancellation asked with it is not repeated here: the operator cancels by hand if it is still wanted.
  if (outcome.becameFull) {
    await reverseReferralReward(refund.organizationId).catch((error) =>
      console.error("[admin] refund confirmed but reversing the referral reward failed", error),
    );
  }
  return { ok: true, data: { state: outcome.kind } };
}

/* ------------------------------------------------------------------------- */
/* Credits                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Adds or removes backlink credits.
 *
 * The most common support action there is: a link disappears, the customer
 * asks for the credit back, and until now that meant writing SQL by hand.
 *
 * The ledger is append only and its balance is the sum of every row, so this
 * writes a movement rather than setting a total. A correction therefore
 * leaves both the mistake and the fix visible.
 */
export async function adjustCredits(
  organizationId: string,
  amount: number,
  reason: string,
): Promise<ActionResult<{ balance: number }>> {
  const admin = await requireAdmin();

  if (!Number.isInteger(amount) || amount === 0) {
    return { ok: false, error: "Enter a whole number of credits, not zero." };
  }
  /**
   * A cap, because the only realistic way to type 50000 here is by accident
   * and the ledger has no undo beyond another entry. 10,000 since credits
   * moved to ten times the scale (2026-10-26): a Scale plan alone is given
   * 700 a month.
   */
  if (Math.abs(amount) > 10_000) {
    return { ok: false, error: "That is more than 10,000 credits. Split it up." };
  }
  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why these credits are being changed." };
  }

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Workspace not found." };

  await recordAdminAction({
    actorEmail: admin.email,
    action: "credits.adjusted",
    targetType: "organization",
    targetId: org.id,
    organizationId: org.id,
    summary: `${amount > 0 ? "+" : ""}${amount} credits for ${org.name} - ${note}`,
    detail: { amount, reason: note },
  });

  await recordCredit(organizationId, {
    type: "adjustment",
    amount,
    note: `${note} (by ${admin.email})`,
  });

  const balance = await getBalance(organizationId);
  revalidatePath("/admin/organizations");
  return { ok: true, data: { balance } };
}

/* ------------------------------------------------------------------------- */
/* Limits                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Raises a workspace's limits above its plan.
 *
 * Reuses agency_workspaces rather than adding an override table: that row
 * already means "this workspace's limits come from here, not from its plan",
 * which is exactly what a goodwill increase needs. usage.ts already prefers
 * it, so nothing else has to change.
 */
export async function setWorkspaceLimits(
  organizationId: string,
  limits: { siteLimit: number; articleLimit: number; keywordLimit: number },
  reason: string,
): Promise<ActionResult<null>> {
  const admin = await requireAdmin();

  const values = Object.values(limits);
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    return { ok: false, error: "Limits must be whole numbers, zero or more." };
  }
  if (limits.articleLimit > 5000 || limits.keywordLimit > 50000) {
    return { ok: false, error: "Those limits are implausibly high." };
  }
  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why these limits are being changed." };
  }

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Workspace not found." };

  await recordAdminAction({
    actorEmail: admin.email,
    action: "organization.limits_changed",
    targetType: "organization",
    targetId: org.id,
    organizationId: org.id,
    summary: `Limits for ${org.name}: ${limits.siteLimit} sites, ${limits.articleLimit} articles, ${limits.keywordLimit} keywords - ${note}`,
    detail: { ...limits, reason: note },
  });

  const [existing] = await db
    .select({ id: agencyWorkspaces.id })
    .from(agencyWorkspaces)
    .where(eq(agencyWorkspaces.organizationId, organizationId))
    .limit(1);

  if (existing) {
    await db
      .update(agencyWorkspaces)
      .set({ ...limits, note: `${note} (by ${admin.email})`, updatedAt: new Date() })
      .where(eq(agencyWorkspaces.id, existing.id));
  } else {
    await db.insert(agencyWorkspaces).values({
      organizationId,
      ...limits,
      note: `${note} (by ${admin.email})`,
    });
  }

  revalidatePath("/admin/organizations");
  return { ok: true, data: null };
}

/* ------------------------------------------------------------------------- */
/* Account state                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Stops a workspace without deleting anything.
 *
 * Deactivation rather than deletion, deliberately. A customer's articles are
 * published on their OWN website and deleting the account does not unpublish
 * them; if they host links for the backlink network, other customers' links
 * live on their pages too. Removing the row would leave both dangling while
 * destroying the record of what happened.
 *
 * This marks the subscription inactive, which every limit check already
 * respects, so generation and publishing stop on the next run. It is
 * reversible, and the audit log carries both halves.
 */
export async function setOrganizationActive(
  organizationId: string,
  active: boolean,
  reason: string,
): Promise<ActionResult<null>> {
  const admin = await requireAdmin();

  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why this workspace is being changed." };
  }

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Workspace not found." };

  const [current] = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!current) {
    return {
      ok: false,
      error: "This workspace has no subscription to change.",
    };
  }

  await recordAdminAction({
    actorEmail: admin.email,
    action: active ? "organization.reactivated" : "organization.deactivated",
    targetType: "organization",
    targetId: org.id,
    organizationId: org.id,
    summary: `${active ? "Reactivated" : "Deactivated"} ${org.name} - ${note}`,
    detail: { previousStatus: current.status, reason: note },
  });

  /**
   * Only the local record changes. The Stripe subscription is left alone: an
   * operator pausing an account for review should not silently stop billing,
   * and cancelling for real belongs in the billing flow where proration and
   * refunds are handled together.
   */
  await db
    .update(subscriptions)
    .set({ status: active ? "active" : "inactive", updatedAt: new Date() })
    .where(eq(subscriptions.id, current.id));

  revalidatePath("/admin/organizations");
  return { ok: true, data: null };
}


/* ------------------------------------------------------------------------- */
/* Permanent deletion                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Deleting is not the same as suspending, and both exist for a reason.
 *
 * Suspension stops the service and keeps the record, which is what almost
 * every support conversation actually wants. Deletion is for a GDPR erasure
 * request, where keeping the record is the thing that is not allowed.
 *
 * What it does NOT do, and cannot:
 *
 *  - Unpublish articles. They live on the customer's OWN website, under their
 *    control. Deleting our row removes our copy, not their page.
 *  - Remove links this workspace hosts for other customers. Those pages
 *    belong to this customer and stay up; placements.host_website_id is
 *    "set null", so the other customer's record survives with the host
 *    unknown rather than vanishing. A link not yet on a page is withdrawn and
 *    its hold released (lib/websites/deletion.ts); the audit entry counts them.
 *  - Erase the audit log. It has no foreign keys precisely so a deletion
 *    leaves a trace of itself — which is what makes the action accountable.
 */

/** Typed to force the caller to confirm rather than pass a bare boolean. */
const DELETE_CONFIRMATION = "DELETE";

/**
 * Permanently removes a workspace and everything under it.
 *
 * Every application table hangs off organization_id with onDelete cascade, so
 * one delete removes websites, articles, keywords, credits and payments
 * together. That is the point: a partial erasure is not an erasure.
 */
export async function deleteOrganization(
  organizationId: string,
  reason: string,
  confirmation: string,
): Promise<ActionResult<null>> {
  const admin = await requireAdmin();

  if (confirmation !== DELETE_CONFIRMATION) {
    return { ok: false, error: `Type ${DELETE_CONFIRMATION} to confirm.` };
  }
  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why this workspace is being deleted." };
  }

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Workspace not found." };

  /**
   * Refuse while a provider could keep charging, all in one transaction.
   *
   * Deleting the row does not tell Stripe anything, so a live subscription
   * would go on billing a customer whose account no longer exists — and with
   * the local record gone there would be nothing left to trace it back to.
   * Cancel or refund first; both already exist above.
   *
   * Same rules as website deletion (lib/websites/deletion.ts): only a status
   * the provider reports as ended counts, and open checkouts are settled or
   * refuse. The check, the counts, the audit entry and the delete share one
   * transaction with the workspace locked, so a checkout or webhook cannot
   * slip in after the check, and the log never claims a deletion that rolled
   * back.
   */
  const result = await deleteWorkspaceIfBillingResolved(db, {
    organizationId: org.id,
    beforeDelete: async (tx, { releasedLinks }) => {
      /**
       * Counted just before the delete, for the audit entry. Afterwards
       * there is nothing left to count, and "deleted a workspace" without
       * saying how much went with it is not a useful record.
       */
      const [counts] = await tx
        .select({
          websites: raw<number>`(select count(*) from websites where organization_id = ${org.id})::int`,
          members: raw<number>`(select count(*) from member where organization_id = ${org.id})::int`,
          payments: raw<number>`(select count(*) from payments where organization_id = ${org.id})::int`,
        })
        .from(raw`(select 1) as _`);

      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "organization.deleted",
          targetType: "organization",
          targetId: org.id,
          organizationId: org.id,
          summary: `Deleted ${org.name} - ${counts?.websites ?? 0} websites, ${counts?.members ?? 0} members, ${counts?.payments ?? 0} payments, ${releasedLinks} unpublished links withdrawn - ${note}`,
          detail: { name: org.name, ...counts, releasedLinks, reason: note },
        },
        tx,
      );
    },
  });

  if (!result.ok) return result;

  revalidatePath("/admin/organizations");
  revalidatePath("/admin/users");
  return { ok: true, data: null };
}

/**
 * Permanently removes one person's account.
 *
 * Their sessions and provider logins cascade. Their WORKSPACES do not: a
 * workspace can outlive a member, and deleting an account should not silently
 * destroy data belonging to colleagues who share it. A workspace that only
 * this person belonged to is deleted separately, and the check below says so
 * rather than leaving an orphan behind quietly.
 */
export async function deleteUser(
  userId: string,
  reason: string,
  confirmation: string,
): Promise<ActionResult<{ orphanedOrganizations: string[] }>> {
  const admin = await requireAdmin();

  if (confirmation !== DELETE_CONFIRMATION) {
    return { ok: false, error: `Type ${DELETE_CONFIRMATION} to confirm.` };
  }
  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why this account is being deleted." };
  }

  const [person] = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!person) return { ok: false, error: "Account not found." };

  /**
   * An administrator deleting their own account would lock themselves out
   * mid-action, and ADMIN_EMAILS would still list an address with no login.
   */
  if (person.email.toLowerCase() === admin.email.toLowerCase()) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  /** Workspaces this person is the only member of; named, not deleted. */
  const orphans = await db
    .select({ name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(
      and(
        eq(member.userId, userId),
        raw`(select count(*) from member m2 where m2.organization_id = ${member.organizationId})::int = 1`,
      ),
    );

  await recordAdminAction({
    actorEmail: admin.email,
    action: "user.deleted",
    targetType: "user",
    targetId: person.id,
    summary: `Deleted ${person.email}${
      orphans.length > 0
        ? ` — left ${orphans.length} workspace(s) with no members`
        : ""
    } - ${note}`,
    detail: {
      email: person.email,
      name: person.name,
      orphanedOrganizations: orphans.map((row) => row.name),
      reason: note,
    },
  });

  await db.delete(user).where(eq(user.id, userId));

  revalidatePath("/admin/users");
  revalidatePath("/admin/organizations");
  return {
    ok: true,
    data: { orphanedOrganizations: orphans.map((row) => row.name) },
  };
}


/**
 * Deletes several workspaces or accounts in one go.
 *
 * Cleaning up test data or working through a batch of erasure requests one
 * typed confirmation at a time is unworkable, and an operator who has to
 * repeat a destructive action forty times stops reading the dialog by the
 * fifth — which is worse than one careful bulk action.
 *
 * Each item goes through the SAME function as the single delete, so every
 * guard applies identically: live subscriptions refuse, the caller's own
 * account refuses, and every deletion writes its own audit entry. There is no
 * faster path that skips the checks.
 *
 * Partial success is reported rather than hidden. A batch where three of forty
 * refused is a useful outcome; one that fails wholesale because of three would
 * force the operator to find them by hand.
 */
export async function deleteManyOrganizations(
  organizationIds: string[],
  reason: string,
  confirmation: string,
): Promise<
  ActionResult<{ deleted: number; failures: { id: string; error: string }[] }>
> {
  await requireAdmin();

  if (organizationIds.length === 0) {
    return { ok: false, error: "Nothing selected." };
  }
  /**
   * A ceiling, not a limit of the query. Past this the operator is almost
   * certainly selecting a filtered view they have not read, and the request
   * would run long enough to look hung.
   */
  if (organizationIds.length > 100) {
    return { ok: false, error: "Select at most 100 workspaces at a time." };
  }

  const failures: { id: string; error: string }[] = [];
  let deleted = 0;

  for (const id of organizationIds) {
    const result = await deleteOrganization(id, reason, confirmation);
    if (result.ok) deleted += 1;
    else failures.push({ id, error: result.error });
  }

  revalidatePath("/admin/organizations");
  revalidatePath("/admin/users");
  return { ok: true, data: { deleted, failures } };
}

export async function deleteManyUsers(
  userIds: string[],
  reason: string,
  confirmation: string,
): Promise<
  ActionResult<{ deleted: number; failures: { id: string; error: string }[] }>
> {
  await requireAdmin();

  if (userIds.length === 0) return { ok: false, error: "Nothing selected." };
  if (userIds.length > 100) {
    return { ok: false, error: "Select at most 100 accounts at a time." };
  }

  const failures: { id: string; error: string }[] = [];
  let deleted = 0;

  for (const id of userIds) {
    const result = await deleteUser(id, reason, confirmation);
    if (result.ok) deleted += 1;
    else failures.push({ id, error: result.error });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/organizations");
  return { ok: true, data: { deleted, failures } };
}


/* ------------------------------------------------------------------------- */
/* Websites                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Permanently removes ONE website.
 *
 * WHY THIS IS SEPARATE FROM deleteOrganization: removing a single site used
 * to mean deleting the workspace that owned it, which also took the
 * customer's account, their other websites, their payment history and their
 * colleagues. An operator asked to remove one wrong domain had no
 * proportionate way to do it.
 *
 * Its articles, keywords, integrations and results cascade from the foreign
 * keys on websites.id. The workspace, its members and its payments are
 * untouched - which is the entire point of having this at all.
 *
 * REFUSES WHILE A PROVIDER COULD KEEP CHARGING, exactly as the customer
 * action does. Subscriptions are per-WEBSITE here (subscriptions.website_id);
 * deleting a site with a live plan would leave Stripe billing for a site that
 * no longer exists. Cancel or refund first; both already exist above. Once a
 * subscription has ended, its row outlives the site (ON DELETE SET NULL) so
 * the charge can still be traced.
 *
 * The count of what went with it is taken BEFORE the delete, when there is
 * still something to count.
 */
export async function deleteWebsite(
  websiteId: string,
  reason: string,
  confirmation: string,
): Promise<ActionResult<{ domain: string; articles: number }>> {
  const admin = await requireAdmin();

  if (confirmation !== DELETE_CONFIRMATION) {
    return { ok: false, error: `Type ${DELETE_CONFIRMATION} to confirm.` };
  }
  const note = reason.trim();
  if (note.length < 3) {
    return { ok: false, error: "Say why this website is being deleted." };
  }

  const [site] = await db
    .select({
      id: websites.id,
      domain: websites.domain,
      url: websites.url,
      organizationId: websites.organizationId,
      organizationName: organization.name,
    })
    .from(websites)
    .leftJoin(organization, eq(organization.id, websites.organizationId))
    .where(eq(websites.id, websiteId))
    .limit(1);

  if (!site) return { ok: false, error: "Website not found." };

  /*
    What goes with it, counted while it still exists. "Deleted a website"
    without saying it took 84 articles is not a record anyone can act on
    months later, and after the delete there is nothing left to count.
  */
  const [counts] = await db
    .select({
      articles: raw<number>`(select count(*) from articles where website_id = ${websiteId})::int`,
      keywords: raw<number>`(select count(*) from keywords where website_id = ${websiteId})::int`,
    })
    .from(raw`(select 1) as _`);

  /*
    The same guarded delete the customer action uses: it refuses while this
    site's subscription (or a legacy one paying for the workspace's only
    site) could still bill, including a scheduled cancellation that has not
    taken effect and a locally "inactive" row Stripe is still charging. The
    subscription row is detached rather than deleted, so its provider ids
    stay for reconciliation. See lib/websites/deletion.ts.

    The audit entry is written only once every check has passed, inside the
    same transaction as the delete: if the log write fails the website stays,
    and if the delete fails the entry is not left claiming it happened.
  */
  const result = await deleteWebsiteIfBillingResolved(db, {
    websiteId: site.id,
    organizationId: site.organizationId,
    beforeDelete: (tx, { releasedLinks }) =>
      recordAdminAction(
        {
          actorEmail: admin.email,
          action: "website.deleted",
          targetType: "website",
          targetId: site.id,
          organizationId: site.organizationId,
          summary: `Deleted ${site.domain} from ${site.organizationName ?? "an unnamed workspace"} - ${counts?.articles ?? 0} articles, ${counts?.keywords ?? 0} keywords, ${releasedLinks} unpublished links withdrawn - ${note}`,
          detail: {
            domain: site.domain,
            url: site.url,
            organizationName: site.organizationName,
            ...counts,
            releasedLinks,
            reason: note,
          },
        },
        tx,
      ),
  });

  if (!result.ok) return result;

  revalidatePath("/admin/websites");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/articles");
  return {
    ok: true,
    data: { domain: site.domain, articles: counts?.articles ?? 0 },
  };
}

/**
 * Deletes several websites in one go.
 *
 * Each goes through deleteWebsite, so every guard and every audit entry
 * applies identically - there is no faster path that skips the checks. Same
 * reasoning as deleteManyOrganizations above: an operator who has to repeat a
 * destructive action forty times stops reading the dialog by the fifth.
 *
 * Sequential rather than Promise.all. These are writes against one database
 * and each one writes an audit row; running forty concurrently buys nothing
 * and makes the failure list arrive out of order.
 */
export async function deleteManyWebsites(
  websiteIds: string[],
  reason: string,
  confirmation: string,
): Promise<
  ActionResult<{ deleted: number; failures: { id: string; error: string }[] }>
> {
  await requireAdmin();

  if (websiteIds.length === 0) {
    return { ok: false, error: "Nothing selected." };
  }

  let deleted = 0;
  const failures: { id: string; error: string }[] = [];

  for (const id of websiteIds) {
    const result = await deleteWebsite(id, reason, confirmation);
    if (result.ok) {
      deleted += 1;
    } else {
      failures.push({ id, error: result.error });
    }
  }

  /*
    A batch where every item refused is a failure, not a partial success -
    reporting "0 deleted" as ok would leave the operator believing something
    happened. The first error stands in for all of them; they share a cause
    when nothing succeeds (a bad confirmation, a missing reason).
  */
  if (deleted === 0) {
    return { ok: false, error: failures[0]?.error ?? "Nothing was deleted." };
  }

  revalidatePath("/admin/websites");
  return { ok: true, data: { deleted, failures } };
}
