import { nextMonthlyRun } from "../../domain/policies/maturity";
import { payoutThreshold } from "../../domain/policies/program";
import type { PartnerRecord } from "../ports/repositories";
import type { PartnerDeps } from "../use-cases/deps";
import { payoutSetupStatus } from "../use-cases/manage-payout-account";
import { payPalPayoutAvailability } from "../use-cases/paypal-payouts";

/**
 * What ONE partner needs to do to be paid, and when: the answer the portal
 * shows on the overview, the payouts page and the settings. Read from the
 * configuration that is actually running and the partner's own records, never
 * a promise of a method that is off.
 */
export type PayoutStep =
  /* Paid in RepGet credits (PARTNER_PAYOUT_FORM=credits, the default). */
  | "credits_ready"
  | "credits_choose"
  | "credits_no_workspace"
  /* Paid to a bank through Stripe Connect. */
  | "stripe_not_started"
  | "stripe_setup_required"
  | "stripe_verification_pending"
  | "stripe_restricted"
  | "stripe_ready"
  /* Paid to a PayPal account. */
  | "paypal_confirm"
  | "paypal_ready"
  | "paypal_off"
  /* No method covers this partner's country, or none is configured here. */
  | "country"
  | "unavailable";

export type PartnerPayoutStatus = {
  form: "credits" | "cash";
  step: PayoutStep;
  /** No payout runs at the moment (the payouts switch, or the live-money key): earnings are kept. */
  paused: boolean;
  maturityDays: number;
  /** Cash only: the smallest payout, in euros' minor units, and the next monthly run. */
  minimum: { amount: bigint; currency: string } | null;
  nextRunAt: Date | null;
};

export async function partnerPayoutStatus(deps: PartnerDeps, partner: PartnerRecord): Promise<PartnerPayoutStatus> {
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  const environment = deps.settings.environment();
  const form = deps.settings.payoutForm?.() ?? "cash";
  const [version, switchedOn] = await Promise.all([repos.programs.versionAt(now), repos.controls.isEnabled("partner_payouts")]);
  const maturityDays = version.policy.maturityDays;

  if (form === "credits") {
    const [chosen, owned] = await Promise.all([
      repos.credits.creditWorkspaceOf(partner.id),
      partner.userId ? repos.credits.ownedWorkspaces(partner.userId) : Promise.resolve([]),
    ]);
    const step: PayoutStep = chosen && owned.some((workspace) => workspace.id === chosen) ? "credits_ready" : owned.length > 0 ? "credits_choose" : "credits_no_workspace";
    return { form, step, paused: !switchedOn || environment === null, maturityDays, minimum: null, nextRunAt: null };
  }

  const threshold = payoutThreshold(version.policy, "eur");
  return {
    form,
    step: await cashStep(deps, partner),
    paused: !switchedOn || environment === null || !deps.settings.moneyMovementAllowed(environment),
    maturityDays,
    minimum: threshold ? { amount: threshold.amount, currency: "eur" } : null,
    nextRunAt: nextMonthlyRun(now),
  };
}

async function cashStep(deps: PartnerDeps, partner: PartnerRecord): Promise<PayoutStep> {
  const repos = deps.uow.repositories;
  const environment = deps.settings.environment();
  const paypal = payPalPayoutAvailability(deps, partner);
  if (environment && (await repos.paypalPayouts.payoutMethodOf(partner.id)) === "paypal") {
    if (!paypal.available) return "paypal_off";
    const account = await repos.paypalPayouts.findAccount(partner.id, environment);
    return account?.status === "verified" ? "paypal_ready" : "paypal_confirm";
  }
  const setup = await payoutSetupStatus(deps, partner.id);
  const stripeCovers = deps.settings.payoutCountries().includes(partner.country?.toUpperCase() ?? "");
  // An account that already exists keeps working whatever the country list says now.
  if (setup.configured && (setup.state !== "not_started" || stripeCovers)) return `stripe_${setup.state}`;
  if (paypal.available) return "paypal_confirm";
  return setup.configured ? "country" : "unavailable";
}
