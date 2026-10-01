import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the crawler hands to platform detection (lib/audit/ai-crawlers.ts):
 * the generator meta tag ON ITS OWN, so only it is read as the site's
 * self-declaration - never an image path or a class name that happens to
 * start with a platform's name.
 */

const page = vi.hoisted(() => ({ html: "" }));
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async () => new Response(page.html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })),
}));

import { detectPlatform } from "@/lib/audit/ai-crawlers";

import { fetchHomepage } from "./crawl";

const platformOf = async () => {
  const snapshot = await fetchHomepage("https://site.example/", () => true);
  return {
    snapshot,
    platform: detectPlatform(
      [...snapshot.platformSignals, ...snapshot.images.map((image) => image.src), ...(snapshot.internalUrls ?? [])],
      snapshot.generator ?? null,
    ),
  };
};

beforeEach(() => {
  page.html = "";
});

describe("the generator meta tag", () => {
  it("is kept on its own, and a Joomla 4 site is recognised by it", async () => {
    page.html = `<html><head><meta name="generator" content="Joomla! - Open Source Content Management"><title>Studio</title></head>
      <body class="site com_content view-featured"><h1>Studio</h1><p>We make films.</p></body></html>`;
    const { snapshot, platform } = await platformOf();
    expect(snapshot.generator).toBe("Joomla! - Open Source Content Management");
    expect(platform).toBe("Joomla");
  });

  it("is null when the page has none", async () => {
    page.html = `<html><head><title>Studio</title></head><body><h1>Studio</h1><p>Hello there.</p></body></html>`;
    expect((await platformOf()).snapshot.generator).toBeNull();
  });

  it("an image named after a platform does not make the site that platform", async () => {
    page.html = `<html><head><title>Agency</title><script src="/_next/static/chunks/main.js"></script></head>
      <body class="ghost"><h1>We build on every platform</h1><p>Shopify, WordPress, Ghost.</p>
      <img src="shopify/logo.png" alt="Shopify"><img src="WordPress logo.png" alt="WordPress"></body></html>`;
    expect((await platformOf()).platform).toBe("Next.js");
  });
});
