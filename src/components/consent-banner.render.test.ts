import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { siteChrome } from "@/lib/i18n/site-chrome";

/**
 * The cookie banner as the server renders it, and the words it carries.
 *
 * The server cannot know a visitor's answer, so its HTML must never contain
 * the banner: that keeps it out of the first paint (and PageSpeed) for
 * everyone, and away from visitors who already answered. The browser shows
 * it once it has read the cookie - checked in a real browser, not here.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/es/pricing" }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

async function load(id: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", id ?? "");
  return import("./consent-banner");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const copy = Object.fromEntries(LOCALES.map((locale) => [locale, getMessages(locale).consent]));

describe("ConsentBanner on the server", () => {
  it("renders nothing, with or without a Measurement ID", async () => {
    for (const id of ["G-ABC123XYZ", undefined]) {
      const { ConsentBanner } = await load(id);
      expect(renderToStaticMarkup(createElement(ConsentBanner, { copy }))).toBe("");
    }
  });
});

describe("the panel with no Google tag configured", () => {
  it("still renders nothing on the server, so no visitor is shown it unasked", async () => {
    const { ConsentBanner } = await load(undefined);
    expect(renderToStaticMarkup(createElement(ConsentBanner, { copy: { en: getMessages("en").consent } }))).toBe("");
  });

  it.each(LOCALES)("%s: says there is nothing to choose, and how to close it", (locale) => {
    const t = getMessages(locale).consent;
    expect(t.nothingToChoose).toMatch(/Google Analytics/);
    expect(t.nothingToChoose).not.toBe(t.message);
    expect(t.close).toBeTruthy();
  });
});

describe("CookieSettingsButton", () => {
  it("is a real button when GA is configured", async () => {
    const { CookieSettingsButton } = await load("G-ABC123XYZ");
    const html = renderToStaticMarkup(createElement(CookieSettingsButton, { label: "Cookie settings" }));
    expect(html).toMatch(/^<button type="button"[^>]*>Cookie settings<\/button>$/);
  });

  it("is the same button with no Google tag configured: the panel says there is no choice", async () => {
    for (const id of [undefined, "UA-1234-5"]) {
      const { CookieSettingsButton } = await load(id);
      expect(renderToStaticMarkup(createElement(CookieSettingsButton, { label: "Cookie settings" }))).toMatch(/^<button type="button"[^>]*>Cookie settings<\/button>$/);
    }
  });
});

describe("banner words", () => {
  it("reach the public pages in every language, translated", () => {
    const chrome = siteChrome();
    const english = chrome.en.consent;
    for (const locale of LOCALES) {
      const words = chrome[locale].consent;
      expect(Object.keys(words).sort()).toEqual(["accept", "close", "decline", "label", "message", "nothingToChoose", "privacy", "settings"]);
      for (const value of Object.values(words)) expect(value.trim()).not.toBe("");
      if (locale !== "en") {
        expect(words.message).not.toBe(english.message);
        expect(words.accept).not.toBe(english.accept);
      }
      // Says what the cookies are for, by name.
      expect(words.message).toContain("Google Analytics");
    }
  });
});
