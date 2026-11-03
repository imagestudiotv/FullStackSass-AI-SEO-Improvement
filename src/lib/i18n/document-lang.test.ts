import { describe, expect, it } from "vitest";

import { splitLocale } from "./config";
import { LANG_SCRIPT } from "./document-lang";

/**
 * The page-language script that runs before the first paint (app/layout.tsx),
 * run here against a stand-in page: the address's language on the translated
 * pages, the layout's "en" everywhere else, and never an error.
 */
function run(pathname: string) {
  const html = { lang: "en" };
  new Function("location", "document", LANG_SCRIPT)({ pathname }, { documentElement: html });
  return html.lang;
}

describe("the early page-language script", () => {
  it("gives every translated page its language", () => {
    for (const locale of ["es", "fr", "it", "de"]) {
      expect(run(`/${locale}`)).toBe(locale);
      expect(run(`/${locale}/`)).toBe(locale);
      expect(run(`/${locale}/pricing`)).toBe(locale);
      expect(run(`/${locale}/blog/some-post`)).toBe(locale);
    }
  });

  it("leaves English pages, and look-alike paths, as English", () => {
    for (const path of ["/", "/pricing", "/dashboard", "/delivery", "/esempio", "/frames/x", "/its", "/de-mo", "/en"]) {
      expect(run(path)).toBe("en");
    }
  });

  it("agrees with the language the site's links are built from", () => {
    for (const path of ["/", "/de", "/fr/pricing", "/it/blog/x", "/es/tools/robots-checker", "/pricing", "/deals"]) {
      expect(run(path)).toBe(splitLocale(path).locale);
    }
  });

  it("never throws, even without a location", () => {
    expect(() => new Function("location", "document", LANG_SCRIPT)(undefined, undefined)).not.toThrow();
  });
});
