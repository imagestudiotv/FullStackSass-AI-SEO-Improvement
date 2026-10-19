import "server-only";

import type Stripe from "stripe";

import { syncPayoutAccount } from "../application/use-cases/manage-payout-account";
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
    default:
      // Recorded by the webhook store and acknowledged.
      return;
  }
}
