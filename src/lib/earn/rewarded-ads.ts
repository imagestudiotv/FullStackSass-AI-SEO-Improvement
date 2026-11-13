import "server-only";

import { and, count, desc, eq, lt, sql } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { rewardedAdViews } from "@/lib/db/schema";
import type { Executor, Transaction } from "@/lib/db/types";

import { rewardedAdsConfig, type RewardedAdsConfig } from "./rewarded-ads-config";

/**
 * "Watch an ad to earn credits" (client ticket, 2026-11-13; his reference:
 * a card with "10 ads/day" and a countdown, and Google's full-screen
 * rewarded ad). The ad is Google Publisher Tag's rewarded format, served by
 * Google Ad Manager; the credits are RepGet's.
 *
 *  1. START (the member opts in on the card): an attempt row is created only
 *     when the feature is on, the member is under the daily limit, outside
 *     the cooldown, and the workspace and RepGet-wide caps are not reached.
 *     A newer start closes the member's open one ("superseded"), so there is
 *     never more than one open attempt (and the partial unique index makes
 *     that a database rule, not a hope).
 *  2. The browser requests the ad and, after a second, explicit press, shows it.
 *  3. CLAIM, on GPT's rewardedSlotGranted event: the attempt must be the
 *     member's own, in the workspace they are in, still open, started at
 *     least `minSeconds` and at most `sessionMinutes` ago; the limit, the
 *     cooldown and the caps are checked again; then the attempt is marked
 *     granted and the credits are written IN ONE TRANSACTION, the ledger row
 *     keyed "rewarded-ad:<id>". Two claims of one attempt credit it once.
 *  4. END, when the ad closed without a reward, there was no ad, or it could
 *     not load: the attempt is closed with nothing credited.
 *
 * WHAT THIS DOES NOT PROVE. rewardedSlotGranted is an event in the member's
 * browser. GPT gives a web page no signed, per-user confirmation that Google
 * served and completed the ad, so a determined person could call the claim
 * without watching. The checks above bound what that is worth: at most the
 * daily limit, one per cooldown, inside the caps - never more.
 *
 * WHAT THE CREDITS ARE. Ordinary service credits ("reward" in the ledger, as
 * the other Earn Credits rewards): spent inside RepGet, never transferable,
 * never paid out. Partner payouts are computed from partner commissions on
 * real payments (lib/partners), which never read the credit ledger.
 *
 * Every time is the application's (UTC wall-clock), passed in as `now`, and
 * compared here - never the database's now(), whose zone may not be UTC.
 */

export type RewardedAdRefusal =
  | "disabled"
  | "daily_limit"
  | "cooldown"
  | "cap"
  | "attempts"
  | "not_found"
  | "not_open"
  | "too_early"
  | "expired";

/** What the card shows, as the server counts it. */
export type RewardedAdState = {
  rewardCredits: number;
  dailyLimit: number;
  /** Ads that earned credits today (UTC), for this member. */
  watchedToday: number;
  /** When the next ad can start, while the cooldown runs; null otherwise. */
  cooldownUntil: string | null;
  /** The workspace's or RepGet's cap for today is reached. */
  capReached: boolean;
  /** Too many attempts today without a reward (no ad, closed early); try again tomorrow. */
  attemptsExhausted: boolean;
  adUnitPath: string;
  testMode: boolean;
};

export type StartResult =
  | { ok: true; sessionId: string; state: RewardedAdState }
  | { ok: false; error: RewardedAdRefusal; state: RewardedAdState | null };

export type ClaimResult =
  | { ok: true; credits: number; state: RewardedAdState }
  | { ok: false; error: RewardedAdRefusal; state: RewardedAdState | null };

/** Why an attempt closed without credits, as the browser reports it. */
export const END_REASONS = ["closed_early", "no_fill", "unsupported", "blocked", "timeout"] as const;
export type EndReason = (typeof END_REASONS)[number];

export function isEndReason(value: unknown): value is EndReason {
  return typeof value === "string" && (END_REASONS as readonly string[]).includes(value);
}

/** Attempts per member per day, whatever their outcome: enough for some "no ad right now", not for hammering. */
export function attemptsAllowed(config: Pick<RewardedAdsConfig, "dailyLimit">): number {
  return config.dailyLimit * 3 + 5;
}

export function rewardedAdKey(sessionId: string): string {
  return `rewarded-ad:${sessionId}`;
}

/** The UTC calendar day of a moment, "YYYY-MM-DD". */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Serialises one member's starts and claims, and (for claims) the day's caps. */
async function lock(tx: Transaction, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

type Counts = { userGranted: number; userAttempts: number; orgGranted: number; globalGranted: number; lastGrantAt: Date | null };

async function counts(executor: Executor, userId: string, organizationId: string, day: string): Promise<Counts> {
  const granted = and(eq(rewardedAdViews.day, day), eq(rewardedAdViews.status, "granted"));
  // One after another: inside a transaction they share one connection.
  const [user] = await executor.select({ n: count() }).from(rewardedAdViews).where(and(granted, eq(rewardedAdViews.userId, userId)));
  const [attempts] = await executor
    .select({ n: count() })
    .from(rewardedAdViews)
    .where(and(eq(rewardedAdViews.day, day), eq(rewardedAdViews.userId, userId)));
  const [org] = await executor.select({ n: count() }).from(rewardedAdViews).where(and(granted, eq(rewardedAdViews.organizationId, organizationId)));
  const [all] = await executor.select({ n: count() }).from(rewardedAdViews).where(granted);
  // The cooldown runs from the member's latest reward, whichever day it was.
  const [last] = await executor
    .select({ at: rewardedAdViews.endedAt })
    .from(rewardedAdViews)
    .where(and(eq(rewardedAdViews.userId, userId), eq(rewardedAdViews.status, "granted")))
    .orderBy(desc(rewardedAdViews.endedAt))
    .limit(1);
  return {
    userGranted: Number(user?.n ?? 0),
    userAttempts: Number(attempts?.n ?? 0),
    orgGranted: Number(org?.n ?? 0),
    globalGranted: Number(all?.n ?? 0),
    lastGrantAt: last?.at ?? null,
  };
}

function stateOf(config: RewardedAdsConfig, c: Counts, now: Date): RewardedAdState {
  const until = c.lastGrantAt ? new Date(c.lastGrantAt.getTime() + config.cooldownSeconds * 1000) : null;
  return {
    rewardCredits: config.rewardCredits,
    dailyLimit: config.dailyLimit,
    watchedToday: c.userGranted,
    cooldownUntil: until && until > now ? until.toISOString() : null,
    capReached: c.orgGranted >= config.workspaceDailyCap || c.globalGranted >= config.globalDailyCap,
    attemptsExhausted: c.userAttempts >= attemptsAllowed(config),
    adUnitPath: config.adUnitPath ?? "",
    testMode: config.testMode,
  };
}

/** The first rule a new reward would break, or null. `attempts` only matters for a start. */
function refusalOf(state: RewardedAdState, checkAttempts: boolean): RewardedAdRefusal | null {
  if (state.watchedToday >= state.dailyLimit) return "daily_limit";
  if (state.cooldownUntil) return "cooldown";
  if (state.capReached) return "cap";
  if (checkAttempts && state.attemptsExhausted) return "attempts";
  return null;
}

/** The card's state for this member, or null when the feature is off (the card is then not shown). */
export async function loadRewardedAdState(
  userId: string,
  organizationId: string,
  now: Date = new Date(),
  config: RewardedAdsConfig = rewardedAdsConfig(),
): Promise<RewardedAdState | null> {
  if (!config.enabled) return null;
  return stateOf(config, await counts(db, userId, organizationId, utcDay(now)), now);
}

/**
 * Opens an attempt. `userId` and `organizationId` are the signed-in session's
 * (lib/earn/rewarded-ads-actions.ts), never values a browser sent.
 */
export async function startRewardedAd(
  userId: string,
  organizationId: string,
  now: Date = new Date(),
  config: RewardedAdsConfig = rewardedAdsConfig(),
): Promise<StartResult> {
  if (!config.enabled) return { ok: false, error: "disabled", state: null };
  const day = utcDay(now);
  return db.transaction(async (tx) => {
    await lock(tx, `rewarded-ads:user:${userId}`);
    // An open attempt past its time is expired; a newer start closes the other open one.
    const stale = new Date(now.getTime() - config.sessionMinutes * 60_000);
    await tx
      .update(rewardedAdViews)
      .set({ status: "expired", endedAt: now })
      .where(and(eq(rewardedAdViews.userId, userId), eq(rewardedAdViews.status, "started"), lt(rewardedAdViews.startedAt, stale)));
    await tx
      .update(rewardedAdViews)
      .set({ status: "cancelled", reason: "superseded", endedAt: now })
      .where(and(eq(rewardedAdViews.userId, userId), eq(rewardedAdViews.status, "started")));

    const state = stateOf(config, await counts(tx, userId, organizationId, day), now);
    const refusal = refusalOf(state, true);
    if (refusal) return { ok: false as const, error: refusal, state };

    const [row] = await tx
      .insert(rewardedAdViews)
      .values({ organizationId, userId, status: "started", rewardCredits: config.rewardCredits, day, startedAt: now })
      .returning({ id: rewardedAdViews.id });
    return { ok: true as const, sessionId: row.id, state };
  });
}

/**
 * Credits one attempt, after the browser reported GPT's rewardedSlotGranted.
 * Safe to call twice: the second finds the attempt granted and adds nothing.
 */
export async function claimRewardedAd(
  userId: string,
  organizationId: string,
  sessionId: string,
  now: Date = new Date(),
  config: RewardedAdsConfig = rewardedAdsConfig(),
): Promise<ClaimResult> {
  if (!config.enabled) return { ok: false, error: "disabled", state: null };
  if (!UUID.test(sessionId)) return { ok: false, error: "not_found", state: null };

  const outcome = await db.transaction(async (tx) => {
    await lock(tx, `rewarded-ads:user:${userId}`);
    // The caps are RepGet-wide: claims are rare and short, so one lock for them all.
    await lock(tx, "rewarded-ads:caps");
    const [view] = await tx
      .select()
      .from(rewardedAdViews)
      .where(and(eq(rewardedAdViews.id, sessionId), eq(rewardedAdViews.userId, userId), eq(rewardedAdViews.organizationId, organizationId)))
      .limit(1)
      .for("update");
    if (!view) return { ok: false as const, error: "not_found" as const };
    if (view.status === "granted") return { ok: true as const, credits: view.rewardCredits, again: true };
    if (view.status !== "started") return { ok: false as const, error: "not_open" as const };

    const close = async (status: "expired" | "rejected", reason: string) => {
      await tx.update(rewardedAdViews).set({ status, reason, endedAt: now }).where(eq(rewardedAdViews.id, view.id));
    };
    const elapsed = now.getTime() - view.startedAt.getTime();
    if (elapsed > config.sessionMinutes * 60_000) {
      await close("expired", "expired");
      return { ok: false as const, error: "expired" as const };
    }
    if (elapsed < config.minSeconds * 1000) {
      await close("rejected", "too_early");
      return { ok: false as const, error: "too_early" as const };
    }
    const refusal = refusalOf(stateOf(config, await counts(tx, userId, organizationId, view.day), now), false);
    if (refusal) {
      await close("rejected", refusal);
      return { ok: false as const, error: refusal };
    }

    const [granted] = await tx
      .update(rewardedAdViews)
      .set({ status: "granted", endedAt: now })
      .where(and(eq(rewardedAdViews.id, view.id), eq(rewardedAdViews.status, "started")))
      .returning({ id: rewardedAdViews.id });
    if (!granted) return { ok: false as const, error: "not_open" as const };
    await recordCredit(
      organizationId,
      { type: "reward", amount: view.rewardCredits, referenceId: view.id, idempotencyKey: rewardedAdKey(view.id), note: "Earn Credits: rewarded ad watched" },
      tx,
    );
    return { ok: true as const, credits: view.rewardCredits, again: false };
  });

  const state = await loadRewardedAdState(userId, organizationId, now, config);
  return outcome.ok ? { ok: true, credits: outcome.credits, state: state! } : { ok: false, error: outcome.error, state };
}

/** Closes the member's own open attempt with nothing credited. Returns whether one was closed. */
export async function endRewardedAd(
  userId: string,
  organizationId: string,
  sessionId: string,
  reason: EndReason,
  now: Date = new Date(),
): Promise<boolean> {
  if (!UUID.test(sessionId)) return false;
  const rows = await db
    .update(rewardedAdViews)
    .set({ status: "cancelled", reason, endedAt: now })
    .where(
      and(
        eq(rewardedAdViews.id, sessionId),
        eq(rewardedAdViews.userId, userId),
        eq(rewardedAdViews.organizationId, organizationId),
        eq(rewardedAdViews.status, "started"),
      ),
    )
    .returning({ id: rewardedAdViews.id });
  return rows.length > 0;
}
