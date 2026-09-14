"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { recordAdminAction } from "@/lib/admin/audit";
import { recordCredit, getBalance } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import {
  agencyWorkspaces,
  organization,
  payments,
  subscriptions,
} from "@/lib/db/schema";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import type { ActionResult } from "@/lib/websites/actions";

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

/**
 * Refunds a payment through the processor that took it.
 *
 * Stripe only. PayPal refunds need the order id and a different capture flow,
 * and issuing one incorrectly is worse than sending the operator to PayPal's
 * own dashboard, so those are refused with a message that says where to go.
 *
 * The subscription is deliberately NOT cancelled. A refund and a cancellation
 * are different decisions — a goodwill refund on a customer who is staying is
 * the common case — and bundling them would take that choice away. Cancel
 * separately when that is what is wanted.
 */
export async function refundPayment(
  paymentId: string,
  reason: string,
): Promise<ActionResult<{ refunded: number }>> {
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
      amountCents: payments.amountCents,
      currency: payments.currency,
      status: payments.status,
      description: payments.description,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!row) return { ok: false, error: "Payment not found." };
  if (row.status === "refunded") {
    return { ok: false, error: "This payment has already been refunded." };
  }
  if (row.status !== "paid") {
    return {
      ok: false,
      error: `Only a paid payment can be refunded; this one is "${row.status}".`,
    };
  }
  if (row.provider !== "stripe") {
    return {
      ok: false,
      error:
        "Only Stripe payments can be refunded here. Refund PayPal payments in the PayPal dashboard.",
    };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe is not configured on this deployment." };
  }

  /**
   * Logged BEFORE the money moves. A Stripe refund cannot be undone, so the
   * ordering matters: if the log write fails nothing has happened yet, but if
   * the refund succeeded and the log then failed there would be money out the
   * door with no record of who sent it.
   */
  await recordAdminAction({
    actorEmail: admin.email,
    action: "payment.refunded",
    targetType: "payment",
    targetId: row.id,
    organizationId: row.organizationId,
    summary: `Refunded ${(row.amountCents / 100).toFixed(2)} ${row.currency.toUpperCase()} — ${note}`,
    detail: {
      provider: row.provider,
      externalId: row.externalId,
      amountCents: row.amountCents,
      description: row.description,
      reason: note,
    },
  });

  try {
    /**
     * What the stored id actually is decides how the refund is addressed.
     *
     * Subscription payments are recorded under the INVOICE id (in_...), which
     * Stripe cannot refund: refunds take a charge or a payment intent, and
     * passing an invoice id returned "No such payment_intent". The invoice
     * carries neither field any more either — Stripe moved the link to
     * `payments.data[].payment.payment_intent`, and that is only present when
     * expanded, so it has to be fetched rather than read from the webhook
     * payload we already have.
     *
     * One-off add-ons store a payment intent directly, and older rows may
     * hold a charge, so both are still handled by prefix.
     */
    let target: { charge: string } | { payment_intent: string };

    if (row.externalId.startsWith("in_")) {
      const invoice = await stripe.invoices.retrieve(row.externalId, {
        expand: ["payments"],
      });
      const payment = invoice.payments?.data?.[0]?.payment;
      const intent =
        payment?.type === "payment_intent" ? payment.payment_intent : null;
      const intentId = typeof intent === "string" ? intent : (intent?.id ?? null);

      if (!intentId) {
        return {
          ok: false,
          error:
            "This invoice has no refundable payment on Stripe. Refund it in the Stripe dashboard.",
        };
      }
      target = { payment_intent: intentId };
    } else if (row.externalId.startsWith("ch_")) {
      target = { charge: row.externalId };
    } else {
      target = { payment_intent: row.externalId };
    }

    await stripe.refunds.create(target);
  } catch (error) {
    /**
     * The audit row stays. It records an attempt, which is the honest
     * account: someone tried to refund this and it failed.
     */
    const message =
      error instanceof Error ? error.message : "Stripe rejected the refund";
    return { ok: false, error: message.slice(0, 200) };
  }

  await db
    .update(payments)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(payments.id, row.id));

  revalidatePath("/admin/payments");
  return { ok: true, data: { refunded: row.amountCents } };
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
   * A cap, because the only realistic way to type 5000 here is by accident
   * and the ledger has no undo beyond another entry.
   */
  if (Math.abs(amount) > 1000) {
    return { ok: false, error: "That is more than 1000 credits. Split it up." };
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
    summary: `${amount > 0 ? "+" : ""}${amount} credits for ${org.name} — ${note}`,
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
    summary: `Limits for ${org.name}: ${limits.siteLimit} sites, ${limits.articleLimit} articles, ${limits.keywordLimit} keywords — ${note}`,
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
    summary: `${active ? "Reactivated" : "Deactivated"} ${org.name} — ${note}`,
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
