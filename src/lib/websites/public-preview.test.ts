import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The homepage field's suggestion (lib/websites/public-preview.ts) and the
 * card it builds (lib/websites/site-card.ts): what is read from a homepage,
 * that every fetch goes through the free tools' guard, and what is
 * remembered. The guard itself is tested in lib/tools/public-guard.test.ts.
 */

const guard = vi.hoisted(() => ({
  refuse: false,
  calls: [] as { tool: string; site: string; visitor: string }[],
}));
vi.mock("@/lib/tools/public-guard", () => ({
  guardPublicTool: vi.fn(async (options: { tool: string; site: string; visitor: string; run: () => Promise<unknown> }) => {
    guard.calls.push({ tool: options.tool, site: options.site, visitor: options.visitor });
    if (guard.refuse) return { ok: false, refusal: { kind: "rate_limited", message: "Slow down" } };
    return { ok: true, value: await options.run() };
  }),
}));
const crawl = vi.hoisted(() => ({ fetchHomepage: vi.fn() }));
vi.mock("@/lib/websites/crawl", () => crawl);
const icons = vi.hoisted(() => ({ iconData: vi.fn() }));
vi.mock("@/lib/websites/site-icon-data", () => icons);

import { forgetPreviews, publicSitePreview } from "./public-preview";
import { nameFromTitle, siteCard, taglineFromTitle } from "./site-card";

const page = (overrides: Record<string, unknown> = {}) => ({
  title: "Image Studio | Photo & Film Production in Milan",
  ogSiteName: null,
  metaDescription: "Wedding photography and films.",
  faviconUrl: "https://imagestudio.com/apple-touch-icon.png",
  lang: "en-US",
  platformSignals: ["/wp-content/themes/x/style.css"],
  images: [],
  generator: null,
  ...overrides,
});

beforeEach(() => {
  forgetPreviews();
  guard.refuse = false;
  guard.calls = [];
  crawl.fetchHomepage.mockReset();
  icons.iconData.mockReset();
  icons.iconData.mockResolvedValue(null);
});

describe("siteCard", () => {
  it("names the business from the title and describes it with the title's tagline", () => {
    expect(nameFromTitle("Image Studio | Photo & Film Production in Milan")).toBe("Image Studio");
    expect(taglineFromTitle("Image Studio | Photo & Film Production in Milan")).toBe("Photo & Film Production in Milan");
    expect(taglineFromTitle("Image Studio")).toBeNull();
    expect(siteCard(page(), "imagestudio.com", "WordPress")).toEqual({
      domain: "imagestudio.com",
      name: "Image Studio",
      description: "Photo & Film Production in Milan",
      faviconUrl: "https://imagestudio.com/apple-touch-icon.png",
      faviconTone: null,
      platform: "WordPress",
      language: "en",
    });
  });

  it("prefers og:site_name, falls back to the description and then to the address", () => {
    expect(siteCard(page({ ogSiteName: "Imagestudio", title: "Imagestudio" }), "imagestudio.com", null)).toMatchObject({
      name: "Imagestudio",
      description: "Wedding photography and films.",
    });
    expect(siteCard(page({ title: null, metaDescription: null }), "acme.com", null)).toMatchObject({ name: "acme.com", description: null });
  });

  it("keeps an HTTPS icon only, and cuts a long description to one line", () => {
    expect(siteCard(page({ faviconUrl: "http://acme.com/favicon.png" }), "acme.com", null).faviconUrl).toBeNull();
    expect(siteCard(page({ faviconUrl: "not a url" }), "acme.com", null).faviconUrl).toBeNull();
    const long = siteCard(page({ title: null, metaDescription: "word ".repeat(80) }), "acme.com", null).description!;
    expect(long.length).toBeLessThanOrEqual(140);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("publicSitePreview", () => {
  it("reads the homepage through the free tools' guard, as the visitor", async () => {
    crawl.fetchHomepage.mockResolvedValue(page());
    const card = await publicSitePreview("https://www.imagestudio.com/", "visitor-1");
    expect(card).toMatchObject({ name: "Image Studio", platform: "WordPress" });
    expect(guard.calls).toEqual([{ tool: "preview", site: "imagestudio.com", visitor: "visitor-1" }]);
    expect(crawl.fetchHomepage).toHaveBeenCalledTimes(1);
  });

  it("sends the icon our server read, marked when it is white; the site's own address when it could not be read", async () => {
    crawl.fetchHomepage.mockResolvedValue(page());
    icons.iconData.mockResolvedValueOnce({ dataUrl: "data:image/png;base64,AAAA", tone: "light" });
    expect(await publicSitePreview("imagestudio.com", "visitor-1")).toMatchObject({ faviconUrl: "data:image/png;base64,AAAA", faviconTone: "light" });
    expect(icons.iconData).toHaveBeenCalledWith("https://imagestudio.com/apple-touch-icon.png");
    forgetPreviews();
    expect(await publicSitePreview("imagestudio.com", "visitor-1")).toMatchObject({ faviconUrl: "https://imagestudio.com/apple-touch-icon.png", faviconTone: null });
    forgetPreviews();
    icons.iconData.mockClear();
    crawl.fetchHomepage.mockResolvedValue(page({ faviconUrl: null }));
    expect(await publicSitePreview("imagestudio.com", "visitor-1")).toMatchObject({ faviconUrl: null });
    expect(icons.iconData).not.toHaveBeenCalled();
  });

  it("answers the same site again from memory, without counting or fetching", async () => {
    crawl.fetchHomepage.mockResolvedValue(page());
    await publicSitePreview("imagestudio.com", "visitor-1");
    await publicSitePreview("imagestudio.com", "visitor-2");
    expect(guard.calls).toHaveLength(1);
    expect(crawl.fetchHomepage).toHaveBeenCalledTimes(1);
  });

  it("returns nothing for an address that is not one, without fetching", async () => {
    expect(await publicSitePreview("not a website", "visitor-1")).toBeNull();
    expect(await publicSitePreview("http://127.0.0.1", "visitor-1")).toBeNull();
    expect(guard.calls).toEqual([]);
  });

  it("returns nothing when the site cannot be read, and remembers that", async () => {
    crawl.fetchHomepage.mockRejectedValue(new Error("timeout"));
    expect(await publicSitePreview("slow.example", "visitor-1")).toBeNull();
    expect(await publicSitePreview("slow.example", "visitor-1")).toBeNull();
    expect(crawl.fetchHomepage).toHaveBeenCalledTimes(1);
  });

  it("does not remember a refusal: the next keystroke may be let through", async () => {
    guard.refuse = true;
    expect(await publicSitePreview("imagestudio.com", "visitor-1")).toBeNull();
    guard.refuse = false;
    crawl.fetchHomepage.mockResolvedValue(page());
    expect(await publicSitePreview("imagestudio.com", "visitor-1")).toMatchObject({ name: "Image Studio" });
  });
});
