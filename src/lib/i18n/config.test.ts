import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { languageAlternates, LOCALES, localePath, splitLocale, TRANSLATED_PATHS } from "@/lib/i18n/config";

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

/**
 * A translated page links only to addresses that exist. Its "free check"
 * button, tools and docs links used to point at /es/audit, /es/tools and
 * /es/docs/... - pages that exist only in English, so every one was a 404.
 */
/*
  The deployed home page, when regenerated, renders with usePathname() =
  "/index" while the browser says "/". splitLocale must give both the same
  answer, or the language switcher renders differently on the server and in
  the browser (React hydration error #418 on https://www.repget.com/).
*/
describe("splitLocale", () => {
  it("reads locale and path", () => {
    expect(splitLocale("/")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/pricing")).toEqual({ locale: "en", path: "/pricing" });
    expect(splitLocale("/es/pricing")).toEqual({ locale: "es", path: "/pricing" });
    expect(splitLocale("/fr")).toEqual({ locale: "fr", path: "/" });
  });

  it("treats the internal /index route as the home page, in every locale", () => {
    expect(splitLocale("/index")).toEqual(splitLocale("/"));
    expect(splitLocale("/es/index")).toEqual(splitLocale("/es"));
    expect(TRANSLATED_PATHS.has(splitLocale("/index").path)).toBe(true);
  });

  it("ignores a trailing slash, so it cannot change what is translatable", () => {
    expect(splitLocale("/pricing/")).toEqual({ locale: "en", path: "/pricing" });
    expect(splitLocale("/it/pricing/")).toEqual({ locale: "it", path: "/pricing" });
  });
});

describe("localePath", () => {
  it("prefixes the pages that exist in that language", () => {
    expect(localePath("es", "/")).toBe("/es");
    expect(localePath("es", "/pricing")).toBe("/es/pricing");
    expect(localePath("de", "/backlink-exchange")).toBe("/de/backlink-exchange");
  });

  it("links English-only pages as they are", () => {
    for (const page of ["/audit", "/tools", "/tools/robots-checker", "/docs/integrations/wordpress", "/blog", "/sign-up"]) {
      expect(localePath("es", page)).toBe(page);
    }
  });

  it("keeps a fragment or query, on the right page", () => {
    expect(localePath("fr", "/#how-it-works")).toBe("/fr#how-it-works");
    expect(localePath("fr", "/pricing?plan=growth")).toBe("/fr/pricing?plan=growth");
    expect(localePath("fr", "/audit?domain=example.com")).toBe("/audit?domain=example.com");
  });

  it("leaves English unprefixed", () => {
    expect(localePath("en", "/pricing")).toBe("/pricing");
    expect(localePath("en", "audit")).toBe("/audit");
  });

  /** The list and the folders must agree, or a link 404s or a translation is never linked. */
  it("knows exactly the pages app/(marketing)/[locale] has", () => {
    const dir = path.resolve(__dirname, "../../app/(marketing)/[locale]");
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("("))
      .map((entry) => `/${entry.name}`);
    expect([...TRANSLATED_PATHS].sort()).toEqual(["/", ...folders].sort());
  });
});
