"use server";

import { revalidatePath } from "next/cache";

import {
  createIntegrationKey,
  listIntegrationKeys,
  revokeIntegrationKey,
  type IntegrationKeyView,
} from "@/lib/plugin/keys";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Integration Key management.
 *
 * Every entry point goes through requireWebsite(), so a key can only ever be
 * created for, listed from, or revoked on a website the caller's organisation
 * owns. A key is publish access to a live site, which makes a missing check
 * here a real compromise rather than a leak of read-only data.
 */

export async function getIntegrationKeys(
  websiteId: string,
): Promise<IntegrationKeyView[]> {
  const { site } = await requireWebsite(websiteId);
  return listIntegrationKeys(site.id);
}

/**
 * Creates a key and returns it ONCE.
 *
 * The plaintext is never stored, so this response is the only time it exists
 * outside the customer's clipboard. The UI has to make that clear, because a
 * customer who closes the dialog assuming they can look it up later has to
 * create a second key and clean up the first.
 */
export async function generateIntegrationKey(
  websiteId: string,
  label?: string,
): Promise<ActionResult<{ key: string }>> {
  const { site } = await requireWebsite(websiteId);

  const existing = await listIntegrationKeys(site.id);
  /**
   * A small cap. Keys are per-install, and a workspace needing more than a
   * handful is far more likely to be looping by accident than running five
   * WordPress sites off one website record.
   */
  if (existing.length >= 5) {
    return {
      ok: false,
      error: "You already have five keys. Revoke one before creating another.",
    };
  }

  const { key } = await createIntegrationKey(site.id, label);

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: { key } };
}

export async function revokeKey(
  websiteId: string,
  keyId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  await revokeIntegrationKey(site.id, keyId);

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}
