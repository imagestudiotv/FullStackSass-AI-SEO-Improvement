import { describe, expect, it } from "vitest";

import { adsenseConfig, adsenseScriptUrl, isBlogPath } from "./adsense-config";

describe("adsenseConfig", () => {
  it("is off without a valid publisher id, and ignores malformed unit ids", () => {
    expect(adsenseConfig({}).client).toBeNull();
    expect(adsenseConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "pub-8510275614015789" }).client).toBeNull();
    expect(adsenseConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-8510275614015789", NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP: "12345678", NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END: "x1" })).toEqual({
      client: "ca-pub-8510275614015789",
      slots: { top: "12345678", end: null },
    });
    expect(adsenseScriptUrl("ca-pub-8510275614015789")).toBe("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8510275614015789");
  });
});

describe("isBlogPath", () => {
  it("matches the blog's pages, in English or another language, and nothing else", () => {
    for (const path of ["/blog", "/blog/", "/blog/seo-guide", "/it/blog/guida-seo", "/es/blog", "/blog/category/guides"]) expect(isBlogPath(path), path).toBe(true);
    for (const path of ["/", "/pricing", "/blogger", "/dashboard", "/websites/x/blog/y", "/growth-plan"]) expect(isBlogPath(path), path).toBe(false);
  });
});
