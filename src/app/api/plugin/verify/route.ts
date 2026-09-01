import { NextResponse, type NextRequest } from "next/server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { recordSiteInfo, resolveIntegrationKey } from "@/lib/plugin/keys";

/**
 * Plugin handshake: POST /api/plugin/verify
 *
 * The plugin calls this the moment a key is pasted in, so the customer finds
 * out immediately whether it works. A key that only fails later — when an
 * article silently does not appear — is the failure this exists to prevent.
 *
 * Authenticated by the key alone. There is no session: the caller is a
 * WordPress site, not a browser.
 */

// Reads a per-request credential; must never be cached or prerendered.
export const dynamic = "force-dynamic";

/**
 * Permissive CORS.
 *
 * The caller is a WordPress server, which is not subject to CORS at all — but
 * some hosts proxy these calls through the browser, and a blanket rejection
 * would break those installs for no security gain. The key is what
 * authenticates, not the origin.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-integration-key",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-integration-key");
  const resolved = await resolveIntegrationKey(key);

  if (!resolved) {
    /**
     * One message for unknown, revoked and malformed alike. Distinguishing
     * them would confirm to someone holding a guessed key that it is real.
     */
    return NextResponse.json(
      { ok: false, error: "That integration key is not valid." },
      { status: 401, headers: CORS },
    );
  }

  // Recorded for support: "which WordPress version is this customer on?" is
  // otherwise unanswerable without asking them.
  let siteInfo: string | null = null;
  try {
    const body = (await request.json()) as {
      wpVersion?: unknown;
      pluginVersion?: unknown;
      siteUrl?: unknown;
    };
    const parts = [
      typeof body.siteUrl === "string" ? body.siteUrl : null,
      typeof body.wpVersion === "string" ? `WP ${body.wpVersion}` : null,
      typeof body.pluginVersion === "string" ? `plugin ${body.pluginVersion}` : null,
    ].filter(Boolean);
    if (parts.length > 0) siteInfo = parts.join(" · ");
  } catch {
    // A body is optional; the key is what matters.
  }

  if (siteInfo) {
    await recordSiteInfo(resolved.keyId, siteInfo);
  }

  const [site] = await db
    .select({ domain: websites.domain, brandName: websites.brandName })
    .from(websites)
    .where(eq(websites.id, resolved.websiteId))
    .limit(1);

  return NextResponse.json(
    {
      ok: true,
      // Echoed back so the plugin can show WHICH site it connected to. A key
      // pasted into the wrong WordPress install is otherwise invisible.
      website: {
        domain: site?.domain ?? null,
        name: site?.brandName ?? site?.domain ?? null,
      },
    },
    { headers: CORS },
  );
}
