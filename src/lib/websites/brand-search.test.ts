import { describe, expect, it, vi } from "vitest";

import { brandMatches, brandQuery, brandSearchClientId, searchBrands } from "./brand-search";

/**
 * Companies under the homepage field as a name is typed (Daniel, 2026-11-19,
 * after explee.com), from Brandfetch's Brand Search, asked by the browser.
 */

describe("brandQuery", () => {
  it("searches a typed name as it is, and an address by its name part", () => {
    expect(brandQuery("imagestu")).toBe("imagestu");
    expect(brandQuery("Image Studio")).toBe("image studio");
    expect(brandQuery("imagestudio.com")).toBe("imagestudio");
    expect(brandQuery("https://www.imagestudio.com/about?x=1")).toBe("imagestudio");
    expect(brandQuery("imagestudio.com.br")).toBe("imagestudio");
  });

  it("waits for two letters", () => {
    expect(brandQuery("")).toBeNull();
    expect(brandQuery(" i ")).toBeNull();
    expect(brandQuery("www.")).toBeNull();
  });
});

describe("brandMatches", () => {
  it("keeps name, domain and logo, each domain once, at most five", () => {
    const body = [
      { name: "Imagestudio", domain: "imagestudio.com", icon: "https://cdn.brandfetch.io/id_1/icon.webp?c=x", claimed: true, brandId: "id_1" },
      { name: "Imagestudio", domain: "imagestudio.com.br", icon: null },
      { name: "Dup", domain: "IMAGESTUDIO.COM" },
      { name: "", domain: "nameless.io", icon: "http://insecure.example/icon.png" },
      { name: "Bad", domain: "not a domain" },
      null,
      "junk",
      { name: "A", domain: "a.com" },
      { name: "B", domain: "b.com" },
      { name: "C", domain: "c.com" },
    ];
    expect(brandMatches(body)).toEqual([
      { name: "Imagestudio", domain: "imagestudio.com", icon: "https://cdn.brandfetch.io/id_1/icon.webp?c=x" },
      { name: "Imagestudio", domain: "imagestudio.com.br", icon: null },
      { name: "nameless.io", domain: "nameless.io", icon: null },
      { name: "A", domain: "a.com", icon: null },
      { name: "B", domain: "b.com", icon: null },
    ]);
  });

  it("reads anything that is not a list as no matches", () => {
    expect(brandMatches({ message: "client_id_required" })).toEqual([]);
    expect(brandMatches(null)).toEqual([]);
  });
});

describe("searchBrands", () => {
  it("asks Brandfetch with the public client ID, without cookies", async () => {
    const fetcher = vi.fn(async () => Response.json([{ name: "Imagestudio", domain: "imagestudio.com" }]));
    expect(await searchBrands("image studio", "client-1", undefined, fetcher as never)).toEqual([
      { name: "Imagestudio", domain: "imagestudio.com", icon: null },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.brandfetch.io/v2/search/image%20studio?c=client-1",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("answers no matches on a refusal, a quota or a network error", async () => {
    expect(await searchBrands("x1", "c", undefined, vi.fn(async () => new Response("{}", { status: 429 })) as never)).toEqual([]);
    expect(await searchBrands("x1", "c", undefined, vi.fn(async () => Promise.reject(new TypeError("offline"))) as never)).toEqual([]);
  });
});

describe("brandSearchClientId", () => {
  it("is off while unset", () => {
    expect(brandSearchClientId(undefined)).toBeNull();
    expect(brandSearchClientId("  ")).toBeNull();
    expect(brandSearchClientId(" abc ")).toBe("abc");
  });
});
