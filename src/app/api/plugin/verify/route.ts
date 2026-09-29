import { after, NextResponse, type NextRequest } from "next/server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization, websites } from "@/lib/db/schema";
import { recordSiteInfo, resolveIntegrationKey, revokeLeftoverKeys } from "@/lib/plugin/keys";
import { nudgePluginIfDue, recordSyncUrl } from "@/lib/plugin/sync";

/**
 * Printable, single-line, bounded: this text is shown inside WordPress.
 * Cut by characters, not UTF-16 units, so an emoji is never split in half.
 */
function plain(value: string, max: number): string {
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : clean;
}

/** Plugins before 1.7.0 print only website.name after connecting. */
function isLegacyPlugin(version: unknown): boolean {
  if (typeof version !== "string") return true;
  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(major)) return true;
  return major < 1 || (major === 1 && (!Number.isFinite(minor) || minor < 7));
}

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
  let pluginVersion: unknown = null;
  try {
    const body = (await request.json()) as {
      wpVersion?: unknown;
      pluginVersion?: unknown;
      siteUrl?: unknown;
      syncUrl?: unknown;
    };
    pluginVersion = body.pluginVersion;
    await recordSyncUrl(resolved.keyId, resolved.websiteDomain, body.syncUrl);
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

  /*
    Anything already due - the website's first article above all - goes out
    now that the plugin is connected, not at its next hourly check. After the
    response: the plugin is waiting on this reply to show "Connected", and
    the nudge calls back into that same site.
  */
  after(() => nudgePluginIfDue(resolved.websiteId).catch(() => undefined));
  /*
    Connected: older keys of this website that never connected and that
    nobody named are leftovers - a key made when the setup screen opened and
    never seen again, an earlier "Connect WordPress" press. See
    revokeLeftoverKeys.
  */
  after(() => revokeLeftoverKeys(resolved.websiteId, resolved.keyId).catch(() => 0));

  const [site] = await db
    .select({ domain: websites.domain, brandName: websites.brandName, workspace: organization.name })
    .from(websites)
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .where(eq(websites.id, resolved.websiteId))
    .limit(1);

  const domain = site?.domain ?? null;
  // Each part bounded on its own, so the account name - the point of it - is never the part cut off.
  const brand = plain(site?.brandName ?? site?.domain ?? "", 60) || null;
  const workspace = site?.workspace ? plain(site.workspace, 60) : null;

  return NextResponse.json(
    {
      ok: true,
      /*
        Echoed back so the plugin can show WHICH site - and which RepGet
        account - it connected to. On 2026-09-29 a WordPress site said
        "Connected" while holding a key from a second RepGet account for the
        same domain, and nothing on either screen said so.

        Plugins before 1.7.0 print only website.name ("Connected to %s."), so
        for them the name carries the account too.
      */
      website: {
        id: resolved.websiteId,
        domain,
        name:
          isLegacyPlugin(pluginVersion) && brand
            ? `${brand}${domain && brand !== domain ? ` (${plain(domain, 60)})` : ""}${workspace ? `, RepGet account \u201c${workspace}\u201d` : ""}`
            : brand,
      },
      workspace: workspace ? { name: workspace } : null,
    },
    { headers: CORS },
  );
}
