import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The site crawler behind the free SEO Score Checker, the llms.txt Generator
 * and customers' site audits. Addresses are stored without "www."
 * (lib/websites/url.ts) and most sites redirect that to www - or http to
 * https - so a crawl that only followed links on the address it started from
 * read one page of every such site (found on the live tools, 2026-10-19:
 * repget.com and python.org read 1 page, nextjs.org 12).
 */

const site = vi.hoisted(() => ({ pages: new Map<string, { finalUrl: string; links: string[] }>(), fetched: [] as string[] }));
vi.mock("@/lib/websites/crawl", () => {
  class CrawlError extends Error {
    constructor(
      message: string,
      readonly kind: string,
    ) {
      super(message);
    }
  }
  return {
    CrawlError,
    fetchHomepage: async (url: string) => {
      site.fetched.push(url);
      const page = site.pages.get(url);
      if (!page) throw new CrawlError("Returned 404", "http_error");
      return { finalUrl: page.finalUrl, internalUrls: page.links, title: page.finalUrl } as never;
    },
  };
});

import { crawlSite } from "./crawler";

/** A page at `url` that lands on `finalUrl` and links to `links`. */
function page(url: string, finalUrl: string, links: string[] = []) {
  site.pages.set(url, { finalUrl, links });
}

beforeEach(() => {
  site.pages.clear();
  site.fetched.length = 0;
});

describe("crawling a site", () => {
  it("follows a site whose address redirects to its www address, reading each page once", async () => {
    const www = "https://www.example.com";
    page("https://example.com/", `${www}/`, [`${www}/`, `${www}/pricing`, `${www}/blog`, "https://elsewhere.com/"]);
    page(`${www}/`, `${www}/`, [`${www}/pricing`]);
    page(`${www}/pricing`, `${www}/pricing`, [`${www}/blog`]);
    page(`${www}/blog`, `${www}/blog`, [`${www}/pricing`]);

    const result = await crawlSite("https://example.com", 5);
    expect(result.pages.map((p) => p.finalUrl)).toEqual([`${www}/`, `${www}/pricing`, `${www}/blog`]);
    expect(result.failures).toEqual([]);
    // The homepage, reached again by its www address, is not fetched twice; nothing elsewhere is fetched.
    expect(site.fetched).toEqual(["https://example.com/", `${www}/pricing`, `${www}/blog`]);
  });

  it("follows a site that redirects http to https", async () => {
    page("http://example.com/", "https://example.com/", ["https://example.com/about"]);
    page("https://example.com/about", "https://example.com/about");
    const result = await crawlSite("http://example.com", 5);
    expect(result.pages.map((p) => p.finalUrl)).toEqual(["https://example.com/", "https://example.com/about"]);
  });

  it("never follows a redirect to another site", async () => {
    page("https://example.com/", "https://another-site.com/", ["https://another-site.com/about"]);
    const result = await crawlSite("https://example.com", 5);
    expect(result.pages).toHaveLength(1);
    expect(site.fetched).toEqual(["https://example.com/"]);
  });

  it("does not move to a subdomain that is not just www", async () => {
    page("https://example.com/", "https://shop.example.com/", ["https://shop.example.com/cart"]);
    const result = await crawlSite("https://example.com", 5);
    expect(result.pages).toHaveLength(1);
    expect(site.fetched).toEqual(["https://example.com/"]);
  });

  it("reads a page reached by a redirect to one already read once, without calling it a failure", async () => {
    page("https://example.com/", "https://example.com/", ["https://example.com/old-about", "https://example.com/about"]);
    page("https://example.com/old-about", "https://example.com/about");
    page("https://example.com/about", "https://example.com/about");
    const result = await crawlSite("https://example.com", 5);
    expect(result.pages.map((p) => p.finalUrl)).toEqual(["https://example.com/", "https://example.com/about"]);
    expect(result.failures).toEqual([]);
  });

  it("still stops at the page limit", async () => {
    const links = Array.from({ length: 10 }, (_, i) => `https://www.example.com/p${i}`);
    page("https://example.com/", "https://www.example.com/", links);
    for (const link of links) page(link, link);
    const result = await crawlSite("https://example.com", 3);
    expect(result.pages).toHaveLength(3);
  });
});
