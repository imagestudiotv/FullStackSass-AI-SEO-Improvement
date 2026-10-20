import type Stripe from "stripe";

import type { AccountReadiness, ConnectAccountGateway } from "../../application/ports/payout-gateway";
import type { Environment, StripeAccountStatus } from "../../application/ports/repositories";
import { classifyStripeError } from "./errors";

/**
 * Stripe Connect accounts for partners: Stripe-hosted onboarding, Express
 * Dashboard, and the readiness RepGet needs before paying anyone.
 *
 * ACCOUNTS V2. Stripe refuses POST /v1/accounts for platforms that start
 * with Connect now ("Create connected accounts with POST /v2/core/accounts
 * instead"), which the sandbox test of 2026-10-20 found. Accounts are created
 * with Accounts v2; everything else stays on v1, which Stripe serves for v2
 * accounts unchanged (checked in the sandbox the same day): reading the
 * account (details_submitted, payouts_enabled, capabilities.transfers,
 * requirements, the payout schedule), Account Links, Express login links,
 * transfers and payouts, and the classic Connect events (account.updated,
 * capability.updated, payout.*).
 *
 * THE CONFIGURATION (docs/partner-program.md, "Stripe Connect"):
 *
 *   dashboard = express                         the partner manages their bank
 *                                               details in Stripe's Express
 *                                               Dashboard; the platform may set
 *                                               payout schedules and create
 *                                               manual payouts
 *   defaults.responsibilities
 *     .fees_collector = application             RepGet pays Stripe's fees
 *     .losses_collector = application           RepGet is liable for negative
 *                                               balances (required for
 *                                               separate charges and transfers)
 *   configuration.recipient: stripe_balance
 *     .stripe_transfers requested               receive transfers; no card payments
 *   identity.country                            the partner's payout country
 *
 * Then the payout schedule (v1 balance settings): MANUAL, so funds wait in
 * the partner's balance until RepGet creates the bank payout for a
 * settlement. A v2 account starts on Stripe's daily schedule; an account is
 * only "ready" once its schedule is manual, and the use cases make it so
 * whenever they read it (accountReadiness in manage-payout-account.ts).
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
    // Not ready while Stripe would pay the balance out on its own schedule: RepGet's bank payout would find nothing.
    status = currentlyDue.length > 0 || payoutInterval !== "manual" ? "verification_pending" : "ready";
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
  // Idempotent by nature: setting "manual" again changes nothing.
  const setManualPayouts = async (accountId: string) => {
    await stripe.balanceSettings.update({ payments: { payouts: { schedule: { interval: "manual" } } } }, { stripeAccount: accountId });
  };
  return {
    environment: () => environment,
    async createConnectedAccount(input) {
      try {
        const account = await stripe.v2.core.accounts.create(
          {
            contact_email: input.email,
            identity: { country: input.country.toLowerCase() },
            dashboard: "express",
            defaults: {
              responsibilities: { fees_collector: "application", losses_collector: "application" },
              profile: { product_description: "Affiliate partner promoting RepGet" },
            },
            configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
            metadata: { repget_partner_id: input.partnerId, repget_environment: environment, repget_purpose: "partner_payouts" },
          },
          { idempotencyKey: input.idempotencyKey },
        );
        try {
          await setManualPayouts(account.id);
        } catch (error) {
          // The account exists and is kept; the schedule is set again whenever the account is read.
          console.warn("[partners] connected account created, payout schedule not yet manual:", classifyStripeError(error).kind);
        }
        return { kind: "succeeded", value: { accountId: account.id } };
      } catch (error) {
        return classifyStripeError(error);
      }
    },
    async ensureManualPayouts(accountId) {
      await setManualPayouts(accountId);
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
