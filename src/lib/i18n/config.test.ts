import { describe, expect, it } from "vitest";

import { languageAlternates, LOCALES, localePath } from "@/lib/i18n/config";

/**
 * hreflang only counts when it is reciprocal: every version of a page must
 * list every other. The English pages used to list nothing, so Google ignored
 * the translated pages' links back to them (client's launch review,
 * 2026-10-03). Both sides now come from languageAlternates.
 */

describe("languageAlternates", () => {
  it("lists the page in every locale plus x-default", () => {
    expect(languageAlternates("/about")).toEqual({
      en: "/about",
      es: "/es/about",
      fr: "/fr/about",
      it: "/it/about",
      de: "/de/about",
      "x-default": "/about",
    });
  });

  it("handles the homepage without a trailing slash on the prefixed versions", () => {
    expect(languageAlternates("/")).toEqual({
      en: "/",
      es: "/es",
      fr: "/fr",
      it: "/it",
      de: "/de",
      "x-default": "/",
    });
  });

  it("points x-default at the unprefixed English page", () => {
    expect(languageAlternates("/pricing")["x-default"]).toBe(localePath("en", "/pricing"));
  });

  it("covers every locale the site serves, so a new language cannot be left out", () => {
    const keys = Object.keys(languageAlternates("/faq"));
    expect(keys).toEqual([...LOCALES, "x-default"]);
  });
});
