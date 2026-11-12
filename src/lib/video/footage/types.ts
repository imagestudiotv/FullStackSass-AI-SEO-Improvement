/**
 * Stock footage providers (client, 2026-11-12: "prioritize commercially
 * licensed stock video, customers' own uploaded media and original
 * AI-generated visuals; avoid unlicensed movie clips, celebrity footage and
 * downloaded social videos"). Each adapter searches one provider's API; the
 * chosen file is then downloaded to RepGet's storage (providers forbid
 * permanent hotlinking) and recorded with its licence (footage/store.ts).
 * Never scraping: only documented APIs, or a licensed collection an admin
 * supplies.
 */

export type StockCandidate = {
  provider: string;
  providerId: string;
  kind: "video" | "image";
  /** The file to download (the provider's CDN), never stored as the video's URL. */
  downloadUrl: string;
  width: number;
  height: number;
  /** Clip length; null for a picture. */
  durationMs: number | null;
  /** Bytes when the provider says; null = unknown (the download is bounded anyway). */
  sizeBytes: number | null;
  licence: string;
  /** The provider's page for it (attribution and the record). */
  sourceUrl: string;
  author: string | null;
  tags: string[];
};

export type StockSearch = { query: string; kind: "video" | "image"; perPage?: number };

export interface StockProvider {
  id: string;
  /** Whether the provider is free to use (then a fetch is recorded as measured $0). */
  free: boolean;
  /** Whether its key/config is present. No network call is ever made when false. */
  configured(): boolean;
  search(search: StockSearch, fetcher?: typeof fetch): Promise<StockCandidate[]>;
}

/** Bounds on what a video may download (client: affordable, fast). */
export const FOOTAGE_LIMITS = {
  /** Stock files a video may download (cached ones are free to reuse). */
  maxAssetsPerVideo: 6,
  maxBytes: 40 * 1024 * 1024,
  searchTimeoutMs: 10_000,
  downloadTimeoutMs: 45_000,
  minClipMs: 4_000,
  maxClipMs: 20_000,
  /** Preferred: vertical HD. */
  minShortSide: 720,
} as const;

/**
 * How well a candidate suits a 9:16 reel: vertical HD first, a clip of 4-15 s,
 * a sensible file size. Landscape footage still works (cropped around its
 * focal point) but ranks lower.
 */
export function candidateScore(candidate: StockCandidate): number {
  const portrait = candidate.height >= candidate.width;
  const shortSide = Math.min(candidate.width, candidate.height);
  let score = 0;
  if (portrait) score += 50;
  if (shortSide >= FOOTAGE_LIMITS.minShortSide) score += 20;
  else score -= 30;
  if (candidate.kind === "video" && candidate.durationMs !== null) {
    if (candidate.durationMs < FOOTAGE_LIMITS.minClipMs || candidate.durationMs > FOOTAGE_LIMITS.maxClipMs * 3) score -= 100;
    else if (candidate.durationMs <= 15_000) score += 15;
  }
  if (candidate.sizeBytes !== null && candidate.sizeBytes > FOOTAGE_LIMITS.maxBytes) score -= 200;
  return score;
}

export function bestCandidate(candidates: StockCandidate[], exclude: Set<string> = new Set()): StockCandidate | null {
  const usable = candidates
    // A clip too short to hold a scene is never used.
    .filter((c) => !exclude.has(`${c.provider}:${c.providerId}`) && !(c.kind === "video" && c.durationMs !== null && c.durationMs < FOOTAGE_LIMITS.minClipMs))
    .map((c) => ({ c, score: candidateScore(c) }));
  usable.sort((a, b) => b.score - a.score);
  return usable[0] && usable[0].score > -50 ? usable[0].c : null;
}
