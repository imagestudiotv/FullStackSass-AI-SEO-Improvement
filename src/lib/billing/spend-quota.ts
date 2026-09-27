import { randomUUID } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import {
  and,
  count,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { operationLeases, spendReservations } from "@/lib/db/schema";
import type { Executor as AnyExecutor } from "@/lib/db/types";

/**
 * Spend reservations: capacity for a paid call, taken BEFORE the call.
 *
 * ONE ROW PER RESERVATION, with its own id. The previous version kept a bare
 * counter per window and "released" by decrementing it, so a release that ran
 * twice — a retried onFailure, a duplicate request — handed back somebody
 * else's slot. Every transition here is a guarded UPDATE on one row:
 *
 *   reserved ──consume──▶ consumed      (spend happened, or may have)
 *   reserved ──release──▶ released      (provably nothing was spent)
 *   released ──reclaim──▶ reserved      (a late job re-takes capacity, or is refused)
 *
 * `consumed` is final. Nothing returns capacity because a job failed: a job
 * that paid for an outline and then failed on the body has spent, and its
 * reservation stays consumed.
 *
 * SPENDING IS RECORDED AS STARTED BEFORE THE PROVIDER IS CALLED. paidCall
 * writes `spend_started_at` first and only then makes the call. From that
 * moment the reservation can never be released - not by onFailure, not by the
 * abandoned-row sweep - because the provider may have billed even if this
 * process dies, the consume write fails, or a later step fails the job. A
 * release or sweep turns such a row into `consumed` ("ambiguous") instead.
 * Only the attempt that set the marker may clear it, and only when the
 * provider provably refused the call.
 *
 * ATOMIC UNDER CONCURRENCY. Reserving takes a transaction-scoped advisory lock
 * on the key, counts live rows in the window and inserts, in one transaction,
 * so simultaneous requests on any number of connections are admitted one at a
 * time and exactly `limit` of them get a row.
 *
 * SLIDING WINDOWS. "In the last hour" is counted from each row's countedAt, so
 * there is no boundary to straddle: five calls at 10:59 still block a sixth at
 * 11:01. A period window ({ since }) counts from a fixed start instead — the
 * billing period for monthly article allowances.
 *
 * A LEDGER, not a view of content. Rows have no foreign keys, so deleting an
 * article or a website does not hand its allowance back.
 */

export type QuotaWindow = { seconds: number } | { since: Date };

export type QuotaRule = {
  /** What is counted, e.g. `articles:<websiteId>`. */
  key: string;
  /** Live reservations allowed in the window. Zero or less refuses all. */
  limit: number;
  window: QuotaWindow;
  /**
   * Usage recorded OUTSIDE this ledger that still counts: the effective count
   * is max(ledger, floor). Evaluated under the key's lock, and stored on the
   * row so a late re-take respects it too.
   *
   * This is how the ledger took over without back-filling history: articles
   * written before it existed are still counted from their rows, and images
   * already regenerated from articles.image_attempts. Deleting a row can
   * lower the floor but never the ledger, so it cannot hand a slot back.
   */
  floor?: (tx: Executor) => Promise<number>;
  /**
   * Makes past consumption durable before counting: runs under the key's
   * lock and may insert consumed rows (the article baseline, usage.ts).
   * Unlike a floor it cannot be lowered later, because what it writes is
   * ledger.
   */
  backfill?: (tx: Executor, now: Date) => Promise<void>;
};

export type ReserveContext = {
  /** What is being paid for, e.g. "article.generate". */
  operation: string;
  /** The organization that pays: the website OWNER, never a guest's own. */
  organizationId?: string | null;
  websiteId?: string | null;
  /** What is being paid for (an article id). Recorded on the row. */
  subjectId?: string | null;
  metadata?: Record<string, unknown>;
};

/** JSON-safe, so it can ride in an Inngest event. */
export type Reservation = { id: string; key: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Tx;

const LIVE_STATES = ["reserved", "consumed"];

/** Reserved rows older than this are treated as abandoned. See sweep. */
const ABANDONED_AFTER_MS = 6 * 60 * 60 * 1000;

function windowStart(window: QuotaWindow, now: Date): Date {
  return "since" in window
    ? window.since
    : new Date(now.getTime() - window.seconds * 1000);
}

async function lockKey(tx: Executor, key: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`spend:${key}`}, 0))`,
  );
}

async function liveCount(tx: Executor, rule: QuotaRule, now: Date) {
  const start = windowStart(rule.window, now);
  const [row] = await tx
    .select({ n: count() })
    .from(spendReservations)
    .where(
      and(
        eq(spendReservations.key, rule.key),
        inArray(spendReservations.state, LIVE_STATES),
        "since" in rule.window
          ? gte(spendReservations.countedAt, start)
          : gt(spendReservations.countedAt, start),
        lte(spendReservations.countedAt, now),
      ),
    );
  return row?.n ?? 0;
}

async function inTransaction<T>(
  executor: Executor | undefined,
  fn: (tx: Executor) => Promise<T>,
): Promise<T> {
  return executor ? fn(executor) : db.transaction((tx) => fn(tx));
}

export type ReserveOutcome =
  | { ok: true; reservations: Reservation[] }
  | { ok: false; rule: QuotaRule };

/**
 * Claims one slot under EVERY rule, or none of them.
 *
 * Locks are taken in key order so two callers reserving overlapping keys
 * cannot deadlock. Pass `executor` to reserve inside a caller's transaction —
 * the reservation then commits or rolls back with the caller's own writes.
 */
export async function reserveAll(
  rules: QuotaRule[],
  context: ReserveContext,
  options: { executor?: Executor; now?: Date } = {},
): Promise<ReserveOutcome> {
  const now = options.now ?? new Date();
  const refused = rules.find((r) => r.limit <= 0);
  if (refused) return { ok: false, rule: refused };

  const outcome = await inTransaction(options.executor, async (tx) => {
    for (const key of [...new Set(rules.map((r) => r.key))].sort()) {
      await lockKey(tx, key);
    }
    for (const rule of rules) await rule.backfill?.(tx, now);
    const floors: number[] = [];
    for (const rule of rules) {
      const floor = rule.floor ? await rule.floor(tx) : 0;
      floors.push(floor);
      if (Math.max(await liveCount(tx, rule, now), floor) >= rule.limit) {
        return { ok: false as const, rule };
      }
    }
    const reservations: Reservation[] = [];
    for (const [index, rule] of rules.entries()) {
      const [row] = await tx
        .insert(spendReservations)
        .values({
          id: randomUUID(),
          key: rule.key,
          operation: context.operation,
          organizationId: context.organizationId ?? null,
          websiteId: context.websiteId ?? null,
          subjectId: context.subjectId ?? null,
          state: "reserved",
          limitValue: rule.limit,
          windowSeconds: "seconds" in rule.window ? rule.window.seconds : null,
          windowSince: "since" in rule.window ? rule.window.since : null,
          countedAt: now,
          metadata:
            rule.floor || context.metadata
              ? { ...context.metadata, ...(rule.floor ? { floor: floors[index] } : {}) }
              : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: spendReservations.id, key: spendReservations.key });
      reservations.push(row);
    }
    return { ok: true as const, reservations };
  });

  // Occasional housekeeping, never inside somebody else's transaction.
  if (!options.executor && Math.random() < 0.02) {
    await sweepAbandonedReservations(now).catch(() => {});
  }
  return outcome;
}

/** One rule. Null when the window is full. */
export async function reserve(
  rule: QuotaRule,
  context: ReserveContext,
  options: { executor?: Executor; now?: Date } = {},
): Promise<Reservation | null> {
  const outcome = await reserveAll([rule], context, options);
  return outcome.ok ? outcome.reservations[0] : null;
}

export type ReleaseResult =
  | "released"
  | "already_released"
  | "consumed"
  | "not_found";

/**
 * Hands back a reservation on which nothing was spent.
 *
 * Only reserved → released, and only while spending has NOT started. A row
 * whose paid call began is finalised as consumed ("ambiguous") instead: the
 * provider may have billed, whatever happened afterwards. Idempotent: a
 * second call reports "already_released" and changes nothing; a consumed
 * reservation is never returned. Never throws — it runs on failure paths,
 * and an error here must not replace the error being reported.
 *
 * With `executor` (a caller's transaction) it runs inside that transaction
 * and DOES throw: a release that failed must roll the caller's other
 * changes back with it, not let them commit without it.
 */
export async function releaseReservation(
  id: string,
  reason: string,
  executor?: AnyExecutor,
): Promise<ReleaseResult> {
  const run: AnyExecutor = executor ?? db;
  try {
    const now = new Date();
    const released = await run
      .update(spendReservations)
      .set({ state: "released", releasedAt: now, releaseReason: reason, updatedAt: now })
      .where(
        and(
          eq(spendReservations.id, id),
          eq(spendReservations.state, "reserved"),
          isNull(spendReservations.spendStartedAt),
        ),
      )
      .returning({ id: spendReservations.id });
    if (released.length > 0) return "released";

    const finalised = await run
      .update(spendReservations)
      .set({ state: "consumed", spendOutcome: "ambiguous", consumedAt: now, updatedAt: now })
      .where(
        and(
          eq(spendReservations.id, id),
          eq(spendReservations.state, "reserved"),
          isNotNull(spendReservations.spendStartedAt),
        ),
      )
      .returning({ id: spendReservations.id });
    if (finalised.length > 0) return "consumed";

    const [row] = await run
      .select({ state: spendReservations.state })
      .from(spendReservations)
      .where(eq(spendReservations.id, id))
      .limit(1);
    if (!row) return "not_found";
    return row.state === "consumed" ? "consumed" : "already_released";
  } catch (error) {
    if (executor) throw error;
    console.error(`[spend-quota] could not release reservation ${id}`, error);
    return "not_found";
  }
}

/**
 * Releases every reservation in the list that is still unspent. With
 * `executor`, inside that transaction and throwing on failure.
 */
export async function releaseUnspent(
  reservations: Reservation[] | null | undefined,
  reason: string,
  executor?: AnyExecutor,
): Promise<void> {
  for (const r of reservations ?? []) {
    await releaseReservation(r.id, reason, executor);
  }
}

export type SpendOutcome = "paid" | "ambiguous";

/**
 * Records that spending happened (or may have), and is a no-op on a row
 * already consumed, so a retried step records once.
 *
 * Also accepts a RELEASED row: if a sweep released it in the instant between
 * holdReservation and the call returning, the money was still spent, and the
 * ledger must say so rather than stay short.
 */
export async function consumeReservation(
  id: string,
  outcome: SpendOutcome,
): Promise<"consumed" | "already_consumed" | "not_found"> {
  const now = new Date();
  const rows = await db
    .update(spendReservations)
    .set({ state: "consumed", spendOutcome: outcome, consumedAt: now, updatedAt: now })
    .where(
      and(
        eq(spendReservations.id, id),
        inArray(spendReservations.state, ["reserved", "released"]),
      ),
    )
    .returning({ id: spendReservations.id });
  if (rows.length > 0) return "consumed";

  const [row] = await db
    .select({ state: spendReservations.state })
    .from(spendReservations)
    .where(eq(spendReservations.id, id))
    .limit(1);
  return row ? "already_consumed" : "not_found";
}

/**
 * Makes sure a reservation still holds capacity, just before spending on it.
 *
 * Reserved or consumed: yes. Released — a dispatch that was given up on and
 * then delivered late, or a sweep of an abandoned request — re-takes capacity
 * under the reservation's own stored rule, or refuses. So a late or duplicate
 * job can never spend beyond the limit it was admitted under.
 */
export async function holdReservation(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(spendReservations)
      .where(eq(spendReservations.id, id))
      .limit(1);
    if (!row) return false;
    if (row.state !== "released") return true;

    await lockKey(tx, row.key);
    const now = new Date();
    const rule: QuotaRule = {
      key: row.key,
      limit: row.limitValue,
      window: row.windowSince
        ? { since: row.windowSince }
        : { seconds: row.windowSeconds ?? 0 },
    };
    const stored = (row.metadata as { floor?: unknown } | null)?.floor;
    const floor = typeof stored === "number" ? stored : 0;
    if (Math.max(await liveCount(tx, rule, now), floor) >= rule.limit) return false;

    const reclaimed = await tx
      .update(spendReservations)
      .set({ state: "reserved", countedAt: now, releasedAt: null, releaseReason: null, updatedAt: now })
      .where(and(eq(spendReservations.id, id), eq(spendReservations.state, "released")))
      .returning({ id: spendReservations.id });
    return reclaimed.length > 0;
  });
}

/**
 * Durably records that a paid call is about to be made on a reservation.
 *
 * Returns the token that owns the marker, or null when the marker was
 * already set (an earlier attempt that died after starting, whose marker
 * stays) or the row is already consumed. THROWS if the write fails: the
 * provider must not be called unless this is on disk.
 */
export async function markSpendStarted(id: string): Promise<string | null> {
  const token = randomUUID();
  const now = new Date();
  const rows = await db
    .update(spendReservations)
    .set({ spendStartedAt: now, spendToken: token, updatedAt: now })
    .where(
      and(
        eq(spendReservations.id, id),
        eq(spendReservations.state, "reserved"),
        isNull(spendReservations.spendStartedAt),
      ),
    )
    .returning({ id: spendReservations.id });
  return rows.length > 0 ? token : null;
}

/**
 * Withdraws a spend-started marker after the provider provably refused the
 * call. Only the attempt holding the token can, and only while unconsumed.
 */
async function clearSpendStarted(id: string, token: string): Promise<void> {
  await db
    .update(spendReservations)
    .set({ spendStartedAt: null, spendToken: null, updatedAt: new Date() })
    .where(
      and(
        eq(spendReservations.id, id),
        eq(spendReservations.state, "reserved"),
        eq(spendReservations.spendToken, token),
      ),
    );
}

/** Thrown before a paid call whose reservation can no longer be held. */
export class QuotaExhaustedError extends Error {
  constructor(message = "The allowance for this operation has been used up.") {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

/**
 * Whether a failed provider call may have been billed.
 *
 * "not_billed" only when the provider ANSWERED with an error status: the
 * request was received and refused, which providers do not charge for. A
 * timeout, a dropped connection or an unrecognised error is "ambiguous" — the
 * request may have been processed — and is treated as spent.
 */
export function classifySpendError(error: unknown): "not_billed" | "ambiguous" {
  if (error instanceof Anthropic.APIError && typeof error.status === "number") {
    return "not_billed";
  }
  if (error instanceof QuotaExhaustedError) return "not_billed";
  return "ambiguous";
}

/**
 * Wraps ONE paid call.
 *
 * Before: the optional entitlement check runs (inside the step, so an Inngest
 * retry after cancellation checks again rather than replaying a cached
 * answer), then every reservation must still be held, then spending is
 * recorded as STARTED on each (markSpendStarted) - durably, before the call.
 * After: success or an ambiguous failure consumes; a provider refusal
 * withdraws this attempt's marker and leaves the reservation reserved, for
 * onFailure or the caller to release.
 *
 * A ledger write that fails AFTER a successful call is logged, not thrown:
 * throwing would make Inngest retry the step and pay again. The spend-started
 * marker is what keeps that reservation from ever being released.
 */
export async function paidCall<T>(
  reservations: Reservation[] | null | undefined,
  call: () => Promise<T>,
  options: { beforeSpend?: () => Promise<void> } = {},
): Promise<T> {
  await options.beforeSpend?.();
  for (const r of reservations ?? []) {
    if (!(await holdReservation(r.id))) throw new QuotaExhaustedError();
  }
  const owned = new Map<string, string>();
  for (const r of reservations ?? []) {
    const token = await markSpendStarted(r.id);
    if (token) owned.set(r.id, token);
  }

  const consumeAll = async (outcome: SpendOutcome) => {
    for (const r of reservations ?? []) {
      await consumeReservation(r.id, outcome).catch((error) =>
        console.error(`[spend-quota] could not record spend on ${r.id}`, error),
      );
    }
  };

  let result: T;
  try {
    result = await call();
  } catch (error) {
    if (classifySpendError(error) === "ambiguous") {
      await consumeAll("ambiguous");
    } else {
      for (const [id, token] of owned) {
        await clearSpendStarted(id, token).catch((clearError) =>
          console.error(`[spend-quota] could not clear spend marker on ${id}`, clearError),
        );
      }
    }
    throw error;
  }
  await consumeAll("paid");
  return result;
}

/**
 * Settles reservations that were never consumed and never came back.
 *
 * A request that crashed between reserving and dispatching leaves a row in
 * "reserved" with no job behind it. After ABANDONED_AFTER_MS it is released;
 * if its job does turn up later, holdReservation re-takes capacity or refuses.
 *
 * A row whose paid call had STARTED is not abandoned capacity - it is a spend
 * we never heard the end of - and is consumed ("ambiguous") instead.
 */
export async function sweepAbandonedReservations(now: Date = new Date()) {
  const stale = new Date(now.getTime() - ABANDONED_AFTER_MS);
  await db
    .update(spendReservations)
    .set({ state: "consumed", spendOutcome: "ambiguous", consumedAt: now, updatedAt: now })
    .where(
      and(
        eq(spendReservations.state, "reserved"),
        isNotNull(spendReservations.spendStartedAt),
        lt(spendReservations.createdAt, stale),
      ),
    );
  await db
    .update(spendReservations)
    .set({ state: "released", releasedAt: now, releaseReason: "abandoned", updatedAt: now })
    .where(
      and(
        eq(spendReservations.state, "reserved"),
        isNull(spendReservations.spendStartedAt),
        lt(spendReservations.createdAt, stale),
      ),
    );
}

/* ------------------------------------------------------------------------- */
/* Leases: one holder at a time, expiring, released only by that holder.      */
/* ------------------------------------------------------------------------- */

export type Lease = { key: string; holder: string };

/**
 * Takes an exclusive, expiring lease, or returns null while someone else
 * holds a live one.
 *
 * Unlike a counter in a fixed window, a lease lasts exactly `seconds` from
 * when it was taken — it cannot lapse early because a clock boundary passed —
 * and an expired lease is taken over atomically by the next caller.
 */
export async function acquireLease(
  key: string,
  seconds: number,
  now: Date = new Date(),
): Promise<Lease | null> {
  const holder = randomUUID();
  const expiresAt = new Date(now.getTime() + seconds * 1000);
  const rows = await db
    .insert(operationLeases)
    .values({ key, holder, expiresAt, acquiredAt: now })
    .onConflictDoUpdate({
      target: operationLeases.key,
      set: { holder, expiresAt, acquiredAt: now },
      setWhere: lte(operationLeases.expiresAt, now),
    })
    .returning({ holder: operationLeases.holder });
  return rows[0]?.holder === holder ? { key, holder } : null;
}

/**
 * Ends a lease — only if the caller still holds it. A holder whose lease
 * expired and was taken over cannot release the new holder's.
 */
export async function releaseLease(lease: Lease): Promise<boolean> {
  try {
    const rows = await db
      .delete(operationLeases)
      .where(and(eq(operationLeases.key, lease.key), eq(operationLeases.holder, lease.holder)))
      .returning({ key: operationLeases.key });
    return rows.length > 0;
  } catch (error) {
    console.error(`[spend-quota] could not release lease ${lease.key}`, error);
    return false;
  }
}
