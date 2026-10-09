import { describe, expect, it } from "vitest";

import { keywordReport, secondaryKeywordList, splitKeywords } from "./keywords";

/** The editor's keyword checks (client, 2026-10-08): guidance only, nothing added to the page. */

const post = {
  title: "Local SEO for cafés: a checklist",
  seoTitle: "",
  description: "What a café needs for local SEO, in order.",
  slug: "local-seo-for-cafes",
  shortAnswer: "",
  bodyHtml:
    "<p>Local SEO starts with your Google Business Profile.</p><h2>Why local seo matters</h2><p>Reviews and opening hours. More local SEO later.</p>",
  faqs: [{ question: "How long does it take?", answer: "<p>A few weeks for <strong>reviews</strong> to add up.</p>" }],
  primaryKeyword: "local SEO",
  secondaryKeywords: ["Google Business Profile", "opening hours", "citations"],
};

describe("where a post's keywords appear", () => {
  it("checks the places readers and search engines look first, ignoring case, accents and punctuation", () => {
    const report = keywordReport(post);
    expect(Object.fromEntries(report.primary.map((check) => [check.id, check.found]))).toEqual({
      "search-title": true,
      heading: true,
      description: true,
      address: true,
      opening: true,
      subheading: true,
    });
    // Three times in the text: twice in paragraphs and once in the subheading.
    expect(report.primaryUses).toBe(3);
  });

  it("checks the SEO title when there is one, and matches whole words only", () => {
    const report = keywordReport({ ...post, seoTitle: "Café checklist 2026", primaryKeyword: "SEO", description: "Seoul cafés." });
    const found = Object.fromEntries(report.primary.map((check) => [check.id, check.found]));
    expect(found["search-title"]).toBe(false);
    expect(found.description).toBe(false);
  });

  it("checks each secondary keyword against the text, FAQ answers included", () => {
    const report = keywordReport({ ...post, secondaryKeywords: [...post.secondaryKeywords, "reviews"] });
    expect(report.secondary).toEqual([
      { keyword: "Google Business Profile", found: true },
      { keyword: "opening hours", found: true },
      { keyword: "citations", found: false },
      { keyword: "reviews", found: true },
    ]);
  });

  it("has nothing to check without a primary keyword", () => {
    expect(keywordReport({ ...post, primaryKeyword: "  " })).toMatchObject({ primary: [], primaryUses: 0 });
  });
});

describe("the secondary keywords field", () => {
  it("splits on commas; an emptied field is no keywords", () => {
    expect(splitKeywords("a, b,")).toEqual(["a", " b", ""]);
    expect(splitKeywords("   ")).toEqual([]);
  });

  it("tidies spaces and drops empties and repeats, the primary keyword included", () => {
    expect(secondaryKeywordList(["  Rome ", "rome", "", "Lake  Como", "wedding films"], "Wedding Films")).toEqual(["Rome", "Lake Como"]);
  });
});
