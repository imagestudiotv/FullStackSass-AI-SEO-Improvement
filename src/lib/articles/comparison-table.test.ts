import { describe, expect, it } from "vitest";

import { prepareForDelivery } from "@/lib/articles/delivery";
import { briefContext, type ArticleBrief } from "@/lib/articles/generate";
import { sanitizeHtml } from "@/lib/articles/sanitize";

/**
 * The comparison table (client, 2026-10-02: "Videography vs Cinematography
 * at a Glance"): asked for when the Article Settings option is on, kept by the
 * sanitiser, and sent in WordPress's table block.
 */

const brief = (comparisonTable: boolean): ArticleBrief =>
  ({
    title: "Wedding video ideas",
    targetKeyword: "wedding video ideas",
    intent: "informational",
    relatedKeywords: [],
    language: "English",
    brandName: "Image Studio",
    industry: "Video production",
    description: null,
    services: [],
    targetAudience: null,
    country: null,
    customInstructions: null,
    articleInstructions: null,
    tone: null,
    avoid: null,
    vocabulary: null,
    usps: [],
    facts: [],
    socialLinks: [],
    backlink: null,
    articleStyle: null,
    targetWordCount: null,
    internalLinkTarget: null,
    tableOfContents: true,
    authorPerspective: true,
    mentionSimilarProducts: true,
    comparisonTable,
    imageStyle: null,
    imageBrief: null,
    imageInstructions: null,
  }) as unknown as ArticleBrief;

describe("the writer's brief", () => {
  it("asks for exactly one comparison table, in the reference's shape, when the option is on", () => {
    const text = briefContext(brief(true));
    expect(text).toContain("Include exactly ONE comparison table");
    expect(text).toContain("at a Glance");
    expect(text).toContain("<thead>");
    expect(text).not.toContain("Do not use tables.");
  });

  it("says no tables when it is off, rather than leaving it to the model", () => {
    const text = briefContext(brief(false));
    expect(text).toContain("Do not use tables.");
    expect(text).not.toContain("comparison table");
  });
});

const TABLE =
  "<h3>Videography vs Cinematography at a Glance</h3>" +
  "<table><thead><tr><th>Attribute</th><th>Wedding Videography</th><th>Wedding Cinematography</th></tr></thead>" +
  "<tbody><tr><td>Primary purpose</td><td>Event documentation across the day</td><td>Crafted visual storytelling</td></tr></tbody></table>";

describe("storage and delivery", () => {
  it("the sanitiser keeps the table; the editor's extra markup (colgroup, styles, colspan) is dropped", () => {
    expect(sanitizeHtml(TABLE)).toBe(TABLE);
    const fromEditor =
      '<table style="min-width: 75px"><colgroup><col style="min-width: 25px"></colgroup><tbody>' +
      '<tr><th colspan="1" rowspan="1"><p>Attribute</p></th></tr></tbody></table>';
    expect(sanitizeHtml(fromEditor)).toBe("<table><tbody><tr><th><p>Attribute</p></th></tr></tbody></table>");
  });

  it("goes out in WordPress's table block, once, with the editor's cell paragraphs unwrapped", () => {
    const edited = "<table><tbody><tr><th><p>Attribute</p></th><td><p>Crafted visual storytelling</p></td></tr></tbody></table>";
    const sent = prepareForDelivery(edited, { poweredBy: false });
    expect(sent).toBe(
      '<figure class="wp-block-table"><table><tbody><tr><th>Attribute</th><td>Crafted visual storytelling</td></tr></tbody></table></figure>',
    );
    // Running it again changes nothing.
    expect(prepareForDelivery(sent, { poweredBy: false })).toBe(sent);
  });

  it("a cell with more than one paragraph keeps them", () => {
    const cell = "<table><tbody><tr><td><p>One</p><p>Two</p></td></tr></tbody></table>";
    expect(prepareForDelivery(cell, { poweredBy: false })).toContain("<td><p>One</p><p>Two</p></td>");
  });
});
