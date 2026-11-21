import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";

/**
 * Temporary per-day caps on what the scheduler writes for one website,
 * whatever its monthly allowance.
 *
 * Client, 2026-11-21: "1 article is enough for imagestudio, it's only for
 * testing purpose daily to improve if something fails". imagestudio.com runs
 * in an agency workspace with 500 articles a month, which the scheduler writes
 * as batches of 34 per run (two runs a day). Agreed with the owner: one a day
 * until 1 December, then the normal pace again.
 *
 * Why not lower the workspace's monthly limit instead: November's count is
 * already far past 30, so a limit of 30 stops writing until the month turns,
 * and a re-plan (lib/keywords/replan.ts) keeps only as many planned topics as
 * the month has left - it would delete the site's calendar.
 *
 * Each cap ends by itself at `until`; nothing has to be switched back. The
 * topics not written are not lost: moveMissedTopicsForward slides the whole
 * calendar forward each day, keeping its spacing.
 *
 * Only the scheduler reads this. "Write" pressed by hand is not capped.
 */
export const TEMPORARY_DAILY_CAPS: readonly { websiteId: string; perDay: number; until: Date; site: string }[] = [
  {
    // imagestudio.com in Dimitri Kuliuk's Workspace (agency).
    websiteId: "4aec4382-f158-4deb-b7a3-b4968aac6b41",
    perDay: 1,
    until: new Date("2026-12-01T00:00:00Z"),
    site: "imagestudio.com",
  },
];

/** This website's cap per UTC day, or null when it has none (or it has ended). */
export function dailyCapFor(
  websiteId: string,
  now: Date = new Date(),
  caps: typeof TEMPORARY_DAILY_CAPS = TEMPORARY_DAILY_CAPS,
): number | null {
  const cap = caps.find((c) => c.websiteId === websiteId && now < c.until);
  return cap ? cap.perDay : null;
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
