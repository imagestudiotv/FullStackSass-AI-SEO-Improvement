import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INTEGRATION_GUIDE_SLUGS, languageAlternates, LOCALES, localePath, splitLocale, TOOL_SLUGS, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { INTEGRATION_DOCS } from "@/lib/publishing/docs";
import { TOOL_PAGES } from "@/lib/seo/public-pages";

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
    for (const page of ["/blog/some-post", "/blog/category/guides", "/sign-up", "/privacy", "/terms", "/refunds"]) {
      expect(localePath("es", page)).toBe(page);
    }
    // The blog's front page has one per language; its posts have their own addresses (lib/blog/locale.ts).
    expect(localePath("es", "/blog")).toBe("/es/blog");
  });

  it("keeps a fragment or query, on the right page", () => {
    expect(localePath("fr", "/#how-it-works")).toBe("/fr#how-it-works");
    expect(localePath("fr", "/pricing?plan=growth")).toBe("/fr/pricing?plan=growth");
    expect(localePath("fr", "/audit?domain=example.com")).toBe("/fr/audit?domain=example.com");
  });

  it("leaves English unprefixed", () => {
    expect(localePath("en", "/pricing")).toBe("/pricing");
    expect(localePath("en", "audit")).toBe("/audit");
  });

  /** The list and the folders must agree, or a link 404s or a translation is never linked. */
  it("knows exactly the pages app/(marketing)/[locale] has", () => {
    const root = path.resolve(__dirname, "../../app/(marketing)/[locale]");
    // A dynamic folder stands for the pages its generateStaticParams lists. Blog posts and blog
    // categories are database pages with their own addresses in each language (lib/blog/locale.ts),
    // not here.
    const DYNAMIC: Record<string, string[]> = {
      "/docs/integrations/[slug]": INTEGRATION_DOCS.map((doc) => doc.slug),
      "/blog/[slug]": [],
      "/blog/category/[category]": [],
    };
    const pages: string[] = [];
    const walk = (dir: string, at: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name === "page.tsx") pages.push(at || "/");
        if (!entry.isDirectory() || entry.name.startsWith("[...") || entry.name.startsWith("(")) continue;
        const next = `${at}/${entry.name}`;
        if (entry.name.startsWith("[")) {
          expect(DYNAMIC[next], `${next} is not expanded in this test`).toBeDefined();
          for (const slug of DYNAMIC[next]) {
            expect(readdirSync(path.join(dir, entry.name))).toContain("page.tsx");
            pages.push(`${at}/${slug}`);
          }
          continue;
        }
        walk(path.join(dir, entry.name), next);
      }
    };
    walk(root, "");
    /*
      Pages under [locale] that are not public pages, so not in TRANSLATED_PATHS
      (which gives hreflang and sitemap entries): the page Stripe returns a
      "Get Featured" buyer to, noindex (client, 2026-10-15).
    */
    const NOT_PUBLIC = new Set(["/blog/sponsorship/thanks"]);
    for (const page of NOT_PUBLIC) expect(pages, `${page} is listed as not public but has no page`).toContain(page);
    expect([...TRANSLATED_PATHS].sort()).toEqual(pages.filter((page) => !NOT_PUBLIC.has(page)).sort());
  });

  it("lists every integration guide (the slugs are copied so the guides' text stays out of the browser)", () => {
    expect([...INTEGRATION_GUIDE_SLUGS]).toEqual(INTEGRATION_DOCS.map((doc) => doc.slug));
  });

  it("lists every free tool, for the same reason", () => {
    expect(TOOL_SLUGS.map((slug) => `/tools/${slug}`).sort()).toEqual([...TOOL_PAGES].sort());
  });
});
