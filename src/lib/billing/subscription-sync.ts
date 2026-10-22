import { eq, sql } from "drizzle-orm";

import {
  oweCancellation,
  processCancellations,
  type CancellationOps,
} from "@/lib/billing/cancellations";
import { isEntitled } from "@/lib/billing-shared";
import {
  isReleasedApproval,
  markCheckoutCompleted,
  replacedSubscription,
  type CheckoutProvider,
} from "@/lib/billing/checkouts";
import { organization, subscriptions, websites } from "@/lib/db/schema";
import type { Database, Executor, Transaction } from "@/lib/db/types";
import { isSubscriptionEnded } from "@/lib/websites/deletion";

/**
 * Writes what Stripe or PayPal says about a subscription.
 *
 * Shared by both webhooks, the webhook recovery job and the in-app PayPal
 * cancel, so the rules below hold identically for each.
 *
 * ORDERING: THE PROVIDER'S CURRENT STATE, READ UNDER A PER-SUBSCRIPTION LOCK.
 * Events arrive late and out of order - a "cancelled" and then a delayed
 * "updated" carrying the older active snapshot, for the SAME subscription.
 * Writing whichever snapshot arrived last resurrected cancelled plans. So the
 * event body is never written: each sync takes a transaction-scoped advisory
 * lock on the provider subscription id and only then reads the subscription
 * from the provider (`load`). Two syncs of one subscription therefore read
 * and write one after the other, and the later read - which sees the
 * provider's later state - is also the later write. No event timestamp is
 * trusted to order anything.
 *
 * THE PROVIDER'S SUBSCRIPTION ID IS THE IDENTITY. A row, once written, keeps
 * that id for good - website deletion detaches the row (website_id SET NULL)
 * rather than deleting it - and every later event is matched to the row by
 * that id first. The website named in provider metadata is only consulted
 * for a subscription we have never seen. That stops a late event for a
 * deleted site recreating the link or attaching it to another site, and a
 * late event for an old subscription overwriting the site's current one.
 *
 * A subscription that is live for a website or workspace that was deleted
 * is OWED A CANCELLATION: a row written in this transaction
 * (cancellations.ts), worked off straight after commit and, until the
 * provider confirms, by the billing-maintenance job - never dependent on
 * another event arriving.
 *
 * A second live subscription for a website that already has one is recorded
 * detached, with the website it claimed, and reported for reconciliation. It
 * is never cancelled automatically: which one to keep is the customer's call.
 * ONE EXCEPTION: a PayPal approval our checkout ledger had already let go of
 * (released when the customer walked away from it, or reported ended) that
 * activates anyway. The website was allowed another checkout BECAUSE it was
 * let go, so it is the one owed a cancellation. PayPal takes the first
 * payment on activation; that payment is refunded by a person, in PayPal
 * (docs/paypal-go-live.md, reconciliation report releasedApprovalsToRefund).
 *
 * "START YOUR PLAN NOW" (2026-10-22). A website on its free articles through
 * PayPal starts its plan early with a second PayPal subscription, opened to
 * take over from the free one (billing_checkouts.replaces_subscription_id;
 * PayPal cannot cut a subscription's free days short). Once PayPal has
 * activated it, it is attached and the free one detached and owed a
 * cancellation - nothing was ever charged on it. Until then it is not
 * recorded at all, and its checkout stays open: a row written while it was
 * only approved would be detached for good, and the free articles must not
 * end before the plan has started.
 *
 * Lock order matches deletion: (subscription advisory lock), organization,
 * website, subscriptions, checkouts.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Metadata is free text at the provider; a malformed id must not reach a uuid cast. */
export function asUuid(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export type SubscriptionValues = {
  status: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  /** Omitted when the provider's price is not one of ours: keep the old plan. */
  planId?: string | null;
};

/** What the provider says now, as resolved by the caller's loader. */
export type SubscriptionSnapshot = {
  /** The workspace this resolved to (metadata, checked to exist, or customer mapping). */
  organizationId: string | null;
  /** The workspace our checkout wrote into the provider's metadata, if any. */
  claimedOrganizationId: string | null;
  /** The website our checkout wrote into the provider's metadata, if any. */
  claimedWebsiteId: string | null;
  /** Our billing_checkouts id, carried in provider metadata. */
  checkoutId?: string | null;
  stripeSessionId?: string | null;
  values: SubscriptionValues;
};

export type SyncInput = {
  provider: CheckoutProvider;
  providerSubscriptionId: string;
  /**
   * Reads the subscription from the provider. Called UNDER the lock - never
   * pass an event's embedded snapshot. Null when the provider has no such
   * subscription. Any database read it makes goes through `tx`: the sync's
   * own transaction, not a second connection.
   */
  load: (tx: Executor) => Promise<SubscriptionSnapshot | null>;
};

export type SyncOutcome =
  /** Known subscription, matched by provider id and updated in place. */
  | "updated"
  /** New subscription attached to the website it pays for. */
  | "attached"
  /** New subscription attached; the site's ended one kept, detached. */
  | "replaced"
  /**
   * A plan started now: attached in place of the site's free-articles
   * subscription, which is kept detached and owed a cancellation.
   */
  | "replaced_free_articles"
  /**
   * A plan started now, approved but not yet active at the provider: nothing
   * recorded until it is, so the free articles carry on meanwhile.
   */
  | "awaiting_activation"
  /** An older subscription we had lost track of: recorded, not attached. */
  | "detached_stale"
  /** A second live subscription for a site that already has one. */
  | "detached_duplicate"
  /**
   * A released PayPal approval that activated anyway while its site already
   * had a live subscription: recorded, and cancelled. Its payment needs a refund.
   */
  | "detached_released_approval"
  /** Its website was deleted: recorded for reconciliation, and cancelled. */
  | "detached_deleted_website"
  /** Metadata names a website in another workspace: recorded, not attached. */
  | "detached_foreign_website"
  /** Names no website (pre per-site billing, or made by hand). */
  | "detached_unattributed"
  /** Its workspace was deleted: nothing can be recorded; cancelled. */
  | "orphaned_deleted_workspace"
  /** No workspace at all and none was ever claimed: left alone. */
  | "ignored_no_owner"
  /** The provider has no such subscription. */
  | "ignored_not_found";

export type SyncResult = {
  outcome: SyncOutcome;
  /** A cancellation was owed by this sync. */
  cancellationOwed: boolean;
  /** ...and the provider has already confirmed it. */
  cancelled: boolean;
  /** Our row for the subscription, when there is one. */
  subscriptionRowId: string | null;
  /** The workspace it was recorded against, when there is one. */
  organizationId: string | null;
  /** The free-articles subscription this one took over from ("replaced_free_articles"), owed a cancellation. */
  replacedSubscriptionId: string | null;
  /** ...and the provider has already confirmed that cancellation. */
  replacedCancelled: boolean;
};

/** What the transaction decided; worked off once it has committed. */
type Decision = {
  outcome: SyncOutcome;
  /** This subscription is owed a cancellation. */
  owe: boolean;
  rowId: string | null;
  orgId: string | null;
  /** Another subscription is owed one: the free articles this one took over from. */
  replaced?: string | null;
};

function identityColumn(provider: CheckoutProvider) {
  return provider === "stripe"
    ? subscriptions.stripeSubscriptionId
    : subscriptions.paypalSubscriptionId;
}

function rowValues(provider: CheckoutProvider, providerSubscriptionId: string, values: SubscriptionValues) {
  return {
    provider,
    ...(provider === "stripe"
      ? { stripeSubscriptionId: providerSubscriptionId }
      : { paypalSubscriptionId: providerSubscriptionId }),
    status: values.status,
    ...(values.currentPeriodStart !== undefined
      ? { currentPeriodStart: values.currentPeriodStart }
      : {}),
    ...(values.currentPeriodEnd !== undefined
      ? { currentPeriodEnd: values.currentPeriodEnd }
      : {}),
    ...(values.cancelAtPeriodEnd !== undefined
      ? { cancelAtPeriodEnd: values.cancelAtPeriodEnd }
      : {}),
    ...(values.stripeCustomerId ? { stripeCustomerId: values.stripeCustomerId } : {}),
    ...(values.planId ? { planId: values.planId } : {}),
  };
}

async function websiteExists(tx: Transaction, websiteId: string) {
  const [row] = await tx
    .select({ id: websites.id })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  return Boolean(row);
}

/** The lock every sync of one provider subscription takes first. */
export async function lockProviderSubscription(
  tx: Pick<Transaction, "execute">,
  provider: CheckoutProvider,
  providerSubscriptionId: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`subscription:${provider}:${providerSubscriptionId}`}, 0))`,
  );
}

export async function syncProviderSubscription(
  database: Database,
  input: SyncInput,
  cancellationOps: CancellationOps,
): Promise<SyncResult> {
  const { provider, providerSubscriptionId } = input;

  const decided = await database.transaction(async (tx): Promise<Decision> => {
    await lockProviderSubscription(tx, provider, providerSubscriptionId);

    // Read from the provider now that no other sync of it can interleave.
    const snapshot = await input.load(tx);
    if (!snapshot) {
      return {
        outcome: "ignored_not_found" as SyncOutcome,
        owe: false,
        rowId: null as string | null,
        orgId: null as string | null,
      };
    }

    const ended = isSubscriptionEnded(snapshot.values.status);
    const claimedWebsiteId = asUuid(snapshot.claimedWebsiteId);
    const owe = async (outcome: SyncOutcome) => {
      await oweCancellation(tx, { provider, providerSubscriptionId, reason: outcome });
    };

    /*
      The workspace first, locked against deletion: a workspace deleted
      while this runs either finishes first (and the row reads as gone
      here) or waits for this to commit and then deletes what it wrote.
    */
    const [org] = snapshot.organizationId
      ? await tx
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.id, snapshot.organizationId))
          .for("key share")
      : [];

    if (!org) {
      const ours = Boolean(snapshot.claimedOrganizationId ?? snapshot.organizationId);
      const outcome: SyncOutcome = ours ? "orphaned_deleted_workspace" : "ignored_no_owner";
      if (ours && !ended) await owe(outcome);
      return { outcome, owe: ours && !ended, rowId: null, orgId: null };
    }

    const values = rowValues(provider, providerSubscriptionId, snapshot.values);
    const complete = () =>
      markCheckoutCompleted(tx, {
        provider,
        providerSubscriptionId,
        checkoutId: asUuid(snapshot.checkoutId),
        stripeSessionId: snapshot.stripeSessionId,
      });

    /* Known subscription: matched by identity, never re-pointed. */
    const [existing] = await tx
      .select({
        id: subscriptions.id,
        websiteId: subscriptions.websiteId,
        claimedWebsiteId: subscriptions.claimedWebsiteId,
      })
      .from(subscriptions)
      .where(eq(identityColumn(provider), providerSubscriptionId))
      .for("update")
      .limit(1);

    if (existing) {
      await tx
        .update(subscriptions)
        .set({
          ...values,
          ...(existing.claimedWebsiteId || !claimedWebsiteId ? {} : { claimedWebsiteId }),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));
      await complete();

      /*
        Detached and the website it was bought for is gone: a deleted site
        whose subscription is live again, or whose earlier cancellation
        never went through. A row detached because it was superseded or
        duplicated still has its website, and is left alone.
      */
      const siteGone =
        existing.websiteId === null &&
        (existing.claimedWebsiteId ?? claimedWebsiteId) !== null &&
        !(await websiteExists(tx, (existing.claimedWebsiteId ?? claimedWebsiteId)!));
      const cancel = !ended && siteGone;
      if (cancel) await owe("detached_deleted_website");
      return { outcome: "updated" as SyncOutcome, owe: cancel, rowId: existing.id, orgId: org.id };
    }

    const insertDetached = async () => {
      const [row] = await tx
        .insert(subscriptions)
        .values({ organizationId: org.id, websiteId: null, claimedWebsiteId, ...values })
        .returning({ id: subscriptions.id });
      return row.id;
    };

    if (!claimedWebsiteId) {
      // Recorded so the payment is not lost; grants nothing until a person
      // attaches it (scripts/attach-subscriptions.mjs).
      const rowId = await insertDetached();
      await complete();
      return { outcome: "detached_unattributed" as SyncOutcome, owe: false, rowId, orgId: org.id };
    }

    /* Share lock: a deletion of this website finishes first, or waits. */
    const [site] = await tx
      .select({ id: websites.id, organizationId: websites.organizationId })
      .from(websites)
      .where(eq(websites.id, claimedWebsiteId))
      .for("share");

    if (!site) {
      const rowId = await insertDetached();
      await complete();
      if (!ended) await owe("detached_deleted_website");
      return { outcome: "detached_deleted_website" as SyncOutcome, owe: !ended, rowId, orgId: org.id };
    }

    if (site.organizationId !== org.id) {
      /*
        Metadata naming another workspace's site. Unreachable through our
        checkout, which checks ownership; reachable by editing metadata in
        the provider's dashboard. Never attached across tenants.
      */
      const rowId = await insertDetached();
      await complete();
      return { outcome: "detached_foreign_website" as SyncOutcome, owe: false, rowId, orgId: org.id };
    }

    const [current] = await tx
      .select({
        id: subscriptions.id,
        provider: subscriptions.provider,
        status: subscriptions.status,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        paypalSubscriptionId: subscriptions.paypalSubscriptionId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.websiteId, site.id))
      .for("update");

    /*
      "Start your plan now": opened to take over from exactly the site's
      current subscription, which is still live (its free articles).
    */
    const currentProviderId = current?.paypalSubscriptionId ?? current?.stripeSubscriptionId ?? null;
    const takesOver =
      current !== undefined &&
      currentProviderId !== null &&
      !ended &&
      !isSubscriptionEnded(current.status) &&
      (await replacedSubscription(tx, {
        provider,
        providerSubscriptionId,
        checkoutId: asUuid(snapshot.checkoutId),
        organizationId: org.id,
        websiteId: site.id,
      })) === currentProviderId;

    let outcome: SyncOutcome;
    let rowId: string;
    let cancel = false;
    let replaced: string | null = null;
    if (!current) {
      const [row] = await tx
        .insert(subscriptions)
        .values({ organizationId: org.id, websiteId: site.id, claimedWebsiteId, ...values })
        .returning({ id: subscriptions.id });
      rowId = row.id;
      outcome = "attached";
    } else if (!current.stripeSubscriptionId && !current.paypalSubscriptionId) {
      // A local placeholder with no provider identity: this is its identity.
      await tx
        .update(subscriptions)
        .set({ ...values, claimedWebsiteId, updatedAt: new Date() })
        .where(eq(subscriptions.id, current.id));
      rowId = current.id;
      outcome = "attached";
    } else if (ended) {
      // An older subscription's event, after the site moved on to a newer
      // one. Recorded under its own identity; the current plan is untouched.
      rowId = await insertDetached();
      outcome = "detached_stale";
    } else if (isSubscriptionEnded(current.status)) {
      // A new plan after the old one ended. The old row keeps its ids.
      await tx
        .update(subscriptions)
        .set({ websiteId: null, claimedWebsiteId: site.id, updatedAt: new Date() })
        .where(eq(subscriptions.id, current.id));
      const [row] = await tx
        .insert(subscriptions)
        .values({ organizationId: org.id, websiteId: site.id, claimedWebsiteId, ...values })
        .returning({ id: subscriptions.id });
      rowId = row.id;
      outcome = "replaced";
    } else if (takesOver && snapshot.values.status === "incomplete") {
      /*
        Approved, not yet active: PayPal activates it within seconds, and
        its webhook, the PayPal return and the checkout reconciler all sync
        it again. Nothing is written - not even the checkout's completion -
        so the free articles carry on until the plan has really started.
      */
      return { outcome: "awaiting_activation", owe: false, rowId: null, orgId: org.id };
    } else if (takesOver && isEntitled(snapshot.values.status)) {
      /*
        The plan has started: it takes the site, and the free articles step
        aside, kept detached with their ids, and are cancelled. Their free
        days never moved money; should PayPal have billed them anyway (the
        free days ran out first), reconciliation lists that payment to
        refund (replacedFreeArticlesToRefund).
      */
      await tx
        .update(subscriptions)
        .set({ websiteId: null, claimedWebsiteId: site.id, updatedAt: new Date() })
        .where(eq(subscriptions.id, current.id));
      const [row] = await tx
        .insert(subscriptions)
        .values({ organizationId: org.id, websiteId: site.id, claimedWebsiteId, ...values })
        .returning({ id: subscriptions.id });
      rowId = row.id;
      outcome = "replaced_free_articles";
      replaced = currentProviderId;
      await oweCancellation(tx, {
        provider: current.provider === "stripe" ? "stripe" : "paypal",
        providerSubscriptionId: currentProviderId!,
        reason: outcome,
      });
    } else if (
      provider === "paypal" &&
      (await isReleasedApproval(tx, {
        providerSubscriptionId,
        checkoutId: asUuid(snapshot.checkoutId),
      }))
    ) {
      /*
        A PayPal approval the ledger had let go of, approved after all while
        the site pays through something else - which it was allowed to start
        because this one was let go. This one is cancelled; its first
        payment, already taken by PayPal, has to be refunded in PayPal.
      */
      console.error(
        `[billing] website ${site.id} already has a live subscription; released PayPal approval ${providerSubscriptionId} activated anyway - recorded unattached and cancelled. REFUND its first payment in PayPal.`,
      );
      rowId = await insertDetached();
      outcome = "detached_released_approval";
      cancel = true;
      await owe(outcome);
    } else {
      /*
        Two live subscriptions for one site - checkouts that both completed
        despite the checkout guard. Which one the customer keeps is theirs to
        say, so neither is cancelled; this one is recorded detached, with the
        site it claimed, and reported (reconciliation.ts
        duplicateLiveSubscriptions).
      */
      console.error(
        `[billing] website ${site.id} already has a live subscription; ${provider} ${providerSubscriptionId} recorded unattached for reconciliation`,
      );
      rowId = await insertDetached();
      outcome = "detached_duplicate";
    }

    await complete();
    return { outcome, owe: cancel, rowId, orgId: org.id, replaced };
  });

  // Straight away where possible; the maintenance job retries otherwise.
  const owed = [
    ...(decided.owe ? [providerSubscriptionId] : []),
    ...(decided.replaced ? [decided.replaced] : []),
  ];
  const completed = owed.length > 0 ? (await processCancellations(database, cancellationOps, { only: owed })).completed : [];

  return {
    outcome: decided.outcome,
    cancellationOwed: decided.owe,
    cancelled: decided.owe && completed.includes(providerSubscriptionId),
    subscriptionRowId: decided.rowId,
    organizationId: decided.orgId,
    replacedSubscriptionId: decided.replaced ?? null,
    replacedCancelled: Boolean(decided.replaced) && completed.includes(decided.replaced!),
  };
}
