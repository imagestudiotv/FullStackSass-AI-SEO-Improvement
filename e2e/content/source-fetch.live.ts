import { it, expect } from "vitest";
import { safeFetch } from "@/lib/net/safe-fetch";
it("reads the primary documentation through the normal safe fetcher", async () => {
  try {
    const response = await safeFetch("https://support.google.com/webmasters/answer/9008080?hl=en", {
      timeoutMs: 12000, maxBytes: 4_000_000, headers: { accept: "text/html", "user-agent": "RepGetResearch/1.0" },
    });
    const html = await response.text();
    expect(response.ok).toBe(true);
    expect(html).toContain("Verify your site ownership");
  } catch (error) {
    console.error(error instanceof Error ? { name: error.name, message: error.message } : "fetch failed");
    throw error;
  }
});
