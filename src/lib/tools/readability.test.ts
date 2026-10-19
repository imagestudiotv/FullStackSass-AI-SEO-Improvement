import { describe, expect, it, vi } from "vitest";

/**
 * The Keyword Density Checker's phrases: two words that are next to each
 * other on the page. Pairing only the counted words (three letters or more)
 * joined words a short one separated - "How it works" came out as the phrase
 * "how works" (repget.com, 2026-10-19).
 */

const page = vi.hoisted(() => ({ html: "" }));
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: async (url: string) => {
    const response = new Response(page.html, { status: 200 });
    Object.defineProperty(response, "url", { value: url });
    return response;
  },
}));
vi.mock("@/lib/tools/public-guard", () => ({
  guardedSiteTool: (_tool: string, _input: string, _visitor: string, run: () => Promise<unknown>) => run(),
}));

import { checkReadability } from "./readability";

describe("the most used phrases", () => {
  it("are words next to each other on the page", async () => {
    page.html = `<html><body><h1>How it works</h1>
      <p>Check your website for free. How it works: check your website, fix your website.</p>
      <p>Local SEO for dentists. Local SEO for dentists is a guide.</p></body></html>`;
    const outcome = await checkReadability("example.com", "visitor");
    if (!outcome.ok) throw new Error(outcome.error);
    const phrases = outcome.result.topPhrases.map((phrase) => phrase.term);
    expect(phrases).not.toContain("how works");
    expect(phrases).toEqual(expect.arrayContaining(["your website", "check your", "local seo", "for dentists"]));
    // Words of three letters or more are still counted on their own.
    expect(outcome.result.topWords.map((word) => word.term)).toEqual(expect.arrayContaining(["website", "works", "local", "seo"]));
  });
});
