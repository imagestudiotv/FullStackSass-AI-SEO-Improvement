import { describe, expect, it } from "vitest";

import { META_DESCRIPTION_MAX, META_DESCRIPTION_MIN, profileMetaDescription } from "./profile-fields";

/**
 * A profile page's meta description (Ahrefs site audit, 2026-11-24: "Meta
 * description too short" on /discover/dumitru-culiuc, its 64-character
 * tagline).
 */
describe("profileMetaDescription", () => {
  const about =
    "Dumitru Culiuc is an entrepreneur, film director and creative professional based in Italy, building businesses and original projects across creativity, technology and digital media.";

  it("keeps a tagline that is long enough as it is", () => {
    const long = "x ".repeat(70).trim();
    expect(long.length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
    expect(profileMetaDescription(long, [about])).toBe(long);
  });

  it("follows a short tagline with the About, cut at a word within the limit", () => {
    const result = profileMetaDescription("Building what's next across creativity, technology and business.", [about, "The story."]);
    expect(result.startsWith("Building what's next across creativity, technology and business. Dumitru Culiuc is an entrepreneur")).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
    expect(result.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it("ends the tagline with a full stop before what follows, and skips a repeat of it", () => {
    expect(profileMetaDescription("Photography and film", ["Photography and film", "", "Weddings in Rome."])).toBe("Photography and film. Weddings in Rome.");
    expect(profileMetaDescription("Short one.", [null, undefined])).toBe("Short one.");
  });

  it("uses the next text alone when there is no tagline", () => {
    expect(profileMetaDescription("  ", ["How Image Studio grew."])).toBe("How Image Studio grew.");
  });
});
