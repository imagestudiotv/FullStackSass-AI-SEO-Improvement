import { cookies } from "next/headers";

/**
 * Carrying a referral code from the link to the signup.
 *
 * A cookie rather than a form field, because the code has to survive a round
 * trip to Google and back: someone who opens /r/ABC123 and then signs up with
 * Google leaves our site entirely, and any state held in the page is gone by
 * the time they return.
 *
 * Deliberately not httpOnly-strict about much else — this is an attribution
 * hint, not a credential. The worst case for a forged value is that someone
 * credits a referral to a workspace that did not earn it, which is why the
 * reward is only ever granted on a real payment, and only for an account
 * created after the link was opened (lib/referrals/core.ts).
 *
 * THE VALUE is "CODE.CLICKED_AT" (unix seconds): when the link was opened is
 * what tells a new customer from an existing one who clicked someone's link.
 * A bare "CODE" is a cookie set before the timestamp existed, still honoured
 * for the rest of its life.
 */

export const REFERRAL_COOKIE = "ref";

/** Thirty days. Long enough to think it over, short enough to stay relevant. */
export const REFERRAL_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Codes are fixed-length and alphanumeric; anything else is not ours. */
const CODE_RE = /^[A-Z0-9]{4,16}$/;

/** Normalises and validates a code from a URL. Returns null when unusable. */
export function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase();
  return CODE_RE.test(cleaned) ? cleaned : null;
}

export type ReferralCookie = {
  code: string;
  /** When the link was opened. Null for a cookie written before it was recorded. */
  clickedAt: Date | null;
};

/** The cookie's value for a code opened at `clickedAt`. */
export function referralCookieValue(code: string, clickedAt: Date): string {
  return `${code}.${Math.floor(clickedAt.getTime() / 1000)}`;
}

/** Reads a cookie value; null when it is not one of ours. */
export function parseReferralCookie(value: string | null | undefined): ReferralCookie | null {
  if (!value) return null;
  const [rawCode, rawAt, ...rest] = value.split(".");
  if (rest.length > 0) return null;
  const code = normalizeCode(rawCode);
  if (!code) return null;
  if (rawAt === undefined) return { code, clickedAt: null };
  if (!/^\d{1,12}$/.test(rawAt)) return null;
  return { code, clickedAt: new Date(Number(rawAt) * 1000) };
}

/** Options for setting the cookie, shared by the /r route and nothing else. */
export const REFERRAL_COOKIE_OPTIONS = {
  maxAge: REFERRAL_MAX_AGE_SECONDS,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** The stored referral, if any and if still well-formed. Read-only: safe in a render. */
export async function readReferralCookie(): Promise<ReferralCookie | null> {
  const jar = await cookies();
  return parseReferralCookie(jar.get(REFERRAL_COOKIE)?.value);
}

/**
 * Clears the cookie. A WRITE: Next allows it only in a Server Action or Route
 * Handler, so this is called from claimReferral (lib/referrals/actions.ts),
 * never from a render. It used to be called from the app layout, where the
 * delete threw, was swallowed, and the cookie lived its full thirty days -
 * attaching to any new account opened in that browser.
 */
export async function clearReferralCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(REFERRAL_COOKIE);
}
