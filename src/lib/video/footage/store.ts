import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { videoStockAssets } from "@/lib/db/schema";

import { storeSharedFile } from "../storage";
import { FOOTAGE_LIMITS, type StockCandidate } from "./types";

/**
 * A chosen stock file, downloaded once to RepGet's storage (providers forbid
 * permanent hotlinking) and recorded in video_stock_assets with its licence,
 * source, author and the query it answered - reused by later videos without
 * another download (unique provider/provider_id/kind).
 */

export type StockAsset = typeof videoStockAssets.$inferSelect;

/** A cached asset for this exact query (no network call). */
export async function cachedForQuery(query: string, kind: "video" | "image", exclude: Set<string>): Promise<StockAsset | null> {
  const rows = await db
    .select()
    .from(videoStockAssets)
    .where(and(eq(videoStockAssets.query, query.trim().toLowerCase()), eq(videoStockAssets.kind, kind)))
    .limit(8);
  return rows.find((row) => !exclude.has(`${row.provider}:${row.providerId}`)) ?? null;
}

export async function cachedAsset(provider: string, providerId: string, kind: "video" | "image"): Promise<StockAsset | null> {
  const [row] = await db
    .select()
    .from(videoStockAssets)
    .where(and(eq(videoStockAssets.provider, provider), eq(videoStockAssets.providerId, providerId), eq(videoStockAssets.kind, kind)));
  return row ?? null;
}

export async function touchAsset(id: string): Promise<void> {
  await db.update(videoStockAssets).set({ lastUsedAt: new Date() }).where(eq(videoStockAssets.id, id));
}

/**
 * Downloads a file with a size bound and a timeout: refuses an announced
 * size over the limit, and stops reading past it.
 */
export async function boundedDownload(url: string, maxBytes: number = FOOTAGE_LIMITS.maxBytes, fetcher: typeof fetch = fetch): Promise<{ data: Buffer; contentType: string }> {
  if (!/^https:\/\//.test(url)) throw new Error("Only https downloads are allowed");
  const response = await fetcher(url, { signal: AbortSignal.timeout(FOOTAGE_LIMITS.downloadTimeoutMs), redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`The stock file could not be downloaded (${response.status})`);
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > maxBytes) throw new Error("The stock file is larger than allowed");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("The stock file is larger than allowed");
    }
    chunks.push(value);
  }
  return { data: Buffer.concat(chunks), contentType: (response.headers.get("content-type") ?? "").split(";")[0].trim() };
}

function storedType(candidate: StockCandidate, contentType: string): string {
  if (candidate.kind === "video") return "video/mp4";
  return ["image/png", "image/webp", "image/jpeg"].includes(contentType) ? contentType : "image/jpeg";
}

/**
 * The candidate stored and recorded (or the existing record when another
 * video stored it first). The unique index keeps one row per file.
 */
export async function storeCandidate(candidate: StockCandidate, query: string, costUsd: number | null, fetcher: typeof fetch = fetch): Promise<StockAsset> {
  const existing = await cachedAsset(candidate.provider, candidate.providerId, candidate.kind);
  if (existing) return existing;
  const file = await boundedDownload(candidate.downloadUrl, FOOTAGE_LIMITS.maxBytes, fetcher);
  const type = storedType(candidate, file.contentType);
  const url = await storeSharedFile(`stock/${candidate.provider}`, file.data, type);
  const [row] = await db
    .insert(videoStockAssets)
    .values({
      provider: candidate.provider,
      providerId: candidate.providerId,
      kind: candidate.kind,
      url,
      width: candidate.width,
      height: candidate.height,
      durationMs: candidate.durationMs,
      licence: candidate.licence,
      sourceUrl: candidate.sourceUrl,
      author: candidate.author,
      query: query.trim().toLowerCase(),
      costUsd: costUsd === null ? null : costUsd.toFixed(6),
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [videoStockAssets.provider, videoStockAssets.providerId, videoStockAssets.kind],
      set: { lastUsedAt: sql`now()` },
    })
    .returning();
  return row;
}
