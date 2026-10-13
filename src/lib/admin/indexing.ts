import "server-only";

import { and, eq, gte, like, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { articleIndexing } from "@/lib/db/schema";
import { dailyLimit } from "@/lib/indexing/run";
import { isIndexingConfigured, readTokenBalance, TOKENS_PER_INDEXED_URL } from "@/lib/indexing/speedyindex";

/**
 * Google indexing as the operator sees it (admin overview): whether it is
 * switched on, what is left on the SpeedyIndex account, and what happened to
 * the last 30 days' articles.
 */
export type IndexingSummary = {
  configured: boolean;
  /** Null: the balance could not be read (SpeedyIndex did not answer). */
  tokens: number | null;
  /** How many more articles the balance pays for. */
  articlesLeft: number | null;
  dailyLimit: number;
  last30: { sent: number; indexed: number; waiting: number; notIndexed: number; failed: number; skipped: number };
  /** Queued articles held because the balance is empty. */
  heldForBalance: number;
};

export async function getIndexingSummary(now: Date = new Date()): Promise<IndexingSummary> {
  const configured = isIndexingConfigured();
  const since = new Date(now.getTime() - 30 * 24 * 3_600_000);

  const [counts, [held], tokens] = await Promise.all([
    db
      .select({ status: articleIndexing.status, n: sql<number>`count(*)::int` })
      .from(articleIndexing)
      .where(gte(articleIndexing.createdAt, since))
      .groupBy(articleIndexing.status),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(articleIndexing)
      .where(and(eq(articleIndexing.status, "queued"), like(articleIndexing.error, "%balance%"))),
    configured
      ? readTokenBalance().catch((error) => {
          console.error("[admin/indexing] could not read the SpeedyIndex balance", error instanceof Error ? error.message : error);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const count = (status: string) => counts.find((row) => row.status === status)?.n ?? 0;
  const indexed = count("indexed");
  const waiting = count("submitted");
  const notIndexed = count("not_indexed");
  return {
    configured,
    tokens,
    articlesLeft: tokens === null ? null : Math.floor(tokens / TOKENS_PER_INDEXED_URL),
    dailyLimit: dailyLimit(),
    last30: { sent: indexed + waiting + notIndexed, indexed, waiting, notIndexed, failed: count("failed"), skipped: count("skipped") },
    heldForBalance: held?.n ?? 0,
  };
}
