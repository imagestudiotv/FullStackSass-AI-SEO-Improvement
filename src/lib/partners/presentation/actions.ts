"use server";

import { revalidatePath } from "next/cache";

import type { FailureReason } from "../application/contracts/results";
import { submitApplication } from "../application/use-cases/submit-application";
import {
  openPayoutDashboard,
  startPayoutSetup,
  syncPayoutAccount,
} from "../application/use-cases/manage-payout-account";
import { partnerDeps } from "../server";
import { PartnerGuardError, requireActivePartner, requirePartnerAccess, requirePartnerApplicant } from "./guards";
import { applicationSchema } from "./validation";

/**
 * Partner-facing server actions. Each one authorizes ITSELF (a hidden button
 * is not a boundary) and derives identity from the session: none accepts a
 * partner, user, organization or Stripe account id from the browser.
 * Answers carry a stable error code for the page to translate, never a raw
 * internal error.
 */

export type ActionAnswer<T = null> = { ok: true; data: T } | { ok: false; error: FailureReason | "unauthenticated" | "unverified" | "not_partner" | "suspended"; detail?: string };

function refused(error: unknown): ActionAnswer<never> {
  if (error instanceof PartnerGuardError) return { ok: false, error: error.reason };
  throw error;
}

export async function submitPartnerApplicationAction(input: unknown): Promise<ActionAnswer<{ applicationId: string }>> {
  try {
    const applicant = await requirePartnerApplicant();
    const parsed = applicationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid", detail: parsed.error.issues[0]?.path.join(".") };
    const result = await submitApplication(partnerDeps(), applicant, parsed.data);
    if (!result.ok) return { ok: false, error: result.reason, detail: result.detail };
    revalidatePath("/partner", "layout");
    return { ok: true, data: result.value };
  } catch (error) {
    return refused(error);
  }
}

export async function startPayoutSetupAction(): Promise<ActionAnswer<{ url: string }>> {
  try {
    const access = await requireActivePartner();
    const result = await startPayoutSetup(partnerDeps(), access);
    if (!result.ok) return { ok: false, error: result.reason, detail: result.detail };
    return { ok: true, data: result.value };
  } catch (error) {
    return refused(error);
  }
}

export async function openPayoutDashboardAction(): Promise<ActionAnswer<{ url: string }>> {
  try {
    const access = await requirePartnerAccess();
    const result = await openPayoutDashboard(partnerDeps(), access);
    if (!result.ok) return { ok: false, error: result.reason, detail: result.detail };
    return { ok: true, data: result.value };
  } catch (error) {
    return refused(error);
  }
}

/** Re-reads the partner's own account from Stripe. */
export async function refreshPayoutStatusAction(): Promise<ActionAnswer<{ state: string }>> {
  try {
    const access = await requirePartnerAccess();
    const result = await syncPayoutAccount(partnerDeps(), access.context, { partnerId: access.partner.id });
    if (!result.ok) return { ok: false, error: result.reason, detail: result.detail };
    revalidatePath("/partner", "layout");
    return { ok: true, data: { state: result.value.state } };
  } catch (error) {
    return refused(error);
  }
}
