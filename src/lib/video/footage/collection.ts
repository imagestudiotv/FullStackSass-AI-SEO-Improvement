import { FOOTAGE_LIMITS, type StockCandidate, type StockProvider, type StockSearch } from "./types";

/**
 * A licensed collection an admin supplies (VIDEO_FOOTAGE_COLLECTION: an
 * https URL or a file path to a JSON manifest) - footage RepGet has licensed
 * elsewhere, never scraped. The manifest:
 *
 *   { "licence": "Default licence text and URL",
 *     "items": [{ "id": "c1", "url": "https://...mp4", "kind": "video",
 *                 "width": 1080, "height": 1920, "durationMs": 8000,
 *                 "tags": ["office", "laptop"], "sourceUrl": "...",
 *                 "author": "...", "licence": "...", "costUsd": 0 }] }
 *
 * Items without a costUsd are recorded as unmeasured (never as free).
 */

export type CollectionItem = {
  id: string;
  url: string;
  kind: "video" | "image";
  width: number;
  height: number;
  durationMs?: number | null;
  tags: string[];
  sourceUrl?: string | null;
  author?: string | null;
  licence?: string | null;
  costUsd?: number | null;
};

export type CollectionManifest = { licence: string; items: CollectionItem[] };

let cached: { at: number; manifest: CollectionManifest } | null = null;

function location(): string | null {
  return process.env.VIDEO_FOOTAGE_COLLECTION?.trim() || null;
}

export function parseManifest(json: unknown): CollectionManifest {
  const raw = json as Partial<CollectionManifest> | null;
  const licence = typeof raw?.licence === "string" ? raw.licence : "";
  const items = (Array.isArray(raw?.items) ? raw!.items : []).filter(
    (item): item is CollectionItem =>
      Boolean(item && typeof item.id === "string" && typeof item.url === "string" && /^https:\/\//.test(item.url) && (item.kind === "video" || item.kind === "image")),
  );
  // An item without any licence text is not used: the record must say what allows it.
  return { licence, items: items.filter((item) => Boolean(item.licence || licence)) };
}

async function manifest(fetcher: typeof fetch): Promise<CollectionManifest> {
  const where = location();
  if (!where) return { licence: "", items: [] };
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.manifest;
  let json: unknown;
  if (/^https:\/\//.test(where)) {
    const response = await fetcher(where, { signal: AbortSignal.timeout(FOOTAGE_LIMITS.searchTimeoutMs) });
    if (!response.ok) throw new Error(`The footage collection could not be read (${response.status})`);
    json = await response.json();
  } else {
    const { readFile } = await import("node:fs/promises");
    json = JSON.parse(await readFile(where, "utf8"));
  }
  const parsed = parseManifest(json);
  cached = { at: Date.now(), manifest: parsed };
  return parsed;
}

/** Items whose tags share words with the query, best match first. */
export function matchCollection(collection: CollectionManifest, search: StockSearch): StockCandidate[] {
  const words = new Set(search.query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  return collection.items
    .filter((item) => item.kind === search.kind)
    .map((item) => ({ item, hits: item.tags.filter((tag) => tag.toLowerCase().split(/\s+/).some((word) => words.has(word))).length }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(({ item }) => ({
      provider: "collection",
      providerId: item.id,
      kind: item.kind,
      downloadUrl: item.url,
      width: item.width,
      height: item.height,
      durationMs: item.durationMs ?? null,
      sizeBytes: null,
      licence: item.licence || collection.licence,
      sourceUrl: item.sourceUrl ?? item.url,
      author: item.author ?? null,
      tags: item.tags,
    }));
}

/** The per-use cost an item's manifest states (null = unknown). */
export async function collectionCost(providerId: string, fetcher: typeof fetch = fetch): Promise<number | null> {
  const item = (await manifest(fetcher)).items.find((entry) => entry.id === providerId);
  return typeof item?.costUsd === "number" ? item.costUsd : null;
}

export const collection: StockProvider = {
  id: "collection",
  free: false,
  configured: () => location() !== null,
  async search(search: StockSearch, fetcher: typeof fetch = fetch): Promise<StockCandidate[]> {
    if (!location()) return [];
    return matchCollection(await manifest(fetcher), search);
  },
};
