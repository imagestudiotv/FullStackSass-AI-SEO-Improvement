import { NextResponse, type NextRequest } from "next/server";

import { resolveReferralCode } from "@/lib/referrals/core";
import {
  normalizeCode,
  parseReferralCookie,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_OPTIONS,
  referralCookieValue,
} from "@/lib/referrals/cookie";

/**
 * Referral links: /r/ABC123
 *
 * A dedicated route rather than a ?ref= parameter read by every page. A layout
 * cannot read searchParams in Next, so the alternative would be adding the
 * same capture to every marketing page and hoping none is missed. This is one
 * place, and it gives a short link that survives being read aloud.
 *
 * Always redirects to the homepage, even for a malformed or unknown code.
 * Someone who was sent a link should land on the product, not an error about a
 * code they did not choose and cannot fix.
 *
 * The cookie records WHEN the link was opened (lib/referrals/cookie.ts), so
 * only an account created after it can be credited to the referrer.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/r/[code]">,
) {
  const { code } = await context.params;
  const cleaned = normalizeCode(code);

  const response = NextResponse.redirect(new URL("/", request.url));

  /*
    Set only when absent: first touch wins. Someone who arrives through one
    person's link and later clicks another's was introduced by the first.

    And only for a code that exists. A mistyped one used to be stored too,
    and - first touch winning - silently blocked the correct link opened
    afterwards for thirty days.
  */
  if (!cleaned || !(await resolveReferralCode(cleaned))) return response;
  // A cookie stored before codes were checked may hold one that does not exist; it does not count as a first touch.
  const existing = parseReferralCookie(request.cookies.get(REFERRAL_COOKIE)?.value);
  if (existing && (await resolveReferralCode(existing.code))) return response;

  response.cookies.set(REFERRAL_COOKIE, referralCookieValue(cleaned, new Date()), REFERRAL_COOKIE_OPTIONS);
  return response;
}
