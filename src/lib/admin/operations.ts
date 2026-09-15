"use server";

import { and, desc, eq, inArray, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { recordAdminAction } from "@/lib/admin/audit";
import { recordCredit, getBalance } from "@/lib/backlinks/credits";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";
import { db } from "@/lib/db";
import {
  agencyWorkspaces,
  member,
  organization,
  payments,
  subscriptions,
  user,
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
      organizationId: payments.organizationId,
      amountCents: payments.amountCents,
      currency: payments.currency,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!row) return { ok: false, error: "Payment not found." };

  const usage = await checkLimit(row.organizationId, "articles");

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
  options: {
    /** Amount to send back. Omit to refund the whole payment. */
    amountCents?: number;
    /** Also end the subscription, for a customer who is leaving. */
    cancelSubscription?: boolean;
  } = {},
): Promise<ActionResult<{ refunded: number; cancelled: boolean }>> {
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
   * Default to the whole payment. A partial amount is validated here as well
   * as in the dialog, because a server action is a public endpoint and the
   * caller chooses the number.
   */
  const amountCents = options.amountCents ?? row.amountCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (amountCents > row.amountCents) {
    return { ok: false, error: "That is more than the customer paid." };
  }
  const partial = amountCents < row.amountCents;

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
    summary: `Refunded ${(amountCents / 100).toFixed(2)} ${row.currency.toUpperCase()}${
      partial ? ` of ${(row.amountCents / 100).toFixed(2)}` : ""
    }${options.cancelSubscription ? ", subscription cancelled" : ""} — ${note}`,
    detail: {
      provider: row.provider,
      externalId: row.externalId,
      amountCents,
      originalAmountCents: row.amountCents,
      partial,
      cancelSubscription: Boolean(options.cancelSubscription),
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

    // Omitting amount would refund the whole charge, so it is always sent.
    await stripe.refunds.create({ ...target, amount: amountCents });
  } catch (error) {
    /**
     * The audit row stays. It records an attempt, which is the honest
     * account: someone tried to refund this and it failed.
     */
    const message =
      error instanceof Error ? error.message : "Stripe rejected the refund";
    return { ok: false, error: message.slice(0, 200) };
  }

  /**
   * Marked refunded even on a partial. The status answers "was money sent
   * back", which is what stops it being refunded twice; the exact amount
   * lives on the audit entry.
   */
  await db
    .update(payments)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(payments.id, row.id));

  let cancelled = false;
  if (options.cancelSubscription) {
    /**
     * Cancelled AFTER the money is back. If cancelling failed first, the
     * operator would be left with a stopped account and no refund — the worse
     * of the two halves to get stuck with.
     *
     * Failure here does not fail the action: the refund succeeded and is
     * already recorded, and telling the operator it failed would invite them
     * to refund again. The subscription can still be suspended by hand, and
     * the audit entry says a cancellation was intended.
     */
    try {
      const [current] = await db
        .select({
          id: subscriptions.id,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, row.organizationId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (current?.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(current.stripeSubscriptionId);
      }
      if (current) {
        /**
         * Set locally as well as in Stripe. The webhook will say the same
         * thing shortly, but every limit check reads this row, and waiting
         * for the webhook would leave the customer able to generate articles
         * they have just been refunded for.
         */
        await db
          .update(subscriptions)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(subscriptions.id, current.id));
        cancelled = true;
      }
    } catch (error) {
      console.error(
        "[admin] refund succeeded but cancelling the subscription failed",
        error,
      );
    }
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/organizations");
  return { ok: true, data: { refunded: amountCents, cancelled } };
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
 *    unknown rather than vanishing.
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
   * Refuse while Stripe would keep charging.
   *
   * Deleting the row does not tell Stripe anything, so a live subscription
   * would go on billing a customer whose account no longer exists — and with
   * the local record gone there would be nothing left to trace it back to.
   * Cancel or refund first; both already exist above.
   */
  const [live] = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        inArray(subscriptions.status, ["active", "trialing", "past_due"]),
      ),
    )
    .limit(1);

  if (live) {
    return {
      ok: false,
      error:
        "This workspace still has a live subscription. Cancel or refund it first, or Stripe will keep charging them.",
    };
  }

  /**
   * Counted before the delete, for the audit entry. Afterwards there is
   * nothing left to count, and "deleted a workspace" without saying how much
   * went with it is not a useful record.
   */
  const [counts] = await db
    .select({
      websites: raw<number>`(select count(*) from websites where organization_id = ${organizationId})::int`,
      members: raw<number>`(select count(*) from member where organization_id = ${organizationId})::int`,
      payments: raw<number>`(select count(*) from payments where organization_id = ${organizationId})::int`,
    })
    .from(raw`(select 1) as _`);

  await recordAdminAction({
    actorEmail: admin.email,
    action: "organization.deleted",
    targetType: "organization",
    targetId: org.id,
    organizationId: org.id,
    summary: `Deleted ${org.name} — ${counts?.websites ?? 0} websites, ${counts?.members ?? 0} members, ${counts?.payments ?? 0} payments — ${note}`,
    detail: { name: org.name, ...counts, reason: note },
  });

  await db.delete(organization).where(eq(organization.id, organizationId));

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
    } — ${note}`,
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
