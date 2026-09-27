import "server-only";

import type Stripe from "stripe";

import { processPayPalEvent, type PayPalEvent } from "@/lib/billing/paypal-events";
import { processStripeEvent } from "@/lib/billing/stripe-events";
import {
  claimForRecovery,
  completeWebhookEvent,
  releaseWebhookEvent,
} from "@/lib/billing/webhook-events";

/**
 * Processes webhook events whose worker died or failed, from the payload
 * stored when the event was first VERIFIED - no provider redelivery needed.
 * Run by the billing-maintenance job. Each event is claimed with its own
 * token, so it completes or releases only its own claim.
 */
export async function recoverWebhookEvents(
  options: { now?: Date; limit?: number } = {},
): Promise<{ recovered: string[]; failed: string[] }> {
  const recovered: string[] = [];
  const failed: string[] = [];

  for (const event of await claimForRecovery(options)) {
    try {
      if (event.provider === "stripe") {
        await processStripeEvent(event.payload as Stripe.Event);
      } else if (event.provider === "paypal") {
        await processPayPalEvent(event.payload as PayPalEvent);
      }
      await completeWebhookEvent(event.id, event.token);
      recovered.push(event.id);
    } catch (error) {
      await releaseWebhookEvent(event.id, event.token, error);
      failed.push(event.id);
      console.error(`[webhooks] recovery of ${event.provider} ${event.id} failed`, error);
    }
  }
  return { recovered, failed };
}
