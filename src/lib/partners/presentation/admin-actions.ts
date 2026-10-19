"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";

import type { AdminContext } from "../application/contracts/commands";
import type { Result } from "../application/contracts/results";
import { setProgramControl } from "../application/use-cases/manage-program";
import {
  approveApplication,
  rejectApplication,
  setPartnerStatus,
  setPayoutHold,
} from "../application/use-cases/review-application";
import { partnerDeps } from "../server";
import { controlKeySchema, idSchema, reasonSchema } from "./validation";

/**
 * Administrator actions on the partner program. Every one calls
 * requireAdmin() itself (verified, allowlisted address - lib/admin/guard.ts),
 * requires a reason for anything that overrides, and is audited by the use
 * case in the same transaction as the change.
 */

export type AdminAnswer<T = null> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  invalid: "That request is not valid.",
  not_found: "Not found. It may have been removed.",
  conflict: "This was changed by someone else. Reload and try again.",
  disabled: "This part of the partner program is switched off.",
  forbidden: "Not allowed.",
  reason: "Give a reason of at least 5 characters.",
};

async function admin(): Promise<AdminContext> {
  const who = await requireAdmin();
  return { kind: "admin", userId: who.userId, email: who.email };
}

function answer<T>(result: Result<T>): AdminAnswer<T> {
  if (result.ok) return { ok: true, data: result.value };
  return { ok: false, error: MESSAGES[result.detail ?? ""] ?? MESSAGES[result.reason] ?? `Refused: ${result.reason}` };
}

function refresh() {
  revalidatePath("/admin/partners", "layout");
}

export async function approvePartnerApplicationAction(applicationId: string, note?: string): Promise<AdminAnswer<{ partnerId: string }>> {
  const who = await admin();
  if (!idSchema.safeParse(applicationId).success) return { ok: false, error: MESSAGES.invalid };
  const result = await approveApplication(partnerDeps(), who, applicationId, note?.trim() || null);
  refresh();
  return result.ok ? { ok: true, data: { partnerId: result.value.partner.id } } : answer(result);
}

export async function rejectPartnerApplicationAction(applicationId: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(applicationId).success) return { ok: false, error: MESSAGES.invalid };
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await rejectApplication(partnerDeps(), who, applicationId, reason);
  refresh();
  return answer(result);
}

export async function setPartnerStatusAction(partnerId: string, status: "active" | "suspended", reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(partnerId).success || !["active", "suspended"].includes(status)) {
    return { ok: false, error: MESSAGES.invalid };
  }
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await setPartnerStatus(partnerDeps(), who, partnerId, status, reason);
  refresh();
  return answer(result);
}

export async function setPartnerPayoutHoldAction(partnerId: string, hold: boolean, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(partnerId).success) return { ok: false, error: MESSAGES.invalid };
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await setPayoutHold(partnerDeps(), who, partnerId, Boolean(hold), reason);
  refresh();
  return answer(result);
}

export async function setPartnerControlAction(key: string, enabled: boolean, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  const parsedKey = controlKeySchema.safeParse(key);
  if (!parsedKey.success) return { ok: false, error: MESSAGES.invalid };
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await setProgramControl(partnerDeps(), who, parsedKey.data, Boolean(enabled), reason);
  refresh();
  return answer(result);
}
