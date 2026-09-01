import { NextResponse, type NextRequest } from "next/server";

import { normalizeCode } from "@/lib/referrals/cookie";

/**
 * Referral links: /r/ABC123
 *
 * A dedicated route rather than a ?ref= parameter read by every page. A layout
 * cannot read searchParams in Next, so the alternative would be adding the
 * same capture to every marketing page and hoping none is missed. This is one
 * place, and it gives a short link that survives being read aloud.
 *
 * Always redirects to the homepage, even for a malformed code. Someone who was
 * sent a link should land on the product, not an error about a code they did
 * not choose and cannot fix.
 */

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function GET(
  request: NextRequest,
  context: RouteContext<"/r/[code]">,
) {
  const { code } = await context.params;
  const cleaned = normalizeCode(code);

  const response = NextResponse.redirect(new URL("/", request.url));

  if (cleaned) {
    /**
     * Set only when absent: first touch wins. Someone who arrives through one
     * person's link and later clicks another's was introduced by the first.
     */
    if (!request.cookies.get("ref")) {
      response.cookies.set("ref", cleaned, {
        maxAge: MAX_AGE_SECONDS,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  }

  return response;
}
