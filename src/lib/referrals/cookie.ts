import { cookies } from "next/headers";

/**
 * Carrying a referral code from the link to the signup.
 *
 * A cookie rather than a form field, because the code has to survive a round
 * trip to Google and back: someone who arrives on /?ref=ABC123 and then signs
 * up with Google leaves our site entirely, and any state held in the page is
 * gone by the time they return.
 *
 * Deliberately not httpOnly-strict about much else — this is an attribution
 * hint, not a credential. The worst case for a forged value is that someone
 * credits a referral to a workspace that did not earn it, which is why the
 * reward is only ever granted on a real payment.
 */

const COOKIE_NAME = "ref";

/** Thirty days. Long enough to think it over, short enough to stay relevant. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Codes are fixed-length and alphanumeric; anything else is not ours. */
const CODE_RE = /^[A-Z0-9]{4,16}$/;

/** Normalises and validates a code from a URL. Returns null when unusable. */
export function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase();
  return CODE_RE.test(cleaned) ? cleaned : null;
}

/**
 * Stores a referral code for later.
 *
 * Never overwrites an existing one: first touch wins. If someone arrives via
 * one person's link and later clicks another's, the first referrer is the one
 * who actually introduced them.
 */
export async function rememberReferralCode(code: string): Promise<void> {
  const jar = await cookies();
  if (jar.get(COOKIE_NAME)) return;

  jar.set(COOKIE_NAME, code, {
    maxAge: MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** The stored code, if any and if still well-formed. */
export async function readReferralCode(): Promise<string | null> {
  const jar = await cookies();
  return normalizeCode(jar.get(COOKIE_NAME)?.value);
}

/** Clears the code once it has been attached to an account. */
export async function clearReferralCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
