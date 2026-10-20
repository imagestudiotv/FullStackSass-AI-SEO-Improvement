import { describe, expect, it, vi } from "vitest";

/**
 * The website's own photographs in what is sent (lib/sites/library-media.ts)
 * and the media lookup a direct WordPress connection makes before pointing a
 * post's cover at one (lib/publishing/wordpress.ts findMedia).
 */

const net = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/net/safe-fetch", async (original) => ({
  ...(await original<typeof import("@/lib/net/safe-fetch")>()),
  safeFetch: net.fetch,
}));
vi.mock("@/lib/websites/url", async (original) => ({
  ...(await original<typeof import("@/lib/websites/url")>()),
  isPublicWebsiteUrl: () => true,
}));

import { findMedia } from "@/lib/publishing/wordpress";
import { pointAtCopies } from "@/lib/publishing/picture-copies";

import { ownCopies, pictureAddresses, sameAddress } from "./library-media";

const SITE = "https://studio.test/wp-content/uploads/2024/05/";
const credentials = { siteUrl: "https://studio.test", username: "editor", applicationPassword: "placeholder" };

describe("the site's own photographs in an article", () => {
  const html = `<p>A</p><img src="${SITE}boat.jpg" alt="Boat"><img src="https://elsewhere.test/x.jpg" alt=""><img src="${SITE}boat.jpg" alt="Again">`;

  it("are found by address, each once, and only those the library has", () => {
    expect(pictureAddresses(html)).toEqual([`${SITE}boat.jpg`, "https://elsewhere.test/x.jpg"]);
    expect(ownCopies(html, new Map([[`${SITE}boat.jpg`, 512]]))).toEqual({ [`${SITE}boat.jpg`]: { id: "512", url: `${SITE}boat.jpg` } });
    expect(pictureAddresses("<p>No pictures</p>")).toEqual([]);
  });

  it("keep their address and gain WordPress's class for their attachment", () => {
    const out = pointAtCopies(html, ownCopies(html, new Map([[`${SITE}boat.jpg`, 512]])), { wordpress: true });
    expect(out.match(/class="wp-image-512"/g)).toHaveLength(2);
    expect(out).toContain(`src="${SITE}boat.jpg"`);
    expect(out).toMatch(/<img src="https:\/\/elsewhere\.test\/x\.jpg" alt="">/);
  });

  it("are the same picture whatever the scheme or letter case", () => {
    expect(sameAddress(`${SITE}boat.jpg`, `${SITE.replace("https:", "http:")}Boat.JPG`)).toBe(true);
    expect(sameAddress(`${SITE}boat.jpg`, `${SITE}boat-1.jpg`)).toBe(false);
    expect(sameAddress("", "")).toBe(false);
  });
});

describe("a media lookup on a direct WordPress connection", () => {
  const answer = (status: number, body: unknown) =>
    net.fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

  it("gives the picture's address", async () => {
    answer(200, { id: 512, source_url: `${SITE}boat.jpg`, media_type: "image" });
    await expect(findMedia(credentials, 512)).resolves.toEqual({ id: 512, url: `${SITE}boat.jpg` });
    expect(String(net.fetch.mock.calls.at(-1)?.[0])).toBe("https://studio.test/wp-json/wp/v2/media/512?_fields=id,source_url,media_type");
  });

  it("is none for a picture the site does not have, or an item that is not a picture", async () => {
    answer(404, { code: "rest_post_invalid_id", message: "Invalid post ID." });
    await expect(findMedia(credentials, 512)).resolves.toBeNull();
    answer(200, { id: 9, source_url: `${SITE}brochure.pdf`, media_type: "file" });
    await expect(findMedia(credentials, 9)).resolves.toBeNull();
    await expect(findMedia(credentials, 0)).resolves.toBeNull();
  });

  it("throws for any other failure, as every request does", async () => {
    answer(500, { message: "Database error" });
    await expect(findMedia(credentials, 512)).rejects.toThrow("Database error");
  });
});
