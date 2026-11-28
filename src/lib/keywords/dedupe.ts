import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, calendarItems, keywords } from "@/lib/db/schema";
import { mergeVariants, normalizeTerm } from "./variants";

/** The keywords an article or a planned topic targets, normalised (lib/keywords/variants.ts). */
async function targetedTerms(websiteId: string): Promise<Set<string>> {
  return new Set(
    [
      ...(await db
        .select({ term: calendarItems.targetKeyword })
        .from(calendarItems)
        .where(and(eq(calendarItems.websiteId, websiteId), isNotNull(calendarItems.targetKeyword)))),
      ...(await db
        .select({ term: articles.targetKeyword })
        .from(articles)
        .where(and(eq(articles.websiteId, websiteId), isNotNull(articles.targetKeyword)))),
    ].map((row) => normalizeTerm(row.term!)),
  );
}

/**
 * The terms a research run must never drop or delete, normalised: the ones
 * the customer typed, and the ones an article or a planned topic targets.
 */
export async function protectedKeywordTerms(websiteId: string): Promise<Set<string>> {
  const manual = await db
    .select({ term: keywords.term })
    .from(keywords)
    .where(and(eq(keywords.websiteId, websiteId), eq(keywords.source, "manual")));
  const terms = await targetedTerms(websiteId);
  for (const row of manual) terms.add(normalizeTerm(row.term));
  return terms;
}

/**
 * The research run's keywords with every variant folded away - of each other
 * and of what the website already has (lib/keywords/variants.ts).
 *
 * Research upserts by exact term, so "для мужчині" stored last month and "для
 * мужчини" found today would be two rows. Each group of variants keeps one:
 *  - one the customer typed wins, then one an article or a planned topic
 *    already targets (the brief finds its keyword by that exact term), then
 *    the most searched;
 *  - an earlier run's row that loses to a better form is deleted, unless
 *    something targets it;
 *  - a new row that loses is simply not stored.
 *
 * That also cleans up the duplicates earlier runs left: the next research run
 * on a website removes them.
 */
export async function foldKeywordVariants<T extends { term: string; volume: number | null; source: string }>(
  websiteId: string,
  candidates: T[],
): Promise<{ rows: T[]; removed: string[]; dropped: string[] }> {
  const existing = await db
    .select({ term: keywords.term, volume: keywords.volume, source: keywords.source })
    .from(keywords)
    .where(eq(keywords.websiteId, websiteId));

  const targeted = await targetedTerms(websiteId);
  // Compared as the variant check compares terms: "Dentist Dublin!" on a topic still targets "dentist dublin".
  const isTargeted = (term: string) => targeted.has(normalizeTerm(term));

  type Entry = { term: string; volume: number | null; source: string | null; pinned: boolean; stored: boolean; candidate: T | null };
  const pool = new Map<string, Entry>();
  for (const row of existing) {
    pool.set(row.term, { term: row.term, volume: row.volume, source: row.source, pinned: isTargeted(row.term), stored: true, candidate: null });
  }
  for (const row of candidates) {
    const stored = pool.get(row.term);
    // The same term again is the same row: the upsert refreshes it with this run's figures.
    pool.set(row.term, {
      term: row.term,
      volume: row.volume ?? stored?.volume ?? null,
      source: stored?.source === "manual" ? "manual" : row.source,
      pinned: stored?.pinned ?? isTargeted(row.term),
      stored: Boolean(stored),
      candidate: row,
    });
  }

  const entries = [...pool.values()];
  const { kept } = mergeVariants(entries);
  const winners = new Set(kept.map((entry) => entry.term));
  const removed: string[] = [];
  const dropped: string[] = [];
  const rows: T[] = [];
  for (const entry of entries) {
    // A stored row the customer typed, or one an article or a planned topic targets, is never deleted.
    const stays = winners.has(entry.term) || (entry.stored && (entry.pinned || entry.source === "manual"));
    if (stays) {
      if (entry.candidate) rows.push(entry.candidate);
    } else if (entry.stored) {
      removed.push(entry.term);
    } else {
      dropped.push(entry.term);
    }
  }

  if (removed.length > 0) {
    await db.delete(keywords).where(and(eq(keywords.websiteId, websiteId), inArray(keywords.term, removed)));
  }
  return { rows, removed, dropped };
}
