/**
 * The cash partner program's tracking cookie.
 *
 * SEPARATE from the legacy credit-referral cookie ("ref", lib/referrals):
 * opening a partner link never touches it, and a referral link never
 * touches this one.
 *
 * The value is an opaque random token (256 bits, base64url). It means
 * nothing on its own and only finds the click it was issued for, whose row
 * stores the token's SHA-256 - so it cannot be edited to point at another
 * partner. httpOnly, first-party, SameSite=Lax (sent on the top-level
 * navigation back from Google sign-in). Like "ref", it is attribution, not
 * analytics or advertising: it is set without the Google consent banner,
 * whose choices govern Google's tags only (docs/partner-program.md).
 */

import { safeNext } from "@/lib/auth/next";
import { PREFIXED_LOCALES } from "@/lib/i18n/config";

export const PARTNER_COOKIE = "repget_partner";

/** The attribution window, in seconds (90 days, program policy v1). */
export const PARTNER_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function parseTrackingToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return TOKEN_RE.test(trimmed) ? trimmed : null;
}

export function partnerCookieOptions(expiresAt: Date, now: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/**
 * Where /go/<code> may send a visitor: a path on this site from an
 * allowlist of public pages, in any language (/es/pricing), never anywhere
 * else. Anything else lands on the home page of that language.
 */
const LANDING_PATHS = [
  "/",
  "/pricing",
  "/features",
  "/partners",
  "/blog",
  "/tools",
  "/audit",
  "/sign-up",
  "/about",
  "/backlinks",
  "/backlink-exchange",
  "/rank-on-chatgpt",
  "/success-stories",
  "/publishers",
  "/faq",
  "/docs",
  "/contact",
];
const LOCALE_PREFIX = new RegExp(`^/(?:${PREFIXED_LOCALES.join("|")})(?=/|$)`);

export function landingPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  const path = raw.split(/[?#]/)[0];
  const prefix = LOCALE_PREFIX.exec(path)?.[0] ?? "";
  const rest = path.slice(prefix.length) || "/";
  const allowed = LANDING_PATHS.some((page) => rest === page || (page !== "/" && rest.startsWith(`${page}/`)));
  return allowed ? path : prefix || "/";
}

/** Campaign tags a partner put on their link, carried to the page (for analytics). */
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"];

export function campaignParams(query: URLSearchParams): [string, string][] {
  return CAMPAIGN_PARAMS.flatMap((key) => {
    const value = query.get(key);
    return value ? [[key, value.slice(0, 200)] as [string, string]] : [];
  });
}

/** Longer than any address or path we produce: a value past this was not made by us. */
const MAX_CARRIED_LENGTH = 2000;
const EMAIL_SHAPE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * What the page itself would have read, had ?ref= not sent the visitor through
 * /go/<code>: sign-up's destination and pre-filled address (app/(auth)/sign-up/
 * page.tsx), and the website the free audit is asked to check (audit-page.tsx).
 * Only for those pages, so an address never reaches any other page's URL.
 *
 * `landing` is landingPath's answer, a path on this site, so none of this can
 * leave it. `next` must pass safeNext unchanged: a rejected value is dropped,
 * as authSwitchHref drops it, rather than repeated. The audit re-validates the
 * domain itself, with its limits, exactly as for a direct visit.
 */
export function landingParams(landing: string, query: URLSearchParams): [string, string][] {
  const rest = landing.replace(LOCALE_PREFIX, "") || "/";
  const value = (key: string) => {
    const raw = query.get(key)?.trim();
    return raw && raw.length <= MAX_CARRIED_LENGTH ? raw : null;
  };
  const carried: [string, string | null][] = [];
  if (landing === "/sign-up") {
    const next = value("next");
    const email = value("email");
    carried.push(["next", next && safeNext(next) === next ? next : null]);
    carried.push(["email", email && EMAIL_SHAPE.test(email) ? email : null]);
  }
  if (rest === "/audit") carried.push(["domain", value("domain")]);
  return carried.flatMap(([key, kept]) => (kept ? [[key, kept] as [string, string]] : []));
}
