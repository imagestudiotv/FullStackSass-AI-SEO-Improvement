"use server";

import { revalidatePath } from "next/cache";

import {
  createIntegrationKey,
  listIntegrationKeys,
  provisionFirstKey,
  replaceUnusedKey,
  revokeIntegrationKey,
  type IntegrationKeyView,
} from "@/lib/plugin/keys";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
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
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

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

  revalidatePath(`/websites/${site.id}/integrations`);
  return { ok: true, data: { key } };
}

export async function revokeKey(
  websiteId: string,
  keyId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  await revokeIntegrationKey(site.id, keyId);

  revalidatePath(`/websites/${site.id}/integrations`);
  return { ok: true, data: null };
}

export type SetupResult =
  | { state: "created"; key: string; keyPrefix: string }
  | { state: "exists"; keyPrefix: string; connected: boolean }
  | { state: "revoked" };

/**
 * Entering WordPress setup: a ready key for a website that has never had one.
 *
 * Called by the setup screen AFTER it has mounted, as a server action - a
 * POST, so nothing is created by rendering, a GET, or a link prefetch. The
 * editor check is the same one "New key" has. See provisionFirstKey for why
 * repeated and concurrent calls create exactly one key, and why nothing is
 * created again once the customer has revoked their keys.
 */
export async function startWordPressSetup(websiteId: string): Promise<ActionResult<SetupResult>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const outcome = await provisionFirstKey(site.id);
  if (outcome.kind === "created") {
    revalidatePath(`/websites/${site.id}/integrations`);
    return { ok: true, data: { state: "created", key: outcome.key, keyPrefix: outcome.keyPrefix } };
  }
  if (outcome.kind === "exists") {
    return { ok: true, data: { state: "exists", keyPrefix: outcome.keyPrefix, connected: outcome.connected } };
  }
  return { ok: true, data: { state: "revoked" } };
}

/**
 * "I never saw my key": replaces an UNUSED key with a new one, shown once.
 * Refused for a key WordPress has used - that installation is working, and
 * the customer can add a second key instead of breaking it.
 */
export async function replaceUnusedIntegrationKey(
  websiteId: string,
  keyId: string,
): Promise<ActionResult<{ key: string }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const outcome = await replaceUnusedKey(site.id, keyId);
  if (!outcome.ok) {
    return {
      ok: false,
      error:
        outcome.reason === "connected"
          ? "That key is connected to WordPress, so it was not replaced. Create an additional key instead."
          : "Key not found",
    };
  }
  revalidatePath(`/websites/${site.id}/integrations`);
  return { ok: true, data: { key: outcome.key } };
}
