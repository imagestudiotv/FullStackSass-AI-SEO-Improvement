import { collection } from "./collection";
import { pexels } from "./pexels";
import { pixabay } from "./pixabay";
import type { StockCandidate, StockProvider, StockSearch } from "./types";

export { bestCandidate, candidateScore, FOOTAGE_LIMITS } from "./types";
export type { StockCandidate, StockProvider, StockSearch } from "./types";

/**
 * The stock providers, in the order they are asked: the admin's licensed
 * collection first (chosen footage), then Pixabay, then Pexels. Only the
 * configured ones are ever called; with none configured there is no network
 * call at all and footageStatus() says what setup is missing.
 */
export const STOCK_PROVIDERS: readonly StockProvider[] = [collection, pixabay, pexels];

export function configuredProviders(providers: readonly StockProvider[] = STOCK_PROVIDERS): StockProvider[] {
  return providers.filter((provider) => provider.configured());
}

export type FootageStatus = { configured: boolean; providers: string[]; message: string };

/** Whether stock footage can be used, for the job and the Videos page ("stock footage needs setup"). */
export function footageStatus(providers: readonly StockProvider[] = STOCK_PROVIDERS): FootageStatus {
  const ready = configuredProviders(providers).map((provider) => provider.id);
  if (ready.length) return { configured: true, providers: ready, message: `Stock footage from ${ready.join(", ")}.` };
  return {
    configured: false,
    providers: [],
    message:
      "Stock footage needs setup: add a Pixabay API key (PIXABAY_API_KEY), an existing Pexels key (PEXELS_API_KEY) or a licensed collection (VIDEO_FOOTAGE_COLLECTION). Until then videos use the customer's media, the article's pictures and original AI images.",
  };
}

/**
 * Searches are kept 24 hours (Pixabay: "requests must be cached for 24
 * hours"), per server instance: the same query asked again within a day is
 * not sent again.
 */
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const searches = new Map<string, { at: number; results: StockCandidate[] }>();

export async function searchProvider(provider: StockProvider, search: StockSearch, fetcher: typeof fetch = fetch, now = Date.now()): Promise<StockCandidate[]> {
  if (!provider.configured()) return [];
  const key = `${provider.id}|${search.kind}|${search.query.trim().toLowerCase()}`;
  const hit = searches.get(key);
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.results;
  const results = await provider.search(search, fetcher);
  searches.set(key, { at: now, results });
  if (searches.size > 500) {
    for (const [k, value] of searches) if (now - value.at >= SEARCH_TTL_MS) searches.delete(k);
  }
  return results;
}

/** For tests. */
export function clearSearchCache(): void {
  searches.clear();
}
