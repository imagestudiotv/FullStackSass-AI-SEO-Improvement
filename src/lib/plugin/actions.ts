"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import {
  createManualKey,
  listIntegrationKeys,
  MAX_LIVE_KEYS,
  mintConnectKey,
  provisionFirstKey,
  replaceUnusedKey,
  revokedKeyEndpoint,
  revokeIntegrationKey,
  type IntegrationKeyView,
} from "@/lib/plugin/keys";
import { getSession } from "@/lib/auth-guard";
import { createConnectLink } from "@/lib/plugin/handshake";
import { signalRevokedKey } from "@/lib/plugin/sync";
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

  // A person's key for another install: never tidied up (see keyLabel), and
  // under the same lock and five-key cap as "Connect WordPress".
  const created = await createManualKey(site.id, label ?? "");
  if (!created.ok) {
    return {
      ok: false,
      error: `You already have ${MAX_LIVE_KEYS} keys. Revoke one you no longer use, then try again.`,
    };
  }
  const { key } = created;

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

  const revokedNow = await revokeIntegrationKey(site.id, keyId);

  /*
    A WordPress site still holding this key would say "Connected" until its
    next hourly check. Tell it now, after the response - see signalRevokedKey.
    Only the first time: revoking an already-revoked key sends nothing.
  */
  if (revokedNow) {
    after(async () => {
      const endpoint = await revokedKeyEndpoint(site.id, keyId).catch(() => null);
      if (endpoint) await signalRevokedKey(endpoint).catch(() => undefined);
    });
  }

  revalidatePath(`/websites/${site.id}/integrations`);
  return { ok: true, data: null };
}

/**
 * "Connect WordPress": a key made at the moment of the click, returned for
 * the customer's WordPress tab (see mintConnectKey). The screen puts it in
 * the address FRAGMENT of their WordPress settings page, which plugin 1.6.0
 * reads into its key field; the customer presses Save and connect there.
 * Editors only - the same check as "New key".
 *
 * Also returns a LINK for plugin 1.7.0, which finishes with one button and a
 * handshake instead of the key (lib/plugin/handshake.ts): approved without
 * asking when this same session comes back with it. Null if it could not be
 * made - the key still works.
 */
export async function connectWordPress(
  websiteId: string,
): Promise<ActionResult<{ key: string; keyPrefix: string; link: string | null }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const outcome = await mintConnectKey(site.id);
  if (!outcome.ok) {
    return {
      ok: false,
      error:
        outcome.reason === "too_many_pending"
          ? "Several WordPress tabs are already waiting to connect. Finish in one of them (Save and connect), or try again in 30 minutes."
          : `You already have ${MAX_LIVE_KEYS} keys. Revoke one you no longer use under Keys (advanced), then try again.`,
    };
  }
  const session = await getSession();
  const link = session
    ? await createConnectLink(site.id, session.user.id, session.session.id, outcome.id).catch(() => null)
    : null;
  revalidatePath(`/websites/${site.id}/integrations`);
  return { ok: true, data: { key: outcome.key, keyPrefix: outcome.keyPrefix, link } };
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
