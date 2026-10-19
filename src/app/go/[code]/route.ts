import { NextResponse, type NextRequest } from "next/server";

import { recordReferralClick } from "@/lib/partners/application/use-cases/record-referral-click";
import {
  landingPath,
  PARTNER_COOKIE,
  partnerCookieOptions,
  parseTrackingToken,
} from "@/lib/partners/presentation/tracking-cookie";
import { partnerDeps } from "@/lib/partners/server";
import { visitorKey } from "@/lib/visitor-key";

/**
 * Partner links: /go/<code>, optionally ?to=/pricing (an allowlisted page).
 *
 * Separate from the legacy credit-referral links (/r/CODE): this records a
 * click for the cash partner program and sets ITS cookie, and nothing else.
 *
 * Always redirects to the site, whatever happens - an unknown code, a
 * suspended partner, the program switched off, a rate limit or a database
 * error: someone who was sent a link should land on the product, not on an
 * error about a code they did not choose. A failure is logged.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext<"/go/[code]">) {
  const { code } = await context.params;
  const target = new URL(landingPath(request.nextUrl.searchParams.get("to")), request.url);
  const response = NextResponse.redirect(target);
  // A tracking redirect is never cached by a browser or a CDN.
  response.headers.set("Cache-Control", "no-store");

  try {
    const deps = partnerDeps();
    let referrerHost: string | null = null;
    try {
      const referrer = request.headers.get("referer");
      referrerHost = referrer ? new URL(referrer).hostname : null;
    } catch {
      referrerHost = null;
    }
    const outcome = await recordReferralClick(deps, {
      code,
      existingToken: parseTrackingToken(request.cookies.get(PARTNER_COOKIE)?.value),
      landingPath: target.pathname,
      referrerHost,
      visitor: visitorKey(request.headers),
    });
    if (outcome.setCookie) {
      response.cookies.set(
        PARTNER_COOKIE,
        outcome.setCookie.token,
        partnerCookieOptions(outcome.setCookie.expiresAt, deps.clock.now()),
      );
    }
  } catch (error) {
    console.error("[partners] click not recorded", error);
  }
  return response;
}
