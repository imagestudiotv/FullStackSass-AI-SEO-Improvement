import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5" },
}));

import type { ArticleBrief } from "./generate";
import { briefContext } from "./generate";
import {
  articleText,
  checkArticleFormat,
  classifyArticleFormat,
  correctArticleFormat,
  formatInstruction,
  formatSearchMarket,
  MIN_EXAMPLES,
  needsFormatCheck,
  parseFormatPlan,
  parseFormatReview,
  type FormatPlan,
} from "./format";

const answer = (body: unknown) => ({
  model: "claude-haiku-4-5",
  stop_reason: "end_turn",
  usage: { input_tokens: 500, output_tokens: 50 },
  content: [{ type: "text", text: JSON.stringify(body) }],
});

const examples: FormatPlan = { format: "examples", minItems: 20, basis: "serp", results: 10 };

const brief = {
  title: "Привітання з днем народження зятю від тещі",
  targetKeyword: "привітання з днем народження зятю від тещі своїми словами",
  intent: "informational",
  relatedKeywords: [],
  brandName: null, industry: "Media", country: "Ukraine", language: "Ukrainian",
  description: null, targetAudience: null, services: [], customInstructions: null, articleInstructions: null,
  tone: null, avoid: null, vocabulary: null, usps: [], facts: [], socialLinks: [], backlink: null,
  articleStyle: null, targetWordCount: null, internalLinkTarget: 0, tableOfContents: false, authorPerspective: false,
  mentionSimilarProducts: false, comparisonTable: false, imageStyle: null, imageBrief: null, imageInstructions: null,
} satisfies ArticleBrief;

beforeEach(() => ai.create.mockReset());

describe("parseFormatPlan", () => {
  it("keeps examples between the floor and the ceiling", () => {
    expect(parseFormatPlan(JSON.stringify({ format: "examples", minItems: 3 }), 10)).toEqual({ format: "examples", minItems: MIN_EXAMPLES, basis: "serp", results: 10 });
    expect(parseFormatPlan(JSON.stringify({ format: "examples", minItems: 100 }), 10).minItems).toBe(40);
    expect(parseFormatPlan(JSON.stringify({ format: "examples", minItems: 30 }), 0)).toMatchObject({ minItems: 30, basis: "keyword" });
  });

  it("reads anything unknown as a plain guide, with no count", () => {
    expect(parseFormatPlan(JSON.stringify({ format: "poem", minItems: 5 }), 3)).toMatchObject({ format: "guide", minItems: null });
    expect(parseFormatPlan(JSON.stringify({ format: "how_to", minItems: 12 }), 3).minItems).toBeNull();
  });
});

describe("formatInstruction", () => {
  it("asks an examples article for the examples themselves, first", () => {
    const text = formatInstruction(examples)!;
    expect(text).toContain("at least 20 complete examples");
    expect(text).toContain("not advice about writing them");
    expect(text).toContain("Open by answering the search directly");
  });

  it("says nothing extra for a plain guide or no plan", () => {
    expect(formatInstruction({ ...examples, format: "guide", minItems: null })).toBeNull();
    expect(formatInstruction(null)).toBeNull();
  });

  it("reaches the outline and body prompts through the brief", () => {
    const context = briefContext({ ...brief, format: examples });
    expect(context).toContain("Article format, from the pages that rank for this search: examples");
    // Ukrainian keeps its grammatical dash (lib/articles/dashes.ts).
    expect(context).toContain("X — це Y");
    expect(briefContext({ ...brief, language: "English" })).not.toContain("Article format");
  });
});

describe("formatSearchMarket", () => {
  it("reads the website's own market, never one in another language", () => {
    expect(formatSearchMarket("Ukraine", "Ukrainian")).toEqual({ location: "Ukraine", language: "Ukrainian" });
    expect(formatSearchMarket("Italy", "English")).toEqual({ location: "United States", language: "English" });
    expect(formatSearchMarket("Kenya", "Swahili")).toBeNull();
    expect(formatSearchMarket(null, "English")).toBeNull();
  });
});

describe("parseFormatReview", () => {
  it("fails an examples article that is short of its count, whatever the checker said", () => {
    expect(parseFormatReview(JSON.stringify({ delivers: true, items: 6, problems: [] }), examples)).toEqual({
      delivers: false, items: 6, problems: ["Only 6 complete, ready-to-use examples; at least 20 are needed."],
    });
    expect(parseFormatReview(JSON.stringify({ delivers: true, items: 24, problems: [] }), examples).delivers).toBe(true);
    expect(parseFormatReview(JSON.stringify({ delivers: false, items: 0, problems: ["No steps"] }), { ...examples, format: "how_to", minItems: null }))
      .toEqual({ delivers: false, items: null, problems: ["No steps"] });
  });
});

describe("articleText", () => {
  it("keeps the structure a checker counts by", () => {
    expect(articleText("<h2>Wishes</h2><ul><li>One</li><li>Two</li></ul><p>Tip</p>")).toBe("## Wishes\n\n- One\n- Two\nTip");
  });
});

describe("needsFormatCheck", () => {
  it("checks only a specific format", () => {
    expect(needsFormatCheck(examples, "<p>x</p>")).toBe(true);
    expect(needsFormatCheck({ ...examples, format: "guide" }, "<p>x</p>")).toBe(false);
    expect(needsFormatCheck(null, "<p>x</p>")).toBe(false);
  });
});

describe("the model calls", () => {
  it("classifies from the top ten results, as material", async () => {
    ai.create.mockResolvedValueOnce(answer({ format: "examples", minItems: 50 }));
    const results = Array.from({ length: 30 }, (_, i) => ({ url: `https://site${i}.example/p`, title: `${50 + i} привітань зятю`, description: "Найкращі привітання" }));
    const measure = vi.fn(async () => {});
    expect(await classifyArticleFormat(brief, results, measure)).toEqual({ format: "examples", minItems: 40, basis: "serp", results: 10 });
    const request = ai.create.mock.calls[0][0];
    expect(request.model).toBe("claude-haiku-4-5");
    expect(request.messages[0].content).toContain("<website_page>");
    expect(request.messages[0].content).toContain("site9.example");
    expect(request.messages[0].content).not.toContain("site10.example");
    expect(measure).toHaveBeenCalledWith(expect.objectContaining({ task: "format_classify" }));
  });

  it("checks the article's text and applies the count", async () => {
    ai.create.mockResolvedValueOnce(answer({ delivers: true, items: 4, problems: ["Mostly advice"] }));
    const review = await checkArticleFormat("<h2>Як написати</h2><p>Порада</p>", brief, examples);
    expect(review).toMatchObject({ delivers: false, items: 4 });
    expect(review.problems).toHaveLength(2);
  });

  it("corrects once into a complete article, keeping Ukrainian dashes and dropping disallowed markup", async () => {
    const html = `<h2>Привітання</h2><ul>${Array.from({ length: 20 }, (_, i) => `<li>Побажання ${i} — це щастя</li>`).join("")}</ul><p>Порада — це додаток.</p><script>x</script>`;
    ai.create.mockResolvedValueOnce({ ...answer({ bodyHtml: html }), model: "claude-sonnet-5" });
    const result = await correctArticleFormat("<h2>Порада</h2><p>Як написати привітання.</p>", brief, examples, { delivers: false, items: 0, problems: ["No wishes"] });
    expect(result.bodyHtml).toContain("Порада — це додаток.");
    expect(result.bodyHtml).not.toContain("<script>");
    const request = ai.create.mock.calls[0][0];
    expect(request.model).toBe("claude-sonnet-5");
    expect(request.system).toContain("add no new links");
    expect(request.messages[0].content).toContain("No wishes");
  });

  it("refuses a correction that lost most of the article", async () => {
    ai.create.mockResolvedValueOnce(answer({ bodyHtml: "<h2>Short</h2><p>Too short.</p>" }));
    const long = `<h2>A</h2><p>${"word ".repeat(400)}</p>`;
    await expect(correctArticleFormat(long, { ...brief, language: "English" }, examples, { delivers: false, items: 0, problems: [] })).rejects.toThrow("incomplete");
  });
});
