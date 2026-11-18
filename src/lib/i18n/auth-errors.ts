import type { Messages } from "@/lib/i18n/messages";

/**
 * What sign-in and sign-up say when Better Auth refuses, in the form's language.
 *
 * The words live in the auth section of messages.ts (oauthErrors,
 * serverErrors, ...), which the page hands AuthForm as `t`. This file holds only
 * the rule, so the client component imports no dictionary: a type import costs
 * nothing in the browser.
 */
type AuthCopy = Messages["app"]["auth"];

/** The shape of a Better Auth client error: { code, message, status }. */
export type AuthRequestError = { status?: number; code?: string; message?: string };

/**
 * Better Auth's error codes these forms can meet (better-auth 1.7.14): its base
 * codes from sign-in/email and sign-up/email, and the email-otp plugin's own.
 * Every language other than English words each of them (auth-errors.test.ts).
 */
export const AUTH_SERVER_ERROR_CODES = [
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "INVALID_PASSWORD",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "USER_NOT_FOUND",
  "EMAIL_NOT_VERIFIED",
  "FAILED_TO_CREATE_USER",
  "FAILED_TO_CREATE_SESSION",
  "INVALID_OTP",
  "OTP_EXPIRED",
  "TOO_MANY_ATTEMPTS",
] as const;

/** Own keys only: a code such as "constructor" must not reach Object.prototype. */
function lookup(table: Record<string, string>, key: string | undefined): string | undefined {
  return key && Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * The sentence for a refused request.
 *
 * A 429 (lib/auth/rate-limit.ts) is the rate limit, said the same way in every
 * language. English then keeps Better Auth's own message, as it always has
 * (serverErrors is null there). Other languages show the code in their words,
 * and for a code they do not list, the step's own fallback - never Better
 * Auth's English.
 */
export function authFailureMessage(error: AuthRequestError, t: AuthCopy, fallback: string): string {
  if (error.status === 429) return t.tooManyAttempts;
  if (!t.serverErrors) return error.message ?? fallback;
  return lookup(t.serverErrors, error.code) ?? fallback;
}

/** The sentence for ?error=<code> after the Google round trip. */
export function oauthErrorMessage(code: string, t: AuthCopy): string {
  return lookup(t.oauthErrors, code) ?? t.oauthFailed;
}
