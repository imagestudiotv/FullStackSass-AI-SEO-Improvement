import { describe, expect, it } from "vitest";

import { LOCALES } from "./config";
import { getMessages } from "./messages";

/*
  The profile's market question fits a publisher as well as a seller
  (outside review of 2026-11-28: a content site was asked for "the country
  you mainly sell in"). Each language names customers or readers and no
  longer asks where they sell.
*/
const READERS: Record<(typeof LOCALES)[number], RegExp> = {
  en: /customers or readers/,
  es: /clientes o lectores/,
  fr: /clients ou lecteurs/,
  it: /clienti o lettori/,
  de: /Kunden oder Leser/,
};
const SELL = /\bsell|vend[eo]|vendez|verkaufen/i;

describe("the profile's market question", () => {
  it.each(LOCALES)("asks where the customers or readers are (%s)", (locale) => {
    const t = getMessages(locale).app.profile;
    for (const text of [t.countryHint, t.marketHelp]) {
      expect(text).toMatch(READERS[locale]);
      expect(text).not.toMatch(SELL);
    }
    // Still says why, and how to write the country.
    expect(t.countryHint).toContain("Spain");
  });
});
