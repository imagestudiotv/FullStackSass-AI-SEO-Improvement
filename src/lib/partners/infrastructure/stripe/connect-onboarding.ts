import type Stripe from "stripe";

import type { AccountReadiness, ConnectAccountGateway } from "../../application/ports/payout-gateway";
import type { Environment, StripeAccountStatus } from "../../application/ports/repositories";
import { classifyStripeError } from "./errors";

/**
 * Stripe Connect accounts for partners: Stripe-hosted onboarding, Express
 * Dashboard, and the readiness RepGet needs before paying anyone.
 *
 * THE CONFIGURATION (docs/partner-program.md, "Stripe Connect"):
 *
 *   controller.stripe_dashboard.type = express  the partner manages their bank
 *                                               details in Stripe's Express
 *                                               Dashboard; the platform may set
 *                                               payout schedules and create
 *                                               manual payouts
 *   controller.fees.payer = application         RepGet pays Stripe's fees
 *   controller.losses.payments = application    RepGet is liable for negative
 *                                               balances (required for
 *                                               separate charges and transfers)
 *   capabilities.transfers = requested          receive transfers; no card payments
 *   settings.payouts.schedule.interval = manual funds wait in the partner's
 *                                               balance until RepGet creates the
 *                                               bank payout for a settlement
 *   country                                     the partner's payout country
 *
 * Requirement collection stays with Stripe (the default for Express), so
 * identity documents and bank details never touch RepGet.
 */

/**
 * Readiness from a retrieved Account. Account objects carry no livemode: an
 * account read with a test key is a test account, so the caller says which.
 */
export function readinessFromAccount(account: Stripe.Account, environment: Environment): AccountReadiness {
  const requirements = account.requirements;
  const currentlyDue = requirements?.currently_due ?? [];
  const pastDue = requirements?.past_due ?? [];
  const pendingVerification = requirements?.pending_verification ?? [];
  const disabledReason = requirements?.disabled_reason ?? null;
  const transfers = account.capabilities?.transfers ?? null;
  const payoutInterval = account.settings?.payouts?.schedule?.interval ?? null;

  let status: StripeAccountStatus;
  if (!account.details_submitted) {
    status = "onboarding";
  } else if (disabledReason || pastDue.length > 0 || transfers === "inactive") {
    status = "restricted";
  } else if (transfers === "active" && account.payouts_enabled) {
    status = currentlyDue.length > 0 ? "verification_pending" : "ready";
  } else {
    status = "verification_pending";
  }

  return {
    accountId: account.id,
    livemode: environment === "live",
    status,
    country: account.country ?? null,
    defaultCurrency: account.default_currency ?? null,
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    transfersCapability: transfers,
    requirementsCurrentlyDue: currentlyDue,
    requirementsPastDue: pastDue,
    requirementsPendingVerification: pendingVerification,
    disabledReason,
    currentDeadline: requirements?.current_deadline ? new Date(requirements.current_deadline * 1000) : null,
    payoutInterval,
    metadataPartnerId: account.metadata?.repget_partner_id ?? null,
  };
}

export function connectAccountGateway(stripe: Stripe, environment: Environment): ConnectAccountGateway {
  return {
    environment: () => environment,
    async createConnectedAccount(input) {
      try {
        const account = await stripe.accounts.create(
          {
            country: input.country,
            email: input.email,
            controller: {
              fees: { payer: "application" },
              losses: { payments: "application" },
              stripe_dashboard: { type: "express" },
            },
            capabilities: { transfers: { requested: true } },
            settings: { payouts: { schedule: { interval: "manual" } } },
            business_profile: { product_description: "Affiliate partner promoting RepGet" },
            metadata: { repget_partner_id: input.partnerId, repget_environment: environment, repget_purpose: "partner_payouts" },
          },
          { idempotencyKey: input.idempotencyKey },
        );
        return { kind: "succeeded", value: { accountId: account.id } };
      } catch (error) {
        return classifyStripeError(error);
      }
    },
    async createOnboardingLink(input) {
      const link = await stripe.accountLinks.create({
        account: input.accountId,
        type: "account_onboarding",
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        collection_options: { fields: "eventually_due" },
      });
      return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
    },
    async createDashboardLink(accountId) {
      const link = await stripe.accounts.createLoginLink(accountId);
      return { url: link.url };
    },
    async retrieveAccount(accountId) {
      return readinessFromAccount(await stripe.accounts.retrieve(accountId), environment);
    },
  };
}
