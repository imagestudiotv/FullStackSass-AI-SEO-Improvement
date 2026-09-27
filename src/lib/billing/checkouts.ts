import { and, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import {
  billingCheckouts,
  organization,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import type { Database, Executor, Transaction } from "@/lib/db/types";
import { TRIAL_DAYS } from "@/lib/plans/features";

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
  return checkoutBlockReason(locked, recorded, subject);
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
 *  - An open checkout for the same provider and plan is REUSED rather than a
 *    second one being made.
 *  - Any other open checkout is settled with its provider first (a Stripe
 *    session is expired); one that cannot be settled refuses, as does one
 *    already paid but not yet recorded, or one still being created.
 *  - Nothing is released by AGE. A PayPal approval still pending at PayPal,
 *    or a checkout whose create answer was lost, blocks every replacement -
 *    any provider, any plan - until the provider confirms it cannot
 *    complete. The same provider and plan is reused instead.
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
  },
  ops: CheckoutProviderOps,
  now: Date = new Date(),
): Promise<BeginCheckoutResult> {
  const reusable = (c: CheckoutRow) =>
    BLOCKING_DELETION.includes(c.status) &&
    c.provider === input.provider &&
    c.planId === input.planId &&
    Boolean(c.checkoutUrl);

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
    if (current && currentId && !ENDED.has(current.status)) {
      if (current.provider !== input.provider) {
        const name = current.provider === "paypal" ? "PayPal" : "card (Stripe)";
        return {
          kind: "refuse",
          error: `This website is already billed by ${name}. Change its plan there, or cancel that subscription first.`,
        };
      }
      if (ENTITLED.has(current.status) || current.cancelAtPeriodEnd) {
        return {
          kind: "change_plan",
          current: {
            subscriptionId: current.id,
            provider: current.provider as CheckoutProvider,
            providerSubscriptionId: currentId,
            planId: current.planId,
          },
        };
      }
      return {
        kind: "refuse",
        error: `This website's subscription is ${current.status.replace(/_/g, " ")}. Settle or cancel it before starting another.`,
      };
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
      two sites' simultaneous checkouts cannot both be offered a trial.
      PayPal plans carry no trial cycle, so a PayPal checkout offers none.
    */
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`trial:${org.id}`}, 0))`,
    );
    const trialDays =
      input.provider === "stripe" && (await isTrialEligible(tx, org.id)) ? TRIAL_DAYS : 0;

    const [row] = await tx
      .insert(billingCheckouts)
      .values({
        organizationId: org.id,
        websiteId: site.id,
        provider: input.provider,
        planId: input.planId,
        status: "open",
        trialDays,
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

/**
 * Settles checkouts nobody is waiting on - crashed creates and open sessions
 * past their expiry hint - from the billing-maintenance job, so their status
 * reflects the provider without needing a deletion or a new checkout to
 * trigger it. Reads Stripe sessions rather than expiring them: a customer
 * may still be on the payment page.
 */
export async function reconcileCheckouts(
  database: Database,
  ops: CheckoutProviderOps,
  now: Date = new Date(),
  limit = 25,
): Promise<number> {
  const due = await database
    .select()
    .from(billingCheckouts)
    .where(
      and(
        inArray(billingCheckouts.status, ["open", "unresolved"]),
        sql`${billingCheckouts.createdAt} < ${new Date(now.getTime() - CHECKOUT_IN_FLIGHT_MS).toISOString()}::timestamp`,
        or(
          isNull(billingCheckouts.lastCheckedAt),
          sql`${billingCheckouts.lastCheckedAt} < ${new Date(now.getTime() - 15 * 60 * 1000).toISOString()}::timestamp`,
        ),
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
        await applyTransition(database, checkout, next, now);
        if (next.status && next.status !== checkout.status) settled += 1;
      }
    } catch (error) {
      console.error(`[checkouts] could not reconcile checkout ${checkout.id}`, error);
    }
  }
  return settled;
}
