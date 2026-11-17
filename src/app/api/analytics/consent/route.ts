import type { NextRequest } from "next/server";

import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { ANALYTICS_CONSENT_COOKIE, validConsentKey } from "@/lib/conversions/config";
import { revokeCheckoutConsent } from "@/lib/conversions/paid-acquisitions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Sec-Fetch-Site when the browser sends it. Older Safari (before 16.4) and some in-app webviews do not:
 * then the Origin a fetch POST always carries must name this host. Neither present: refused.
 */
function sameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Revoke only this browser's saved identities; never accepts a GA id or workspace id from a body. */
export async function POST(request: NextRequest) {
  const headers = { "cache-control": "no-store" };
  if (!sameOrigin(request)) return new Response(null, { status: 403, headers });
  if (parseConsent(`${CONSENT_COOKIE}=${request.cookies.get(CONSENT_COOKIE)?.value ?? ""}`) !== "denied") {
    return new Response(null, { status: 204, headers });
  }
  const key = request.cookies.get(ANALYTICS_CONSENT_COOKIE)?.value;
  if (!validConsentKey(key)) return new Response(null, { status: 204, headers });
  try {
    await revokeCheckoutConsent(db, key);
    // Keep the key: an acknowledgement-lost retry can still revoke the same records.
    return new Response(null, { status: 204, headers });
  } catch {
    console.error("[analytics] consent withdrawal could not be saved");
    return new Response(null, { status: 503, headers });
  }
}
