import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PREFIXED_LOCALES, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { landingPath } from "@/lib/partners/presentation/tracking-cookie";
import { isPublicEnglishPage, PUBLIC_PAGES } from "@/lib/seo/public-pages";

import { MOVED_PAGE_LOCALES, MOVED_PAGES, movedPageRedirects } from "./moved-pages";

/**
 * The removed /backlink-exchange and /publishers (client, 2026-11-21): the
 * rules in next.config.ts, run through Next's own matcher so the patterns are
 * tested as Next reads them.
 */

const require = createRequire(import.meta.url);
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match") as {
  getPathMatch: (source: string, options: { removeUnnamedParams: boolean; strict: boolean }) => (path: string) => Record<string, string> | false;
};
const { prepareDestination } = require("next/dist/shared/lib/router/utils/prepare-destination") as {
  prepareDestination: (args: { appendParamsToQuery: boolean; destination: string; params: Record<string, string>; query: Record<string, string> }) => {
    parsedDestination: { pathname: string; query: Record<string, string> };
  };
};

/** Where the first matching rule sends this request, as Next would: the path, its query, and whether it is for good. */
function redirectFor(path: string, query: Record<string, string> = {}) {
  for (const rule of movedPageRedirects()) {
    const params = getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(path);
    if (!params) continue;
    const { parsedDestination } = prepareDestination({ appendParamsToQuery: false, destination: rule.destination, params, query });
    return { pathname: parsedDestination.pathname, query: parsedDestination.query, permanent: rule.permanent };
  }
  return null;
}

const ROOT = join(process.cwd(), "src", "app");

describe("the removed pages", () => {
  it.each([
    ["/backlink-exchange", "/backlinks"],
    ["/publishers", "/partners"],
    ["/es/backlink-exchange", "/es/backlinks"],
    ["/fr/backlink-exchange", "/fr/backlinks"],
    ["/it/backlink-exchange", "/it/backlinks"],
    ["/de/backlink-exchange", "/de/backlinks"],
    ["/es/publishers", "/es/partners"],
    ["/fr/publishers", "/fr/partners"],
    ["/it/publishers", "/it/partners"],
    ["/de/publishers", "/de/partners"],
  ])("send %s to %s for good", (from, to) => {
    expect(redirectFor(from)).toEqual({ pathname: to, query: {}, permanent: true });
  });

  it("keep the query, so a partner's ?ref= and campaign tags still arrive", () => {
    expect(redirectFor("/publishers", { ref: "dami", utm_source: "x" })).toEqual({
      pathname: "/partners",
      query: { ref: "dami", utm_source: "x" },
      permanent: true,
    });
  });

  it.each(["/backlinks", "/partners", "/de/partners", "/backlink-exchange/x", "/publishers-guide", "/en/publishers", "/pt/publishers", "/affiliate"])(
    "leave %s alone",
    (path) => {
      expect(redirectFor(path)).toBeNull();
    },
  );

  it("cover every language in a URL", () => {
    expect([...MOVED_PAGE_LOCALES].sort()).toEqual([...PREFIXED_LOCALES].sort());
  });

  it("go to pages that exist in every language", () => {
    for (const { to } of MOVED_PAGES) {
      expect(TRANSLATED_PATHS.has(to)).toBe(true);
      expect(existsSync(join(ROOT, "(marketing)", to.slice(1), "page.tsx"))).toBe(true);
      expect(existsSync(join(ROOT, "(localized)", "[locale]", "(pages)", to.slice(1), "page.tsx"))).toBe(true);
    }
  });

  it("are gone from the site: no page, no sitemap entry, no translation, no partner landing", () => {
    for (const { from } of MOVED_PAGES) {
      expect(existsSync(join(ROOT, "(marketing)", from.slice(1)))).toBe(false);
      expect(existsSync(join(ROOT, "(localized)", "[locale]", "(pages)", from.slice(1)))).toBe(false);
      expect(PUBLIC_PAGES.map((page) => page.path)).not.toContain(from);
      expect(isPublicEnglishPage(from)).toBe(false);
      expect(TRANSLATED_PATHS.has(from)).toBe(false);
      expect(landingPath(from)).toBe("/");
    }
  });
});
