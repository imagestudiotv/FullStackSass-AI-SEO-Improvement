import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The footer's one line about who RepGet is for (eval 2026-11-28): it said
 * "for small businesses, without the agency" while the product serves
 * publishers too and has an agency section. Neutral now, in every language.
 */
describe("footer tagline", () => {
  it.each(LOCALES)("%s names businesses and publishers, and no agency", (locale) => {
    const tagline = getMessages(locale).footer.tagline;
    expect(tagline).not.toMatch(/agen(cy|cia|ce|zia|tur)/i);
    expect(tagline).not.toMatch(/small|pequeñ|petites|piccol|klein/i);
    expect(tagline).toMatch(/SEO/);
  });

  it("is translated, not English everywhere", () => {
    expect(new Set(LOCALES.map((locale) => getMessages(locale).footer.tagline)).size).toBe(LOCALES.length);
  });
});
