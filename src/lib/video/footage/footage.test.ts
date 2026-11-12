import { afterEach, describe, expect, it, vi } from "vitest";

import { matchCollection, parseManifest } from "./collection";
import { bestCandidate, clearSearchCache, footageStatus, searchProvider, STOCK_PROVIDERS } from "./index";
import { parsePexelsPhotos, parsePexelsVideos } from "./pexels";
import { parsePixabayImages, parsePixabayVideos, pixabay } from "./pixabay";

/**
 * Stock providers, parsed from responses shaped as their documentation shows
 * (recorded, trimmed; no live calls): the right file chosen, the licence and
 * source kept, nothing called without a key.
 */

const PIXABAY_VIDEOS = {
  total: 2,
  totalHits: 2,
  hits: [
    {
      id: 125,
      pageURL: "https://pixabay.com/videos/id-125/",
      type: "film",
      tags: "barista, coffee, latte",
      duration: 12,
      user: "Coverr-Free-Footage",
      videos: {
        large: { url: "https://cdn.pixabay.com/video/125_large.mp4", width: 3840, height: 2160, size: 61_000_000, thumbnail: "" },
        medium: { url: "https://cdn.pixabay.com/video/125_medium.mp4", width: 1920, height: 1080, size: 9_000_000, thumbnail: "" },
        small: { url: "https://cdn.pixabay.com/video/125_small.mp4", width: 1280, height: 720, size: 4_000_000, thumbnail: "" },
        tiny: { url: "https://cdn.pixabay.com/video/125_tiny.mp4", width: 960, height: 540, size: 1_500_000, thumbnail: "" },
      },
    },
    { id: 126, pageURL: "https://pixabay.com/videos/id-126/", tags: "x", duration: 8, user: "u", videos: { tiny: { url: "https://cdn.pixabay.com/video/126_tiny.mp4", width: 640, height: 360, size: 500_000 } } },
  ],
};

const PEXELS_VIDEOS = {
  page: 1,
  per_page: 2,
  total_results: 1,
  videos: [
    {
      id: 857251,
      width: 1080,
      height: 1920,
      url: "https://www.pexels.com/video/857251/",
      duration: 9,
      user: { id: 1, name: "Jane Doe", url: "https://www.pexels.com/@jane" },
      video_files: [
        { id: 1, quality: "sd", file_type: "video/mp4", width: 540, height: 960, fps: 25, link: "https://videos.pexels.com/857251-sd.mp4" },
        { id: 2, quality: "hd", file_type: "video/mp4", width: 1080, height: 1920, fps: 25, link: "https://videos.pexels.com/857251-hd.mp4" },
        { id: 3, quality: "uhd", file_type: "video/mp4", width: 2160, height: 3840, fps: 25, link: "https://videos.pexels.com/857251-uhd.mp4" },
      ],
      video_pictures: [],
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  clearSearchCache();
});

describe("stock providers", () => {
  it("parses Pixabay videos: the smallest rendition with a 1080 short side under the size limit, with licence and source", () => {
    const [first, second] = parsePixabayVideos(PIXABAY_VIDEOS);
    expect(first).toMatchObject({
      provider: "pixabay",
      providerId: "125",
      kind: "video",
      downloadUrl: "https://cdn.pixabay.com/video/125_medium.mp4",
      width: 1920,
      height: 1080,
      durationMs: 12_000,
      sourceUrl: "https://pixabay.com/videos/id-125/",
      author: "Coverr-Free-Footage",
    });
    expect(first.licence).toMatch(/Pixabay Content License/);
    // Too small to use: dropped.
    expect(second).toBeUndefined();
  });

  it("parses Pixabay pictures at their 1280 px size", () => {
    const [image] = parsePixabayImages({ hits: [{ id: 9, pageURL: "https://pixabay.com/photos/id-9/", largeImageURL: "https://pixabay.com/get/9_1280.jpg", imageWidth: 3000, imageHeight: 4500, user: "ann", tags: "desk" }] });
    expect(image).toMatchObject({ kind: "image", width: 853, height: 1280, author: "ann" });
  });

  it("parses Pexels videos: the HD portrait file, the creator for the credit", () => {
    const [video] = parsePexelsVideos(PEXELS_VIDEOS);
    expect(video).toMatchObject({ provider: "pexels", providerId: "857251", downloadUrl: "https://videos.pexels.com/857251-hd.mp4", width: 1080, height: 1920, author: "Jane Doe" });
    expect(video.licence).toMatch(/Pexels License/);
    const [photo] = parsePexelsPhotos({ photos: [{ id: 5, width: 4000, height: 6000, url: "https://www.pexels.com/photo/5/", photographer: "Sam", src: { original: "https://images.pexels.com/5.jpeg" } }] });
    expect(photo.downloadUrl).toBe("https://images.pexels.com/5.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1080&h=1920");
  });

  it("prefers a vertical HD clip of a usable length", () => {
    const landscape = parsePixabayVideos(PIXABAY_VIDEOS)[0];
    const portrait = parsePexelsVideos(PEXELS_VIDEOS)[0];
    expect(bestCandidate([landscape, portrait])?.provider).toBe("pexels");
    expect(bestCandidate([landscape, portrait], new Set(["pexels:857251"]))?.provider).toBe("pixabay");
    expect(bestCandidate([{ ...portrait, durationMs: 1000 }])).toBeNull();
  });

  it("reads a licensed collection: items without https or a licence are dropped, matches by tags", () => {
    const manifest = parseManifest({
      licence: "Storyblocks subscription 2026 (https://example.com/licence)",
      items: [
        { id: "a", url: "https://files.example.com/a.mp4", kind: "video", width: 1080, height: 1920, durationMs: 8000, tags: ["coffee shop", "barista"] },
        { id: "b", url: "http://files.example.com/b.mp4", kind: "video", width: 1080, height: 1920, tags: ["coffee"] },
      ],
    });
    expect(manifest.items.map((item) => item.id)).toEqual(["a"]);
    expect(matchCollection(manifest, { query: "barista pouring latte", kind: "video" }).map((c) => c.providerId)).toEqual(["a"]);
    expect(matchCollection(manifest, { query: "mountain", kind: "video" })).toEqual([]);
  });

  it("makes no network call at all when no provider is configured, and says what setup is missing", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "");
    vi.stubEnv("PEXELS_API_KEY", "");
    vi.stubEnv("VIDEO_FOOTAGE_COLLECTION", "");
    const fetcher = vi.fn();
    const status = footageStatus();
    expect(status).toMatchObject({ configured: false, providers: [] });
    expect(status.message).toMatch(/Stock footage needs setup/);
    for (const provider of STOCK_PROVIDERS) expect(await searchProvider(provider, { query: "office", kind: "video" }, fetcher as never)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks Pixabay once per query a day (its 24-hour caching rule), with safe search on", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "test-key");
    const fetcher = vi.fn(async () => new Response(JSON.stringify(PIXABAY_VIDEOS), { status: 200 }));
    await searchProvider(pixabay, { query: "Coffee", kind: "video" }, fetcher as never);
    await searchProvider(pixabay, { query: "coffee", kind: "video" }, fetcher as never);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetcher.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe("https://pixabay.com/api/videos/");
    expect(url.searchParams.get("safesearch")).toBe("true");
    expect(footageStatus().providers).toEqual(["pixabay"]);
  });
});
