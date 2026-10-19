import "server-only";

import { cache } from "react";

import { getSession } from "@/lib/auth-guard";

import type { ApplicantContext, PartnerContext } from "../application/contracts/commands";
import type { PartnerRecord } from "../application/ports/repositories";
import { partnerInfrastructure } from "../server";

/**
 * Who may use the partner program. Authorization lives HERE and in every
 * use case it guards - a protected layout or a hidden button is not a
 * boundary, so every page, server action and route handler calls one of
 * these itself.
 *
 *   requirePartnerApplicant  signed in, address PROVEN (read from the user
 *                            row, not the session). Enough to apply.
 *   requirePartnerAccess     ...and owns a partner profile, in any status.
 *                            Enough to see history and status.
 *   requireActivePartner     ...and the profile is active. Needed for
 *                            anything that changes state or moves money.
 *
 * Identity always comes from the session's user. A partner, user,
 * organization or Stripe account id sent by a browser is never evidence of
 * ownership. Partner access needs no paid plan, no website and no customer
 * workspace, and grants nothing outside the partner portal - in particular,
 * never administrator access, which stays with lib/admin/guard.ts.
 */

export type PartnerGuardReason = "unauthenticated" | "unverified" | "not_partner" | "suspended";

export class PartnerGuardError extends Error {
  /** 404 for anything that would reveal another account's data, as elsewhere in the app. */
  readonly status: number;
  constructor(readonly reason: PartnerGuardReason) {
    super(`Partner access refused: ${reason}`);
    this.name = "PartnerGuardError";
    this.status = reason === "unauthenticated" ? 401 : reason === "unverified" ? 403 : 404;
  }
}

export type PartnerAccess = { context: PartnerContext; partner: PartnerRecord };

/** The signed-in user, re-read from the database. Memoised per request. */
const currentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  return partnerInfrastructure().directory.findUser(session.user.id);
});

const currentPartner = cache(async (userId: string) =>
  partnerInfrastructure().uow.repositories.partners.findByUserId(userId),
);

export async function requirePartnerApplicant(): Promise<ApplicantContext> {
  const user = await currentUser();
  if (!user) throw new PartnerGuardError("unauthenticated");
  if (!user.emailVerified) throw new PartnerGuardError("unverified");
  return { kind: "applicant", userId: user.id, email: user.email, name: user.name };
}

export async function requirePartnerAccess(): Promise<PartnerAccess> {
  const applicant = await requirePartnerApplicant();
  const partner = await currentPartner(applicant.userId);
  if (!partner) throw new PartnerGuardError("not_partner");
  return { context: { kind: "partner", userId: applicant.userId, partnerId: partner.id }, partner };
}

export async function requireActivePartner(): Promise<PartnerAccess> {
  const access = await requirePartnerAccess();
  if (access.partner.status !== "active") throw new PartnerGuardError("suspended");
  return access;
}

/** For pages: what the visitor is, without throwing. */
export type PartnerViewer =
  | { state: "signed_out" }
  | { state: "unverified"; userId: string; email: string; name: string }
  | { state: "applicant"; applicant: ApplicantContext }
  | { state: "partner"; applicant: ApplicantContext; access: PartnerAccess };

export async function partnerViewer(): Promise<PartnerViewer> {
  const user = await currentUser();
  if (!user) return { state: "signed_out" };
  if (!user.emailVerified) return { state: "unverified", userId: user.id, email: user.email, name: user.name };
  const applicant: ApplicantContext = { kind: "applicant", userId: user.id, email: user.email, name: user.name };
  const partner = await currentPartner(user.id);
  if (!partner) return { state: "applicant", applicant };
  return {
    state: "partner",
    applicant,
    access: { context: { kind: "partner", userId: user.id, partnerId: partner.id }, partner },
  };
}
