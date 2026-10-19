import type { ApplicationStatus } from "../../domain/entities/application";
import type { PartnerStatus } from "../../domain/entities/partner";
import type { AdminContext } from "../contracts/commands";
import { programReadiness } from "../use-cases/manage-program";
import { setupState } from "../use-cases/manage-payout-account";
import type { PartnerDeps } from "../use-cases/deps";

/**
 * Administrator read models for the partner program. Every function takes
 * the AdminContext the presentation layer obtained from requireAdmin(), so
 * none of them can be called without one.
 */

export const ADMIN_PAGE_SIZE = 25;

/** These read models exist only for an administrator context; anything else is a programming error. */
function assertAdmin(admin: AdminContext): void {
  if (admin?.kind !== "admin") throw new Error("An administrator context is required");
}

export async function adminProgramOverview(deps: PartnerDeps, admin: AdminContext) {
  assertAdmin(admin);
  const repos = deps.uow.repositories;
  const [readiness, applications, partners, suspended, cases, events] = await Promise.all([
    programReadiness(deps),
    repos.applications.list({ status: "submitted", offset: 0, limit: 1 }),
    repos.partners.list({ status: "active", offset: 0, limit: 1 }),
    repos.partners.list({ status: "suspended", offset: 0, limit: 1 }),
    repos.reviews.list({ status: "open", offset: 0, limit: 1 }),
    repos.providerEvents.backlog(),
  ]);
  return {
    readiness,
    openApplications: applications.total,
    activePartners: partners.total,
    suspendedPartners: suspended.total,
    openReviewCases: cases.total,
    providerEvents: events,
  };
}

export async function adminApplications(
  deps: PartnerDeps,
  admin: AdminContext,
  filter: { status?: ApplicationStatus; search?: string; page: number },
) {
  assertAdmin(admin);
  const page = Math.max(1, filter.page);
  const result = await deps.uow.repositories.applications.list({
    status: filter.status,
    search: filter.search,
    offset: (page - 1) * ADMIN_PAGE_SIZE,
    limit: ADMIN_PAGE_SIZE,
  });
  return { ...result, page, pageSize: ADMIN_PAGE_SIZE };
}

export async function adminPartners(
  deps: PartnerDeps,
  admin: AdminContext,
  filter: { status?: PartnerStatus; search?: string; page: number },
) {
  assertAdmin(admin);
  const page = Math.max(1, filter.page);
  const result = await deps.uow.repositories.partners.list({
    status: filter.status,
    search: filter.search,
    offset: (page - 1) * ADMIN_PAGE_SIZE,
    limit: ADMIN_PAGE_SIZE,
  });
  return { ...result, page, pageSize: ADMIN_PAGE_SIZE };
}

export async function adminPartnerDetail(deps: PartnerDeps, admin: AdminContext, partnerId: string) {
  assertAdmin(admin);
  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(partnerId);
  if (!partner) return null;
  const environment = deps.settings.environment();
  const [tiers, account, coupons, cases] = await Promise.all([
    repos.tiers.periods(partnerId),
    environment ? repos.stripeAccounts.find(partnerId, environment) : Promise.resolve(null),
    environment ? repos.coupons.forPartner(partnerId, environment) : Promise.resolve([]),
    repos.reviews.list({ partnerId, offset: 0, limit: 20 }),
  ]);
  return { partner, tiers, account, setup: setupState(account), coupons, cases: cases.rows, environment };
}
