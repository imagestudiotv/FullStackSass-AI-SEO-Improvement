import "server-only";

import { createHash } from "node:crypto";

import {
  acquireLease,
  consumeReservation,
  releaseLease,
  reserveAll,
  type Lease,
  type QuotaRule,
} from "@/lib/billing/spend-quota";
import { normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * Abuse protection for the free, anonymous tools that make RepGet's servers
 * fetch somebody's website: the public audit, the llms.txt generator, and the
 * sitemap, robots, meta-tag, readability and AI-crawler checkers.
 *
 * BEFORE. The audit's "60 an hour" counted cached SUCCESSFUL results, read
 * before crawling: failed, blocked, timed-out and empty crawls were never
 * counted, so an endless stream of them all reached the crawler, and
 * simultaneous requests all passed the same count. The other tools had no
 * limit at all - each GET of a tool page with ?domain= made our servers
 * fetch (the llms.txt generator: crawl 12 pages of) any public site.
 *
 * NOW, for every tool, in this order (all shared across server instances, in
 * PostgreSQL - no per-process counters):
 *  1. A cache hit costs nothing and counts nothing (the caller checks first).
 *  2. One request per tool and site at a time: an expiring lease, so the same
 *     site asked for twice at once is fetched once.
 *  3. Bounded concurrency: a request must hold one of a few slot leases for
 *     its kind of work (crawls / single fetches) across all instances.
 *  4. Capacity is RESERVED atomically before any network work (the spend
 *     ledger's reserveAll: per visitor per hour and per day, per site per
 *     hour, and overall per hour), and recorded as used at once - so a
 *     request that then fails, is blocked, times out or finds nothing still
 *     counts exactly once.
 *  5. Only then does `run` touch the network, still under safeFetch's SSRF,
 *     size, deadline and page limits.
 * If the quota store cannot be reached, nothing is fetched: it fails closed.
 *
 * Visitors are identified only through trusted ingress (lib/visitor-key.ts).
 */

export type PublicToolId =
  | "audit"
  | "llms-txt"
  | "sitemap"
  | "robots"
  | "meta-tags"
  | "readability"
  | "ai-crawlers";

type ToolLimits = {
  perVisitorPerHour: number;
  perVisitorPerDay: number;
  /** All visitors together, for this tool. */
  globalPerHour: number;
  /** One site, for this tool, whoever asks: the sites being fetched deserve restraint too. */
  perSitePerHour: number;
  /** Which concurrency pool the work draws from. */
  pool: "crawl" | "fetch";
  /** How long one request may hold its leases: longer than its own deadline. */
  leaseSeconds: number;
};

/** Crawls (several pages) are scarce; single fetches are cheap but not free. */
export const PUBLIC_TOOL_LIMITS: Record<PublicToolId, ToolLimits> = {
  audit: { perVisitorPerHour: 5, perVisitorPerDay: 20, globalPerHour: 60, perSitePerHour: 6, pool: "crawl", leaseSeconds: 150 },
  "llms-txt": { perVisitorPerHour: 5, perVisitorPerDay: 20, globalPerHour: 60, perSitePerHour: 6, pool: "crawl", leaseSeconds: 150 },
  sitemap: { perVisitorPerHour: 20, perVisitorPerDay: 100, globalPerHour: 300, perSitePerHour: 20, pool: "fetch", leaseSeconds: 120 },
  robots: { perVisitorPerHour: 30, perVisitorPerDay: 150, globalPerHour: 400, perSitePerHour: 30, pool: "fetch", leaseSeconds: 60 },
  "meta-tags": { perVisitorPerHour: 30, perVisitorPerDay: 150, globalPerHour: 400, perSitePerHour: 30, pool: "fetch", leaseSeconds: 60 },
  readability: { perVisitorPerHour: 30, perVisitorPerDay: 150, globalPerHour: 400, perSitePerHour: 30, pool: "fetch", leaseSeconds: 60 },
  "ai-crawlers": { perVisitorPerHour: 30, perVisitorPerDay: 150, globalPerHour: 400, perSitePerHour: 30, pool: "fetch", leaseSeconds: 60 },
};

/** Requests of each kind that may be fetching at once, across every instance. */
export const POOL_SLOTS: Record<ToolLimits["pool"], number> = { crawl: 3, fetch: 8 };

export type PublicToolRefusal = {
  kind: "rate_limited" | "busy" | "in_progress" | "unavailable";
  message: string;
  /** A sensible wait before trying again. */
  retryAfterSeconds: number;
};

export type GuardOutcome<T> = { ok: true; value: T } | { ok: false; refusal: PublicToolRefusal };

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function publicToolRules(tool: PublicToolId, site: string, visitor: string): QuotaRule[] {
  const limits = PUBLIC_TOOL_LIMITS[tool];
  return [
    { key: `public-tool:${tool}:visitor:${visitor}`, limit: limits.perVisitorPerHour, window: { seconds: 3600 } },
    { key: `public-tool:${tool}:visitor-day:${visitor}`, limit: limits.perVisitorPerDay, window: { seconds: 86_400 } },
    { key: `public-tool:${tool}:site:${digest(site)}`, limit: limits.perSitePerHour, window: { seconds: 3600 } },
    { key: `public-tool:${tool}:global`, limit: limits.globalPerHour, window: { seconds: 3600 } },
  ];
}

function rateLimited(rule: QuotaRule): PublicToolRefusal {
  if (rule.key.endsWith(":global")) {
    return { kind: "rate_limited", message: "We are checking a lot of websites right now. Please try again in a few minutes.", retryAfterSeconds: 300 };
  }
  if (rule.key.includes(":site:")) {
    return { kind: "rate_limited", message: "That website has been checked several times in the last hour. Please try again later.", retryAfterSeconds: 3600 };
  }
  if (rule.key.includes(":visitor-day:")) {
    return { kind: "rate_limited", message: "You have used this free check many times today. Please try again tomorrow.", retryAfterSeconds: 86_400 };
  }
  return { kind: "rate_limited", message: "You have run this check several times in the last hour. Please try again later.", retryAfterSeconds: 3600 };
}

const BUSY: PublicToolRefusal = {
  kind: "busy",
  message: "We are checking a lot of websites right now. Please try again in a minute.",
  retryAfterSeconds: 60,
};
const IN_PROGRESS: PublicToolRefusal = {
  kind: "in_progress",
  message: "We are already checking that website. Refresh the page in a moment for the result.",
  retryAfterSeconds: 15,
};
const UNAVAILABLE: PublicToolRefusal = {
  kind: "unavailable",
  message: "This free check is temporarily unavailable. Please try again in a few minutes.",
  retryAfterSeconds: 300,
};

/**
 * The guard for a free tool that takes a website address and returns
 * `{ ok: false, error }` on failure (every tool but the audit, which has
 * richer errors and calls guardPublicTool itself).
 *
 * An address that does not even normalise is handed straight to `run`: each
 * tool rejects it there before any network work, with its own message.
 */
export async function guardedSiteTool<T>(
  tool: PublicToolId,
  input: string,
  visitor: string,
  run: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  let site: string;
  try {
    site = normalizeWebsiteUrl(input).url;
  } catch {
    return run();
  }
  const guarded = await guardPublicTool({ tool, site, visitor, run });
  return guarded.ok ? guarded.value : { ok: false, error: guarded.refusal.message };
}

/** Takes one free slot of the pool, or null when every slot is held. */
async function acquireSlot(pool: ToolLimits["pool"], seconds: number): Promise<Lease | null> {
  const slots = POOL_SLOTS[pool];
  // Start at a random slot so concurrent requests do not all queue on slot 0.
  const start = Math.floor(Math.random() * slots);
  for (let i = 0; i < slots; i++) {
    const lease = await acquireLease(`public-tool:pool:${pool}:${(start + i) % slots}`, seconds);
    if (lease) return lease;
  }
  return null;
}

/**
 * Runs `run` - the tool's network work - only once every check above has
 * passed and its capacity is reserved and counted. `beforeRun` runs under the
 * site's lease, before anything is reserved: a request that waited behind
 * another for the same site can return that request's freshly cached result.
 */
export async function guardPublicTool<T>(options: {
  tool: PublicToolId;
  /** The normalised site (domain or URL) being fetched. */
  site: string;
  /** From visitorKey(); a shared "unknown" bucket when no trusted address exists. */
  visitor: string;
  run: () => Promise<T>;
  beforeRun?: () => Promise<T | null>;
}): Promise<GuardOutcome<T>> {
  const limits = PUBLIC_TOOL_LIMITS[options.tool];
  const leases: Lease[] = [];
  try {
    let siteLease: Lease | null;
    try {
      siteLease = await acquireLease(`public-tool:${options.tool}:in-flight:${digest(options.site)}`, limits.leaseSeconds);
    } catch {
      return { ok: false, refusal: UNAVAILABLE };
    }
    if (!siteLease) return { ok: false, refusal: IN_PROGRESS };
    leases.push(siteLease);

    if (options.beforeRun) {
      const early = await options.beforeRun().catch(() => null);
      if (early !== null) return { ok: true, value: early };
    }

    let slot: Lease | null;
    try {
      slot = await acquireSlot(limits.pool, limits.leaseSeconds);
    } catch {
      return { ok: false, refusal: UNAVAILABLE };
    }
    if (!slot) return { ok: false, refusal: BUSY };
    leases.push(slot);

    try {
      const reserved = await reserveAll(publicToolRules(options.tool, options.site, options.visitor), {
        operation: `public.${options.tool}`,
        metadata: { visitor: options.visitor },
      });
      if (!reserved.ok) return { ok: false, refusal: rateLimited(reserved.rule) };
      // Used from this moment: whatever the network does next, it counts.
      for (const reservation of reserved.reservations) await consumeReservation(reservation.id, "paid");
    } catch {
      return { ok: false, refusal: UNAVAILABLE };
    }

    return { ok: true, value: await options.run() };
  } finally {
    for (const lease of leases.reverse()) await releaseLease(lease);
  }
}
