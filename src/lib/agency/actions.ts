"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { agencyWorkspaces } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Granting and revoking agency status.
 *
 * ADMIN ONLY. This is the one action in the product that grants paid features
 * without a payment, so requireAdmin() is the whole security model here — a
 * customer-reachable version of this would be a free subscription for anyone
 * who found it.
 */

/** Defaults for a new agency workspace. Generous, but not unlimited. */
const DEFAULTS = {
  siteLimit: 50,
  articleLimit: 500,
  keywordLimit: 5000,
} as const;

export async function grantAgencyStatus(
  organizationId: string,
  note?: string,
): Promise<ActionResult<null>> {
  await requireAdmin();

  await db
    .insert(agencyWorkspaces)
    .values({
      organizationId,
      ...DEFAULTS,
      note: note?.trim() || null,
    })
    // Re-granting an existing agency is a no-op rather than an error: the
    // button is idempotent, and a double click should not fail.
    .onConflictDoNothing({ target: agencyWorkspaces.organizationId });

  revalidatePath("/admin/organizations");
  return { ok: true, data: null };
}

export async function revokeAgencyStatus(
  organizationId: string,
): Promise<ActionResult<null>> {
  await requireAdmin();

  /**
   * Deleted rather than flagged. Unlike a referral, there is no history worth
   * keeping here — and a workspace that stops being an agency should fall back
   * to its subscription immediately, which a soft delete would complicate.
   */
  await db
    .delete(agencyWorkspaces)
    .where(eq(agencyWorkspaces.organizationId, organizationId));

  revalidatePath("/admin/organizations");
  return { ok: true, data: null };
}
