import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { processStripeEvent } from "@/lib/billing/stripe-events";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  releaseWebhookEvent,
} from "@/lib/billing/webhook-events";
import { stripe } from "@/lib/stripe/client";

/**
 * Stripe webhook. THE ONLY PLACE SUBSCRIPTION STATE CHANGES (with the
 * recovery job, which replays events stored here).
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
 *  2. CLAIM, THEN COMPLETE. The event is claimed under a lease and a token,
 *     handled, and only then marked complete. See lib/billing/webhook-events.ts.
 *  3. RETURN 2xx ONCE HANDLED. A 500 makes Stripe retry with backoff for days;
 *     only signature failures should be 4xx.
 *
 * What each event does lives in lib/billing/stripe-events.ts.
 */

// Never prerendered, and must see the raw body.
export const dynamic = "force-dynamic";

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

  /*
    The verified event is stored with the claim, so if this worker dies the
    recovery job can finish it from the stored payload.
  */
  const claim = await claimWebhookEvent({
    id: event.id,
    provider: "stripe",
    type: event.type,
    payload: event,
  });

  if (!claim.claimed) {
    /*
      Acknowledged either way - a 500 would make Stripe retry an event that is
      finished, or one another request is actively working on. If that other
      request dies, the recovery job picks the event up once its lease ends.
    */
    return NextResponse.json({
      received: true,
      duplicate: true,
      reason: claim.reason,
    });
  }

  try {
    await processStripeEvent(event);
  } catch (error) {
    // The row is kept with its attempt count; Stripe's retry or the recovery
    // job takes it again.
    await releaseWebhookEvent(event.id, claim.token, error);
    console.error(`[stripe-webhook] ${event.type} failed`, error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  /*
    Only now is the event finished - and only if this attempt still owns it.
    A worker that ran past its lease while another took over cannot mark the
    other's work complete.
  */
  await completeWebhookEvent(event.id, claim.token);

  return NextResponse.json({ received: true });
}
