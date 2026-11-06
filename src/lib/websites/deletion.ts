import { and, eq, isNull, or, sql } from "drizzle-orm";

import { lockPlacementsOfWebsites, releaseLinksHostedOn } from "@/lib/backlinks/placements";
import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import {
  checkoutsBlockDeletion,
  settleOpenCheckouts,
  type CheckoutProviderOps,
} from "@/lib/billing/checkouts";
import { organization, subscriptions, websites } from "@/lib/db/schema";
import type { Database, Transaction } from "@/lib/db/types";
import { hasDeliveryInFlight } from "@/lib/publishing/dispatch";
import type { WebsiteContext } from "@/lib/tenant";

/**
 * Website deletion rules, shared by the customer action and the admin tool.
 *
 * Deliberately NOT a "use server" module: everything exported from one of
 * those is a public endpoint, and these helpers trust their arguments. The
 * database is passed in rather than imported, so the same code runs against
 * the app's client and the disposable test database.
 *
 * FOUR RULES, all enforced here so neither caller can drift from the other:
 *
 *  1. Only an OWNER deletes. An invited editor is trusted to work on the
 *     site's content, not to destroy it; that belongs to the workspace that
 *     pays for it. The customer action used to reuse requireEditor, which
 *     let an editor delete the whole website.
 *
 *  2. Nothing is deleted while a payment provider could still bill for it.
 *     Deleting a row tells Stripe and PayPal nothing, so a live subscription
 *     would keep charging for a site that no longer exists. The local status
 *     is not proof on its own - an admin "deactivate" sets it to inactive
 *     while leaving Stripe billing - so only a status the PROVIDER reports as
 *     ended counts as resolved.
 *
 *  3. Nothing is deleted while a checkout for it could still be paid. Open
 *     checkouts are settled with the provider first (a Stripe session is
 *     expired so it can no longer be paid); one that cannot be settled, or
 *     was paid but not yet recorded, refuses the deletion. See
 *     lib/billing/checkouts.ts, and lib/billing/subscription-sync.ts for
 *     what happens to a checkout completed after the deletion anyway.
 *
 *  4. Nothing is deleted while an article of it is being delivered. The request
 *     cannot be recalled and the dispatch cascades with the site, so the post
 *     could land with no record left of it, and the outcome would have nowhere
 *     to go. As for deleting one article (lockForEdit). A claim past its lease
 *     (lib/publishing/dispatch.ts) no longer counts, so this waits ten minutes
 *     at most.
 *
 * The subscription row itself is kept: subscriptions.website_id is ON DELETE
 * SET NULL, so the provider ids and plan survive the site for reconciliation.
 * Payments hang off the organization and are untouched.
 *
 * WHAT ANOTHER CUSTOMER'S CREDITS DO. A link placed on a website being deleted
 * holds its partner's credits (backlink_requests.credits_reserved, see "RESERVED
 * IS NOT THE LEDGER" in lib/backlinks/placements.ts). The cascade alone would
 * leave that hold with no article and no host, and nothing could release it. So
 * each deletion gives those links up in its own transaction, by the rule for
 * deleting the host article (lib/articles/deletion.ts): pending, drafted and
 * unverified are withdrawn and their hold released, with no ledger row; published
 * stays with the verifier, which needs only liveUrl; live, removed and cancelled
 * do not move. A failed deletion leaves every hold as it was, and a repeated one
 * finds no website.
 *
 * Refusing instead would be worse: a customer cannot withdraw a link the RepGet
 * team placed, so they could not clear it themselves, and the credits are somebody
 * else's. A website's OWN requests go with it (ON DELETE CASCADE), and their holds
 * with the rows.
 *
 * LOCK ORDER, shared with checkout creation and the webhooks: organization,
 * then website, then subscriptions, then checkouts. Placements come before all of
 * them: the verifier holds a placement while it writes to the ledger, which needs
 * a key share on the organization, so the other way round is a deadlock with a
 * workspace's deletion. They are read again under the website's lock: a new link
 * needs a key share on its host website (placeManagedLink, before its article), so
 * by then every link is either visible or can never be placed. A delivery's claim
 * takes a key share on the website before its article (claimDispatch), so here too
 * it either shows as in flight or finds no website.
 */

/** Statuses the provider reports once a subscription can never bill again. */
const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

export function isSubscriptionEnded(status: string): boolean {
  return ENDED_STATUSES.has(status);
}

/** Statuses that grant access. Mirrors ENTITLED_STATUSES in lib/usage.ts. */
const BILLING_STATUSES = new Set(["active", "trialing", "past_due"]);

export type SubscriptionBillingState = {
  status: string;
  provider: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  stripeSubscriptionId: string | null;
  paypalSubscriptionId: string | null;
};

function providerName(provider: string): string {
  return provider === "paypal" ? "PayPal" : "Stripe";
}

/**
 * Why these subscriptions stop a deletion, or null if nothing can bill.
 *
 * `subject` is what is being deleted, for the message only.
 */
export function billingBlockReason(
  rows: SubscriptionBillingState[],
  subject: "website" | "workspace" = "website",
): string | null {
  for (const row of rows) {
    if (isSubscriptionEnded(row.status)) continue;

    const processor = providerName(row.provider);

    // Checked before the active case: it IS active, but the customer has
    // already asked to cancel, and telling them to cancel again is wrong.
    // A PayPal one cancelled in PayPal (running out its paid time) is the
    // same: the maintenance job records it ended on that day.
    if (row.cancelAtPeriodEnd) {
      const until = row.currentPeriodEnd
        ? ` until ${row.currentPeriodEnd.toISOString().slice(0, 10)}`
        : "";
      return `This ${subject}'s subscription is set to cancel but is still running${until}. It can be deleted once ${processor} confirms the subscription has ended.`;
    }

    if (BILLING_STATUSES.has(row.status)) {
      return `This ${subject} still has an active subscription. Cancel it first, or ${processor} will keep charging for a ${subject} that no longer exists.`;
    }

    // A local-only row (never checked out, or granted by hand) has nothing
    // at a provider that could bill.
    if (!row.stripeSubscriptionId && !row.paypalSubscriptionId) continue;

    // incomplete, unpaid, paused, or an admin-set "inactive": the provider
    // still holds a subscription that could resume billing.
    return `This ${subject}'s subscription has not been confirmed as cancelled with ${processor} (status: ${row.status}). Cancel it with ${processor} and wait for the confirmation before deleting.`;
  }

  return null;
}

/** Why a delivery under way stops a deletion, or null if none is. */
async function deliveryBlockReason(
  tx: Transaction,
  websiteIds: string[],
  subject: "website" | "workspace",
): Promise<string | null> {
  if (!(await hasDeliveryInFlight(tx, websiteIds))) return null;
  return `An article from this ${subject} is being delivered to its site right now. It can be deleted once that finishes. Try again in a few minutes.`;
}

/** Why this caller may not delete the website, or null if they may. */
export function websiteDeletionDenial(
  access: WebsiteContext["access"],
): string | null {
  if (access === "owner") return null;
  return "Only the workspace that owns this website can delete it.";
}

export type DeletionResult = { ok: true } | { ok: false; error: string };

/** What a deletion did besides deleting, for its audit entry. */
export type DeletionEffects = { releasedLinks: number };

const BILLING_COLUMNS = {
  status: subscriptions.status,
  provider: subscriptions.provider,
  cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  stripeSubscriptionId: subscriptions.stripeSubscriptionId,
  paypalSubscriptionId: subscriptions.paypalSubscriptionId,
};

/**
 * Deletes a website unless something could still bill for it.
 *
 * Open checkouts are settled with their provider first, outside any
 * transaction. Then the check and the delete run in one transaction with the
 * workspace, website, subscription and checkout rows locked (the shared lock
 * order), so neither a webhook activating a plan nor a checkout being opened
 * can land between "nothing is billing" and the delete.
 *
 * Subscriptions checked: the one naming this website, plus legacy rows that
 * name no website when this is the workspace's only site - those are paying
 * for it, even though they predate subscriptions.website_id. With several
 * sites an unattributed subscription cannot be blamed on any one of them.
 *
 * `beforeDelete` runs after every check has passed and before the delete, for
 * the admin audit entry. It gets the transaction, so the entry commits only
 * with the delete, and a failed log write stops the deletion and the releases.
 */
export async function deleteWebsiteIfBillingResolved(
  database: Database,
  input: {
    websiteId: string;
    organizationId: string;
    beforeDelete?: (tx: Transaction, effects: DeletionEffects) => Promise<void>;
    providers?: CheckoutProviderOps;
  },
): Promise<DeletionResult> {
  const { websiteId, organizationId } = input;

  await settleOpenCheckouts(
    database,
    { websiteId },
    input.providers ?? checkoutProviderOps,
  );

  return database.transaction(async (tx) => {
    const own = await tx
      .select({ id: websites.id })
      .from(websites)
      .where(
        and(
          eq(websites.id, websiteId),
          eq(websites.organizationId, organizationId),
        ),
      );
    await lockPlacementsOfWebsites(tx, own.map((row) => row.id));

    // Key share: excludes a concurrent workspace deletion, nothing else.
    await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .for("key share");

    const [site] = await tx
      .select({ id: websites.id })
      .from(websites)
      .where(
        and(
          eq(websites.id, websiteId),
          eq(websites.organizationId, organizationId),
        ),
      )
      .for("update");

    if (!site) return { ok: false, error: "Website not found." };

    const billing = await tx
      .select(BILLING_COLUMNS)
      .from(subscriptions)
      .where(
        or(
          eq(subscriptions.websiteId, websiteId),
          and(
            eq(subscriptions.organizationId, organizationId),
            isNull(subscriptions.websiteId),
            sql`(select count(*) from websites w where w.organization_id = ${organizationId})::int = 1`,
          ),
        ),
      )
      .for("update");

    const blocked =
      billingBlockReason(billing) ??
      (await checkoutsBlockDeletion(tx, { websiteId }, "website")) ??
      (await deliveryBlockReason(tx, [websiteId], "website"));
    if (blocked) return { ok: false, error: blocked };

    const releasedLinks = await releaseLinksHostedOn(tx, [websiteId]);

    await input.beforeDelete?.(tx, { releasedLinks });

    // Content cascades; subscriptions and checkouts are detached, not deleted.
    await tx.delete(websites).where(eq(websites.id, websiteId));

    return { ok: true };
  });
}

/**
 * Deletes a workspace and everything under it, unless something could still
 * bill for it. The admin erasure path; see deleteOrganization.
 *
 * Unlike a website, a workspace takes its subscription rows WITH it - that is
 * the point of an erasure - so every one of them must have ended first. The
 * audit entry is written by `beforeDelete` inside the same transaction.
 *
 * Locks: the placements, then the workspace FOR UPDATE, which excludes checkout
 * creation and the webhooks (both take a key share on it first), then its
 * websites, subscriptions and checkouts - the shared order.
 *
 * Links its websites host for other workspaces are given up as for one website;
 * those workspaces' ledgers and balances are not touched. Its own ledger goes with
 * it: that is the erasure.
 */
export async function deleteWorkspaceIfBillingResolved(
  database: Database,
  input: {
    organizationId: string;
    beforeDelete?: (tx: Transaction, effects: DeletionEffects) => Promise<void>;
    providers?: CheckoutProviderOps;
  },
): Promise<DeletionResult> {
  const { organizationId } = input;

  await settleOpenCheckouts(
    database,
    { organizationId },
    input.providers ?? checkoutProviderOps,
  );

  return database.transaction(async (tx) => {
    const sites = await tx
      .select({ id: websites.id })
      .from(websites)
      .where(eq(websites.organizationId, organizationId));
    await lockPlacementsOfWebsites(tx, sites.map((row) => row.id));

    const [org] = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .for("update");
    if (!org) return { ok: false, error: "Workspace not found." };

    const locked = await tx
      .select({ id: websites.id })
      .from(websites)
      .where(eq(websites.organizationId, organizationId))
      .for("update");

    const billing = await tx
      .select(BILLING_COLUMNS)
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .for("update");

    const blocked =
      billingBlockReason(billing, "workspace") ??
      (await checkoutsBlockDeletion(tx, { organizationId }, "workspace")) ??
      (await deliveryBlockReason(tx, locked.map((row) => row.id), "workspace"));
    if (blocked) return { ok: false, error: blocked };

    const releasedLinks = await releaseLinksHostedOn(tx, locked.map((row) => row.id));

    await input.beforeDelete?.(tx, { releasedLinks });

    await tx.delete(organization).where(eq(organization.id, organizationId));

    return { ok: true };
  });
}

/**
 * The customer path: owner check, then the guarded delete.
 *
 * Takes the context requireWebsite returned, so the website has already been
 * scoped to the caller's tenant before anything here runs.
 */
export async function deleteWebsiteAsOwner(
  database: Database,
  context: Pick<WebsiteContext, "access" | "site">,
  providers?: CheckoutProviderOps,
): Promise<DeletionResult> {
  const denied = websiteDeletionDenial(context.access);
  if (denied) return { ok: false, error: denied };

  return deleteWebsiteIfBillingResolved(database, {
    websiteId: context.site.id,
    organizationId: context.site.organizationId,
    providers,
  });
}
