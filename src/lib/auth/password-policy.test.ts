import { describe, expect, it } from "vitest";

import { getMessages } from "@/lib/i18n/messages";
import { LOCALES } from "@/lib/i18n/config";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password-policy";

/**
 * One password rule, said the same way everywhere (client's launch review,
 * 2026-10-03). If the numbers in password-policy.ts change, every sentence
 * that states them must change too - in every language.
 */
describe("password policy", () => {
  it("is Better Auth's long-standing rule: 8 to 128 characters", () => {
    expect([MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]).toEqual([8, 128]);
  });

  it.each(LOCALES)("%s: every sentence that states a length states the policy's", (locale) => {
    const t = getMessages(locale).app;
    for (const sentence of [t.auth.passwordHint, t.settings.passwordTooShort, t.settings.passwordHelp, t.settings.setPasswordHelp]) {
      expect(sentence).toContain(String(MIN_PASSWORD_LENGTH));
    }
    expect(t.settings.passwordTooLong).toContain(String(MAX_PASSWORD_LENGTH));
    expect(t.auth.passwordTooLong).toContain(String(MAX_PASSWORD_LENGTH));
  });

  /** It used to promise "a number and a letter", which nothing ever enforced. */
  it.each(LOCALES)("%s: the sign-up hint promises nothing beyond the length", (locale) => {
    expect(getMessages(locale).app.auth.passwordHint).not.toMatch(/,/);
  });
});
