import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { ONBOARDING_ERRORS, websiteErrorKey, websiteRefusal, type OnboardingErrorsCopy } from "@/lib/i18n/onboarding-errors";
import { FETCH_TIMEOUT_MS } from "@/lib/websites/crawl";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * The first setup steps' refusals were English after an Italian, German,
 * Spanish or French sign-up (2026-11-18). English must say exactly what the
 * actions said before; every other language says all of it in its own words.
 */

/** Every entry as text: sentences as they are, the ones taking a number called with one. */
function texts(copy: OnboardingErrorsCopy): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [section, entries] of Object.entries(copy)) {
    for (const [key, value] of Object.entries(entries)) {
      out[`${section}.${key}`] = typeof value === "function" ? (value as (n: number) => string)(503) : (value as string);
    }
  }
  return out;
}

/** The message normalizeWebsiteUrl refuses an address with. */
function refusalOf(address: string): string {
  try {
    normalizeWebsiteUrl(address);
  } catch (error) {
    if (error instanceof InvalidUrlError) return error.message;
    throw error;
  }
  throw new Error(`${address} was accepted`);
}

const en = ONBOARDING_ERRORS.en;

describe("the setup steps' refusals", () => {
  it("has every key, non-empty, in all five languages", () => {
    const keys = Object.keys(texts(en)).sort();
    expect(Object.keys(ONBOARDING_ERRORS).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      const own = texts(ONBOARDING_ERRORS[locale]);
      expect(Object.keys(own).sort(), locale).toEqual(keys);
      for (const [key, text] of Object.entries(own)) expect(text.trim(), `${locale}.${key}`).not.toBe("");
    }
  });

  it("words every entry in each other language, keeping the number it is given", () => {
    const english = texts(en);
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const own = ONBOARDING_ERRORS[locale];
      for (const [key, text] of Object.entries(texts(own))) expect(text, `${locale}.${key}`).not.toBe(english[key]);
      expect(own.website.timedOut(15000)).toContain("15000");
      expect(own.website.httpStatus(503)).toContain("503");
    }
  });

  it("keeps the English word for word", () => {
    expect(refusalOf("not a url")).toBe(en.website.invalidUrl);
    expect(refusalOf("localhost")).toBe(en.website.notPublic);
    expect(refusalOf("facebook.com/acme")).toBe(en.website.socialProfile);
    expect(en.website.alreadyInWorkspace).toBe("That website is already in this workspace");
    expect(en.website.alreadyShared).toBe("That website is already shared with you. Find it under Websites, in Shared with you.");
    expect(en.website.invitationWaiting).toBe("You have an invitation waiting for that website. Accept it on your dashboard.");
    expect(en.website.analysisDailyLimit).toBe("You have analysed several websites today. Choose a plan, or try again tomorrow.");
    expect(en.website.analysisBusy).toBe("Too many websites are being analysed right now. Please try again shortly.");
    expect(en.website.timedOut(FETCH_TIMEOUT_MS)).toBe("Timed out after 15000ms");
    expect(en.website.httpStatus(404)).toBe("The site returned 404");
    expect(en.website.unreadable).toBe("Could not read that website");
    expect(en.google).toEqual({
      viewOnly: "You have view-only access to this website.",
      cannotReplace:
        "This Google connection belongs to the website's owner. Only the owner can disconnect it or connect a different account.",
      notConfigured: "Google integration is not configured yet.",
      signIn: "Sign in to connect Google.",
    });
  });

  it("finds a lower layer's English sentence, and never shows words that are not ours", () => {
    expect(websiteErrorKey(refusalOf("localhost"))).toBe("notPublic");
    expect(websiteRefusal(refusalOf("localhost"), "it")).toBe("Quell’indirizzo non è un sito web pubblico");
    expect(websiteRefusal(refusalOf("localhost"), "en")).toBe("That address is not a public website");
    expect(websiteRefusal("declined", "en")).toBe(en.website.unexpected);
    expect(websiteRefusal("getaddrinfo ENOTFOUND x.example", "de", "unreachable")).toBe(ONBOARDING_ERRORS.de.website.unreachable);
    expect(websiteErrorKey("constructor")).toBeUndefined();
  });
});
