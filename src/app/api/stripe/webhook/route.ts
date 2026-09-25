import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import {
  billingCustomers,
  organization,
  payments,
  plans,
  subscriptions,
  webhookEvents,
  websites,
} from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";
import { fulfilAddonPurchase } from "@/lib/addons/fulfil";
import { convertReferral } from "@/lib/referrals/core";

/**
 * Stripe webhook. THE ONLY PLACE SUBSCRIPTION STATE CHANGES.
 *
 * Access is never granted from the success redirect: the user can close the
 * tab before it loads, or simply visit the success URL by hand. If it is not
 * written here, it did not happen.
 *
 * Three rules this handler must keep:
 *
 *  1. VERIFY THE SIGNATURE against the RAW body. Parsing the body first (or
 *     letting a framework parse it) changes the bytes and the signature will
 *     never match. Without verification anyone who finds this URL can grant
 *     themselves a subscription.
 *  2. BE IDEMPOTENT. Stripe retries on any non-2xx and can deliver the same
 *     event twice even after a 200. Recording the event id first, and exiting
 *     on conflict, makes replays free.
 *  3. RETURN 2xx ONCE HANDLED. A 500 makes Stripe retry with backoff for days;
 *     only signature failures should be 4xx.
 */

// Never prerendered, and must see the raw body.
export const dynamic = "force-dynamic";

function periodFor(subscription: Stripe.Subscription) {
  /**
   * current_period_start/end were REMOVED from the Subscription object and now
   * live on each subscription ITEM. Reading them from the root yields
   * undefined, which becomes an Invalid Date in Postgres.
   */
  const item = subscription.items.data[0];
  return {
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
  };
}

/** Resolves our plan row from the Stripe price on the subscription. */
async function planIdForSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.stripePriceId, priceId))
    .limit(1);
  return plan?.id ?? null;
}

/**
 * Finds the organization a subscription belongs to.
 *
 * Metadata is written in two places at checkout (session AND subscription)
 * because session metadata does not propagate. The customer lookup is the last
 * resort for subscriptions created outside our checkout - e.g. by hand in the
 * Stripe dashboard.
 *
 * Metadata is only trusted while that workspace still EXISTS. Stripe keeps the
 * id it was given at checkout forever, so a subscription whose workspace was
 * deleted kept naming it, every insert failed its foreign key, the handler
 * returned 500, and Stripe retried the same invoice.paid every hour for days.
 * A deleted workspace now falls through to the customer mapping, and when
 * that finds nothing either the event is logged and acknowledged like any
 * other subscription with no owner.
 */
async function organizationIdFor(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.organizationId;
  if (fromMetadata) {
    const [exists] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, fromMetadata))
      .limit(1);
    if (exists) return fromMetadata;
    console.error(
      `[stripe-webhook] subscription ${subscription.id} names deleted organization ${fromMetadata}`,
    );
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  /*
    billing_customers first: it is the authoritative customer-to-workspace
    mapping and exists from the moment someone reaches checkout. The
    subscriptions fallback below is kept for rows written before that table
    existed, which still carry a customer id of their own.
  */
  const [owner] = await db
    .select({ organizationId: billingCustomers.organizationId })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, customerId))
    .limit(1);
  if (owner) return owner.organizationId;

  const [row] = await db
    .select({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.organizationId ?? null;
}

/**
 * Finds the website a subscription pays for.
 *
 * Written into subscription metadata at checkout, for the same reason the
 * organization is: session metadata does not propagate, so a
 * customer.subscription.updated arriving weeks later has only what was put on
 * the subscription itself.
 *
 * Falls back to the row we already stored, which covers a subscription
 * created before per-website billing or by hand in the Stripe dashboard.
 */
async function websiteIdFor(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.websiteId;
  if (fromMetadata) return fromMetadata;

  const [row] = await db
    .select({ websiteId: subscriptions.websiteId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);
  return row?.websiteId ?? null;
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const orgId = await organizationIdFor(subscription);
  if (!orgId) {
    // Nothing to attach it to. Logged rather than thrown: retrying cannot fix
    // a missing organization, and a 500 would make Stripe retry for days.
    console.error(
      `[stripe-webhook] no organization for subscription ${subscription.id}`,
    );
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const planId = await planIdForSubscription(subscription);
  const { currentPeriodStart, currentPeriodEnd } = periodFor(subscription);

  /**
   * Which website this pays for. Null is tolerated rather than fatal: a
   * subscription made before per-website billing has no website in its
   * metadata, and refusing it would stop recording a real payment.
   */
  const websiteId = await websiteIdFor(subscription);

  const values = {
    provider: "stripe",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    // Keep the existing plan if the price is not one of ours.
    ...(planId ? { planId } : {}),
  };

  /**
   * Keyed on the WEBSITE, matching the unique index. Upserting on the
   * organization is what limited a workspace to one subscription: a second
   * site's checkout overwrote the first site's plan instead of adding to it.
   *
   * With no website — a pre-migration row — the conflict target cannot match,
   * so it is updated by its Stripe id instead. Inserting would duplicate.
   */
  if (websiteId) {
    /**
     * The website must belong to the organization the event names.
     *
     * websiteId arrives from subscription metadata, and the upsert below
     * conflicts on websiteId ALONE while deliberately not rewriting
     * organizationId. So a row already held by organization A, updated by an
     * event carrying A's websiteId under organization B, would have its
     * plan, status, period and Stripe id overwritten while still reading as
     * A's — B's payment silently taking over A's subscription and destroying
     * the record of A's.
     *
     * createCheckout re-checks ownership before writing that metadata, so
     * this is not reachable through the product. It is reachable by anyone
     * who can edit metadata in the Stripe dashboard, and by any future code
     * path that sets it without the same check. This handler is the last
     * place that can still tell, so it checks rather than assuming the
     * caller did.
     */
    const [owned] = await db
      .select({ id: websites.id })
      .from(websites)
      .where(and(eq(websites.id, websiteId), eq(websites.organizationId, orgId)))
      .limit(1);

    if (!owned) {
      console.error(
        `[stripe-webhook] websiteId ${websiteId} is not owned by org ${orgId} - refusing upsert`,
      );
      return;
    }

    await db
      .insert(subscriptions)
      .values({ organizationId: orgId, websiteId, ...values })
      .onConflictDoUpdate({
        target: subscriptions.websiteId,
        set: { ...values, updatedAt: new Date() },
      });
    return;
  }

  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (existing) {
    await db
      .update(subscriptions)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(subscriptions.id, existing.id));
    return;
  }

  /**
   * A subscription with no website and no existing row: created outside our
   * checkout. Recorded against the organization so the payment is not lost,
   * but it grants no allowance until a website is attached — checkLimit reads
   * subscriptions.website_id.
   */
  console.warn(
    `[stripe-webhook] subscription ${subscription.id} has no website; recording without one`,
  );
  await db.insert(subscriptions).values({ organizationId: orgId, ...values });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Raw text, never request.json() - parsing changes the bytes being signed.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    // Includes replayed events outside the tolerance window.
    const message = error instanceof Error ? error.message : "invalid";
    return NextResponse.json(
      { error: `signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  /**
   * Idempotency gate. The insert IS the lock: if this event id is already
   * present the work was done, so acknowledge and stop. Done before handling
   * so a duplicate delivered while the first is still running cannot double
   * apply.
   */
  const inserted = await db
    .insert(webhookEvents)
    .values({
      id: event.id,
      provider: "stripe",
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        /**
         * One-off payments are add-ons: extra link credits, or a service we
         * deliver by hand. This is the ONLY place they are recorded — the
         * success redirect cannot be trusted, since a customer can close the
         * tab before it loads or visit the URL by hand.
         *
         * Both ids come from session metadata, because a payment-mode session
         * has no subscription object to carry them on.
         */
        if (session.mode === "payment") {
          const organizationId = session.metadata?.organizationId;
          const addonId = session.metadata?.addonId;

          if (!organizationId || !addonId) {
            // Money taken with no way to know who for. Logged rather than
            // thrown: a retry cannot add metadata that was never sent.
            console.error(
              `[stripe-webhook] payment session ${session.id} has no addon metadata`,
            );
            break;
          }

          await fulfilAddonPurchase({
            organizationId,
            addonId,
            stripeSessionId: session.id,
            amountTotal: session.amount_total,
            currency: session.currency,
          });
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        // Re-fetched rather than trusting the embedded object: the session
        // carries a snapshot that may already be stale.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // "deleted" still carries status "canceled", so the same path applies
        // and entitlement falls away via the status check in usage.ts.
        await upsertSubscription(event.data.object);
        break;
      }

      case "invoice.payment_failed":
      case "invoice.paid": {
        const invoice = event.data.object;

        /**
         * Where the subscription id lives on an invoice.
         *
         * It used to be on the line item. Stripe moved it to
         * `parent.subscription_details.subscription`, and reading only the old
         * place meant subscriptionId was undefined on every real invoice — the
         * handler then hit the guard below and returned BEFORE recording the
         * payment. Three invoice.paid events were processed successfully and
         * the payments table stayed empty, so the admin refund screen had
         * nothing to show and no error said why.
         *
         * Both locations are read rather than only the new one: invoices
         * already in flight when Stripe's version changes still carry the old
         * shape, and an operator pinning an older apiVersion would otherwise
         * silently lose payments again.
         */
        const line = invoice.lines?.data?.[0];
        const fromParent = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          (typeof fromParent === "string"
            ? fromParent
            : (fromParent?.id ?? null)) ??
          (typeof line?.subscription === "string"
            ? line.subscription
            : (line?.subscription?.id ?? null));

        if (!subscriptionId) {
          /**
           * Logged rather than silent. This branch is how the bug above went
           * unnoticed: a break with no trace looks identical to an event that
           * was handled correctly.
           */
          console.error(
            `[stripe-webhook] ${event.type} ${invoice.id} carries no subscription id`,
          );
          break;
        }

        // Stripe has already moved the subscription to past_due / active; read
        // it back rather than inferring status from the invoice.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(subscription);

        /**
         * A referral converts on a PAID invoice, never on an active
         * subscription: a subscription is active during a trial with nothing
         * charged, and paying a referrer for a trial that never converts hands
         * out credit against no revenue.
         *
         * Guarded on the event type because payment_failed shares this branch.
         *
         * convertReferral is idempotent and no-ops when nothing is pending, so
         * a webhook retry or next month's invoice cannot pay twice. Failure is
         * swallowed: the subscription is already recorded, and throwing would
         * make Stripe retry a payment we handled correctly.
         */
        /**
         * Record the payment either way.
         *
         * Stripe's portal already lists invoices, but a PayPal subscriber has
         * no portal at all — recording both here gives every customer the same
         * in-app history. Stripe's hosted invoice stays the authoritative
         * document and is linked when the event carries a URL.
         */
        {
          const orgId = await organizationIdFor(subscription);
          if (!orgId) {
            console.error(
              `[stripe-webhook] ${event.type} ${invoice.id} has no workspace - payment not recorded`,
            );
          }
          if (orgId && invoice.id) {
            await db
              .insert(payments)
              .values({
                organizationId: orgId,
                provider: "stripe",
                externalId: invoice.id,
                amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
                currency: invoice.currency ?? "eur",
                status: event.type === "invoice.paid" ? "paid" : "failed",
                invoiceUrl:
                  invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
                description: invoice.lines?.data?.[0]?.description ?? null,
                paidAt: invoice.status_transitions?.paid_at
                  ? new Date(invoice.status_transitions.paid_at * 1000)
                  : new Date(),
              })
              // A retry updates rather than duplicating; the unique index on
              // (provider, external_id) is the guard.
              .onConflictDoUpdate({
                target: [payments.provider, payments.externalId],
                set: {
                  status:
                    event.type === "invoice.paid" ? "paid" : "failed",
                  updatedAt: new Date(),
                },
              });
          }
        }

        if (event.type === "invoice.paid") {
          const orgId = await organizationIdFor(subscription);
          if (orgId) {
            try {
              await convertReferral(orgId);
            } catch (error) {
              console.error(
                "[stripe-webhook] referral conversion failed",
                error,
              );
            }
          }
        }
        break;
      }

      default:
        // Unhandled types are recorded above and acknowledged.
        break;
    }
  } catch (error) {
    /**
     * Handling failed after the event was recorded, so a Stripe retry would
     * hit the idempotency gate and skip. Remove the record to make the retry
     * effective.
     */
    await db.delete(webhookEvents).where(eq(webhookEvents.id, event.id));
    console.error(`[stripe-webhook] ${event.type} failed`, error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
