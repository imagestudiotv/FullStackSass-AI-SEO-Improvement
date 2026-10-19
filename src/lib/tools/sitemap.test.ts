import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Sitemap Checker: one file counted once however its address is spelled
 * (repget.com was reported as 2 sitemaps and 374 pages for 1 sitemap of 187,
 * 2026-10-19: robots.txt names the www address, the usual location was tried
 * without www and redirects to the same file), and a large index read in
 * part says so.
 */

/** The web, as the tool sees it: address -> [status, body, address it lands on]. */
const web = vi.hoisted(() => new Map<string, { status: number; body: string; landsOn?: string }>());
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: async (url: string) => {
    const hit = web.get(url) ?? { status: 404, body: "Not found" };
    const response = new Response(hit.body, { status: hit.status });
    Object.defineProperty(response, "url", { value: hit.landsOn ?? url });
    return response;
  },
}));
vi.mock("@/lib/tools/public-guard", () => ({
  guardedSiteTool: (_tool: string, _input: string, _visitor: string, run: () => Promise<unknown>) => run(),
}));

import { checkSitemap } from "./sitemap";

const urlset = (urls: string[]) => `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
const index = (maps: string[]) => `<?xml version="1.0"?><sitemapindex>${maps.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("")}</sitemapindex>`;
const pages = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `${prefix}/page-${i}`);

async function check(domain: string) {
  const outcome = await checkSitemap(domain, "visitor");
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

beforeEach(() => web.clear());

describe("the Sitemap Checker", () => {
  it("counts a site's sitemap once when robots.txt names its www address", async () => {
    web.set("https://example.com/robots.txt", { status: 200, body: "User-agent: *\nSitemap: https://www.example.com/sitemap.xml\n" });
    web.set("https://www.example.com/sitemap.xml", { status: 200, body: urlset(pages(187, "https://www.example.com")) });
    // The usual location without www: the same file, after a redirect.
    web.set("https://example.com/sitemap.xml", { status: 200, body: urlset(pages(187, "https://www.example.com")), landsOn: "https://www.example.com/sitemap.xml" });

    const result = await check("example.com");
    expect(result.found.filter((f) => f.ok).map((f) => f.url)).toEqual(["https://www.example.com/sitemap.xml"]);
    expect(result.totalUrls).toBe(187);
  });

  it("counts an index once when the usual location redirects to it, and reads its sitemaps", async () => {
    const children = ["post", "page", "product"].map((name) => `https://shop-example.org/${name}-sitemap.xml`);
    web.set("https://shop-example.org/robots.txt", { status: 200, body: "Sitemap: https://shop-example.org/sitemap_index.xml" });
    web.set("https://shop-example.org/sitemap_index.xml", { status: 200, body: index(children) });
    web.set("https://shop-example.org/sitemap.xml", { status: 200, body: index(children), landsOn: "https://shop-example.org/sitemap_index.xml" });
    children.forEach((child, i) => web.set(child, { status: 200, body: urlset(pages(10 * (i + 1), "https://shop-example.org")) }));

    const result = await check("shop-example.org");
    expect(result.found.filter((f) => f.ok)).toHaveLength(4);
    expect(result.totalUrls).toBe(60);
    expect(result.childSitemaps).toBe(3);
    expect(result.childSitemapsRead).toBe(3);
  });

  it("reads a typical index of ten sitemaps whole", async () => {
    const children = Array.from({ length: 10 }, (_, i) => `https://shop-example.org/part-${i}.xml`);
    web.set("https://shop-example.org/robots.txt", { status: 200, body: "Sitemap: https://shop-example.org/sitemap_index.xml" });
    web.set("https://shop-example.org/sitemap_index.xml", { status: 200, body: index(children) });
    for (const child of children) web.set(child, { status: 200, body: urlset(pages(5, child)) });

    const result = await check("shop-example.org");
    expect(result.childSitemapsRead).toBe(10);
    expect(result.totalUrls).toBe(50);
  });

  it("says how much of a larger index it read", async () => {
    const children = Array.from({ length: 30 }, (_, i) => `https://shop-example.org/part-${i}.xml`);
    web.set("https://shop-example.org/robots.txt", { status: 200, body: "Sitemap: https://shop-example.org/sitemap_index.xml" });
    web.set("https://shop-example.org/sitemap_index.xml", { status: 200, body: index(children) });
    for (const child of children) web.set(child, { status: 200, body: urlset(pages(5, child)) });

    const result = await check("shop-example.org");
    expect(result.childSitemaps).toBe(30);
    expect(result.childSitemapsRead).toBeLessThan(30);
    expect(result.totalUrls).toBe(5 * result.childSitemapsRead);
  });
});
