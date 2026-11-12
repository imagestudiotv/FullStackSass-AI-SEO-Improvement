import "server-only";

import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents, videoIdeaBatches, videoIdeas } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { DAILY_BATCH_SIZE, EXTRA_BATCH_SIZE, EXTRA_BATCHES_PER_DAY, type BatchKind, type ExtraBatchKind } from "./formats";

/**
 * The free idea allowance (client, 2026-11-12: "20 fresh ideas daily ...
 * Each click on New ideas generates 10 additional ideas. Allow three
 * additional batches per day for free. Limit repeated requests to prevent
 * abuse."). The same allowance holds for the page's buttons, the AI chat,
 * the jobs and any direct request, because all of them go through here.
 *
 * A batch is a video_idea_batches row: slot 0 the day's batch, slots
 * 1..EXTRA_BATCHES_PER_DAY the extra ones. Reserving an extra batch is an
 * INSERT of the next free slot in a short transaction, serialised per
 * website by an advisory lock, with the unique (website, day, slot) as the
 * backstop - so requests at the same moment never get more than three. The
 * AI call runs after that transaction, holding no lock; a second short
 * transaction stores the ideas and closes the batch (lib/video/ideas.ts).
 *
 * Without loopholes:
 *  - a request key makes a retried request (a double click, the chat's
 *    Confirm sent twice) return its first batch, never a second slot;
 *  - a skipped idea never gives anything back: slots are rows, not counts;
 *  - writing attempts only grow (Inngest retries included); a batch that
 *    failed with no idea may be asked for again ONCE, in the same slot;
 *    a batch that wrote some ideas is done, even with fewer than asked;
 *  - while a batch of the website is being written, another request is
 *    "busy"; extra requests are at least EXTRA_REQUEST_GAP_MS apart;
 *  - the daily batch is never an extra one, and extra ideas never count
 *    towards (or fill) the day's twenty.
 */

/** The least time between two extra requests of a website. */
export const EXTRA_REQUEST_GAP_MS = 20_000;
/** A batch reserved or writing for longer than this is taken as failed (a job that never ran or died). */
export const STALE_BATCH_MS = 10 * 60_000;
/** Attempts one request may use (the job's first try and its Inngest retry). */
export const ATTEMPTS_PER_REQUEST = 2;
/** Attempts a batch may ever use: one request and the one re-request of a failed batch. */
export const MAX_BATCH_ATTEMPTS = ATTEMPTS_PER_REQUEST * 2;
/** Writing attempts of the day's batch (top-ups when the page opens, the morning job, retries). */
export const DAILY_MAX_ATTEMPTS = 6;

export type BatchRow = typeof videoIdeaBatches.$inferSelect;
export type RequestVia = "button" | "chat" | "job";

export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

const ACTIVE = ["reserved", "writing"];
const isActive = (row: BatchRow, now: Date) => ACTIVE.includes(row.status) && now.getTime() - row.updatedAt.getTime() < STALE_BATCH_MS;
/** A failed extra batch that wrote nothing and was not asked for again yet. */
const isRetryable = (row: BatchRow) => row.slot > 0 && row.status === "failed" && row.created === 0 && row.attempts <= ATTEMPTS_PER_REQUEST;

async function lockWebsite(tx: Executor, websiteId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('video_idea_batches'), hashtext(${websiteId}))`);
}

/** Marks the website's batches that stalled as failed (no job ran, or it died mid-way). */
async function expireStale(tx: Executor, websiteId: string, now: Date) {
  await tx
    .update(videoIdeaBatches)
    .set({ status: "failed", error: "stalled", finishedAt: now, updatedAt: now })
    .where(
      and(
        eq(videoIdeaBatches.websiteId, websiteId),
        inArray(videoIdeaBatches.status, ACTIVE),
        lt(videoIdeaBatches.updatedAt, new Date(now.getTime() - STALE_BATCH_MS)),
      ),
    );
}

export type Allowance = {
  /** Ideas of the day's batch written (the legacy ideas of the day included). */
  dailyWritten: number;
  /** Extra batches used today (a failed one that may be asked for again is not used). */
  extraUsed: number;
  extraLeft: number;
  /** A batch of the website is being written: further requests wait. */
  busy: boolean;
  /** When the next extra request is allowed, if not now. */
  nextAllowedAt: Date | null;
};

/** The ideas of the day's batch: those written in it, and the day's ideas from before batches (batch_id null). */
export async function dailyWritten(websiteId: string, day: string, executor: Executor = db): Promise<number> {
  const [{ n }] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(videoIdeas)
    .leftJoin(videoIdeaBatches, eq(videoIdeas.batchId, videoIdeaBatches.id))
    .where(and(eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.day, day), or(isNull(videoIdeas.batchId), eq(videoIdeaBatches.slot, 0))));
  return Number(n);
}

export async function ideaAllowance(websiteId: string, now: Date = new Date(), executor: Executor = db): Promise<Allowance> {
  const day = utcDay(now);
  const [rows, written] = await Promise.all([
    executor.select().from(videoIdeaBatches).where(and(eq(videoIdeaBatches.websiteId, websiteId), eq(videoIdeaBatches.day, day))),
    dailyWritten(websiteId, day, executor),
  ]);
  const extras = rows.filter((row) => row.slot > 0);
  const extraUsed = extras.filter((row) => !isRetryable(row)).length;
  const last = Math.max(0, ...extras.map((row) => row.createdAt.getTime()));
  const next = last + EXTRA_REQUEST_GAP_MS;
  return {
    dailyWritten: written,
    extraUsed,
    extraLeft: Math.max(0, EXTRA_BATCHES_PER_DAY - extraUsed),
    busy: rows.some((row) => isActive(row, now)),
    nextAllowedAt: next > now.getTime() ? new Date(next) : null,
  };
}

export type ReserveError = "extra_used_up" | "busy" | "too_soon";
export type ReserveResult = { ok: true; batch: BatchRow; reused: boolean } | { ok: false; error: ReserveError; nextAllowedAt?: Date };

/**
 * Reserves one of the day's extra batches for `kind`, or says why not. The
 * same request key returns the batch it reserved before, whatever its state.
 */
export async function reserveExtraBatch(
  websiteId: string,
  kind: ExtraBatchKind,
  options: { requestKey?: string | null; requestedBy?: string | null; via?: RequestVia } = {},
  now: Date = new Date(),
): Promise<ReserveResult> {
  const day = utcDay(now);
  const requestKey = options.requestKey?.trim().slice(0, 120) || null;
  return db.transaction(async (tx) => {
    await lockWebsite(tx, websiteId);
    if (requestKey) {
      const [same] = await tx
        .select()
        .from(videoIdeaBatches)
        .where(and(eq(videoIdeaBatches.websiteId, websiteId), eq(videoIdeaBatches.requestKey, requestKey)));
      if (same) return { ok: true as const, batch: same, reused: true };
    }
    await expireStale(tx, websiteId, now);
    const rows = await tx.select().from(videoIdeaBatches).where(and(eq(videoIdeaBatches.websiteId, websiteId), eq(videoIdeaBatches.day, day)));
    if (rows.some((row) => isActive(row, now))) return { ok: false as const, error: "busy" as const };
    const extras = rows.filter((row) => row.slot > 0);
    const last = Math.max(0, ...extras.map((row) => row.createdAt.getTime()));
    if (last && now.getTime() - last < EXTRA_REQUEST_GAP_MS) {
      return { ok: false as const, error: "too_soon" as const, nextAllowedAt: new Date(last + EXTRA_REQUEST_GAP_MS) };
    }
    const common = { kind, status: "reserved", requestedBy: options.requestedBy ?? null, requestedVia: options.via ?? "button", requestKey, error: null, createdAt: now, updatedAt: now };

    // A failed batch that wrote nothing is asked for again in its own slot, once:
    // its attempts are set to a full request's, so it is never retryable again.
    const retry = extras.find(isRetryable);
    if (retry) {
      const [batch] = await tx
        .update(videoIdeaBatches)
        .set({ ...common, size: EXTRA_BATCH_SIZE, finishedAt: null, attempts: sql`greatest(${videoIdeaBatches.attempts}, ${ATTEMPTS_PER_REQUEST})` })
        .where(and(eq(videoIdeaBatches.id, retry.id), eq(videoIdeaBatches.status, "failed")))
        .returning();
      return { ok: true as const, batch, reused: false };
    }

    const taken = new Set(extras.map((row) => row.slot));
    const slot = Array.from({ length: EXTRA_BATCHES_PER_DAY }, (_, index) => index + 1).find((candidate) => !taken.has(candidate));
    if (!slot) return { ok: false as const, error: "extra_used_up" as const };
    const [batch] = await tx
      .insert(videoIdeaBatches)
      .values({ websiteId, day, slot, size: EXTRA_BATCH_SIZE, ...common })
      .onConflictDoNothing()
      .returning();
    // The unique (website, day, slot) is the backstop: under the lock this never happens.
    if (!batch) return { ok: false as const, error: "busy" as const };
    return { ok: true as const, batch, reused: false };
  });
}

/** The day's batch (slot 0), created on first use. */
export async function dailyBatch(websiteId: string, now: Date, executor: Executor = db): Promise<BatchRow> {
  const day = utcDay(now);
  await executor
    .insert(videoIdeaBatches)
    .values({ websiteId, day, slot: 0, kind: "daily", status: "done", size: DAILY_BATCH_SIZE, requestedVia: "job", createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  const [row] = await executor
    .select()
    .from(videoIdeaBatches)
    .where(and(eq(videoIdeaBatches.websiteId, websiteId), eq(videoIdeaBatches.day, day), eq(videoIdeaBatches.slot, 0)));
  return row;
}

/**
 * Takes a batch for writing: one more attempt, while it has attempts left
 * and is not being written by another job (a stalled "writing" may be taken
 * again - an Inngest retry after a crash). null: not to be written now.
 */
export async function claimBatch(batchId: string, now: Date = new Date(), options: { retry?: boolean } = {}): Promise<BatchRow | null> {
  const [row] = await db.select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, batchId));
  if (!row) return null;
  const daily = row.slot === 0;
  const limit = daily ? DAILY_MAX_ATTEMPTS : MAX_BATCH_ATTEMPTS;
  const [claimed] = await db
    .update(videoIdeaBatches)
    .set({ status: "writing", attempts: sql`${videoIdeaBatches.attempts} + 1`, error: null, updatedAt: now })
    .where(
      and(
        eq(videoIdeaBatches.id, batchId),
        lt(videoIdeaBatches.attempts, limit),
        daily
          ? or(inArray(videoIdeaBatches.status, ["done", "failed", "reserved"]), lt(videoIdeaBatches.updatedAt, new Date(now.getTime() - STALE_BATCH_MS)))
          : // An extra batch: reserved; or, for the job's retry, writing by the try that died.
            options.retry
            ? inArray(videoIdeaBatches.status, ["reserved", "writing"])
            : eq(videoIdeaBatches.status, "reserved"),
      ),
    )
    .returning();
  if (!claimed && !daily && row.status !== "done" && row.attempts >= limit) {
    await db
      .update(videoIdeaBatches)
      .set({ status: "failed", error: "attempts used", finishedAt: now, updatedAt: now })
      .where(and(eq(videoIdeaBatches.id, batchId), inArray(videoIdeaBatches.status, ACTIVE)));
  }
  return claimed ?? null;
}

/**
 * A writing attempt that threw. On the request's last attempt the batch is
 * failed (with no ideas it may be asked for again once); otherwise it goes
 * back to reserved for the job's retry. The daily batch just stops writing.
 */
export async function releaseBatch(batchId: string, error: string, final: boolean, now: Date = new Date()): Promise<void> {
  const [row] = await db.select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, batchId));
  if (!row) return;
  const status = row.slot === 0 ? "done" : final ? (row.created > 0 ? "done" : "failed") : "reserved";
  await db
    .update(videoIdeaBatches)
    .set({ status, error: error.slice(0, 300), updatedAt: now, ...(status === "reserved" ? {} : { finishedAt: now }) })
    .where(and(eq(videoIdeaBatches.id, batchId), eq(videoIdeaBatches.status, "writing")));
}

/** The batches of a day that are waiting for their job (the page re-queues one whose event was lost). */
export async function pendingBatches(websiteId: string, now: Date = new Date()): Promise<BatchRow[]> {
  return db
    .select()
    .from(videoIdeaBatches)
    .where(
      and(
        eq(videoIdeaBatches.websiteId, websiteId),
        eq(videoIdeaBatches.day, utcDay(now)),
        gt(videoIdeaBatches.slot, 0),
        eq(videoIdeaBatches.status, "reserved"),
      ),
    );
}

/* --------------------------------------------------------------- rewrites */

/** Free rewrites of single ideas a website gets a UTC day. */
export const REWRITES_PER_DAY = 10;
export const REWRITE_EVENT = "video_rewrite";

/**
 * Counts one of the day's free rewrites, or refuses when they are used. A
 * usage_events row per rewrite, counted and written under the website's
 * lock in one short transaction, so rewrites at the same moment never go
 * past REWRITES_PER_DAY. A rewrite that fails afterwards is not given back.
 */
export async function reserveRewrite(websiteId: string, organizationId: string, ideaId: string, now: Date = new Date()): Promise<boolean> {
  const start = new Date(`${utcDay(now)}T00:00:00.000Z`);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('video_rewrites'), hashtext(${websiteId}))`);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(usageEvents)
      .where(and(eq(usageEvents.websiteId, websiteId), eq(usageEvents.kind, REWRITE_EVENT), gte(usageEvents.createdAt, start)));
    if (Number(n) >= REWRITES_PER_DAY) return false;
    await tx.insert(usageEvents).values({ organizationId, websiteId, kind: REWRITE_EVENT, quantity: 1, metadata: { ideaId }, createdAt: now });
    return true;
  });
}

export async function rewritesLeft(websiteId: string, now: Date = new Date()): Promise<number> {
  const start = new Date(`${utcDay(now)}T00:00:00.000Z`);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(usageEvents)
    .where(and(eq(usageEvents.websiteId, websiteId), eq(usageEvents.kind, REWRITE_EVENT), gte(usageEvents.createdAt, start)));
  return Math.max(0, REWRITES_PER_DAY - Number(n));
}

export type { BatchKind };
