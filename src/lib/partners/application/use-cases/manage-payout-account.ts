import type { PartnerContext, SystemContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { AccountReadiness, ConnectAccountGateway } from "../ports/payout-gateway";
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

/**
 * A connected account's readiness, with its bank payouts made manual first
 * when they are not. Accounts v2 start on Stripe's daily schedule; the
 * schedule is set at creation, and this repairs a missed or undone step
 * whenever an account is read - before a status is stored and before a
 * transfer. If Stripe refuses or cannot be reached, the readiness is returned
 * as read: an account whose schedule is not manual is never "ready"
 * (readinessFromAccount), so nothing is sent to it.
 */
export async function accountReadiness(connect: ConnectAccountGateway, accountId: string): Promise<AccountReadiness> {
  const readiness = await connect.retrieveAccount(accountId);
  if (readiness.payoutInterval === "manual") return readiness;
  try {
    await connect.ensureManualPayouts(accountId);
  } catch {
    console.warn("[partners] a connected account's payouts could not be made manual yet; it stays not ready");
    return readiness;
  }
  return connect.retrieveAccount(accountId);
}

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

/**
 * Each of these calls Stripe; the platform's Stripe rate limit is shared with
 * checkout and billing, so one partner reloading cannot use it up.
 */
const STRIPE_BUDGET = { perPartnerPerMinute: 12 };
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;

async function withinStripeBudget(deps: PartnerDeps, partnerId: string): Promise<boolean> {
  return deps.burstLimiter.admit([{ key: `partner-stripe:${partnerId}`, limit: STRIPE_BUDGET.perPartnerPerMinute, windowSeconds: 60 }], "partner.stripe");
}

export async function startPayoutSetup(deps: PartnerDeps, access: Access): Promise<Result<{ url: string }>> {
  if (access.partner.status !== "active") return fail("forbidden", "suspended");
  const connect = deps.connect;
  if (!connect) return fail("disabled", "stripe_not_configured");
  const environment = connect.environment();
  const country = access.partner.country?.toUpperCase() ?? "";
  if (!deps.settings.payoutCountries().includes(country)) return fail("invalid", "country_not_supported");

  if (!(await withinStripeBudget(deps, access.partner.id))) return fail("rate_limited");

  const repos = deps.uow.repositories;
  const key = creationKey(access.partner.id, environment);
  let account = await repos.stripeAccounts.reserve(access.partner.id, environment, key, country, deps.clock.now());
  if (!account.stripeAccountId && deps.clock.now().getTime() - account.createdAt.getTime() > IDEMPOTENCY_WINDOW_MS) {
    /*
      Reserved more than a day ago and never confirmed: Stripe may have made the
      account while the answer was lost, and its idempotency key has expired, so
      a new request could make a SECOND account. A person checks first.
    */
    await repos.reviews.open({
      kind: "payout_discrepancy",
      dedupeKey: `account_unresolved:${account.id}`,
      environment,
      partnerId: access.partner.id,
      attributionId: null,
      commissionId: null,
      settlementId: null,
      paymentFactId: null,
      organizationId: null,
      summary: "A connected-account creation for this partner was never confirmed; look for an account with this partner's repget_partner_id metadata at Stripe before letting them retry",
      evidence: { creationKey: account.creationKey, reservedAt: account.createdAt.toISOString() },
    });
    return fail("provider_outcome_unknown", "account_unresolved");
  }
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
  if (!(await withinStripeBudget(deps, access.partner.id))) return fail("rate_limited");
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
  // A partner's own refreshes are budgeted; webhooks and jobs (system) are not.
  if (actor.kind === "partner" && !(await withinStripeBudget(deps, actor.partnerId))) return fail("rate_limited");
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

  const readiness = await accountReadiness(connect, account.stripeAccountId);
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
  if (!(await withinStripeBudget(deps, access.partner.id))) return fail("rate_limited");
  return ok(await connect.createDashboardLink(account.stripeAccountId));
}

/** What the portal shows about payout setup, from the stored readiness. */
export async function payoutSetupStatus(deps: PartnerDeps, partnerId: string) {
  const environment = deps.settings.environment();
  if (!environment || !deps.connect) return { configured: false as const };
  const account = await deps.uow.repositories.stripeAccounts.find(partnerId, environment);
  return { configured: true as const, environment, state: setupState(account), account };
}
