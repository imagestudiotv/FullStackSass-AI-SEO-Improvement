import { beforeEach, describe, expect, it, vi } from "vitest";

import { message } from "@/test/blog-autopilot";

/**
 * The autopilot's translations: the fields and the pictures' words in one
 * call, the body in the parts it was written in, nothing of the article's
 * shape lost, and each language's own pictures swapped in.
 */

const ai = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { stream: ai.stream } },
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5", BLOG: "claude-sonnet-5", BLOG_TRANSLATION: "claude-haiku-5-5" },
  isAiConfigured: () => true,
}));

import { bodySlices, swapPictures, translateBodyPart, translateFields, type TranslationSource } from "./translate";

const answer = (value: unknown) => ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => message(value) }));
const asked = () => ai.stream.mock.calls[0][0] as { model: string; system: { text: string; cache_control?: unknown }[]; output_config: { effort: string }; messages: { content: string }[] };

const SOURCE: TranslationSource = {
  title: "Local SEO for Plumbers",
  seoTitle: "Local SEO for Plumbers: A Guide",
  description: "Learn local SEO for plumbers.",
  shortAnswer: "Start with your profile.",
  breadcrumbLabel: "",
  primaryKeyword: "local SEO for plumbers",
  secondaryKeywords: ["plumber SEO"],
  faqs: [
    { question: "What is it?", answer: "<p>Being found.</p>" },
    { question: "How long?", answer: "<p>Months.</p>" },
  ],
  pictures: [{ title: "From search to call", labels: ["Search", "Call"], alt: "How a search becomes a call" }],
};

const ITALIAN = {
  title: "SEO locale per idraulici",
  slug: "seo-locale-idraulici",
  seoTitle: "SEO locale per idraulici: guida",
  description: "Scopri la SEO locale per idraulici.",
  shortAnswer: "Inizia dal tuo profilo.",
  breadcrumbLabel: "Should stay empty",
  primaryKeyword: "SEO locale per idraulici",
  secondaryKeywords: ["SEO idraulico"],
  faqs: [
    { question: "Che cos'è?", answer: "<p>Farsi trovare.</p>" },
    { question: "Quanto tempo?", answer: "<p>Mesi.</p>" },
  ],
  pictures: [{ title: "Dalla ricerca alla chiamata", labels: ["Ricerca", "Chiamata"], alt: "Come una ricerca diventa una chiamata" }],
};

beforeEach(() => ai.stream.mockReset());

describe("the fields", () => {
  it("are translated by Claude Haiku 5.5 with the editor's rules, the pictures' words included", async () => {
    answer(ITALIAN);
    const { fields, usage } = await translateFields(SOURCE, "it");
    const request = asked();
    // Haiku 5.5 since 2026-10-20 (client: the translations were half an article's cost on Sonnet 5).
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.output_config).toMatchObject({ effort: "medium" });
    expect(request.system[0].text).toContain("from English into Italian");
    expect(request.system[0].text).toContain("Keep every fact, number, date, price and claim exactly as it is.");
    expect(request.system[0].text).toContain("no dashes as punctuation");
    expect(request.messages[0].content).toContain(JSON.stringify(SOURCE));
    expect(request.messages[0].content).toContain("it has to fit in the picture");
    // An empty field stays empty.
    expect(fields).toEqual({ ...ITALIAN, breadcrumbLabel: "" });
    // Haiku 5.5's prices: 1,000 tokens in at $0.10, 2,000 out at $0.50, 20,000 written to the cache at $0.125 a million.
    expect(usage.costUsd).toBeCloseTo(0.0036, 6);
  });

  it("are priced at Haiku 5.5's higher rate when the prompt is over 100K tokens", async () => {
    ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => message(ITALIAN, { usage: { input_tokens: 150_000 } }) }));
    const { usage } = await translateFields(SOURCE, "it");
    // 150,000 in at $0.50, 2,000 out at $2.50, 20,000 written to the cache at $0.625 a million.
    expect(usage.costUsd).toBeCloseTo(0.0925, 6);
  });

  it("are refused when a FAQ or a picture's words are lost", async () => {
    answer({ ...ITALIAN, faqs: ITALIAN.faqs.slice(0, 1) });
    await expect(translateFields(SOURCE, "it")).rejects.toThrow("has 1 of the 2 FAQs");
    answer({ ...ITALIAN, pictures: [] });
    await expect(translateFields(SOURCE, "it")).rejects.toThrow("lost the words of a picture");
    answer({ ...ITALIAN, title: " " });
    await expect(translateFields(SOURCE, "it")).rejects.toThrow("without a title");
  });
});

describe("the body", () => {
  const sections = (count: number) => Array.from({ length: count }, (_, index) => `<h2>S${index + 1}</h2><p>Text ${index + 1}.</p>`).join("");

  it("is cut where it was written: the opening with the first sections, then at most four a part", () => {
    const html = `<p>Opening.</p>${sections(10)}`;
    const slices = bodySlices(html);
    expect(slices).toHaveLength(3);
    expect(slices.join("")).toBe(html);
    expect(slices[0].startsWith("<p>Opening.</p><h2>S1</h2>")).toBe(true);
    expect(slices.map((slice) => (slice.match(/<h2>/g) ?? []).length)).toEqual([4, 3, 3]);
    expect(bodySlices("<p>No headings.</p>")).toEqual(["<p>No headings.</p>"]);
  });

  const PART =
    '<h2>Where it starts</h2><p>See the <a href="https://www.repget.com/audit">audit</a>.</p><img src="https://cdn.example/en/1.webp" alt="A diagram" width="1536" height="1024"><table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>';

  it("keeps the HTML and uses the same phrases as the fields", async () => {
    const italian = PART.replace("Where it starts", "Da dove si parte").replace("See the", "Vedi").replace('alt="A diagram"', 'alt="Un diagramma"');
    answer({ bodyHtml: italian });
    const result = await translateBodyPart(PART, "it", { title: ITALIAN.title, primaryKeyword: ITALIAN.primaryKeyword, secondaryKeywords: ITALIAN.secondaryKeywords });
    expect(result.html).toBe(italian);
    const request = asked().messages[0].content;
    expect(request).toContain(`<html_part>\n${PART}\n</html_part>`);
    expect(request).toContain("- its main search phrase: SEO locale per idraulici");
  });

  it("is refused when a part loses or changes a heading, a table, a picture or a link", async () => {
    const glossary = { title: "T", primaryKeyword: "", secondaryKeywords: [] };
    for (const broken of [
      PART.replace("<h2>Where it starts</h2>", "<p>Where it starts</p>"),
      PART.replace(/<table>.*<\/table>/, ""),
      PART.replace("https://www.repget.com/audit", "https://www.repget.com/it/audit"),
      PART.replace("https://cdn.example/en/1.webp", "https://cdn.example/it/1.webp"),
    ]) {
      answer({ bodyHtml: broken });
      await expect(translateBodyPart(PART, "it", glossary)).rejects.toThrow("changed the article's headings, tables, pictures or links");
    }
  });

  it("accepts a link written in another form, and gives it back exactly as it was", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    try {
      const glossary = { title: "T", primaryKeyword: "", secondaryKeywords: [] };
      answer({ bodyHtml: PART.replace("https://www.repget.com/audit", "/audit/").replace("See the", "Vedi") });
      const result = await translateBodyPart(PART, "it", glossary);
      expect(result.html).toContain('<a href="https://www.repget.com/audit">audit</a>');
      expect(result.html).toContain("Vedi");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("a translation's pictures", () => {
  it("are its own where they could be made, else the English ones with its alt text", () => {
    const html = '<p>A</p><img src="https://cdn.example/en/1.webp" alt="One" width="1536" height="1024"><p>B</p><img src="https://cdn.example/en/2.webp" alt="Two" width="1536" height="1024">';
    const swapped = swapPictures(html, [
      { from: "https://cdn.example/en/1.webp", to: { url: "https://cdn.example/it/1.webp", width: 1600, height: 1000 }, alt: "Uno" },
      { from: "https://cdn.example/en/2.webp", alt: "Due" },
    ]);
    expect(swapped).toBe(
      '<p>A</p><img src="https://cdn.example/it/1.webp" alt="Uno" width="1600" height="1000"><p>B</p><img src="https://cdn.example/en/2.webp" alt="Due" width="1536" height="1024">',
    );
  });
});
