import { describe, expect, it } from "vitest";

import { metaDescription, pagedDescription } from "./meta-description";

const LONG_BLURB =
  "Product updates from RepGet: new features, improvements and fixes across SEO articles, social content, publishing and Growth Copilot. Read what changed and why it matters for your website.";

describe("metaDescription", () => {
  it("returns text that fits as written, spaces tidied", () => {
    expect(metaDescription("  A short   description.  ")).toBe("A short description.");
    const exact = "x".repeat(155);
    expect(metaDescription(exact)).toBe(exact);
  });

  it("ends at the last whole sentence when that keeps at least 100 characters", () => {
    expect(LONG_BLURB.length).toBeGreaterThan(155);
    const out = metaDescription(LONG_BLURB);
    expect(out).toBe(
      "Product updates from RepGet: new features, improvements and fixes across SEO articles, social content, publishing and Growth Copilot.",
    );
  });

  it("otherwise ends at the last whole word, with an ellipsis, within the limit", () => {
    const text = `${"word ".repeat(40)}end`;
    const out = metaDescription(text);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("word…")).toBe(true);
  });

  it("never exceeds the limit, whatever the text", () => {
    for (const text of [LONG_BLURB, "a".repeat(400), `${"Sentence one. ".repeat(20)}`, `${"ü ".repeat(200)}`]) {
      expect(metaDescription(text).length).toBeLessThanOrEqual(155);
    }
  });
});

describe("pagedDescription", () => {
  it("keeps short text whole and adds the page, as before", () => {
    expect(pagedDescription("Guides for small businesses.", " — Page 2")).toBe("Guides for small businesses — Page 2.");
  });

  it("shortens long text so the page number still fits", () => {
    const out = pagedDescription(LONG_BLURB, " — Page 12");
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith(" — Page 12.")).toBe(true);
  });
});
