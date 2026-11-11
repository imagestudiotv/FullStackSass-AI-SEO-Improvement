import { and, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import {
  billingCheckouts,
  lifecycleEmails,
  member,
  organization,
  paypalPlanChanges,
  plans,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import type { Database, Executor, Transaction } from "@/lib/db/types";
import { REPGET_CODE, repgetCouponFor, repgetDiscountCents, repgetOfferEnabled, type OfferPlan } from "@/lib/billing/repget-offer";
import {
  WINBACK_CODE,
  WINBACK_COUPON,
  winbackCovers,
  winbackDiscountCents,
  winbackOfferEnabled,
} from "@/lib/billing/winback-offer";
import { FREE_ARTICLES_DAYS, isDirectPurchaseTier } from "@/lib/plans/features";

/**
 * Checkouts we have sent a customer to, and what became of them.
 *
 * WHY THIS EXISTS: a checkout is opened at the provider and completed there,
 * minutes or hours later, with nothing on our side in between. A website
 * could be deleted in that gap, and two checkouts for one site - two tabs, a
 * double click, card then PayPal - could both complete into two
 * subscriptions. So every checkout leaves a row here BEFORE the customer is
 * sent to the provider, and both deletion and new checkouts consult it.
 *
 *  - open:       sent to the provider (or being sent); may still complete.
 *  - completed:  the provider has a subscription for it.
 *  - expired:    the provider CONFIRMED it can no longer complete.
 *  - failed:     the provider refused the create call; nothing exists.
 *  - unresolved: we cannot confirm it can no longer complete - a create
 *                call whose answer was lost and cannot be looked up. It
 *                blocks both deletion and any new checkout for the website
 *                until the provider (or an operator who checked with it)
 *                confirms it cannot complete.
 *  - abandoned:  written by an earlier version for PayPal approvals left
 *                behind by a deletion; treated like unresolved.
 *  - released:   a PayPal approval the customer walked away from ("Cancel
 *                and return"), which PayPal still reports awaiting approval
 *                and gives us no way to withdraw. It no longer blocks
 *                anything. Should it be approved after all while the website
 *                already pays through something else, the sync cancels it
 *                (subscription-sync.ts, "detached_released_approval").
 *
 * WHAT A STATUS IS BASED ON. Only the provider's answer. `expiresAt` is a
 * hint for when to ask again, never proof: a Stripe session paid a second
 * before it expired, whose webhook is late, is a live subscription, and
 * reading the clock instead of asking Stripe let a deletion through with it
 * still billing.
 *
 * LOCK ORDER, shared with deletion and the webhooks: organization, then
 * website, then subscriptions, then checkouts. Opening a checkout takes the
 * website FOR UPDATE, which serialises checkouts for one site against each
 * other and against its deletion.
 */

export type CheckoutProvider = "stripe" | "paypal";

/**
 * How long an open checkout with no provider id is assumed to be in flight.
 * The provider call has its own timeout well under this; an older row means
 * the process died between creating the row and recording the answer.
 */
export const CHECKOUT_IN_FLIGHT_MS = 10 * 60 * 1000;

/** A Stripe session this close to expiry is not handed out again. */
const REUSE_MARGIN_MS = 5 * 60 * 1000;

const BLOCKING_DELETION = ["open", "unresolved", "abandoned"];

export type StripeSessionState =
  | { state: "open"; url: string | null; expiresAt: Date | null }
  | { state: "complete"; subscriptionId: string | null }
  | { state: "expired" };

/**
 * What the provider says about a checkout. Implemented against the real SDKs
 * in checkout-providers.ts; injected so tests never reach one.
 */
export type CheckoutProviderOps = {
  /**
   * Expires a Stripe Checkout session so it can no longer be paid. When it
   * cannot be expired, reports why: already paid ("complete"), already
   * expired, or still open for some other reason.
   */
  expireStripeCheckout(
    sessionId: string,
  ): Promise<
    | { state: "expired" }
    | { state: "complete"; subscriptionId: string | null }
    | { state: "open" }
  >;
  /** Reads a Stripe session without changing it. */
  stripeSessionState(sessionId: string): Promise<StripeSessionState>;
  /**
   * Finds the session a create call made when its answer was lost, by our
   * checkout id (client_reference_id) among the customer's sessions. Null
   * means Stripe has none: the create never happened.
   */
  findStripeSession(input: {
    checkoutId: string;
    customerId: string;
    createdAt: Date;
  }): Promise<{ sessionId: string; url: string | null; expiresAt: Date | null } | null>;
  /**
   * Where a PayPal subscription stands. "pending" is still awaiting the
   * buyer's approval, which PayPal gives us no way to withdraw.
   */
  payPalApprovalState(subscriptionId: string): Promise<"pending" | "live" | "ended">;
  /**
   * Reads a PayPal subscription and records it, exactly as its webhook would
   * (paypal-events.ts syncPayPalSubscription). For an approval PayPal reports
   * live, so a missed or late webhook does not leave it unrecorded. Optional:
   * without it the checkout is only marked, as before.
   */
  syncPayPalSubscription?(subscriptionId: string): Promise<unknown>;
};

type CheckoutRow = typeof billingCheckouts.$inferSelect;

/** Stores what the provider returned. */
export async function recordCheckoutStarted(
  database: Executor,
  checkoutId: string,
  started: {
    stripeSessionId?: string | null;
    providerSubscriptionId?: string | null;
    expiresAt?: Date | null;
    checkoutUrl?: string | null;
  },
): Promise<void> {
  await database
    .update(billingCheckouts)
    .set({
      ...(started.stripeSessionId !== undefined
        ? { stripeSessionId: started.stripeSessionId }
        : {}),
      ...(started.providerSubscriptionId !== undefined
        ? { providerSubscriptionId: started.providerSubscriptionId }
        : {}),
      ...(started.expiresAt !== undefined ? { expiresAt: started.expiresAt } : {}),
      ...(started.checkoutUrl !== undefined ? { checkoutUrl: started.checkoutUrl } : {}),
      providerState: "open",
      lastCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(billingCheckouts.id, checkoutId));
}

/**
 * Stores the exact create request BEFORE it is sent, so a process that dies
 * mid-call leaves enough to find what the provider made.
 */
export async function recordCheckoutRequest(
  database: Executor,
  checkoutId: string,
  request: { idempotencyKey: string; params: Record<string, unknown> },
): Promise<void> {
  await database
    .update(billingCheckouts)
    .set({
      idempotencyKey: request.idempotencyKey,
      requestParams: request.params,
      updatedAt: new Date(),
    })
    .where(eq(billingCheckouts.id, checkoutId));
}

/**
 * The provider REFUSED the create call: nothing exists to complete. Only for
 * a definitive answer - a timeout leaves the row open for recovery.
 */
export async function markCheckoutFailed(
  database: Executor,
  checkoutId: string,
): Promise<void> {
  await database
    .update(billingCheckouts)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(eq(billingCheckouts.id, checkoutId), eq(billingCheckouts.status, "open")),
    );
}

/**
 * Marks the checkout behind a subscription as completed.
 *
 * Called by the webhook in the same transaction that records the
 * subscription, so "completed" always means "and recorded" once the webhook
 * has run. Matched by our own checkout id (Stripe subscription metadata or
 * the PayPal custom_id), the Stripe session, or the PayPal subscription id
 * stored at creation.
 */
export async function markCheckoutCompleted(
  tx: Executor,
  match: {
    provider: CheckoutProvider;
    providerSubscriptionId: string;
    checkoutId?: string | null;
    stripeSessionId?: string | null;
  },
): Promise<void> {
  const conditions = [];
  if (match.checkoutId) conditions.push(eq(billingCheckouts.id, match.checkoutId));
  if (match.stripeSessionId) {
    conditions.push(eq(billingCheckouts.stripeSessionId, match.stripeSessionId));
  }
  if (match.provider === "paypal") {
    conditions.push(
      eq(billingCheckouts.providerSubscriptionId, match.providerSubscriptionId),
    );
  }
  if (conditions.length === 0) return;

  await tx
    .update(billingCheckouts)
    .set({
      status: "completed",
      providerState: "complete",
      providerSubscriptionId: match.providerSubscriptionId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(billingCheckouts.provider, match.provider),
        or(...conditions),
      ),
    );
}

type CheckoutScope = { websiteId: string } | { organizationId: string };

function scopeCondition(scope: CheckoutScope) {
  return "websiteId" in scope
    ? eq(billingCheckouts.websiteId, scope.websiteId)
    : eq(billingCheckouts.organizationId, scope.organizationId);
}

type Transition = {
  status?: string;
  providerState?: string;
  providerSubscriptionId?: string | null;
  stripeSessionId?: string;
  checkoutUrl?: string | null;
  expiresAt?: Date | null;
};

/**
 * Asks the provider where one unsettled checkout stands. Null when it could
 * not be reached: the row stays as it is and keeps blocking.
 *
 * `expire` decides what happens to an OPEN Stripe session: deletion expires
 * it (it must not be payable afterwards); a new checkout for the same plan
 * reads it without touching it, so it can be reused.
 */
async function askProvider(
  checkout: CheckoutRow,
  ops: CheckoutProviderOps,
  now: Date,
  expire: boolean,
): Promise<Transition | null> {
  if (checkout.provider === "stripe") {
    let sessionId = checkout.stripeSessionId;
    const found: Transition = {};

    if (!sessionId) {
      // In flight, or orphaned by a crash. Only the latter is looked up.
      if (now.getTime() - checkout.createdAt.getTime() <= CHECKOUT_IN_FLIGHT_MS) {
        return null;
      }
      const customerId = (checkout.requestParams as { customer?: unknown } | null)
        ?.customer;
      if (typeof customerId !== "string") {
        // Nothing to search by: we cannot rule a session out.
        return { status: "unresolved", providerState: "unknown" };
      }
      const session = await ops.findStripeSession({
        checkoutId: checkout.id,
        customerId,
        createdAt: checkout.createdAt,
      });
      // Stripe has no session for it: the create never happened.
      if (!session) return { status: "failed", providerState: "not_created" };
      sessionId = session.sessionId;
      Object.assign(found, {
        stripeSessionId: session.sessionId,
        checkoutUrl: session.url,
        expiresAt: session.expiresAt,
      });
    }

    const result = expire
      ? await ops.expireStripeCheckout(sessionId)
      : await ops.stripeSessionState(sessionId);
    if (result.state === "expired") {
      return { ...found, status: "expired", providerState: "expired" };
    }
    if (result.state === "complete") {
      return {
        ...found,
        status: "completed",
        providerState: "complete",
        providerSubscriptionId: result.subscriptionId,
      };
    }
    // Only the read (stripeSessionState) reports where the session stands.
    const detail = result as { url?: string | null; expiresAt?: Date | null };
    const open: Transition = { ...found, providerState: "open" };
    if (detail.url) open.checkoutUrl = detail.url;
    if (detail.expiresAt) open.expiresAt = detail.expiresAt;
    return open;
  }

  /* PayPal */
  const subscriptionId = checkout.providerSubscriptionId;
  if (!subscriptionId) {
    if (now.getTime() - checkout.createdAt.getTime() <= CHECKOUT_IN_FLIGHT_MS) {
      return null;
    }
    /*
      A create call whose answer was lost. PayPal cannot be searched by our
      ids, so whether it made an approval is unknowable here. Conservative:
      unresolved, which keeps the website from being deleted under it.
    */
    return { status: "unresolved", providerState: "unknown" };
  }
  const state = await ops.payPalApprovalState(subscriptionId);
  if (state === "ended") return { status: "expired", providerState: "ended" };
  if (state === "live") {
    return { status: "completed", providerState: "live", providerSubscriptionId: subscriptionId };
  }
  return { providerState: "approval_pending" };
}

async function applyTransition(
  database: Executor,
  checkout: CheckoutRow,
  next: Transition,
  now: Date,
) {
  await database
    .update(billingCheckouts)
    .set({ ...next, lastCheckedAt: now, updatedAt: new Date() })
    .where(
      and(
        eq(billingCheckouts.id, checkout.id),
        // Compare-and-set: a webhook marking it completed meanwhile wins.
        eq(billingCheckouts.status, checkout.status),
      ),
    );
}

/**
 * Settles unsettled checkouts with their provider, ahead of a deletion or a
 * new checkout. Every status change is based on what the provider says.
 *
 * Runs OUTSIDE the caller's transaction: provider calls take seconds, and
 * holding row locks across them would stall every webhook for the site. The
 * caller re-reads the rows under lock afterwards and refuses anything this
 * could not settle, so a checkout opened after this ran is still caught.
 *
 * `keep` names checkouts a new checkout may reuse: those are read, never
 * expired.
 */
export async function settleOpenCheckouts(
  database: Database,
  scope: CheckoutScope,
  ops: CheckoutProviderOps,
  now: Date = new Date(),
  keep: (checkout: CheckoutRow) => boolean = () => false,
): Promise<Set<string>> {
  // Checkouts the provider answered for during this call.
  const answered = new Set<string>();
  const unsettled = await database
    .select()
    .from(billingCheckouts)
    .where(
      and(
        scopeCondition(scope),
        inArray(billingCheckouts.status, ["open", "unresolved", "abandoned"]),
      ),
    );

  for (const checkout of unsettled) {
    let next: Transition | null = null;
    try {
      next = await askProvider(checkout, ops, now, !keep(checkout));
    } catch (error) {
      console.error(
        `[checkouts] could not settle ${checkout.provider} checkout ${checkout.id}`,
        error,
      );
    }
    if (next) {
      await applyTransition(database, checkout, next, now);
      answered.add(checkout.id);
    }
  }
  return answered;
}

type LockedCheckout = Pick<
  CheckoutRow,
  "status" | "provider" | "providerSubscriptionId" | "providerState"
>;

/**
 * Why these checkouts stop a deletion, or null. Never based on the clock.
 *
 *  - Open or unresolved: the provider has not confirmed it can no longer be
 *    completed - still payable, a PayPal approval that cannot be withdrawn,
 *    or a lost create call.
 *  - Completed but not recorded: the provider has a subscription the webhook
 *    has not written yet. Deleting now would leave it billing with nothing
 *    on our side to cancel.
 */
export function checkoutBlockReason(
  checkouts: LockedCheckout[],
  recordedSubscriptionIds: Set<string>,
  subject: "website" | "workspace" = "website",
): string | null {
  for (const checkout of checkouts) {
    if (
      checkout.provider === "paypal" &&
      BLOCKING_DELETION.includes(checkout.status) &&
      (checkout.providerState === "approval_pending" || checkout.status !== "open")
    ) {
      return `A PayPal subscription for this ${subject} is still waiting for approval, and PayPal gives us no way to withdraw it. The ${subject} can be deleted once PayPal reports it expired, or once it is approved and then cancelled. Contact support if this does not clear.`;
    }
    if (BLOCKING_DELETION.includes(checkout.status)) {
      return `A checkout for this ${subject} is still open, and we could not confirm with the payment provider that it can no longer be paid. Try again in a few minutes.`;
    }
    if (
      checkout.status === "completed" &&
      (!checkout.providerSubscriptionId ||
        !recordedSubscriptionIds.has(checkout.providerSubscriptionId))
    ) {
      return `A payment for this ${subject} has just gone through and is still being recorded. Try again in a few minutes, then cancel the subscription before deleting.`;
    }
  }
  return null;
}

async function recordedIds(tx: Executor, ids: string[]): Promise<Set<string>> {
  const recorded = new Set<string>();
  if (ids.length === 0) return recorded;
  const rows = await tx
    .select({
      stripe: subscriptions.stripeSubscriptionId,
      paypal: subscriptions.paypalSubscriptionId,
    })
    .from(subscriptions)
    .where(
      or(
        inArray(subscriptions.stripeSubscriptionId, ids),
        inArray(subscriptions.paypalSubscriptionId, ids),
      ),
    );
  for (const row of rows) {
    if (row.stripe) recorded.add(row.stripe);
    if (row.paypal) recorded.add(row.paypal);
  }
  return recorded;
}

/**
 * Locks the checkouts in scope and returns why they block deletion, if they
 * do. Called inside the deletion's transaction, after the website (or
 * workspace) and subscription rows are locked - the shared lock order.
 */
export async function checkoutsBlockDeletion(
  tx: Transaction,
  scope: CheckoutScope,
  subject: "website" | "workspace",
): Promise<string | null> {
  const locked = await tx
    .select({
      status: billingCheckouts.status,
      provider: billingCheckouts.provider,
      providerSubscriptionId: billingCheckouts.providerSubscriptionId,
      providerState: billingCheckouts.providerState,
    })
    .from(billingCheckouts)
    .where(
      and(
        scopeCondition(scope),
        inArray(billingCheckouts.status, [...BLOCKING_DELETION, "completed"]),
      ),
    )
    .for("update");

  const recorded = await recordedIds(
    tx,
    locked
      .filter((c) => c.status === "completed" && c.providerSubscriptionId)
      .map((c) => c.providerSubscriptionId as string),
  );
  return checkoutBlockReason(locked, recorded, subject) ?? (await planChangeBlocksDeletion(tx, scope, subject));
}

/**
 * A PayPal upgrade's difference paid and not yet settled (lib/paypal/
 * plan-changes.ts): still waiting for the revision's approval, or being
 * refunded. Deleting now would delete the record that refunds it.
 */
async function planChangeBlocksDeletion(tx: Transaction, scope: CheckoutScope, subject: "website" | "workspace"): Promise<string | null> {
  const [held] = await tx
    .select({ id: paypalPlanChanges.id })
    .from(paypalPlanChanges)
    .innerJoin(subscriptions, eq(subscriptions.id, paypalPlanChanges.subscriptionId))
    .where(
      and(
        "websiteId" in scope ? eq(subscriptions.websiteId, scope.websiteId) : eq(paypalPlanChanges.organizationId, scope.organizationId),
        or(
          eq(paypalPlanChanges.status, "refunding"),
          and(eq(paypalPlanChanges.status, "awaiting_approval"), sql`${paypalPlanChanges.differenceCents} > 0`),
        ),
      ),
    )
    .limit(1);
  return held
    ? `A PayPal plan change for this ${subject} has been paid and is still waiting for approval or for its refund. The ${subject} can be deleted once that is settled (within 72 hours); contact support if this does not clear.`
    : null;
}

/* ------------------------------------------------------------------------- */
/* Opening a checkout                                                         */
/* ------------------------------------------------------------------------- */

/** Statuses at which a subscription can never bill again. */
const ENDED = new Set(["canceled", "incomplete_expired"]);
const ENTITLED = new Set(["active", "trialing", "past_due"]);

/**
 * Whether a workspace may still be given a free trial, from durable history:
 * no subscription has ever been recorded for it at either provider -
 * attached, detached, current or long cancelled - and no other checkout is
 * outstanding with a trial offered. Checked under a per-workspace lock so two
 * simultaneous checkouts cannot both be offered one.
 *
 * Per WORKSPACE, not per website: adding a second site, or cancelling and
 * subscribing again, is not a new trial.
 */
export async function isTrialEligible(
  executor: Pick<Executor, "select">,
  organizationId: string,
): Promise<boolean> {
  const [subscribed] = await executor
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        or(
          isNotNull(subscriptions.stripeSubscriptionId),
          isNotNull(subscriptions.paypalSubscriptionId),
        ),
      ),
    )
    .limit(1);
  if (subscribed) return false;

  const [offered] = await executor
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.organizationId, organizationId),
        sql`${billingCheckouts.trialDays} > 0`,
        inArray(billingCheckouts.status, ["open", "completed", "unresolved"]),
      ),
    )
    .limit(1);
  return !offered;
}

export type CurrentSubscriptionForChange = {
  subscriptionId: string;
  provider: CheckoutProvider;
  providerSubscriptionId: string;
  planId: string | null;
};

export type BeginCheckoutResult =
  /** A still-open checkout for the same plan: send the customer back to it. */
  | { kind: "reuse"; url: string }
  /** A new checkout row; the caller now calls the provider. */
  | { kind: "create"; checkoutId: string; trialDays: number }
  /** The website already pays through this provider: change its plan. */
  | { kind: "change_plan"; current: CurrentSubscriptionForChange }
  | { kind: "refuse"; error: string };

/**
 * Decides whether a website may start a checkout, and records it.
 *
 * ONE SUBSCRIPTION PER WEBSITE, ACROSS BOTH PROVIDERS:
 *  - A website already paying is sent to a plan CHANGE on its existing
 *    subscription (same provider), never a second subscription. Switching
 *    provider while one is live is refused: cancel first.
 *  - The one exception: a website on its free articles through PayPal
 *    starts the plan it picks NOW, with a second PayPal subscription that
 *    takes over from the free one and has it cancelled (replacesSubscriptionId).
 *  - An open checkout for the same provider and plan is REUSED rather than a
 *    second one being made.
 *  - Any other open checkout is settled with its provider first (a Stripe
 *    session is expired); one that cannot be settled refuses, as does one
 *    already paid but not yet recorded, or one still being created.
 *  - Nothing is released by AGE. A PayPal approval still pending at PayPal,
 *    or a checkout whose create answer was lost, blocks every replacement -
 *    any provider, any plan - until the provider confirms it cannot
 *    complete. The same provider and plan is reused instead. The one other
 *    way out is the customer's: coming back through PayPal's "Cancel and
 *    return" releases the approval (settlePayPalReturn).
 *
 * Serialised per website by taking it FOR UPDATE, and per workspace for the
 * trial decision, so concurrent requests are decided one at a time.
 */
export async function beginCheckout(
  database: Database,
  input: {
    organizationId: string;
    websiteId: string;
    provider: CheckoutProvider;
    planId: string;
    /** The offer this checkout carries (lib/billing/repget-offer.ts). An open one without it is not the same checkout. */
    offer?: string | null;
    /**
     * The Stripe price this checkout would be made at. An open one made at
     * another price is not the same checkout: it shows the old terms (2026-11-12,
     * the bundle's EUR 99 page still offered after its price became EUR 299 +
     * REPGET), so it is closed and a new one made.
     */
    price?: string | null;
  },
  ops: CheckoutProviderOps,
  now: Date = new Date(),
): Promise<BeginCheckoutResult> {
  const reusable = (c: CheckoutRow) =>
    BLOCKING_DELETION.includes(c.status) &&
    c.provider === input.provider &&
    c.planId === input.planId &&
    ((c.requestParams as { offer?: string } | null)?.offer ?? null) === (input.offer ?? null) &&
    (input.price === undefined || ((c.requestParams as { price?: string } | null)?.price ?? null) === input.price) &&
    Boolean(c.checkoutUrl);

  /*
    A once-per-account offer (the win-back discount) counts every other
    website's checkouts too, so learn which of those are over first. Read,
    never expired: they are somebody's open checkouts. REPGET is not one: the
    launch price goes on every checkout while it is on.
  */
  if (input.offer && input.offer !== REPGET_CODE) await settleOpenCheckouts(database, { organizationId: input.organizationId }, ops, now, () => true);

  /*
    Only a checkout the provider answered for during THIS request is trusted
    to still be open, and so to be sent back to.
  */
  const answered = await settleOpenCheckouts(
    database,
    { websiteId: input.websiteId },
    ops,
    now,
    reusable,
  );

  return database.transaction(async (tx): Promise<BeginCheckoutResult> => {
    const [org] = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, input.organizationId))
      .for("key share");
    if (!org) return { kind: "refuse", error: "Website not found" };

    const [site] = await tx
      .select({ id: websites.id })
      .from(websites)
      .where(
        and(
          eq(websites.id, input.websiteId),
          eq(websites.organizationId, input.organizationId),
        ),
      )
      .for("update");
    if (!site) return { kind: "refuse", error: "Website not found" };

    const [current] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.websiteId, site.id))
      .for("update");

    const currentId = current?.stripeSubscriptionId ?? current?.paypalSubscriptionId ?? null;
    /** Set when this checkout starts the plan now, in place of the website's PayPal free articles. */
    let replaces: string | null = null;
    if (current && currentId && !ENDED.has(current.status)) {
      /*
        Cancelled in PayPal and running out the time paid for (review M1):
        PayPal can neither revise nor resume a cancelled subscription, and a
        second one now would bill the website twice. A new plan, by card or
        PayPal, can start once that time is over.
      */
      if (current.provider === "paypal" && current.cancelAtPeriodEnd) {
        const until = current.currentPeriodEnd ? ` until ${current.currentPeriodEnd.toISOString().slice(0, 10)}` : "";
        return {
          kind: "refuse",
          error: `This website's PayPal subscription is cancelled and its plan runs${until}. You can choose a plan again, by card or PayPal, once it has ended.`,
        };
      }
      if (current.provider !== input.provider) {
        const name = current.provider === "paypal" ? "PayPal" : "card (Stripe)";
        return {
          kind: "refuse",
          error: `This website is already billed by ${name}. Change its plan there, or cancel that subscription first.`,
        };
      }
      if (current.provider === "paypal" && current.status === "trialing") {
        /*
          On its free articles through PayPal (2026-10-22). PayPal moves a
          subscription to another plan only from its next billing cycle, so
          the free days cannot be cut short: choosing a plan - the same one
          or another - STARTS it now instead. A new PayPal subscription to
          that plan, charged on approval, which takes over from the free one
          once PayPal has activated it; the free one is then cancelled,
          nothing ever charged on it (subscription-sync.ts,
          "replaced_free_articles"). Opened below like any checkout.
        */
        replaces = currentId;
      } else if (ENTITLED.has(current.status) || current.cancelAtPeriodEnd) {
        return {
          kind: "change_plan",
          current: {
            subscriptionId: current.id,
            provider: current.provider as CheckoutProvider,
            providerSubscriptionId: currentId,
            planId: current.planId,
          },
        };
      } else {
        return {
          kind: "refuse",
          error: `This website's subscription is ${current.status.replace(/_/g, " ")}. Settle or cancel it before starting another.`,
        };
      }
    }

    /*
      Every checkout the provider has not confirmed dead: open, unresolved
      (a lost create call) and abandoned (older versions) alike. Any of them
      could still turn into a subscription, so none may be replaced.
    */
    const pending = await tx
      .select()
      .from(billingCheckouts)
      .where(
        and(
          eq(billingCheckouts.websiteId, site.id),
          inArray(billingCheckouts.status, [...BLOCKING_DELETION, "completed"]),
        ),
      )
      .for("update");

    const recorded = await recordedIds(
      tx,
      pending
        .filter((c) => c.status === "completed" && c.providerSubscriptionId)
        .map((c) => c.providerSubscriptionId as string),
    );

    for (const checkout of pending) {
      if (checkout.status === "completed") {
        if (
          !checkout.providerSubscriptionId ||
          !recorded.has(checkout.providerSubscriptionId)
        ) {
          return {
            kind: "refuse",
            error: "A payment for this website has just gone through and is still being recorded. Refresh in a minute.",
          };
        }
        continue;
      }

      /*
        Still payable, or unknown. The same provider and plan, which the
        provider confirmed moments ago is still waiting to be paid, is sent
        back to; anything else blocks. There is no timeout: how old a
        checkout is says nothing about whether it can still be paid, and
        releasing a PayPal approval by age is how two live subscriptions
        were made for one site.
      */
      if (
        reusable(checkout) &&
        answered.has(checkout.id) &&
        (checkout.providerState === "open" || checkout.providerState === "approval_pending") &&
        (checkout.provider !== "stripe" ||
          !checkout.expiresAt ||
          checkout.expiresAt.getTime() > now.getTime() + REUSE_MARGIN_MS)
      ) {
        return { kind: "reuse", url: checkout.checkoutUrl! };
      }

      const providerId =
        checkout.provider === "stripe" ? checkout.stripeSessionId : checkout.providerSubscriptionId;
      if (!providerId && now.getTime() - checkout.createdAt.getTime() <= CHECKOUT_IN_FLIGHT_MS) {
        return {
          kind: "refuse",
          error: "A checkout for this website is already being prepared. Try again in a moment.",
        };
      }

      if (checkout.provider === "paypal" && checkout.providerState === "approval_pending") {
        return {
          kind: "refuse",
          error:
            "A PayPal approval for this website is still waiting. Finish it in PayPal, or wait until PayPal reports it expired, before choosing another plan or payment method.",
        };
      }

      if (!providerId || checkout.status !== "open") {
        // A create call whose answer was lost and cannot be looked up.
        return {
          kind: "refuse",
          error:
            "We could not confirm whether an earlier checkout for this website can still be paid. Contact support before starting another.",
        };
      }

      return {
        kind: "refuse",
        error: "An earlier checkout for this website is still open and could not be closed. Try again in a few minutes.",
      };
    }

    /*
      Trial eligibility from durable history, under a per-workspace lock so
      two sites' simultaneous checkouts cannot both be offered a trial. A
      PayPal checkout offers it too when the plan has its free-articles
      PayPal plan (plans.paypal_trial_plan_id, 2026-10-22); the caller then
      subscribes to that one. Never when starting the plan now: that is the
      end of the free articles.
    */
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`trial:${org.id}`}, 0))`,
    );
    /*
      One redemption per USER ACCOUNT for the win-back discount (owner's
      decision, 2026-11-07): the account that owns this workspace, across
      EVERY workspace it owns, so a second workspace cannot take the offer
      again. Not REPGET any more (2026-11-11): its launch price goes on every
      checkout while the offer is on, returning customers included. Decided
      under a lock per owner (taken in a fixed order, after the workspace lock
      above, so two checkouts in two of the account's workspaces wait for each
      other and never deadlock). Completed used it. Open, or not yet known,
      holds it. Expired or failed gives it back, so opening a checkout does
      not spend it. Any provider: a PayPal checkout carrying the offer counts
      too. A workspace with no recorded owner falls back to itself.
    */
    if (input.offer && input.offer !== REPGET_CODE) {
      const owners = await accountOwners(tx, org.id);
      for (const owner of owners) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`offer:${input.offer}:user:${owner}`}, 0))`);
      }
      const state = await offerStateOfAccount(tx, org.id, owners, input.offer);
      const offerName = input.offer === WINBACK_CODE ? "welcome-back" : input.offer;
      if (state === "used") {
        return { kind: "refuse", error: `Your account has already used the ${offerName} discount.` };
      }
      if (state === "held") {
        return { kind: "refuse", error: `The ${offerName} discount is on another checkout of your account. Finish that one, or try again once it has expired.` };
      }
    }

    /*
      The free articles: never when starting the plan now, and never on a plan
      bought outright (the Grow + Visibility bundle, lib/plans/features.ts
      DIRECT_PURCHASE_TIERS) - its first payment is taken at checkout.
    */
    const chosen = await planForCheckout(tx, input.planId);
    const freeArticlesPossible =
      replaces === null &&
      !isDirectPurchaseTier(chosen?.tier) &&
      (input.provider === "stripe" || (input.provider === "paypal" && Boolean(chosen?.paypalTrialPlanId)));
    const trialDays = freeArticlesPossible && (await isTrialEligible(tx, org.id)) ? FREE_ARTICLES_DAYS : 0;

    const [row] = await tx
      .insert(billingCheckouts)
      .values({
        organizationId: org.id,
        websiteId: site.id,
        provider: input.provider,
        planId: input.planId,
        status: "open",
        trialDays,
        replacesSubscriptionId: replaces,
        // Written here, under the lock, so a second checkout sees it. The request recorded next keeps it.
        ...(input.offer ? { requestParams: { offer: input.offer } } : {}),
        /*
          From the app clock, not the column default: settleOpenCheckouts
          compares it with the app clock, and a database session in another
          time zone would make a brand-new checkout look hours old.
        */
        createdAt: now,
      })
      .returning({ id: billingCheckouts.id });
    return { kind: "create", checkoutId: row.id, trialDays };
  });
}

/** What the trial decision needs of the plan: its tier, and whether it has its free-articles PayPal plan (scripts/paypal-setup.mjs). */
async function planForCheckout(executor: Pick<Executor, "select">, planId: string) {
  const [plan] = await executor
    .select({ tier: plans.tier, paypalTrialPlanId: plans.paypalTrialPlanId })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);
  return plan ?? null;
}

/** The user accounts that own a workspace, sorted (the order their offer locks are taken in). */
async function accountOwners(executor: Pick<Executor, "select">, organizationId: string): Promise<string[]> {
  const rows = await executor
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")));
  return [...new Set(rows.map((row) => row.userId))].sort();
}

/**
 * Where an account stands with an offer, across every workspace its owners
 * own (a workspace with no recorded owner counts alone): a completed checkout
 * USED it; an open or not-yet-known one HOLDS it; expired or failed ones gave
 * it back.
 */
async function offerStateOfAccount(
  executor: Pick<Executor, "select">,
  organizationId: string,
  owners: string[],
  offer: string,
): Promise<OfferState> {
  const workspaces =
    owners.length === 0
      ? [organizationId]
      : [
          ...new Set([
            organizationId,
            ...(
              await executor
                .select({ organizationId: member.organizationId })
                .from(member)
                .where(and(inArray(member.userId, owners), eq(member.role, "owner")))
            ).map((row) => row.organizationId),
          ]),
        ];
  const taken = await executor
    .select({ status: billingCheckouts.status })
    .from(billingCheckouts)
    .where(
      and(
        inArray(billingCheckouts.organizationId, workspaces),
        inArray(billingCheckouts.status, [...BLOCKING_DELETION, "completed"]),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${offer}`,
      ),
    );
  if (taken.some((row) => row.status === "completed")) return "used";
  return taken.length > 0 ? "held" : "available";
}

/** Where an account stands with a once-per-account offer (the win-back discount). */
export type OfferState = "available" | "held" | "used";

/**
 * The coupon a new checkout for this plan carries by itself (client,
 * 2026-11-11: "we auto apply the repget coupon code 40% OFF at the checkout"):
 * the plan's REPGET launch-price coupon while the offer is on and the plan is
 * covered, for every checkout - there is no "one use per account" for it any
 * more, so a returning customer gets it too. Null otherwise - the checkout
 * then goes without it.
 */
export function automaticRepgetCoupon(plan: OfferPlan): string | null {
  return repgetOfferEnabled() ? repgetCouponFor(plan) : null;
}

/** The win-back email's kind (lib/email/lifecycle-copy.ts), named here so billing does not import the email module. */
const WINBACK_EMAIL_KIND = "winback";

/**
 * Whether the account owning this workspace may get the win-back discount
 * (lib/billing/winback-offer.ts): "none" unless one of its owners was SENT
 * the win-back email; then "used" once a checkout carrying it completed and
 * "held" while one is open. Read without a lock; beginCheckout
 * decides again under the account's lock.
 */
export async function winbackOfferState(
  executor: Pick<Executor, "select">,
  organizationId: string,
): Promise<OfferState | "none"> {
  const owners = await accountOwners(executor, organizationId);
  if (owners.length === 0) return "none";
  const [emailed] = await executor
    .select({ sentAt: lifecycleEmails.updatedAt })
    .from(lifecycleEmails)
    .where(
      and(
        eq(lifecycleEmails.kind, WINBACK_EMAIL_KIND),
        eq(lifecycleEmails.status, "sent"),
        inArray(lifecycleEmails.userId, owners),
      ),
    )
    .orderBy(lifecycleEmails.updatedAt)
    .limit(1);
  if (!emailed) return "none";
  /*
    One restart only: a plan restarted with REPGET after the email was sent
    (its row's updatedAt, set by the app clock when it went out, as the
    checkout's createdAt is; REPGET
    won, and the win-back's credits went with it - lib/billing/winback.ts)
    used the win-back too.
  */
  const [restarted] = await executor
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .innerJoin(member, and(eq(member.organizationId, billingCheckouts.organizationId), eq(member.role, "owner")))
    .where(
      and(
        inArray(member.userId, owners),
        eq(billingCheckouts.status, "completed"),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
        gt(billingCheckouts.createdAt, emailed.sentAt),
      ),
    )
    .limit(1);
  if (restarted) return "used";
  return offerStateOfAccount(executor, organizationId, owners, WINBACK_CODE);
}

/**
 * Which discount the plan screens say is applied (Billing, the onboarding plan
 * step): REPGET while the offer is on, else the win-back offer for an account
 * that was sent it and has not used it, else none. The same order as
 * automaticOffer; checkout decides again per plan.
 */
export async function planScreenOffer(
  executor: Pick<Executor, "select">,
  organizationId: string,
): Promise<"repget" | "winback" | null> {
  if (repgetOfferEnabled()) return "repget";
  if (!winbackOfferEnabled()) return null;
  const state = await winbackOfferState(executor, organizationId);
  return state === "none" || state === "used" ? null : "winback";
}

/** The discount a new checkout carries by itself: which offer, its Stripe coupon, and what it takes off (REPGET: every payment; win-back: the first). */
export type AutomaticOffer = { code: string; coupon: string; discountCents: number };

/**
 * The ONE discount a new checkout for this plan carries, chosen by the server
 * and never stacked: REPGET while the offer is on (the bigger discount; the
 * win-back credits still follow - lib/billing/winback.ts), otherwise the
 * win-back discount for an account that was sent the win-back email and has
 * not used it. Null for
 * neither - the checkout then has Stripe's promotion-code box instead (a
 * partner's code). beginCheckout makes the final decision on the win-back
 * discount under the account's lock.
 */
export async function automaticOffer(
  executor: Pick<Executor, "select">,
  organizationId: string,
  plan: OfferPlan,
): Promise<AutomaticOffer | null> {
  const repget = automaticRepgetCoupon(plan);
  const repgetOff = repget ? repgetDiscountCents(plan) : null;
  if (repget && repgetOff !== null) return { code: REPGET_CODE, coupon: repget, discountCents: repgetOff };
  if (!winbackOfferEnabled()) return null;
  const off = winbackCovers(plan) ? winbackDiscountCents(plan) : null;
  if (off === null) return null;
  const state = await winbackOfferState(executor, organizationId);
  return state === "none" || state === "used" ? null : { code: WINBACK_CODE, coupon: WINBACK_COUPON, discountCents: off };
}

/** How long a released PayPal approval is still asked about, in case it is approved after all. */
const RELEASED_WATCH_MS = 30 * 24 * 60 * 60 * 1000;

/** How often a released approval is asked about: rarely, as nobody is waiting on it. */
const RELEASED_RECHECK_MS = 6 * 60 * 60 * 1000;

/**
 * Settles checkouts nobody is waiting on - crashed creates and open sessions
 * past their expiry hint - from the billing-maintenance job, so their status
 * reflects the provider without needing a deletion or a new checkout to
 * trigger it. Reads Stripe sessions rather than expiring them: a customer
 * may still be on the payment page.
 *
 * A PayPal approval PayPal reports live is RECORDED here too, through the
 * same sync its webhook runs: a webhook that never arrives (a wrong webhook
 * id, an outage longer than PayPal's retries) must not leave a paying
 * customer without their plan. Released approvals are watched for a month,
 * so one approved after all is recorded - and, if the website pays through
 * something else by then, cancelled - even without its webhook.
 */
export async function reconcileCheckouts(
  database: Database,
  ops: CheckoutProviderOps,
  now: Date = new Date(),
  limit = 25,
): Promise<number> {
  const before = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const due = await database
    .select()
    .from(billingCheckouts)
    .where(
      and(
        or(
          and(
            inArray(billingCheckouts.status, ["open", "unresolved"]),
            or(
              isNull(billingCheckouts.lastCheckedAt),
              sql`${billingCheckouts.lastCheckedAt} < ${before(15 * 60 * 1000)}::timestamp`,
            ),
          ),
          and(
            eq(billingCheckouts.status, "released"),
            sql`${billingCheckouts.createdAt} > ${before(RELEASED_WATCH_MS)}::timestamp`,
            or(
              isNull(billingCheckouts.lastCheckedAt),
              sql`${billingCheckouts.lastCheckedAt} < ${before(RELEASED_RECHECK_MS)}::timestamp`,
            ),
          ),
        ),
        sql`${billingCheckouts.createdAt} < ${before(CHECKOUT_IN_FLIGHT_MS)}::timestamp`,
        // Unresolved rows with no provider id cannot be looked up.
        or(
          ne(billingCheckouts.status, "unresolved"),
          isNotNull(billingCheckouts.providerSubscriptionId),
          isNotNull(billingCheckouts.stripeSessionId),
        ),
      ),
    )
    .limit(limit);

  let settled = 0;
  for (const checkout of due) {
    try {
      const next = await askProvider(checkout, ops, now, false);
      if (next) {
        /*
          Recorded BEFORE the checkout is marked completed: a sync that
          fails leaves the row as it was, to be asked again next run.
        */
        if (next.status === "completed" && checkout.provider === "paypal" && next.providerSubscriptionId) {
          const synced = await ops.syncPayPalSubscription?.(next.providerSubscriptionId);
          /*
            Approved, but not yet active at PayPal, and waiting to take over
            from the website's free articles: the sync records it only once
            it is (awaitsActivation), so the checkout stays open and is asked
            about again next run.
          */
          if (awaitsActivation(synced)) {
            await applyTransition(database, checkout, { providerState: "approved" }, now);
            continue;
          }
        }
        await applyTransition(database, checkout, next, now);
        if (next.status && next.status !== checkout.status) settled += 1;
      }
    } catch (error) {
      console.error(`[checkouts] could not reconcile checkout ${checkout.id}`, error);
    }
  }
  return settled;
}

/** How long after a PayPal checkout completed a success return still reads its subscription back. */
const RETURN_RESYNC_MS = 24 * 60 * 60 * 1000;

export type PayPalReturnSettled = {
  /** Subscriptions read back from PayPal and recorded. */
  synced: string[];
  /** Approved plans started now, recorded once PayPal activates them (awaitsActivation). */
  awaiting: string[];
  /** Approvals released because the customer walked away from them. */
  released: string[];
  /** Approvals PayPal still reports awaiting the buyer. */
  pending: string[];
};

/**
 * The customer is back from PayPal, on the return or the cancel URL. Keyed
 * on the workspace and website the CALLER established from the session -
 * never on the subscription id PayPal appends to the address, which anyone
 * can edit. Every change still rests on what PayPal says when asked now.
 *
 *  - Success: each of the website's PayPal checkouts PayPal reports live is
 *    recorded through the webhook's own sync, so a late or missed webhook
 *    no longer leaves a paying customer without a plan. A checkout completed
 *    in the last day whose subscription is unrecorded, or recorded before
 *    PayPal activated it ("incomplete"), is read again.
 *  - Cancelled: an approval PayPal still reports APPROVAL_PENDING is
 *    RELEASED, so it stops blocking card checkout, other plans and deletion
 *    for good. PayPal gives no way to withdraw it; if it is approved later
 *    anyway, the sync records it and, should the website already pay
 *    through something else, owes its cancellation.
 *
 * Either way an approval PayPal reports ended is marked expired. A provider
 * call that fails changes nothing: the checkout keeps its status, and the
 * maintenance job asks again.
 */
export async function settlePayPalReturn(
  database: Database,
  scope: { organizationId: string; websiteId: string },
  outcome: "success" | "cancelled",
  ops: CheckoutProviderOps,
  now: Date = new Date(),
): Promise<PayPalReturnSettled> {
  const settled: PayPalReturnSettled = { synced: [], awaiting: [], released: [], pending: [] };
  const rows = await database
    .select({ checkout: billingCheckouts, recordedStatus: subscriptions.status })
    .from(billingCheckouts)
    .leftJoin(
      subscriptions,
      eq(subscriptions.paypalSubscriptionId, billingCheckouts.providerSubscriptionId),
    )
    .where(
      and(
        eq(billingCheckouts.organizationId, scope.organizationId),
        eq(billingCheckouts.websiteId, scope.websiteId),
        eq(billingCheckouts.provider, "paypal"),
        isNotNull(billingCheckouts.providerSubscriptionId),
        outcome === "success"
          ? or(
              eq(billingCheckouts.status, "open"),
              and(
                eq(billingCheckouts.status, "completed"),
                sql`${billingCheckouts.updatedAt} > ${new Date(now.getTime() - RETURN_RESYNC_MS).toISOString()}::timestamp`,
              ),
            )
          : eq(billingCheckouts.status, "open"),
      ),
    );

  for (const { checkout, recordedStatus } of rows) {
    // Completed and recorded as PayPal had it once active: nothing to read.
    if (checkout.status === "completed" && recordedStatus !== null && recordedStatus !== "incomplete") {
      continue;
    }
    const subscriptionId = checkout.providerSubscriptionId!;
    try {
      const state = await ops.payPalApprovalState(subscriptionId);
      if (state === "live") {
        if (ops.syncPayPalSubscription) {
          const synced = await ops.syncPayPalSubscription(subscriptionId);
          (awaitsActivation(synced) ? settled.awaiting : settled.synced).push(subscriptionId);
        }
        continue;
      }
      if (checkout.status !== "open") continue;
      if (state === "ended") {
        await applyTransition(database, checkout, { status: "expired", providerState: "ended" }, now);
        continue;
      }
      if (outcome === "cancelled") {
        await applyTransition(database, checkout, { status: "released", providerState: "approval_pending" }, now);
        settled.released.push(subscriptionId);
      } else {
        await applyTransition(database, checkout, { providerState: "approval_pending" }, now);
        settled.pending.push(subscriptionId);
      }
    } catch (error) {
      console.error(`[checkouts] could not settle the PayPal return for checkout ${checkout.id}`, error);
    }
  }
  return settled;
}

/** How old an unfinished PayPal approval is before the billing page offers to cancel it: PayPal finishes a real approval in seconds. */
export const UNFINISHED_APPROVAL_MS = 10 * 60 * 1000;

/**
 * Whether this website has a PayPal approval that was started and never
 * finished - not paid, not cancelled with "Cancel and return", not ended -
 * for at least UNFINISHED_APPROVAL_MS. It blocks card checkout, other plans
 * and deletion (beginCheckout). Closing PayPal's tab leaves one, so the
 * billing and plan pages offer to cancel it (review H1, 2026-10-20) through
 * the same release as "Cancel and return" (settlePayPalReturn), which only
 * releases what PayPal still reports unapproved.
 */
export async function hasUnfinishedPayPalApproval(
  database: Pick<Database, "select">,
  scope: { organizationId: string; websiteId: string },
  now: Date = new Date(),
): Promise<boolean> {
  const [row] = await database
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.organizationId, scope.organizationId),
        eq(billingCheckouts.websiteId, scope.websiteId),
        eq(billingCheckouts.provider, "paypal"),
        eq(billingCheckouts.status, "open"),
        isNotNull(billingCheckouts.providerSubscriptionId),
        sql`${billingCheckouts.createdAt} < ${new Date(now.getTime() - UNFINISHED_APPROVAL_MS).toISOString()}::timestamp`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Whether this PayPal subscription comes from an approval our ledger had
 * already let go of - released by the customer, or reported ended - so
 * another checkout for its website was allowed meanwhile. Read by the sync
 * before it marks the checkout completed.
 */
export async function isReleasedApproval(
  tx: Executor,
  match: { providerSubscriptionId: string; checkoutId: string | null },
): Promise<boolean> {
  const [row] = await tx
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.provider, "paypal"),
        inArray(billingCheckouts.status, ["released", "expired"]),
        match.checkoutId
          ? or(
              eq(billingCheckouts.id, match.checkoutId),
              eq(billingCheckouts.providerSubscriptionId, match.providerSubscriptionId),
            )
          : eq(billingCheckouts.providerSubscriptionId, match.providerSubscriptionId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The subscription a "Start your plan now" checkout was opened to take over
 * from (replacesSubscriptionId), for the subscription that checkout made -
 * matched by our checkout id or the PayPal subscription id, and only within
 * the workspace and website the sync resolved. Null for any other
 * subscription. Read by the sync (subscription-sync.ts).
 */
export async function replacedSubscription(
  tx: Executor,
  match: {
    provider: CheckoutProvider;
    providerSubscriptionId: string;
    checkoutId: string | null;
    organizationId: string;
    websiteId: string;
  },
): Promise<string | null> {
  const [row] = await tx
    .select({ replaces: billingCheckouts.replacesSubscriptionId })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.provider, match.provider),
        eq(billingCheckouts.organizationId, match.organizationId),
        eq(billingCheckouts.websiteId, match.websiteId),
        isNotNull(billingCheckouts.replacesSubscriptionId),
        match.checkoutId
          ? or(
              eq(billingCheckouts.id, match.checkoutId),
              eq(billingCheckouts.providerSubscriptionId, match.providerSubscriptionId),
            )
          : eq(billingCheckouts.providerSubscriptionId, match.providerSubscriptionId),
      ),
    )
    .limit(1);
  return row?.replaces ?? null;
}

/**
 * Whether a sync (syncProviderSubscription's result, through
 * CheckoutProviderOps.syncPayPalSubscription) recorded nothing yet because
 * the plan started now is approved but not yet active at PayPal. Its
 * checkout stays open until it is.
 */
export function awaitsActivation(synced: unknown): boolean {
  return (synced as { outcome?: unknown } | null | undefined)?.outcome === "awaiting_activation";
}
