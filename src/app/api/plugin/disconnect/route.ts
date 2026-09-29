import { NextResponse, type NextRequest } from "next/server";

import { lookupIntegrationKey, revokeForDisconnect } from "@/lib/plugin/keys";

/**
 * POST /api/plugin/disconnect
 *
 * Plugin 1.7.0's "Disconnect": the key it holds is revoked, so the RepGet
 * card stops saying "Connected" for a site that let go of it. Authenticated
 * by that key alone, like every plugin call.
 *
 * ONLY ON THE WORD OF THE INSTALL THE KEY BELONGS TO. A host's one-click
 * staging copies the live site's options, key included, and shows the same
 * Disconnect button; revoking there would stop the LIVE site publishing. So
 * the key is revoked only when the caller is the key's own install and no
 * other address is using it (revokeForDisconnect, lib/plugin/keys.ts).
 * Anyone else is answered "ok" with revoked: false - that copy forgets the
 * key, and the live site keeps it.
 *
 * No CORS headers: only servers call this, never a browser.
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: NextRequest) {
  // Not recorded as use: the key is being given up, not used.
  const resolved = await lookupIntegrationKey(request.headers.get("x-integration-key"));
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "That integration key is not valid." }, { status: 401, headers: NO_STORE });
  }

  let reported: unknown = null;
  try {
    const body = (await request.json()) as { syncUrl?: unknown } | null;
    reported = body?.syncUrl ?? null;
  } catch {
    // No body: nobody we can recognise, so nothing is revoked.
  }
  const revoked = await revokeForDisconnect(resolved.websiteId, resolved.keyId, reported);
  return NextResponse.json({ ok: true, revoked }, { headers: NO_STORE });
}
