import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { plans, subscriptions, webhookEvents } from "@/lib/db/schema";
import { isPayPalConfigured, payPalRequest } from "@/lib/paypal/client";
import { getSubscription, mapStatus } from "@/lib/paypal/subscriptions";

/**
 * PayPal webhook. THE ONLY PLACE PAYPAL SUBSCRIPTION STATE CHANGES.
 *
 * As with Stripe, access is never granted from the return redirect — a
 * customer can reach that URL without completing payment. If it is not written
 * here, it did not happen.
 *
 * PayPal verifies signatures differently from Stripe: rather than an HMAC we
 * can check locally, the raw headers and body are posted back to PayPal, which
 * answers SUCCESS or FAILURE. That is an extra network call per webhook, but it
 * is the only supported method.
 */

export const dynamic = "force-dynamic";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    plan_id?: string;
    billing_info?: { next_billing_time?: string };
  };
};

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

  try {
    const result = await payPalRequest<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: headers.get("paypal-auth-algo"),
          cert_url: headers.get("paypal-cert-url"),
          transmission_id: headers.get("paypal-transmission-id"),
          transmission_sig: headers.get("paypal-transmission-sig"),
          transmission_time: headers.get("paypal-transmission-time"),
          webhook_id: webhookId,
          // Parsed, because PayPal expects the event as JSON here. The raw
          // body is still what was signed, so it is parsed rather than rebuilt.
          webhook_event: JSON.parse(rawBody),
        }),
      },
    );
    return result.verification_status === "SUCCESS";
  } catch {
    // A failed verification call is treated as unverified, never as valid.
    return false;
  }
}

/** Writes the subscription row for an organization. */
async function upsertSubscription(
  organizationId: string,
  paypalSubscriptionId: string,
  paypalPlanId: string | null,
  status: string,
  nextBilling: string | null,
) {
  let planId: string | null = null;
  if (paypalPlanId) {
    const [plan] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.paypalPlanId, paypalPlanId))
      .limit(1);
    planId = plan?.id ?? null;
  }

  const values = {
    provider: "paypal",
    paypalSubscriptionId,
    status,
    currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
    // Keep the existing plan if this PayPal plan is not one of ours.
    ...(planId ? { planId } : {}),
    updatedAt: new Date(),
  };

  await db
    .insert(subscriptions)
    .values({ organizationId, ...values })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: values,
    });
}

export async function POST(request: Request) {
  if (!isPayPalConfigured() || !process.env.PAYPAL_WEBHOOK_ID) {
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
   * Idempotency gate, shared with Stripe's handler. PayPal retries for up to
   * three days on a non-2xx, so a duplicate must be free rather than applied
   * twice.
   */
  const inserted = await db
    .insert(webhookEvents)
    .values({
      id: event.id,
      provider: "paypal",
      type: event.event_type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const resource = event.resource ?? {};
    const subscriptionId = resource.id ?? null;

    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED":
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        if (!subscriptionId) break;

        /**
         * Re-fetched rather than trusting the event body: the payload is a
         * snapshot that may already be stale, and custom_id is not present on
         * every event type.
         */
        const live = await getSubscription(subscriptionId);
        const organizationId = live.custom_id ?? resource.custom_id ?? null;

        if (!organizationId) {
          // Nothing to attach it to, and retrying cannot fix that.
          console.error(
            `[paypal-webhook] no organization for subscription ${subscriptionId}`,
          );
          break;
        }

        await upsertSubscription(
          organizationId,
          subscriptionId,
          live.plan_id ?? null,
          mapStatus(live.status),
          live.billing_info?.next_billing_time ?? null,
        );
        break;
      }

      case "PAYMENT.SALE.COMPLETED":
      case "PAYMENT.SALE.DENIED": {
        // A payment moves the subscription's status; read it back rather than
        // inferring from the payment itself.
        const billingId =
          (resource as { billing_agreement_id?: string }).billing_agreement_id ??
          null;
        if (!billingId) break;

        const live = await getSubscription(billingId);
        if (!live.custom_id) break;

        await upsertSubscription(
          live.custom_id,
          billingId,
          live.plan_id ?? null,
          mapStatus(live.status),
          live.billing_info?.next_billing_time ?? null,
        );
        break;
      }

      default:
        // Recorded above and acknowledged.
        break;
    }
  } catch (error) {
    /**
     * Handling failed after the event was recorded, so a retry would hit the
     * idempotency gate and skip. Remove the record to make the retry work.
     */
    await db.delete(webhookEvents).where(eq(webhookEvents.id, event.id));
    console.error(`[paypal-webhook] ${event.event_type} failed`, error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
