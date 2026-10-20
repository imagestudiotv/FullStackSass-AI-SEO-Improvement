import "server-only";

import type Stripe from "stripe";

import { applyPayoutEvent } from "../application/use-cases/execute-bank-payout";
import { syncPayoutAccount } from "../application/use-cases/manage-payout-account";
import { partnerWorkFor } from "../infrastructure/stripe/event-normalizer";
import { partnerDeps } from "../server";

/**
 * Verified Stripe CONNECT events (events on connected accounts), from
 * /api/stripe/connect-webhook and from the webhook-recovery job replaying a
 * stored one. Platform events (invoices, charges, transfers) arrive on the
 * existing platform endpoint instead.
 *
 * Only the account id and livemode are taken from the event: the account is
 * then READ from Stripe, so a stale or out-of-order event cannot write old
 * state. An account that is not a partner's in this environment changes
 * nothing. Throws only for what a retry can fix.
 */
/**
 * What is kept of a Connect event: who, what and which object - all the
 * handler (and a replay) needs, since it re-reads the account or payout from
 * Stripe. The rest is dropped before storage: external-account events carry
 * bank details (holder name, bank, last digits, routing number) and account
 * events carry contact details, none of which RepGet keeps.
 */
export function minimalConnectEvent(event: Stripe.Event): Stripe.Event {
  const object = event.data.object as { id?: string; object?: string };
  return {
    id: event.id,
    object: "event",
    api_version: event.api_version,
    created: event.created,
    livemode: event.livemode,
    pending_webhooks: event.pending_webhooks,
    request: { id: null, idempotency_key: null },
    type: event.type,
    account: event.account,
    data: { object: { id: object.id, object: object.object } },
  } as unknown as Stripe.Event;
}

export async function processPartnerConnectEvent(event: Stripe.Event): Promise<void> {
  const accountId = event.account;
  if (!accountId) {
    console.warn(`[partners] connect event ${event.id} (${event.type}) has no account`);
    return;
  }
  switch (event.type) {
    case "account.updated":
    case "account.application.deauthorized":
    case "capability.updated":
    case "account.external_account.created":
    case "account.external_account.updated":
    case "account.external_account.deleted": {
      const deps = partnerDeps();
      if (!deps.connect) return;
      const result = await syncPayoutAccount(deps, { kind: "system", origin: `stripe:${event.id}` }, {
        stripeAccountId: accountId,
        livemode: event.livemode,
      });
      if (!result.ok && result.reason !== "not_found") {
        console.warn(`[partners] ${event.type} for ${accountId} not applied`, { reason: result.reason, detail: result.detail });
      }
      return;
    }
    case "payout.created":
    case "payout.updated":
    case "payout.paid":
    case "payout.failed":
    case "payout.canceled":
    case "payout.reconciliation_completed": {
      const deps = partnerDeps();
      if (!deps.payouts) return;
      const outcome = await applyPayoutEvent(deps, { accountId, payoutId: event.data.object.id, livemode: event.livemode });
      if (outcome !== "applied") console.info(`[partners] ${event.type} ${event.data.object.id}: ${outcome}`);
      return;
    }
    default:
      // Recorded by the webhook store and acknowledged.
      return;
  }
}

/**
 * Records the affiliate work a verified PLATFORM event implies, called by
 * lib/billing/stripe-events.ts processStripeEvent after the billing work
 * and BEFORE the webhook event is marked complete: a crash between the two
 * leaves the event unfinished, so it is retried (the billing work is
 * idempotent) and the affiliate work is recorded then. Once recorded it is
 * durable - partner_provider_events - and processed by the
 * partner-commissions job, even while commission processing is switched
 * off (it waits). An event for another environment than this deployment's
 * key is ignored and logged: test and live never mix.
 */
export async function recordPartnerPlatformWork(event: Stripe.Event): Promise<void> {
  const work = partnerWorkFor(event);
  if (!work) return;
  const deps = partnerDeps();
  const environment = deps.settings.environment();
  if (!environment) return;
  if (work.environment !== environment) {
    console.warn(`[partners] ${event.type} ${event.id} is ${work.environment} but this deployment is ${environment}; ignored`);
    return;
  }
  const now = deps.clock.now();
  const repos = deps.uow.repositories;
  const { id, created } = await repos.providerEvents.record({
    environment,
    stripeEventId: event.id,
    eventType: `${work.kind}:${event.type}`,
    objectId: work.objectId,
    connectedAccountId: null,
    eventCreatedAt: new Date(event.created * 1000),
    now,
  });
  if (created) {
    await repos.outbox.enqueue({ name: "partners/provider-event.process", id: `partners/provider-event:${id}`, data: { providerEventId: id } });
  }
}
