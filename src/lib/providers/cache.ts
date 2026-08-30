import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerCache } from "@/lib/db/schema";

/**
 * Response cache for paid provider calls.
 *
 * Keyword volume, difficulty and CPC change monthly at most, so paying
 * DataForSEO twice in a week for the same query is money burned. Two users
 * researching "dental implants dublin" should cost one call, not two.
 *
 * The cache is deliberately GLOBAL rather than per organization: the answer to
 * "what is the search volume for X in Ireland" is a fact about the world, not
 * about a tenant. Nothing tenant-specific is ever stored here — only the
 * provider's own response to a public query.
 */

/** Default lifetime. Long because the underlying data barely moves. */
export const DEFAULT_TTL_DAYS = 30;

/**
 * Stable hash of provider + endpoint + params.
 *
 * Object keys are sorted before hashing: JSON.stringify preserves insertion
 * order, so {a,b} and {b,a} would otherwise hash differently and silently miss
 * a cache entry that is really there.
 */
export function cacheKey(
  provider: string,
  endpoint: string,
  params: Record<string, unknown>,
): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  return createHash("sha256")
    .update(`${provider}:${endpoint}:${JSON.stringify(sorted)}`)
    .digest("hex");
}

/** Returns the cached response, or null when absent or expired. */
export async function readCache<T>(
  provider: string,
  endpoint: string,
  params: Record<string, unknown>,
): Promise<T | null> {
  const hash = cacheKey(provider, endpoint, params);
  const [row] = await db
    .select({ response: providerCache.response })
    .from(providerCache)
    .where(
      and(
        eq(providerCache.paramsHash, hash),
        // Expired rows are treated as absent and overwritten on the next write.
        gt(providerCache.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return (row?.response as T | undefined) ?? null;
}

export async function writeCache(
  provider: string,
  endpoint: string,
  params: Record<string, unknown>,
  response: unknown,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<void> {
  const hash = cacheKey(provider, endpoint, params);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await db
    .insert(providerCache)
    .values({ provider, endpoint, paramsHash: hash, response, expiresAt })
    // Upsert rather than insert: an expired row already holds this hash, and
    // the unique index would reject a second copy.
    .onConflictDoUpdate({
      target: providerCache.paramsHash,
      set: { response, expiresAt, createdAt: new Date() },
    });
}

/**
 * Runs `fetcher` only on a cache miss.
 *
 * Callers never touch read/write directly, so it is impossible to forget the
 * write half and silently pay for every call.
 */
export async function withCache<T>(
  provider: string,
  endpoint: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<{ data: T; cached: boolean }> {
  const hit = await readCache<T>(provider, endpoint, params);
  if (hit !== null) {
    return { data: hit, cached: true };
  }

  const data = await fetcher();
  await writeCache(provider, endpoint, params, data, ttlDays);
  return { data, cached: false };
}
