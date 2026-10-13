import { describe, expect, it } from "vitest";

import { bodyImageCount, tableCount } from "./article-shape";
import { briefContext, parseOutline, structureFor, tablesInstruction, type ArticleBrief } from "./generate";

/**
 * The article's shape (client, 2026-10-13): one to three comparison tables,
 * varying between articles; an FAQ at the end; sub-headings inside sections.
 */

describe("how many comparison tables an article gets", () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

  it("is 1, 2 or 3, and the same every time for the same article (a retried step agrees)", () => {
    for (const id of ids.slice(0, 50)) {
      const n = tableCount(id, null);
      expect([1, 2, 3]).toContain(n);
      expect(tableCount(id, null)).toBe(n);
    }
  });

  it("varies between articles: mostly one or two, three now and then", () => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    for (const id of ids) counts[tableCount(id, null)] += 1;
    expect(counts[1] / ids.length).toBeGreaterThan(0.35);
    expect(counts[1] / ids.length).toBeLessThan(0.55);
    expect(counts[2] / ids.length).toBeGreaterThan(0.25);
    expect(counts[3] / ids.length).toBeGreaterThan(0.1);
    expect(counts[3] / ids.length).toBeLessThan(0.3);
  });

  it("fewer for a short article", () => {
    for (const id of ids.slice(0, 200)) {
      expect(tableCount(id, 800)).toBe(1);
      expect(tableCount(id, 1200)).toBeLessThanOrEqual(2);
    }
  });
});

describe("pictures inside the article", () => {
  it("is 0-3, whatever is stored", () => {
    expect([bodyImageCount(0), bodyImageCount(2), bodyImageCount(3), bodyImageCount(9), bodyImageCount(-1)]).toEqual([0, 2, 3, 3, 0]);
    expect(bodyImageCount(null)).toBe(3);
    expect(bodyImageCount(Number.NaN)).toBe(3);
  });
});

const brief = (over: Partial<ArticleBrief>): ArticleBrief =>
  ({
    title: "Wedding video ideas",
    targetKeyword: "wedding video ideas",
    relatedKeywords: [],
    services: [],
    usps: [],
    facts: [],
    socialLinks: [],
    backlink: null,
    targetWordCount: null,
    authorPerspective: true,
    mentionSimilarProducts: false,
    comparisonTable: true,
    ...over,
  }) as unknown as ArticleBrief;

describe("the writer's brief", () => {
  it("keeps the one-table wording, and asks for two or three different comparisons when the count says so", () => {
    expect(tablesInstruction(brief({ tableCount: 1 }))).toContain("Include exactly ONE comparison table");
    expect(tablesInstruction(brief({}))).toContain("Include exactly ONE comparison table");
    const two = tablesInstruction(brief({ tableCount: 2 }));
    expect(two).toContain("Include exactly TWO comparison tables");
    expect(two).toContain("never the same comparison twice");
    expect(two).toContain("never two tables in a row");
    expect(tablesInstruction(brief({ tableCount: 3 }))).toContain("Include exactly THREE comparison tables");
    expect(tablesInstruction(brief({ tableCount: 7 }))).toContain("THREE");
    expect(tablesInstruction(brief({ comparisonTable: false, tableCount: 3 }))).toBe("Do not use tables.");
  });

  it("asks for an FAQ at the end when it is on, and for none when it is off", () => {
    expect(briefContext(brief({ faqSection: true }))).toContain("End the article with a frequently asked questions section");
    expect(briefContext(brief({ faqSection: false }))).toContain("Do not add a frequently asked questions section.");
    expect(briefContext(brief({}))).toContain("Do not add a frequently asked questions section.");
  });
});

describe("the outline", () => {
  const json = JSON.stringify({
    metaDescription: "  A description.  ",
    sections: [
      { heading: "What it is", subheadings: [], points: ["a", "b"] },
      { heading: "How to choose", subheadings: ["Budget", " ", "Style", 3], points: ["c"] },
      { heading: "", subheadings: [], points: [] },
    ],
    faq: ["How long does it take?", "", "Can I do it myself?"],
  });

  it("keeps sections with their sub-headings, and the FAQ when one was asked for", () => {
    const outline = parseOutline(json, { faq: true });
    expect(outline.sections).toEqual([
      { heading: "What it is", subheadings: [], points: ["a", "b"] },
      { heading: "How to choose", subheadings: ["Budget", "Style"], points: ["c"] },
    ]);
    expect(outline.metaDescription).toBe("A description.");
    expect(outline.faq).toEqual(["How long does it take?", "Can I do it myself?"]);
  });

  it("drops an FAQ the brief did not ask for, and accepts an outline without the new fields", () => {
    expect(parseOutline(json, { faq: false }).faq).toEqual([]);
    const old = parseOutline(JSON.stringify({ metaDescription: "m", sections: [{ heading: "A", points: ["x"] }] }), { faq: true });
    expect(old.sections).toEqual([{ heading: "A", subheadings: [], points: ["x"] }]);
    expect(old.faq).toEqual([]);
  });

  it("is handed to the writer as ## sections, ### parts and a final FAQ", () => {
    const text = structureFor(parseOutline(json, { faq: true }));
    expect(text).toBe(
      [
        "## What it is\n- a\n- b",
        "## How to choose\n### Budget\n### Style\n- c",
        "## Frequently asked questions (in the article's language)\n- How long does it take?\n- Can I do it myself?",
      ].join("\n\n"),
    );
  });

  it("refuses an outline with no usable section", () => {
    expect(() => parseOutline(JSON.stringify({ sections: [{ heading: " " }] }), { faq: false })).toThrow(/no sections/);
    expect(() => parseOutline("not json", { faq: false })).toThrow(/not valid JSON/);
  });
});
