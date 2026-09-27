"use server";

import { revalidatePath } from "next/cache";

import { linkDetail, type Direction, type LinkDetail } from "@/lib/reporting/backlinks";
import { requestRecheck, requestRecoveryChecks, type RecheckResult } from "@/lib/reporting/recheck";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";

/**
 * Row details and re-checks for the Earned Backlinks / Hosted links pages.
 * Every call resolves the website through tenancy first (another tenant's
 * website is "not found"), and every placement is looked up WITHIN that
 * website's own links, in the requested direction.
 */

type RecheckRefusal = Extract<RecheckResult, { ok: false }>["reason"];

function direction(value: string): Direction | null {
  return value === "received" || value === "given" ? value : null;
}

export async function getLinkDetail(
  websiteId: string,
  side: string,
  placementId: string,
): Promise<{ ok: true; data: LinkDetail } | { ok: false; error: string }> {
  const dir = direction(side);
  if (!dir) return { ok: false, error: "Unknown link direction" };
  const context = await requireWebsite(websiteId);
  const detail = await linkDetail(dir, { websiteId: context.site.id, orgId: context.ownerOrgId }, placementId);
  if (!detail) return { ok: false, error: "Link not found" };
  // The credit ledger belongs to the owning workspace: a guest invited to one
  // website sees the link, not the workspace's money.
  return { ok: true, data: context.access === "owner" ? detail : { ...detail, credits_history: [] } };
}

export async function recheckLink(
  websiteId: string,
  side: string,
  placementId: string,
): Promise<{ ok: true; data: { revived: boolean } } | { ok: false; error: string; reason?: RecheckRefusal }> {
  const dir = direction(side);
  if (!dir) return { ok: false, error: "Unknown link direction" };
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const result = await requestRecheck(dir, guard.context.site.id, placementId);
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      not_found: "Link not found",
      not_checkable: "This link cannot be checked in its current state",
      queued: "A check is already queued",
      cooldown: "This link was checked recently - try again later",
      superseded: "This link was replaced by another placement and cannot be recovered",
    };
    return { ok: false, error: messages[result.reason], reason: result.reason };
  }
  revalidatePath(`/websites/${guard.context.site.id}/backlinks`, "layout");
  return { ok: true, data: { revived: result.revived } };
}

export async function recoverCredits(websiteId: string): Promise<{ ok: true; data: { requested: number; skipped: number } } | { ok: false; error: string }> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const result = await requestRecoveryChecks(guard.context.site.id);
  revalidatePath(`/websites/${guard.context.site.id}/backlinks`, "layout");
  return { ok: true, data: result };
}
