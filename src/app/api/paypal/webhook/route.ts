import { NextResponse } from "next/server";

import { processPayPalEvent, type PayPalEvent } from "@/lib/billing/paypal-events";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  releaseWebhookEvent,
} from "@/lib/billing/webhook-events";
import { isPayPalConfigured, payPalRequest } from "@/lib/paypal/client";

/**
 * PayPal webhook. THE ONLY PLACE PAYPAL SUBSCRIPTION STATE CHANGES (with the
 * recovery job, which replays events stored here, and the in-app cancel,
 * which reads PayPal back through the same sync).
 *
 * As with Stripe, access is never granted from the return redirect — a
 * customer can reach that URL without completing payment. If it is not written
 * here, it did not happen.
 *
 * PayPal verifies signatures differently from Stripe: rather than an HMAC we
 * can check locally, the raw headers and body are posted back to PayPal, which
 * answers SUCCESS or FAILURE. That is an extra network call per webhook, but it
 * is the only supported method.
 *
 * What each event does lives in lib/billing/paypal-events.ts.
 */

export const dynamic = "force-dynamic";

/** Asks PayPal whether this delivery is genuine. */
async function verifySignature(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  if (required.some((header) => !headers.get(header))) return false;

  // Not JSON at all: nothing PayPal signed, and it could not be spliced in below.
  try {
    JSON.parse(rawBody);
  } catch {
    return false;
  }

  /*
    The event goes back to PayPal as the EXACT text it sent, spliced into
    the request rather than parsed and serialised again: PayPal checks it
    against what it signed, and re-serialising changes escapes ("\/",
    "\u00e9") and number formatting, which turned genuine events into
    FAILURE - a 400 PayPal retries for three days and then gives up on.
  */
  const envelope = JSON.stringify({
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  });
  const body = `${envelope.slice(0, -1)},"webhook_event":${rawBody}}`;

  try {
    const result = await payPalRequest<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      { method: "POST", body },
    );
    return result.verification_status === "SUCCESS";
  } catch {
    // A failed verification call is treated as unverified, never as valid.
    return false;
  }
}

export async function POST(request: Request) {
  // Credentials, PAYPAL_WEBHOOK_ID and a valid PAYPAL_ENV (client.ts).
  if (!isPayPalConfigured()) {
    console.error("[paypal-webhook] PayPal is not configured");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  // Raw text: the signature is over these exact bytes.
  const raw = await request.text();

  const verified = await verifySignature(request.headers, raw);
  if (!verified) {
    return NextResponse.json(
      { error: "signature verification failed" },
      { status: 400 },
    );
  }

  let event: PayPalEvent;
  try {
    event = JSON.parse(raw) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  /**
   * Idempotency gate, shared with Stripe's handler: the event is CLAIMED under
   * a lease and a token, and stored, so a handler killed mid-run is finished
   * by the recovery job. See lib/billing/webhook-events.ts.
   */
  const claim = await claimWebhookEvent({
    id: event.id,
    provider: "paypal",
    type: event.event_type,
    payload: event,
  });

  if (!claim.claimed) {
    return NextResponse.json({
      received: true,
      duplicate: true,
      reason: claim.reason,
    });
  }

  try {
    await processPayPalEvent(event);
  } catch (error) {
    await releaseWebhookEvent(event.id, claim.token, error);
    console.error(`[paypal-webhook] ${event.event_type} failed`, error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  // Finished - if this attempt still owns the claim.
  await completeWebhookEvent(event.id, claim.token);

  return NextResponse.json({ received: true });
}
