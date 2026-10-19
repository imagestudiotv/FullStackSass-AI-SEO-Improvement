import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  claimWebhookEvent,
  completeWebhookEvent,
  releaseWebhookEvent,
} from "@/lib/billing/webhook-events";
import { processPartnerConnectEvent } from "@/lib/partners/presentation/webhooks";
import { stripe } from "@/lib/stripe/client";

/**
 * Stripe Connect webhook: events that happen ON partners' connected
 * accounts (account.updated, payout.*). A separate endpoint with its own
 * signing secret, as Stripe configures "events on connected accounts"
 * separately from the platform's own events.
 *
 * The same three rules as the platform webhook (app/api/stripe/webhook):
 * verify the signature against the RAW body; claim, then complete, through
 * webhook_events (provider "stripe_connect", so the recovery job can replay
 * it); answer 2xx once handled.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid";
    return NextResponse.json({ error: `signature verification failed: ${message}` }, { status: 400 });
  }

  // A platform event sent here by mistake is acknowledged and ignored: it has no connected account.
  if (!event.account) return NextResponse.json({ received: true, ignored: "no_account" });

  const claim = await claimWebhookEvent({ id: event.id, provider: "stripe_connect", type: event.type, payload: event });
  if (!claim.claimed) return NextResponse.json({ received: true, duplicate: true, reason: claim.reason });

  try {
    await processPartnerConnectEvent(event);
  } catch (error) {
    await releaseWebhookEvent(event.id, claim.token, error);
    console.error(`[stripe-connect-webhook] ${event.type} failed`, error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  await completeWebhookEvent(event.id, claim.token);
  return NextResponse.json({ received: true });
}
