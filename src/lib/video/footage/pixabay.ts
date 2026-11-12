import { FOOTAGE_LIMITS, type StockCandidate, type StockProvider, type StockSearch } from "./types";

/**
 * Pixabay (https://pixabay.com/api/docs/, checked 2026-11-12): free API key
 * (PIXABAY_API_KEY); 100 requests per 60 s per key; "requests must be cached
 * for 24 hours"; "permanent hotlinking of images is not allowed" (videos may
 * be embedded but storing them is recommended) - so RepGet downloads the
 * chosen file to its own storage and searches are cached for 24 h
 * (footage/index.ts). Show users where the media comes from when search
 * results are displayed (RepGet displays none; each video keeps its credit).
 * Content License (https://pixabay.com/service/license-summary/): free to
 * use and modify, no attribution required; not sold or distributed
 * standalone, not misleading or deceptive, recognisable people never in an
 * immoral or illegal way, no trademarks used commercially.
 */

export const PIXABAY_LICENCE = "Pixabay Content License (https://pixabay.com/service/license-summary/)";

type PixabayRendition = { url: string; width: number; height: number; size: number };
type PixabayVideoHit = {
  id: number;
  pageURL: string;
  tags?: string;
  duration?: number;
  user?: string;
  videos?: Partial<Record<"large" | "medium" | "small" | "tiny", PixabayRendition>>;
};
type PixabayImageHit = { id: number; pageURL: string; tags?: string; user?: string; largeImageURL?: string; imageWidth?: number; imageHeight?: number; imageSize?: number };

function key(): string | null {
  return process.env.PIXABAY_API_KEY?.trim() || null;
}

/** The rendition to download: the smallest one whose short side is at least 720 px (1080 preferred) and under the size limit. */
export function pixabayRendition(videos: PixabayVideoHit["videos"]): PixabayRendition | null {
  const all = (["tiny", "small", "medium", "large"] as const)
    .map((name) => videos?.[name])
    .filter((r): r is PixabayRendition => Boolean(r?.url) && (r?.width ?? 0) > 0 && (r?.size ?? 0) <= FOOTAGE_LIMITS.maxBytes);
  const shortSide = (r: PixabayRendition) => Math.min(r.width, r.height);
  return all.find((r) => shortSide(r) >= 1080) ?? all.find((r) => shortSide(r) >= FOOTAGE_LIMITS.minShortSide) ?? null;
}

export function parsePixabayVideos(json: unknown): StockCandidate[] {
  const hits = ((json as { hits?: PixabayVideoHit[] })?.hits ?? []).filter((hit) => hit && typeof hit.id === "number");
  return hits.flatMap((hit) => {
    const rendition = pixabayRendition(hit.videos);
    if (!rendition) return [];
    return [
      {
        provider: "pixabay",
        providerId: String(hit.id),
        kind: "video" as const,
        downloadUrl: rendition.url,
        width: rendition.width,
        height: rendition.height,
        durationMs: typeof hit.duration === "number" ? hit.duration * 1000 : null,
        sizeBytes: rendition.size || null,
        licence: PIXABAY_LICENCE,
        sourceUrl: hit.pageURL,
        author: hit.user ?? null,
        tags: (hit.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
      },
    ];
  });
}

export function parsePixabayImages(json: unknown): StockCandidate[] {
  const hits = ((json as { hits?: PixabayImageHit[] })?.hits ?? []).filter((hit) => hit && typeof hit.id === "number" && hit.largeImageURL);
  return hits.map((hit) => {
    // largeImageURL is scaled to 1280 px on its long side.
    const w = hit.imageWidth ?? 0;
    const h = hit.imageHeight ?? 0;
    const scale = Math.max(w, h) > 1280 ? 1280 / Math.max(w, h) : 1;
    return {
      provider: "pixabay",
      providerId: String(hit.id),
      kind: "image" as const,
      downloadUrl: hit.largeImageURL!,
      width: Math.round(w * scale),
      height: Math.round(h * scale),
      durationMs: null,
      sizeBytes: null,
      licence: PIXABAY_LICENCE,
      sourceUrl: hit.pageURL,
      author: hit.user ?? null,
      tags: (hit.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    };
  });
}

export const pixabay: StockProvider = {
  id: "pixabay",
  free: true,
  configured: () => key() !== null,
  async search(search: StockSearch, fetcher: typeof fetch = fetch): Promise<StockCandidate[]> {
    const apiKey = key();
    if (!apiKey) return [];
    const params = new URLSearchParams({
      key: apiKey,
      q: search.query.slice(0, 100),
      safesearch: "true",
      per_page: String(Math.min(30, Math.max(3, search.perPage ?? 15))),
      lang: "en",
    });
    if (search.kind === "video") params.set("video_type", "film");
    else {
      params.set("image_type", "photo");
      params.set("orientation", "vertical");
    }
    const url = search.kind === "video" ? `https://pixabay.com/api/videos/?${params}` : `https://pixabay.com/api/?${params}`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(FOOTAGE_LIMITS.searchTimeoutMs) });
    if (response.status === 429) throw new Error("Pixabay's rate limit was reached; try again in a minute");
    if (!response.ok) throw new Error(`Pixabay search failed (${response.status})`);
    const json = await response.json();
    return search.kind === "video" ? parsePixabayVideos(json) : parsePixabayImages(json);
  },
};
