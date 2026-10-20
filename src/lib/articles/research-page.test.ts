import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { researchPageContent } from "./research-page";

describe("research page extraction", () => {
  it("reads the matching main headline instead of an earlier unrelated article card", () => {
    const $ = load(`<title>Essentials of color grading | Publisher</title>
      <main><article><h2><a href="/biography">Meet a photographer</a></h2><p>${"Unrelated biography. ".repeat(80)}</p></article>
      <header><h1>Essentials of color grading</h1></header>
      <p>Start with a reference image.</p><h2>Compare tones</h2><p>Keep the original for comparison.</p></main>`);
    const { excerpt } = researchPageContent($, $("title").text());
    expect(excerpt).toContain("Start with a reference image. Compare tones Keep the original");
    expect(excerpt).not.toContain("biography");
    expect(excerpt).toContain("Essentials of color grading");
  });
  it("handles a page-builder body with no semantic main and articles used only for teasers", () => {
    const $ = load(`<div><h1>Essentials of color grading</h1><p>The actual editing lesson.</p></div>
      <article><h3><a href="/other">A photographer biography</a></h3><p>${"Unrelated. ".repeat(100)}</p></article>`);
    expect(researchPageContent($, "Essentials of color grading").excerpt)
      .toBe("Essentials of color grading The actual editing lesson.");
  });
  it("keeps the article body when its matching headline is outside the article element", () => {
    const $ = load(`<main><h1>Editing guide</h1><article><h2>Introduction</h2><p>The actual lesson.</p></article></main>`);
    expect(researchPageContent($, "Editing guide").excerpt).toContain("The actual lesson.");
  });
  it("prefers the article containing the actual headline and excludes sibling recommendations", () => {
    const $ = load(`<main><p>Unrelated recommendations</p>
      <article><h1>Verify your site</h1><p>Use the verification method for your property.</p></article>
      <article><h2>Other post</h2><p>More recommendations.</p></article></main>`);
    expect(researchPageContent($, "Verify your site - Documentation").excerpt)
      .toBe("Verify your site Use the verification method for your property.");
  });
  it("bounds long pages while retaining block boundaries and removing navigation", () => {
    const $ = load(`<main><h1>Guide</h1><nav>Ignore this menu</nav><p>First paragraph.</p>
      <p>${"Useful text. ".repeat(2000)}</p></main>`);
    const result = researchPageContent($, "Guide");
    expect(result.excerpt).toHaveLength(12000);
    expect(result.excerpt).not.toContain("menu");
    expect(result.excerpt).toContain("First paragraph. Useful text.");
  });
});
