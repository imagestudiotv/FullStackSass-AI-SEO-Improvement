import { describe, expect, it } from "vitest";

import { blogWriterCopy } from "@/lib/i18n/blog-writer";
import { LOCALES } from "@/lib/i18n/config";

import {
  BLOG_FORMATS,
  clampOpening,
  cleanBrief,
  OPENING_HARD_MAX_WORDS,
  onDevicePrompt,
  openingText,
  parseOpeningText,
  templateOpening,
  templateTitle,
  wordCount,
} from "./blog-writer-shared";

/**
 * The free AI Blog Writer's shared rules (owner's mockup, 2026-11-27): the
 * template fallback, the on-device prompt, and "never more than the opening".
 */

const closings = blogWriterCopy("en").closings;

describe("the template", () => {
  it("writes the mockup's opening: the question as title, the advice, then the format's closing line", () => {
    const opening = templateOpening(
      {
        topic: "how much time should we leave for wedding portraits on Lake Como",
        format: "guide",
        notes: "we work backwards from the aperitivo and include the walk to the boat in the portrait window",
      },
      "en",
      closings,
    );
    expect(opening).toEqual({
      title: "How much time should we leave for wedding portraits on Lake Como?",
      opening:
        "We work backwards from the aperitivo and include the walk to the boat in the portrait window. The easiest way to put that advice to work is to try it on one real example. Pick the next decision in front of you, apply the same rule and see what changes.",
    });
    expect(openingText(opening)).toMatch(/^How much time .*\?\n\nWe work backwards/);
  });

  it("adds a question mark only to a question, and keeps the reader's own punctuation", () => {
    expect(templateTitle("Should I buy whole beans", "en")).toBe("Should I buy whole beans?");
    expect(templateTitle("A first-run checklist for a dashboard", "en")).toBe("A first-run checklist for a dashboard");
    expect(templateTitle("why  is the sky   blue?", "en")).toBe("Why is the sky blue?");
    expect(templateOpening({ topic: "x", format: "comparison", notes: "Grind fresh!" }, "en", closings).opening).toMatch(/^Grind fresh! Use that point/);
  });

  it("writes questions the way each language does", () => {
    expect(templateTitle("cuánto tiempo dejamos para los retratos", "es")).toBe("¿Cuánto tiempo dejamos para los retratos?");
    expect(templateTitle("comment choisir un moulin", "fr")).toBe("Comment choisir un moulin?");
    expect(templateTitle("quanto tempo serve", "it")).toBe("Quanto tempo serve?");
    expect(templateTitle("wie viel Zeit brauchen wir", "de")).toBe("Wie viel Zeit brauchen wir?");
  });

  it.each(LOCALES)("has a closing line for every format in %s", (locale) => {
    for (const format of BLOG_FORMATS) expect(blogWriterCopy(locale).closings[format].length).toBeGreaterThan(40);
  });
});

describe("never more than the opening", () => {
  it("cuts a long answer at a sentence inside the word limit", () => {
    const sentence = "This sentence has exactly eight words in it.";
    const long = Array.from({ length: 40 }, () => sentence).join(" ");
    const clamped = clampOpening(long);
    expect(wordCount(clamped)).toBeLessThanOrEqual(OPENING_HARD_MAX_WORDS);
    expect(clamped.endsWith(".")).toBe(true);
  });

  it("reads a model's answer as a title and an opening, without markdown or labels", () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    expect(parseOpeningText(`**Title:** "How to plan portraits"\n\n## ${words}.`)).toEqual({ title: "How to plan portraits", opening: `${words}.` });
    expect(parseOpeningText("Only a title")).toBeNull();
    expect(parseOpeningText("Title\n\nToo short.")).toBeNull();
  });
});

describe("the brief", () => {
  it("is refused when empty or too long, and defaults an unknown format to the guide", () => {
    expect(cleanBrief({ topic: "  ", format: "guide", notes: "x" })).toBeNull();
    expect(cleanBrief({ topic: "q", format: "guide", notes: "" })).toBeNull();
    expect(cleanBrief({ topic: "q".repeat(551), format: "guide", notes: "x" })).toBeNull();
    expect(cleanBrief({ topic: "q", format: "poem", notes: "x".repeat(1000) })?.format).toBe("guide");
  });

  it("asks the on-device AI exactly what the mockup asks, in the page's language", () => {
    const brief = { topic: "Whole beans or ground?", format: "comparison" as const, notes: "Buy what your grinder allows." };
    const en = onDevicePrompt(brief, "en");
    expect(en).toContain("Write an English article title and a 90–140 word opening in plain text.");
    expect(en).toContain("Answer the question directly using the supplied experience. Respect the format. Avoid invented facts or testimonials. Return only the title and prose.");
    expect(en).toContain('Article brief: {"question":"Whole beans or ground?","format":"Comparison","experience":"Buy what your grinder allows."}');
    expect(onDevicePrompt(brief, "it")).toContain("Write an Italian article title");
    expect(onDevicePrompt(brief, "de")).toContain("Write a German article title");
  });
});
