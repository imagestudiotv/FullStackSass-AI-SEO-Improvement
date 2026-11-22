import { and, count, eq, gte, inArray, like } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, creditSettings, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * Per-website daily limits on what the scheduler writes, whatever the
 * website's monthly allowance. Set by an administrator on Admin -> Websites
 * ("Articles per day"), without a deploy.
 *
 * Client, 2026-11-21: "1 article is enough for imagestudio, it's only for
 * testing purpose daily to improve if something fails". imagestudio.com runs
 * in an agency workspace with 500 articles a month, which the scheduler writes
 * as batches of 34 per run (two runs a day). A first version capped it in code
 * until 1 December; the owner asked for an admin setting instead, so the pace
 * changes only when someone decides it should.
 *
 * Why not lower the workspace's monthly limit instead: November's count is
 * already far past 30, so a limit of 30 stops writing until the month turns,
 * and a re-plan (lib/keywords/replan.ts) keeps only as many planned topics as
 * the month has left - it would delete the site's calendar.
 *
 * Stored in credit_settings (the administrators' number settings, beside the
 * Free plan cap), one row per website: `articles_per_day:<websiteId>`.
 *   - n >= 1: at most n articles started per UTC day;
 *   - 0: no daily limit (the monthly allowance alone, as for any website);
 *   - no row: DEFAULT_DAILY_LIMITS, then no limit.
 *
 * The topics not written are not lost: moveMissedTopicsForward slides the
 * whole calendar forward each day, keeping its spacing.
 *
 * Only the scheduler reads this. "Write" pressed by hand is not limited, but
 * it counts towards the day (articlesStartedToday).
 */
export const DAILY_LIMIT_PREFIX = "articles_per_day:";

/** The setting's key for one website. */
export const dailyLimitKey = (websiteId: string) => `${DAILY_LIMIT_PREFIX}${websiteId}`;

/** The highest limit the form accepts; above it the monthly allowance decides anyway. */
export const MAX_DAILY_LIMIT = 100;

/** The stored value meaning "no daily limit". */
export const NO_DAILY_LIMIT = 0;

/**
 * Limits that hold until an administrator saves one for the website, so the
 * limit already agreed stays in force from the deploy on. Saving "No limit"
 * (a stored 0) overrides it.
 */
export const DEFAULT_DAILY_LIMITS: readonly { websiteId: string; perDay: number; site: string }[] = [
  {
    // imagestudio.com in Dimitri Kuliuk's Workspace (agency).
    websiteId: "4aec4382-f158-4deb-b7a3-b4968aac6b41",
    perDay: 1,
    site: "imagestudio.com",
  },
];

/**
 * A website's limit from its stored value: the value when there is one (0 is
 * no limit), else its default, else none. Null means no daily limit.
 */
export function resolveDailyLimit(
  websiteId: string,
  stored: number | undefined,
  defaults: typeof DEFAULT_DAILY_LIMITS = DEFAULT_DAILY_LIMITS,
): number | null {
  if (stored !== undefined) return stored > 0 ? stored : null;
  return defaults.find((entry) => entry.websiteId === websiteId)?.perDay ?? null;
}

/** This website's limit per UTC day, or null when it has none. */
export async function dailyCapFor(websiteId: string, executor: Executor = db): Promise<number | null> {
  const [row] = await executor
    .select({ value: creditSettings.value })
    .from(creditSettings)
    .where(eq(creditSettings.key, dailyLimitKey(websiteId)));
  return resolveDailyLimit(websiteId, row?.value);
}

/**
 * Every website with a daily limit in force, saved or by default (Admin ->
 * Websites). `saved` says whether an administrator set it.
 */
export async function listDailyLimits(
  executor: Executor = db,
): Promise<{ websiteId: string; domain: string; perDay: number; saved: boolean }[]> {
  const rows = await executor
    .select({ key: creditSettings.key, value: creditSettings.value })
    .from(creditSettings)
    .where(like(creditSettings.key, `${DAILY_LIMIT_PREFIX}%`));
  const stored = new Map(rows.map((row) => [row.key.slice(DAILY_LIMIT_PREFIX.length), row.value]));
  const ids = [...new Set([...stored.keys(), ...DEFAULT_DAILY_LIMITS.map((entry) => entry.websiteId)])];
  if (ids.length === 0) return [];
  // Websites that still exist only: a deleted website's setting row is left behind, harmless.
  const sites = await executor.select({ id: websites.id, domain: websites.domain }).from(websites).where(inArray(websites.id, ids));
  const limits: { websiteId: string; domain: string; perDay: number; saved: boolean }[] = [];
  for (const site of sites) {
    const perDay = resolveDailyLimit(site.id, stored.get(site.id));
    if (perDay !== null) limits.push({ websiteId: site.id, domain: site.domain, perDay, saved: stored.has(site.id) });
  }
  return limits.sort((a, b) => a.domain.localeCompare(b.domain));
}

/** Start of the UTC calendar day, the day the scheduler counts in (see missed-days.ts). */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Articles this website has started since the UTC day began, however they
 * were started. `created_at` holds UTC wall-clock time, as usage.ts compares it.
 */
export async function articlesStartedToday(websiteId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), gte(articles.createdAt, utcDayStart(now))));
  return row?.n ?? 0;
}
