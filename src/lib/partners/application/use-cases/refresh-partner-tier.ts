import { tierForCount } from "../../domain/policies/tiers";
import type { PartnerDeps } from "./deps";

/**
 * Re-counts a partner's qualifying customers and, when that moves them to
 * another tier, opens a new tier period from NOW. Payments use the tier in
 * force at their own time, so this never changes a commission already made
 * - a promotion applies to payments made after it, in both directions.
 *
 * Under the partner's row lock: two refreshes cannot both open a period.
 */
export async function refreshPartnerTier(deps: PartnerDeps, partnerId: string) {
  const environment = deps.settings.environment();
  if (!environment) return null;
  return deps.uow.transaction(async (repos) => {
    const partner = await repos.partners.lock(partnerId);
    if (!partner) return null;
    const now = deps.clock.now();
    const version = await repos.programs.versionAt(now);
    const organizations = await repos.tiers.qualifyingOrganizations(partnerId, environment, now);
    const tier = tierForCount(version.policy, organizations.length);
    const periods = await repos.tiers.periods(partnerId);
    const open = periods.find((period) => period.effectiveTo === null) ?? null;
    let changed = false;
    if (!open || open.tierKey !== tier.key || open.rateBasisPoints !== tier.rateBasisPoints) {
      await repos.tiers.open({
        partnerId,
        tierKey: tier.key,
        rateBasisPoints: tier.rateBasisPoints,
        programVersion: version.policy.version,
        qualifyingCustomers: organizations.length,
        effectiveFrom: now,
        evidence: { organizations, previous: open?.tierKey ?? null },
      });
      changed = true;
    }
    await repos.partners.setTierProjection(partnerId, tier.key, organizations.length);
    return { tier: tier.key, qualifyingCustomers: organizations.length, changed };
  });
}
