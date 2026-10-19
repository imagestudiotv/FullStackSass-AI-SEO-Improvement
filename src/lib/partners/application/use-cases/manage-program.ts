import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerControlKey } from "../ports/repositories";
import type { PartnerDeps } from "./deps";

/**
 * The program's three switches (see ports/settings.ts). Administrators
 * only, always with a reason, always audited - in the same transaction.
 */
export async function setProgramControl(
  deps: PartnerDeps,
  admin: AdminContext,
  key: PartnerControlKey,
  enabled: boolean,
  reason: string,
): Promise<Result<null>> {
  if (!["partner_program", "partner_commissions", "partner_payouts"].includes(key)) return fail("invalid", "key");
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  return deps.uow.transaction(async (repos) => {
    await repos.controls.write(key, enabled, { reason: reason.trim(), actor: admin.email });
    await repos.audit.record({
      actorEmail: admin.email,
      action: "partner.control_changed",
      targetType: "partner_program",
      targetId: key,
      summary: `${enabled ? "Switched on" : "Switched off"} ${key.replace(/_/g, " ")}`,
      detail: { enabled, reason: reason.trim() },
    });
    return ok(null);
  });
}

/** Whether each switch is on, and whether live money could move on this deployment. */
export async function programReadiness(deps: PartnerDeps) {
  const controls = await deps.uow.repositories.controls.read();
  const environment = deps.settings.environment();
  return {
    controls,
    environment,
    stripeConfigured: environment !== null,
    connectConfigured: deps.connect !== null,
    moneyMovementAllowed: environment ? deps.settings.moneyMovementAllowed(environment) : false,
    payoutCountries: deps.settings.payoutCountries(),
  };
}

/**
 * What the public partner page shows: the rules in force now and whether
 * applications are open. Read per request, like the pricing page, so the
 * page never advertises a rate the program does not pay.
 */
export async function publicProgramSummary(deps: PartnerDeps) {
  const repos = deps.uow.repositories;
  const [version, open] = await Promise.all([repos.programs.current(), repos.controls.isEnabled("partner_program")]);
  return { policy: version.policy, open };
}
