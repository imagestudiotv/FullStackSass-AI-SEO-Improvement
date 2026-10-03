import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INTEGRATION_DOCS } from "@/lib/publishing/docs";
import { TOOLS } from "@/lib/tools/registry";

import { buildSiteLlmsTxt, PAGE_NOTES } from "./site-llms-txt";

/**
 * RepGet's own /llms.txt (client's launch review, 2026-10-03): the standard
 * format, built from the site's own data, saying nothing the pages do not.
 */

const SITE = "https://www.repget.com";
const POSTS = [
  { slug: "ghost-vs-wordpress", title: "Ghost vs WordPress", description: "Which one fits a small business." },
];

const file = buildSiteLlmsTxt(SITE, POSTS);
const lines = file.split("\n");

describe("buildSiteLlmsTxt", () => {
  it("opens with the name and a one-line summary, as the format requires", () => {
    expect(lines[0]).toBe("# RepGet");
    expect(lines[2]).toMatch(/^> RepGet is an AI SEO platform for content and backlinks\. /);
  });

  it("has the sections in order", () => {
    const headings = lines.filter((line) => line.startsWith("## "));
    expect(headings).toEqual([
      "## Product",
      "## Free tools",
      "## Integration guides",
      "## Blog",
      "## Optional",
    ]);
  });

  it("writes every entry as a Markdown link to an absolute address", () => {
    const entries = lines.filter((line) => line.startsWith("- "));
    expect(entries.length).toBeGreaterThan(10);
    for (const entry of entries) {
      expect(entry).toMatch(/^- \[[^\]]+\]\(https:\/\/www\.repget\.com\/[^)]*\)(: .+)?$/);
    }
  });

  it("lists every free tool, integration guide and published post", () => {
    for (const tool of TOOLS) expect(file).toContain(`(${SITE}${tool.href}): ${tool.blurb}`);
    for (const doc of INTEGRATION_DOCS) expect(file).toContain(`(${SITE}/docs/integrations/${doc.slug})`);
    expect(file).toContain(`- [Ghost vs WordPress](${SITE}/blog/ghost-vs-wordpress): Which one fits a small business.`);
  });

  it("leaves out the pages whose link-exchange wording is being rewritten", () => {
    expect(file).not.toContain("/backlink-exchange");
    expect(file).not.toContain("/publishers");
  });

  it("escapes brackets in a title and keeps each note on one line", () => {
    const built = buildSiteLlmsTxt(SITE, [
      { slug: "x", title: "SEO [2026] guide", description: "first line\nsecond line" },
    ]);
    expect(built).toContain(`- [SEO \\[2026\\] guide](${SITE}/blog/x): first line second line`);
  });

  it("still serves the rest of the file when there are no posts", () => {
    const built = buildSiteLlmsTxt(SITE, []);
    expect(built).toContain("## Blog");
    expect(built).toContain(`- [Blog](${SITE}/blog): `);
  });
});

describe("PAGE_NOTES", () => {
  /**
   * These notes are copies of each page's meta description. A page whose
   * description changes must change here too, or the file would describe a
   * page differently from the page itself.
   */
  const root = path.resolve(__dirname, "../app/(marketing)");
  it.each(Object.entries(PAGE_NOTES))("%s matches its page's own description", (route, note) => {
    const page = readFileSync(path.join(root, route, "page.tsx"), "utf8");
    expect(page).toContain(JSON.stringify(note));
  });
});
