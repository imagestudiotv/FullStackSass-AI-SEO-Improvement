import { it, expect } from "vitest";
import { safeFetch } from "@/lib/net/safe-fetch";
import { load } from "cheerio";
import { researchPageContent } from "@/lib/articles/research-page";
it("reads the primary documentation through the normal safe fetcher", async () => {
  try {
    const response = await safeFetch("https://support.google.com/webmasters/answer/9008080?hl=en", {
      timeoutMs: 20000, maxBytes: 4_000_000, headers: { accept: "text/html", "accept-encoding": "gzip, br", "user-agent": "RepGetResearch/1.0" },
    });
    const html = await response.text();
    expect(response.ok).toBe(true);
    expect(html).toContain("Verify your site ownership");
    const $ = load(html);
    const { excerpt } = researchPageContent($, $("title").text(), "Google Search Console verify domain property DNS TXT CNAME");
    expect(excerpt).toContain("Domain name provider");
    expect(excerpt).toContain("CNAME");
    expect(excerpt).toContain("TXT");
    expect(excerpt.length).toBeLessThanOrEqual(12000);
  } catch (error) {
    console.error(error instanceof Error ? { name: error.name, message: error.message } : "fetch failed");
    throw error;
  }
});
