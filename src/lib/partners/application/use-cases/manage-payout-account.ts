import type { PartnerContext, SystemContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerRecord, StripeAccountRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";

/**
 * A partner's connected Stripe account: creation, Stripe-hosted onboarding,
 * and readiness.
 *
 * ONE ACCOUNT PER PARTNER AND ENVIRONMENT. The row is reserved first (a
 * unique index), then the account is created with a stable idempotency key,
 * so a double click, a retry or two tabs make one account. Stripe collects
 * identity and bank details; nothing sensitive is stored here.
 *
 * RETURNING FROM STRIPE PROVES NOTHING. Stripe sends the partner back to the
 * return URL when they finish OR when they click "save for later". Readiness
 * is always read from the account itself (retrieve, or a verified
 * account.updated event), never inferred from the redirect.
 */

export type PayoutSetupState = "not_started" | "setup_required" | "verification_pending" | "restricted" | "ready";

export function creationKey(partnerId: string, environment: string): string {
  return `partner-account:${partnerId}:${environment}`;
}

export function setupState(account: StripeAccountRecord | null): PayoutSetupState {
  if (!account || !account.stripeAccountId) return "not_started";
  switch (account.status) {
    case "ready":
      return "ready";
    case "verification_pending":
      return "verification_pending";
    case "restricted":
    case "deauthorized":
      return "restricted";
    default:
      return "setup_required";
  }
}

type Access = { context: PartnerContext; partner: PartnerRecord };

export async function startPayoutSetup(deps: PartnerDeps, access: Access): Promise<Result<{ url: string }>> {
  if (access.partner.status !== "active") return fail("forbidden", "suspended");
  const connect = deps.connect;
  if (!connect) return fail("disabled", "stripe_not_configured");
  const environment = connect.environment();
  const country = access.partner.country?.toUpperCase() ?? "";
  if (!deps.settings.payoutCountries().includes(country)) return fail("invalid", "country_not_supported");

  const repos = deps.uow.repositories;
  const key = creationKey(access.partner.id, environment);
  let account = await repos.stripeAccounts.reserve(access.partner.id, environment, key, country, deps.clock.now());
  if (!account.stripeAccountId) {
    const created = await connect.createConnectedAccount({
      partnerId: access.partner.id,
      email: access.partner.contactEmail,
      country,
      idempotencyKey: account.creationKey,
    });
    if (created.kind === "refused") return fail("invalid", created.code ?? "account_refused");
    // The same idempotency key is used next time, so a lost answer cannot make a second account.
    if (created.kind === "unknown") return fail("provider_outcome_unknown");
    await repos.stripeAccounts.attach(account.id, created.value.accountId);
    account = { ...account, stripeAccountId: created.value.accountId, status: "onboarding" };
  }
  return onboardingLink(deps, account.stripeAccountId!);
}

/** The refresh URL: a new single-use link for an account that already exists. Never creates one. */
export async function refreshOnboardingLink(deps: PartnerDeps, access: Access): Promise<Result<{ url: string }>> {
  if (access.partner.status !== "active") return fail("forbidden", "suspended");
  const connect = deps.connect;
  if (!connect) return fail("disabled", "stripe_not_configured");
  const account = await deps.uow.repositories.stripeAccounts.find(access.partner.id, connect.environment());
  if (!account?.stripeAccountId) return fail("not_found");
  return onboardingLink(deps, account.stripeAccountId);
}

async function onboardingLink(deps: PartnerDeps, accountId: string): Promise<Result<{ url: string }>> {
  const appUrl = deps.settings.appUrl();
  const link = await deps.connect!.createOnboardingLink({
    accountId,
    refreshUrl: `${appUrl}/partner/connect/refresh`,
    returnUrl: `${appUrl}/partner/settings?onboarding=returned`,
  });
  return ok({ url: link.url });
}

/**
 * Reads the account from Stripe and stores its readiness. Refuses an
 * account that is not this partner's, or not this environment's - a
 * mismatched id or livemode never updates anything.
 */
export async function syncPayoutAccount(
  deps: PartnerDeps,
  actor: PartnerContext | SystemContext,
  target: { partnerId: string } | { stripeAccountId: string; livemode: boolean },
): Promise<Result<{ state: PayoutSetupState; account: StripeAccountRecord }>> {
  const connect = deps.connect;
  if (!connect) return fail("disabled", "stripe_not_configured");
  const environment = connect.environment();
  const repos = deps.uow.repositories;

  let account: StripeAccountRecord | null;
  if ("partnerId" in target) {
    if (actor.kind === "partner" && actor.partnerId !== target.partnerId) return fail("forbidden");
    account = await repos.stripeAccounts.find(target.partnerId, environment);
  } else {
    if ((target.livemode ? "live" : "test") !== environment) return fail("invalid", "wrong_environment");
    account = await repos.stripeAccounts.findByStripeId(target.stripeAccountId);
    if (account && account.environment !== environment) return fail("invalid", "wrong_environment");
  }
  if (!account?.stripeAccountId) return fail("not_found");

  const readiness = await connect.retrieveAccount(account.stripeAccountId);
  if ((readiness.livemode ? "live" : "test") !== account.environment) return fail("invalid", "wrong_environment");
  if (readiness.metadataPartnerId && readiness.metadataPartnerId !== account.partnerId) {
    return fail("invalid", "account_owner_mismatch");
  }
  const values = {
    status: readiness.status,
    country: readiness.country,
    defaultCurrency: readiness.defaultCurrency,
    detailsSubmitted: readiness.detailsSubmitted,
    payoutsEnabled: readiness.payoutsEnabled,
    transfersCapability: readiness.transfersCapability,
    requirementsCurrentlyDue: readiness.requirementsCurrentlyDue,
    requirementsPastDue: readiness.requirementsPastDue,
    requirementsPendingVerification: readiness.requirementsPendingVerification,
    disabledReason: readiness.disabledReason,
    currentDeadline: readiness.currentDeadline,
    payoutInterval: readiness.payoutInterval,
  };
  await repos.stripeAccounts.updateReadiness(account.id, { ...values, syncedAt: deps.clock.now() });
  const updated = { ...account, ...values };
  return ok({ state: setupState(updated), account: updated });
}

/** The Express Dashboard, where the partner manages their bank account with Stripe. */
export async function openPayoutDashboard(deps: PartnerDeps, access: Access): Promise<Result<{ url: string }>> {
  const connect = deps.connect;
  if (!connect) return fail("disabled", "stripe_not_configured");
  const account = await deps.uow.repositories.stripeAccounts.find(access.partner.id, connect.environment());
  if (!account?.stripeAccountId || !account.detailsSubmitted) return fail("onboarding_incomplete");
  return ok(await connect.createDashboardLink(account.stripeAccountId));
}

/** What the portal shows about payout setup, from the stored readiness. */
export async function payoutSetupStatus(deps: PartnerDeps, partnerId: string) {
  const environment = deps.settings.environment();
  if (!environment || !deps.connect) return { configured: false as const };
  const account = await deps.uow.repositories.stripeAccounts.find(partnerId, environment);
  return { configured: true as const, environment, state: setupState(account), account };
}
