import { referralLinkPath } from "../../domain/entities/partner";
import { tierProgress } from "../../domain/policies/tiers";
import type { PartnerContext } from "../contracts/commands";
import { payoutSetupStatus } from "../use-cases/manage-payout-account";
import type { PartnerDeps } from "../use-cases/deps";

/**
 * The partner's own overview. Scoped by the PartnerContext the guard
 * derived from the session - never by an id from the browser.
 */
export async function partnerOverview(deps: PartnerDeps, context: PartnerContext) {
  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(context.partnerId);
  if (!partner || partner.userId !== context.userId) return null;
  const version = await repos.programs.versionAt(deps.clock.now());
  const progress = tierProgress(version.policy, partner.qualifyingCustomers);
  const environment = deps.settings.environment();
  const [setup, coupons] = await Promise.all([
    payoutSetupStatus(deps, partner.id),
    environment ? repos.coupons.forPartner(partner.id, environment) : Promise.resolve([]),
  ]);
  return {
    partner,
    policy: version.policy,
    progress,
    referralUrl: `${deps.settings.appUrl()}${referralLinkPath(partner.referralCode)}`,
    setup,
    coupons: coupons.filter((coupon) => coupon.status === "active"),
  };
}
