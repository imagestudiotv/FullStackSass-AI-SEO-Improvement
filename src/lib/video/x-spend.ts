import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerSpend, providerSpendEvents, usageEvents } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * Videos on X (client, 2026-11-12: "implement X with proper API cost tracking
 * and spending limits. Make X available only when the integration is
 * configured and costs are controlled").
 *
 * X meters every post through its API; bundle.social posts with its own X
 * app and takes X's fee from the prepaid balance on RepGet's bundle.social
 * account (docs/social-media.md). So videos go to X only when:
 *  - X_VIDEO_POSTS_ENABLED=1, and
 *  - X_VIDEO_MONTHLY_LIMIT_USD is a positive number (RepGet-wide, per UTC month).
 * X_VIDEO_COST_PER_POST_USD is what one video post is counted at (default
 * DEFAULT_X_COST_PER_POST_USD, conservative: see the constant).
 *
 * Each post reserves its cost first with ONE conditional UPDATE
 * (reserved + spent + amount <= limit), so simultaneous posts never go over
 * the limit; it is charged after bundle.social accepted the post and released
 * when it failed. A reservation is keyed (x:<ideaId>:<attempt>): a retried
 * step reuses its key and never reserves twice. Nothing ever tops up a
 * balance: when the month's limit is used, X waits for the next month.
 */

export const X_SPEND_SCOPE = "x_posts";

/**
 * USD one X video post is counted at when X_VIDEO_COST_PER_POST_USD is not
 * set. X's pay-per-use price for creating a post is $0.015 and $0.20 for a
 * post with a link (docs/social-media.md, bundle.social's figures); a video
 * post also uploads media. RepGet sends videos to X without a link, and
 * counts each at the link price so the limit holds whatever the media
 * upload costs: deliberately on the safe side.
 */
export const DEFAULT_X_COST_PER_POST_USD = 0.2;

export type XVideoConfig = { enabled: boolean; limitUsd: number; costPerPostUsd: number };

function positive(value: string | undefined): number | null {
  const n = Number(value?.trim());
  return value?.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

export function xVideoConfig(): XVideoConfig {
  const limitUsd = positive(process.env.X_VIDEO_MONTHLY_LIMIT_USD) ?? 0;
  return {
    enabled: process.env.X_VIDEO_POSTS_ENABLED?.trim() === "1" && limitUsd > 0,
    limitUsd,
    costPerPostUsd: positive(process.env.X_VIDEO_COST_PER_POST_USD) ?? DEFAULT_X_COST_PER_POST_USD,
  };
}

/** A UTC month, "2026-11". */
export const spendPeriod = (now: Date = new Date()) => now.toISOString().slice(0, 7);

export const xSpendKey = (ideaId: string, attempt: number) => `x:${ideaId}:${attempt}`;

export type XUnavailable = "disabled" | "no_limit" | "limit_reached";

export type XVideoStatus = {
  /** Whether a video can go to X now. */
  available: boolean;
  reason: XUnavailable | null;
  /** RepGet's own figures (internal: not for customers). */
  limitUsd: number;
  reservedUsd: number;
  spentUsd: number;
  costPerPostUsd: number;
  period: string;
};

/** Makes sure this month's row exists with the configured limit. */
async function ensurePeriod(config: XVideoConfig, period: string, executor: Executor) {
  await executor
    .insert(providerSpend)
    .values({ scope: X_SPEND_SCOPE, period, limitUsd: config.limitUsd.toFixed(6) })
    .onConflictDoUpdate({
      target: [providerSpend.scope, providerSpend.period],
      set: { limitUsd: config.limitUsd.toFixed(6), updatedAt: new Date() },
      setWhere: sql`${providerSpend.limitUsd} <> ${config.limitUsd.toFixed(6)}::numeric`,
    });
}

/** Whether X takes videos now, and this month's figures. */
export async function xVideoStatus(now: Date = new Date(), executor: Executor = db): Promise<XVideoStatus> {
  const config = xVideoConfig();
  const period = spendPeriod(now);
  const base = { limitUsd: config.limitUsd, reservedUsd: 0, spentUsd: 0, costPerPostUsd: config.costPerPostUsd, period };
  if (process.env.X_VIDEO_POSTS_ENABLED?.trim() !== "1") return { ...base, available: false, reason: "disabled" };
  if (!config.enabled) return { ...base, available: false, reason: "no_limit" };
  const [row] = await executor
    .select()
    .from(providerSpend)
    .where(and(eq(providerSpend.scope, X_SPEND_SCOPE), eq(providerSpend.period, period)));
  const reservedUsd = Number(row?.reservedUsd ?? 0);
  const spentUsd = Number(row?.spentUsd ?? 0);
  const room = config.limitUsd - reservedUsd - spentUsd;
  const available = room + 1e-9 >= config.costPerPostUsd;
  return { ...base, reservedUsd, spentUsd, available, reason: available ? null : "limit_reached" };
}

export type XReservation = { ok: true; key: string; amountUsd: number; reused: boolean } | { ok: false; reason: XUnavailable };

class NoRoom extends Error {}

/**
 * Reserves one X post's cost against this month's limit. The same key again
 * (a retried step) returns the existing reservation; a released one is
 * reserved again only if there is still room.
 */
export async function reserveXSpend(
  input: { key: string; websiteId: string | null; ideaId: string | null; amountUsd?: number; now?: Date },
  executor: Executor = db,
): Promise<XReservation> {
  const config = xVideoConfig();
  if (process.env.X_VIDEO_POSTS_ENABLED?.trim() !== "1") return { ok: false, reason: "disabled" };
  if (!config.enabled) return { ok: false, reason: "no_limit" };
  const now = input.now ?? new Date();
  const period = spendPeriod(now);
  const amount = (input.amountUsd ?? config.costPerPostUsd).toFixed(6);
  await ensurePeriod(config, period, executor);

  /** The one conditional UPDATE: it waits for any other reservation on the row and re-checks the room after it. */
  const take = async (tx: Executor) => {
    const rows = await tx
      .update(providerSpend)
      .set({ reservedUsd: sql`${providerSpend.reservedUsd} + ${amount}::numeric`, updatedAt: now })
      .where(
        and(
          eq(providerSpend.scope, X_SPEND_SCOPE),
          eq(providerSpend.period, period),
          sql`${providerSpend.reservedUsd} + ${providerSpend.spentUsd} + ${amount}::numeric <= ${providerSpend.limitUsd}`,
        ),
      )
      .returning({ id: providerSpend.id });
    return rows.length > 0;
  };

  try {
    return await executor.transaction(async (tx) => {
      // The unique key makes a second caller with the same key wait for the first one's outcome.
      const inserted = await tx
        .insert(providerSpendEvents)
        .values({ scope: X_SPEND_SCOPE, period, key: input.key, websiteId: input.websiteId, ideaId: input.ideaId, amountUsd: amount, status: "reserved" })
        .onConflictDoNothing({ target: providerSpendEvents.key })
        .returning({ id: providerSpendEvents.id });
      if (inserted.length === 0) {
        const [event] = await tx.select().from(providerSpendEvents).where(eq(providerSpendEvents.key, input.key)).for("update");
        if (event && event.status !== "released") return { ok: true as const, key: input.key, amountUsd: Number(event.amountUsd), reused: true };
        if (!(await take(tx))) throw new NoRoom();
        await tx
          .update(providerSpendEvents)
          .set({ status: "reserved", period, amountUsd: amount, updatedAt: now })
          .where(eq(providerSpendEvents.key, input.key));
        return { ok: true as const, key: input.key, amountUsd: Number(amount), reused: false };
      }
      if (!(await take(tx))) throw new NoRoom();
      return { ok: true as const, key: input.key, amountUsd: Number(amount), reused: false };
    });
  } catch (error) {
    if (error instanceof NoRoom) return { ok: false, reason: "limit_reached" };
    throw error;
  }
}

/** Moves a reservation (reserved -> charged | released) and its amount on the month's row; once per key. */
async function settleReservation(key: string, to: "charged" | "released", note: string | null, executor: Executor): Promise<boolean> {
  return executor.transaction(async (tx) => {
    const [event] = await tx
      .update(providerSpendEvents)
      .set({ status: to, note: note?.slice(0, 300) ?? null, updatedAt: new Date() })
      .where(and(eq(providerSpendEvents.key, key), eq(providerSpendEvents.status, "reserved")))
      .returning();
    if (!event) return false;
    await tx
      .update(providerSpend)
      .set({
        reservedUsd: sql`greatest(${providerSpend.reservedUsd} - ${event.amountUsd}::numeric, 0)`,
        ...(to === "charged" ? { spentUsd: sql`${providerSpend.spentUsd} + ${event.amountUsd}::numeric` } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(providerSpend.scope, event.scope), eq(providerSpend.period, event.period)));
    return true;
  });
}

/** bundle.social accepted the post: the reservation becomes spending. */
export async function chargeXSpend(key: string, executor: Executor = db): Promise<boolean> {
  return settleReservation(key, "charged", null, executor);
}

/** The post failed or was never sent: the reservation goes back to the month's room. */
export async function releaseXSpend(key: string, note: string | null = null, executor: Executor = db): Promise<boolean> {
  return settleReservation(key, "released", note, executor);
}

/**
 * The metered X call in usage_events (unit economics per workspace): kind
 * "social_api", provider "x", with the counted cost and the attempt.
 */
export async function trackXPost(
  input: { organizationId: string; websiteId: string; ideaId: string; key: string; amountUsd: number; outcome: "accepted" | "failed"; attempt: number },
  executor: Executor = db,
): Promise<void> {
  await executor.insert(usageEvents).values({
    organizationId: input.organizationId,
    websiteId: input.websiteId,
    kind: "social_api",
    provider: "x",
    model: "bundle.social",
    quantity: 1,
    costUsd: input.outcome === "accepted" ? input.amountUsd.toFixed(6) : "0",
    metadata: { purpose: "video_x_post", ideaId: input.ideaId, key: input.key, outcome: input.outcome, attempt: input.attempt },
  });
}
