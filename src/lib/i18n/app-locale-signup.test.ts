import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The signed-in app's language for somebody who never chose one in Settings:
 * the language they signed up in, then their browser's. Before 2026-11-18 the
 * second was the only one, so a visitor from /it/seo-content-automation with
 * an English browser read Italian up to sign-up and English from the first
 * onboarding step on.
 */

const { row, acceptLanguage } = vi.hoisted(() => ({
  row: { value: undefined as { locale: string | null; signupLocale: string | null } | undefined },
  acceptLanguage: { value: null as string | null },
}));
vi.mock("@/lib/db", () => {
  const chain = { from: () => chain, leftJoin: () => chain, where: () => chain, limit: async () => (row.value ? [row.value] : []) };
  return { db: { select: () => chain } };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers(acceptLanguage.value ? { "accept-language": acceptLanguage.value } : {}),
  cookies: async () => ({ get: () => undefined }),
}));

import { resolveAppLocale, signupLocaleFromHeaders } from "@/lib/i18n/app-locale";

beforeEach(() => {
  row.value = undefined;
  acceptLanguage.value = null;
});

describe("the language sign-up records (signupLocaleFromHeaders)", () => {
  it("the site page last read, over the browser", () => {
    expect(signupLocaleFromHeaders(new Headers({ cookie: "a=1; repget_site_language=it; b=2", "accept-language": "en-US,en;q=0.9" }))).toBe("it");
  });

  it("an English site page keeps an Italian browser in English", () => {
    expect(signupLocaleFromHeaders(new Headers({ cookie: "repget_site_language=en", "accept-language": "it-IT" }))).toBe("en");
  });

  it("no site page read: the browser's", () => {
    expect(signupLocaleFromHeaders(new Headers({ "accept-language": "de-DE,de;q=0.9" }))).toBe("de");
  });

  it("a cookie holding anything else is ignored, and nothing at all is null", () => {
    expect(signupLocaleFromHeaders(new Headers({ cookie: "repget_site_language=xx", "accept-language": "fr" }))).toBe("fr");
    expect(signupLocaleFromHeaders(new Headers())).toBeNull();
    expect(signupLocaleFromHeaders(new Headers({ "accept-language": "ja" }))).toBeNull();
  });
});

describe("the signed-in app's language (resolveAppLocale)", () => {
  it("the Italian sign-up carries on in Italian with an English browser (the bug, fixed)", async () => {
    row.value = { locale: null, signupLocale: "it" };
    acceptLanguage.value = "en-US,en;q=0.9";
    expect(await resolveAppLocale("user-1")).toBe("it");
  });

  it("a choice made in Settings still wins", async () => {
    row.value = { locale: "de", signupLocale: "it" };
    acceptLanguage.value = "fr";
    expect(await resolveAppLocale("user-1")).toBe("de");
  });

  it("nothing recorded at sign-up (accounts from before): the browser's, as before", async () => {
    row.value = { locale: null, signupLocale: null };
    acceptLanguage.value = "es-ES";
    expect(await resolveAppLocale("user-1")).toBe("es");
  });

  it("values we no longer ship degrade to the next signal, then English", async () => {
    row.value = { locale: "pt", signupLocale: "xx" };
    expect(await resolveAppLocale("user-1")).toBe("en");
    row.value = undefined;
    acceptLanguage.value = "fr";
    expect(await resolveAppLocale("missing")).toBe("fr");
  });
});
