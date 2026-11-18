import { BASE_ERROR_CODES } from "better-auth";
import { emailOTP } from "better-auth/plugins/email-otp";
import { describe, expect, it } from "vitest";

import { AUTH_SERVER_ERROR_CODES, authFailureMessage, oauthErrorMessage } from "@/lib/i18n/auth-errors";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Sign-in and sign-up were in the visitor's language except when something
 * went wrong: the OAuth errors, the Google and form fallbacks and Better
 * Auth's own messages stayed English (2026-11-18). English must read exactly
 * as before; every other language words the error, never Better Auth's English.
 */
const en = getMessages("en").app.auth;
const OTHERS = ["es", "fr", "it", "de"] as const;
const OAUTH_CODES = [
  "account_not_linked",
  "email_does_not_match",
  "account_already_linked_to_different_user",
  "unable_to_link_account",
] as const;

describe("English keeps today's words", () => {
  it("shows Better Auth's own message, or the step's fallback, as before", () => {
    expect(authFailureMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, en, en.somethingWentWrong)).toBe("Invalid email or password");
    expect(authFailureMessage({ status: 400, code: "INVALID_OTP", message: "Invalid OTP" }, en, en.codeInvalid)).toBe("Invalid OTP");
    expect(authFailureMessage({ status: 500 }, en, en.googleFailed)).toBe("Google sign-in failed");
    expect(authFailureMessage({ status: 429, message: "Too many requests" }, en, "x")).toBe(en.tooManyAttempts);
  });

  it("has the same sentences word for word", () => {
    expect(en.oauthErrors).toEqual({
      account_not_linked: "That email already has a password account. Sign in with your password, or contact support to link Google.",
      email_does_not_match: "That Google account uses a different email than the one on file.",
      account_already_linked_to_different_user: "That Google account is already connected to another account.",
      unable_to_link_account: "Google sign-in could not be linked to your account.",
    });
    expect(en.oauthFailed).toBe("Sign-in did not complete. Try again.");
    expect(en.googleFailed).toBe("Google sign-in failed");
    expect(en.somethingWentWrong).toBe("Something went wrong");
    expect([en.signInPageTitle, en.signUpPageTitle]).toEqual(["Sign in", "Sign up"]);
    expect(en.serverErrors).toBeNull();
  });

  it("names an OAuth code, and falls back for an unknown one", () => {
    expect(oauthErrorMessage("account_not_linked", en)).toBe(en.oauthErrors.account_not_linked);
    expect(oauthErrorMessage("something_new", en)).toBe("Sign-in did not complete. Try again.");
    expect(oauthErrorMessage("constructor", en)).toBe("Sign-in did not complete. Try again.");
  });
});

describe.each(OTHERS)("%s", (locale) => {
  const t = getMessages(locale).app.auth;

  it("words every Better Auth code these forms meet, and nothing else", () => {
    expect(Object.keys(t.serverErrors ?? {}).sort()).toEqual([...AUTH_SERVER_ERROR_CODES].sort());
    for (const code of AUTH_SERVER_ERROR_CODES) {
      const said = authFailureMessage({ status: 400, code, message: "English from Better Auth" }, t, "fallback");
      expect(said).toBe(t.serverErrors![code]);
      expect(said.length).toBeGreaterThan(0);
    }
  });

  it("never shows Better Auth's English: an unknown code says the step's fallback", () => {
    expect(authFailureMessage({ status: 400, code: "SOMETHING_NEW", message: "Some English" }, t, t.codeNotSent)).toBe(t.codeNotSent);
    expect(authFailureMessage({ status: 400, message: "Some English" }, t, t.somethingWentWrong)).toBe(t.somethingWentWrong);
    expect(authFailureMessage({ status: 400, code: "constructor", message: "Some English" }, t, t.googleFailed)).toBe(t.googleFailed);
    expect(authFailureMessage({ status: 429, code: "INVALID_OTP" }, t, "x")).toBe(t.tooManyAttempts);
  });

  it("words the OAuth codes and their fallback", () => {
    for (const code of OAUTH_CODES) expect(oauthErrorMessage(code, t)).toBe(t.oauthErrors[code]);
    expect(oauthErrorMessage("something_new", t)).toBe(t.oauthFailed);
  });

  it("has nothing left in English", () => {
    const pairs: [string, string][] = [
      [t.oauthFailed, en.oauthFailed],
      [t.googleFailed, en.googleFailed],
      [t.somethingWentWrong, en.somethingWentWrong],
      [t.signInPageTitle, en.signInPageTitle],
      [t.signUpPageTitle, en.signUpPageTitle],
      ...OAUTH_CODES.map((code): [string, string] => [t.oauthErrors[code], en.oauthErrors[code]]),
    ];
    for (const [translated, english] of pairs) expect(translated).not.toBe(english);
    const englishMessages = Object.values(BASE_ERROR_CODES).map((entry) => (entry as { message: string }).message);
    for (const said of Object.values(t.serverErrors ?? {})) expect(englishMessages).not.toContain(said);
  });
});

it("the codes are Better Auth's own (a rename on upgrade fails here)", () => {
  const otp = emailOTP({ sendVerificationOTP: async () => {} }).$ERROR_CODES;
  const known = new Set([...Object.keys(BASE_ERROR_CODES), ...Object.keys(otp)]);
  for (const code of AUTH_SERVER_ERROR_CODES) expect(known.has(code)).toBe(true);
});
