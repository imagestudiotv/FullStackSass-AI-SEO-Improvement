import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { plans, subscriptions, webhookEvents } from "@/lib/db/schema";
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
 */
async function organizationIdFor(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.organizationId;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const [row] = await db
    .select({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.organizationId ?? null;
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

  await db
    .insert(subscriptions)
    .values({ organizationId: orgId, ...values })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: { ...values, updatedAt: new Date() },
    });
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
        const line = invoice.lines?.data?.[0];
        const subscriptionId =
          typeof line?.subscription === "string"
            ? line.subscription
            : (line?.subscription?.id ?? null);
        if (!subscriptionId) break;

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
