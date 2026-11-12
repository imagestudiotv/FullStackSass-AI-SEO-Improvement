import { FOOTAGE_LIMITS, type StockCandidate, type StockProvider, type StockSearch } from "./types";

/**
 * Pexels (https://www.pexels.com/api/documentation/, checked 2026-11-12):
 * free, 200 requests an hour and 20,000 a month by default, key in the
 * Authorization header (PEXELS_API_KEY). NOTE: the Pexels API page said on
 * 2026-11-12 that new API key issuance is currently paused - this adapter
 * only helps where a key already exists. Guidelines: show a prominent link to
 * Pexels and credit the creator where possible ("Video by X on Pexels") -
 * each asset keeps its author and page for the credit. Pexels License
 * (https://www.pexels.com/license/): free for commercial use, modification
 * allowed; not sold unaltered, identifiable people not shown in a bad light
 * or implying endorsement.
 */

export const PEXELS_LICENCE = "Pexels License (https://www.pexels.com/license/)";

type PexelsVideoFile = { id: number; quality?: string | null; file_type?: string; width?: number | null; height?: number | null; link: string; size?: number };
type PexelsVideo = { id: number; width: number; height: number; url: string; duration?: number; user?: { name?: string; url?: string }; video_files?: PexelsVideoFile[]; tags?: string[] };
type PexelsPhoto = { id: number; width: number; height: number; url: string; photographer?: string; alt?: string; src?: { original?: string; large2x?: string; portrait?: string } };

function key(): string | null {
  return process.env.PEXELS_API_KEY?.trim() || null;
}

/** The MP4 to download: the smallest whose short side is >= 1080 (else >= 720). */
export function pexelsFile(files: PexelsVideoFile[] | undefined): PexelsVideoFile | null {
  const mp4 = (files ?? []).filter((file) => file.link && (file.file_type ?? "video/mp4") === "video/mp4" && (file.width ?? 0) > 0 && (file.height ?? 0) > 0);
  const shortSide = (file: PexelsVideoFile) => Math.min(file.width!, file.height!);
  mp4.sort((a, b) => shortSide(a) - shortSide(b));
  return mp4.find((file) => shortSide(file) >= 1080 && shortSide(file) <= 1440) ?? mp4.find((file) => shortSide(file) >= FOOTAGE_LIMITS.minShortSide) ?? null;
}

export function parsePexelsVideos(json: unknown): StockCandidate[] {
  const videos = ((json as { videos?: PexelsVideo[] })?.videos ?? []).filter((video) => video && typeof video.id === "number");
  return videos.flatMap((video) => {
    const file = pexelsFile(video.video_files);
    if (!file) return [];
    return [
      {
        provider: "pexels",
        providerId: String(video.id),
        kind: "video" as const,
        downloadUrl: file.link,
        width: file.width!,
        height: file.height!,
        durationMs: typeof video.duration === "number" ? video.duration * 1000 : null,
        sizeBytes: typeof file.size === "number" ? file.size : null,
        licence: PEXELS_LICENCE,
        sourceUrl: video.url,
        author: video.user?.name ?? null,
        tags: video.tags ?? [],
      },
    ];
  });
}

export function parsePexelsPhotos(json: unknown): StockCandidate[] {
  const photos = ((json as { photos?: PexelsPhoto[] })?.photos ?? []).filter((photo) => photo && typeof photo.id === "number" && photo.src?.original);
  return photos.map((photo) => ({
    provider: "pexels",
    providerId: String(photo.id),
    kind: "image" as const,
    // A 1080x1920 crop from Pexels' own image service, instead of the multi-megabyte original.
    downloadUrl: `${photo.src!.original}?auto=compress&cs=tinysrgb&fit=crop&w=1080&h=1920`,
    width: 1080,
    height: 1920,
    durationMs: null,
    sizeBytes: null,
    licence: PEXELS_LICENCE,
    sourceUrl: photo.url,
    author: photo.photographer ?? null,
    tags: photo.alt ? [photo.alt] : [],
  }));
}

export const pexels: StockProvider = {
  id: "pexels",
  free: true,
  configured: () => key() !== null,
  async search(search: StockSearch, fetcher: typeof fetch = fetch): Promise<StockCandidate[]> {
    const apiKey = key();
    if (!apiKey) return [];
    const params = new URLSearchParams({ query: search.query.slice(0, 100), orientation: "portrait", per_page: String(Math.min(30, Math.max(3, search.perPage ?? 15))) });
    if (search.kind === "video") params.set("size", "medium");
    const url = search.kind === "video" ? `https://api.pexels.com/v1/videos/search?${params}` : `https://api.pexels.com/v1/search?${params}`;
    const response = await fetcher(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(FOOTAGE_LIMITS.searchTimeoutMs) });
    if (response.status === 429) throw new Error("Pexels' rate limit was reached; try again later");
    if (!response.ok) throw new Error(`Pexels search failed (${response.status})`);
    const json = await response.json();
    return search.kind === "video" ? parsePexelsVideos(json) : parsePexelsPhotos(json);
  },
};
