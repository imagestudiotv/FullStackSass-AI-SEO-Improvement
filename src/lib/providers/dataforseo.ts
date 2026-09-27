import { withCache } from "@/lib/providers/cache";
import type { SearchIntent } from "@/lib/keywords/score";

/**
 * DataForSEO client.
 *
 * Every call goes through the provider cache. Search volume and difficulty are
 * facts about the world that change monthly at most, so paying twice in a week
 * for the same query is money burned — and rank tracking later will be charged
 * PER KEYWORD PER CHECK, which is why check frequency, not plan size, is the
 * cost driver worth watching.
 *
 * Credentials are read at call time, never at import: the app must build and
 * run without them, and keyword research simply reports "not configured".
 */

const BASE_URL = "https://api.dataforseo.com/v3";

/** Requests are slow (multi-second); this bounds a hung one. */
const TIMEOUT_MS = 60_000;

export class DataForSeoError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    /** DataForSEO's own status code from the response body, e.g. 40204. */
    readonly apiStatusCode?: number,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }

  /**
   * True when DataForSEO provably refused the task, so nothing was charged:
   * rejected credentials, or an error status in the response body (access,
   * funds, validation). Read by classifySpendError (lib/billing/spend-quota.ts)
   * so such a refusal hands its spend reservation back. A timeout or a 5xx
   * is not provable and stays "ambiguous".
   */
  get notBilled(): boolean {
    if (this.statusCode === 401) return true;
    return typeof this.apiStatusCode === "number" && this.apiStatusCode >= 40000 && this.apiStatusCode < 50000;
  }
}

export function isDataForSeoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new DataForSeoError("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set");
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

/**
 * DataForSEO returns HTTP 200 with an error status INSIDE the body, and nests
 * real data three levels deep (tasks[0].result[]). Treating a 200 as success
 * would silently produce empty keyword sets instead of a visible failure.
 */
type TaskResponse<T> = {
  status_code: number;
  status_message: string;
  tasks?: Array<{
    status_code: number;
    status_message: string;
    result?: T[] | null;
  }>;
};

async function post<T>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: authHeader(),
        "content-type": "application/json",
      },
      // The API always takes an ARRAY of tasks, even for a single query.
      body: JSON.stringify([payload]),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new DataForSeoError("DataForSEO request timed out");
    }
    throw new DataForSeoError(
      error instanceof Error ? error.message : "DataForSEO request failed",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    throw new DataForSeoError("DataForSEO credentials rejected", 401);
  }
  if (!response.ok) {
    throw new DataForSeoError(
      `DataForSEO returned ${response.status}`,
      response.status,
    );
  }

  const body = (await response.json()) as TaskResponse<T>;

  // 20000 is DataForSEO's "Ok" code; anything else is a failure in a 200.
  if (body.status_code !== 20000) {
    throw new DataForSeoError(
      `DataForSEO error ${body.status_code}: ${body.status_message}`,
      undefined,
      body.status_code,
    );
  }

  const task = body.tasks?.[0];
  if (!task) return [];
  if (task.status_code !== 20000) {
    throw new DataForSeoError(
      `DataForSEO task error ${task.status_code}: ${task.status_message}`,
      undefined,
      task.status_code,
    );
  }

  return task.result ?? [];
}

export type KeywordMetrics = {
  term: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: SearchIntent | null;
  source: string;
};

/** Shape of the rows Labs endpoints return, as far as we consume them. */
type LabsKeywordItem = {
  keyword?: string;
  keyword_info?: {
    search_volume?: number | null;
    cpc?: number | null;
    competition?: number | null;
  };
  keyword_properties?: { keyword_difficulty?: number | null };
  search_intent_info?: { main_intent?: string | null };
};

/** DataForSEO's intent labels differ from ours; anything else is dropped. */
function mapIntent(value: string | null | undefined): SearchIntent | null {
  switch (value) {
    case "transactional":
      return "transactional";
    case "commercial":
      return "commercial";
    case "informational":
      return "informational";
    case "navigational":
      return "navigational";
    default:
      return null;
  }
}

function mapItem(item: LabsKeywordItem, source: string): KeywordMetrics | null {
  const term = item.keyword?.trim().toLowerCase();
  if (!term) return null;
  return {
    term,
    volume: item.keyword_info?.search_volume ?? null,
    difficulty: item.keyword_properties?.keyword_difficulty ?? null,
    cpc: item.keyword_info?.cpc ?? null,
    intent: mapIntent(item.search_intent_info?.main_intent),
    source,
  };
}

/**
 * Expands seed terms into related keywords WITH metrics.
 *
 * One Labs call covers both expansion and metrics, which is why this is
 * preferred over calling a volume endpoint separately for every seed.
 */
export async function keywordIdeas(
  seeds: string[],
  locationName: string,
  languageName: string,
  limit = 200,
): Promise<{ metrics: KeywordMetrics[]; cached: boolean }> {
  if (seeds.length === 0) return { metrics: [], cached: true };

  // The endpoint caps seeds per request; more than this is silently ignored.
  const keywords = seeds.slice(0, 20);
  const params = {
    keywords,
    location_name: locationName,
    language_name: languageName,
    limit,
    include_serp_info: false,
    include_seed_keyword: true,
  };

  const { data, cached } = await withCache(
    "dataforseo",
    "/dataforseo_labs/google/keyword_ideas/live",
    params,
    () =>
      post<{ items?: LabsKeywordItem[] }>(
        "/dataforseo_labs/google/keyword_ideas/live",
        params,
      ),
  );

  const seen = new Set<string>();
  const metrics: KeywordMetrics[] = [];
  for (const result of data) {
    for (const item of result.items ?? []) {
      const mapped = mapItem(item, "dataforseo_ideas");
      if (mapped && !seen.has(mapped.term)) {
        seen.add(mapped.term);
        metrics.push(mapped);
      }
    }
  }

  return { metrics, cached };
}

/**
 * Keywords a domain already ranks for.
 *
 * Distinct from ideas: these are terms the site has proven traction on, which
 * are usually the cheapest wins because some authority already exists.
 */
export async function keywordsForSite(
  domain: string,
  locationName: string,
  languageName: string,
  limit = 100,
): Promise<{ metrics: KeywordMetrics[]; cached: boolean }> {
  const params = {
    target: domain,
    location_name: locationName,
    language_name: languageName,
    limit,
  };

  const { data, cached } = await withCache(
    "dataforseo",
    "/dataforseo_labs/google/ranked_keywords/live",
    params,
    () =>
      post<{ items?: Array<{ keyword_data?: LabsKeywordItem }> }>(
        "/dataforseo_labs/google/ranked_keywords/live",
        params,
      ),
  );

  const seen = new Set<string>();
  const metrics: KeywordMetrics[] = [];
  for (const result of data) {
    for (const item of result.items ?? []) {
      const mapped = item.keyword_data
        ? mapItem(item.keyword_data, "dataforseo_ranked")
        : null;
      if (mapped && !seen.has(mapped.term)) {
        seen.add(mapped.term);
        metrics.push(mapped);
      }
    }
  }

  return { metrics, cached };
}

/* ------------------------------------------------------------------------ */
/* Backlinks API: domain rank                                               */
/* ------------------------------------------------------------------------ */

/** DataForSEO Backlinks API accepts up to 1,000 targets per bulk_ranks task. */
export const BULK_RANKS_MAX_TARGETS = 1000;

type BulkRanksResult = { items?: Array<{ target?: string; rank?: number | null }> | null };

/**
 * DataForSEO Rank for up to 1,000 domains in ONE task
 * (POST /v3/backlinks/bulk_ranks/live), on the 0-100 scale
 * (rank_scale "one_hundred"). The rank is DataForSEO's own measure, based on
 * the referring domains pointing at a target - it is not Ahrefs' Domain
 * Rating or any other company's metric, and is labelled as DataForSEO Rank
 * wherever it is shown.
 *
 * The Backlinks API is a separate DataForSEO subscription from the keyword
 * APIs: an account without it answers 40204, which surfaces as a
 * DataForSeoError with apiStatusCode 40204. Not cached here - the caller
 * stores results in domain_metrics, which is the cache.
 *
 * Returns target -> rank; a target missing from the answer maps to null
 * (DataForSEO returned nothing for it).
 */
export async function bulkDomainRanks(targets: string[]): Promise<Map<string, number | null>> {
  if (targets.length === 0) return new Map();
  if (targets.length > BULK_RANKS_MAX_TARGETS) {
    throw new DataForSeoError(`At most ${BULK_RANKS_MAX_TARGETS} targets per request`);
  }
  const results = await post<BulkRanksResult>("/backlinks/bulk_ranks/live", {
    targets,
    rank_scale: "one_hundred",
  });
  const ranks = new Map<string, number | null>(targets.map((t) => [t, null]));
  for (const result of results) {
    for (const item of result.items ?? []) {
      const target = item.target?.trim().toLowerCase();
      if (!target || !ranks.has(target)) continue;
      ranks.set(target, typeof item.rank === "number" ? Math.round(item.rank) : null);
    }
  }
  return ranks;
}
