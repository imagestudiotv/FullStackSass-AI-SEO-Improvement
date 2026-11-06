import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, min, notLike } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { isFreeArticlesTrial } from "@/lib/billing/entitlement-period";
import { db } from "@/lib/db";
import { creditLedger, subscriptions } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { readCreditSettings, TRIAL_CREDIT_DAYS } from "./prices";

/**
 * Daily credits (client, 2026-10-26): a few credits "to encourage people to
 * login on the platform each day", and - his answer once the first version
 * let them lapse at midnight - "they are not expire at midnight, but stays
 * forever".
 *
 * MANUAL since the client's ticket of 2026-11-05: the customer checks in, once
 * a day, with a deliberate click. They are ordinary ledger rows ("daily_grant")
 * written only by claimDailyCredits; readDailyStatus, which every page showing
 * the credits calls, reports where the workspace stands and writes nothing. A
 * day without a check-in gives nothing, and cannot be claimed afterwards. Once
 * given they are like any other credit: they never expire, and pay for
 * anything, backlinks included.
 *
 * The amount is an administrator's setting (Admin -> Credits, "daily_free");
 * 0 turns them off.
 *
 * A TRIAL (client, 2026-10-27) gets its own amount ("trial_daily_free", 15)
 * so it can try what credits buy - the website check again, social posts -
 * but only on the first TRIAL_CREDIT_DAYS days of its free articles: "the 4th
 * day the free credit is not given". Those days are counted from the trial's
 * start in whole 24-hour days, not UTC days, so a trial started at 23:00
 * still has three grants, never four. After them nothing more is given until
 * the plan starts; the free articles themselves carry on as before.
 */

/** Statuses that earn daily credits: a paid plan, as for the monthly credits (lib/backlinks/credits.ts). */
const DAILY_CREDIT_STATUSES = ["active"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day of a moment, "YYYY-MM-DD". */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The ledger operation id of one workspace's credits for one day. */
export function dailyGrantKey(organizationId: string, now: Date): string {
  return `daily:${organizationId}:${utcDay(now)}`;
}

/** The ledger operation id of a trial's credits for one of its days (0 is the first). */
export function trialGrantKey(organizationId: string, trialDay: number): string {
  return `daily:${organizationId}:trial-${trialDay + 1}`;
}

/**
 * Which daily credits a workspace earns now:
 *  - "paid": it pays for a plan on at least one website;
 *  - "trial": a website is on its free articles, in day `day` (0-based) of
 *    the trial's first TRIAL_CREDIT_DAYS;
 *  - "trial_over": on its free articles, after those days;
 *  - "none": anything else.
 * A paid plan wins over a trial on another website.
 */
export type DailyEarning =
  | { kind: "paid" }
  | { kind: "trial"; day: number; endsAt: Date }
  | { kind: "trial_over"; endsAt: Date }
  | { kind: "none" };

export async function dailyEarning(
  executor: Executor,
  organizationId: string,
  now: Date = new Date(),
): Promise<DailyEarning> {
  const rows = await executor
    .select({
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        isNotNull(subscriptions.websiteId),
        inArray(subscriptions.status, [...DAILY_CREDIT_STATUSES, "trialing"]),
      ),
    )
    .orderBy(asc(subscriptions.currentPeriodStart));

  if (rows.some((row) => DAILY_CREDIT_STATUSES.includes(row.status ?? ""))) return { kind: "paid" };

  // One trial per workspace, ever (isTrialEligible), so the first is the one.
  const trial = rows.find(isFreeArticlesTrial);
  const start = trial?.currentPeriodStart;
  if (!start) return { kind: "none" };

  const endsAt = new Date(start.getTime() + TRIAL_CREDIT_DAYS * DAY_MS);
  const day = Math.floor((now.getTime() - start.getTime()) / DAY_MS);
  if (day >= 0 && day < TRIAL_CREDIT_DAYS) return { kind: "trial", day, endsAt };
  return { kind: "trial_over", endsAt };
}

/** One day of the check-in strip. A past day that was not claimed stays missed: it can never be claimed afterwards. */
export type DailyProgressDay = {
  /** 1-based position in the strip. */
  day: number;
  when: "past" | "today" | "future";
  claimed: boolean;
};

/**
 * Where a workspace stands with its daily credits. Reading this writes
 * nothing: only claimDailyCredits does.
 */
export type DailyCredits = {
  plan: DailyEarning["kind"];
  /** Whether this workspace earns daily credits now (a paid plan, or a trial's first days). */
  eligible: boolean;
  /** Credits one check-in gives: the trial's amount on a trial, otherwise the paid plan's. */
  perDay: number;
  /** The paid plan's amount, whichever the workspace is on, for "with a paid plan you get...". */
  paidPerDay: number;
  /** What the ledger holds for the current day (0 before the check-in, or when not eligible). */
  today: number;
  /** Whether a claim would add credits right now. */
  claimable: boolean;
  /** When the next check-in opens, once this one is done. Null while one is open, or when no other is coming. */
  nextAt: Date | null;
  /** Consecutive UTC days with a check-in, up to today (or up to yesterday, while today's is still open). */
  streak: number;
  /** The strip: seven days cycling on a paid plan, the trial's own days on a trial. Empty when there is nothing to claim. */
  progress: DailyProgressDay[];
  /** On the free articles: when the trial's daily credits stop (or stopped). Null otherwise. */
  trialEndsAt: Date | null;
};

export type DailyClaimOutcome = "claimed" | "already_claimed" | "not_eligible";

export type DailyClaim = {
  outcome: DailyClaimOutcome;
  /** The credits the ledger holds for the current day, whichever request wrote them. */
  amount: number;
  status: DailyCredits;
};

type Grant = { key: string; amount: number; referenceId: string | null; createdAt: Date };

/** How many days the paid plan's strip runs before it starts again. Day 7 pays the same as day 1. */
const PROGRESS_DAYS = 7;

/** The most recent check-ins read for the streak. A longer streak reads as this. */
const STREAK_LOOKBACK = 400;

const DATED_KEY = /:(\d{4}-\d{2}-\d{2})$/;

/** Whole UTC days since the epoch, for counting across months. */
const dayNumber = (at: Date) => Math.floor(at.getTime() / DAY_MS);

/**
 * The UTC calendar day of one check-in, which is what a streak counts.
 *
 * A paid plan's key names its day. A trial's key names a TRIAL day, 24 hours
 * from the trial's start, which spans two calendar days - so a trial's claim
 * records its UTC day in reference_id. Trial rows from before claims have only
 * created_at: UTC wall-clock in production, while a database running in another
 * time zone (a local one may) shifts those old rows by its offset.
 */
function grantDay(grant: Grant): string {
  return DATED_KEY.exec(grant.key)?.[1] ?? grant.referenceId ?? utcDay(grant.createdAt);
}

async function readGrants(organizationId: string): Promise<{ grants: Grant[]; firstDatedKey: string | null }> {
  const scope = and(
    eq(creditLedger.organizationId, organizationId),
    eq(creditLedger.type, "daily_grant"),
    isNotNull(creditLedger.idempotencyKey),
  );
  const [rows, [first]] = await Promise.all([
    db
      .select({
        key: creditLedger.idempotencyKey,
        amount: creditLedger.amount,
        referenceId: creditLedger.referenceId,
        createdAt: creditLedger.createdAt,
      })
      .from(creditLedger)
      .where(scope)
      .orderBy(desc(creditLedger.createdAt))
      .limit(STREAK_LOOKBACK),
    // The keys end in the date, so the smallest is the earliest.
    db
      .select({ key: min(creditLedger.idempotencyKey) })
      .from(creditLedger)
      .where(and(scope, notLike(creditLedger.idempotencyKey, "%:trial-%"))),
  ]);
  return { grants: rows.map((row) => ({ ...row, key: row.key ?? "" })), firstDatedKey: first?.key ?? null };
}

function streakOf(days: Set<string>, now: Date): number {
  // Today's check-in still being open does not break a streak; yesterday's being missed does.
  let cursor = days.has(utcDay(now)) ? now.getTime() : now.getTime() - DAY_MS;
  let streak = 0;
  while (days.has(utcDay(new Date(cursor)))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/**
 * Seven days counted from the workspace's first paid check-in, starting again
 * after the seventh. The calendar decides where the strip is, not what was
 * claimed, so a missed day shows as missed. Only the strip cycles: the balance
 * never resets.
 */
function paidProgress(days: Set<string>, firstDatedKey: string | null, now: Date): DailyProgressDay[] {
  const today = dayNumber(now);
  const firstDay = firstDatedKey ? DATED_KEY.exec(firstDatedKey)?.[1] : null;
  const anchor = firstDay ? dayNumber(new Date(`${firstDay}T00:00:00Z`)) : today;
  const position = (today - anchor) % PROGRESS_DAYS;
  return Array.from({ length: PROGRESS_DAYS }, (_, index) => ({
    day: index + 1,
    when: index < position ? "past" : index === position ? "today" : "future",
    claimed: days.has(utcDay(new Date((today - position + index) * DAY_MS))),
  }));
}

/** A trial's own days, from its keys, which need no calendar: it only ever has TRIAL_CREDIT_DAYS of them. */
function trialProgress(grants: Grant[], organizationId: string, trialDay: number): DailyProgressDay[] {
  const keys = new Set(grants.map((grant) => grant.key));
  return Array.from({ length: TRIAL_CREDIT_DAYS }, (_, index) => ({
    day: index + 1,
    when: index < trialDay ? "past" : index === trialDay ? "today" : "future",
    claimed: keys.has(trialGrantKey(organizationId, index)),
  }));
}

/** The status, and the one grant a claim would write now, if any. */
async function loadStatus(
  organizationId: string,
  now: Date,
): Promise<{ status: DailyCredits; grant: { key: string; amount: number; note: string; referenceId: string | null } | null }> {
  const { dailyFree, trialDailyFree } = await readCreditSettings();
  const earning = await dailyEarning(db, organizationId, now);
  const closed: DailyCredits = {
    plan: earning.kind,
    eligible: false,
    perDay: dailyFree,
    paidPerDay: dailyFree,
    today: 0,
    claimable: false,
    nextAt: null,
    streak: 0,
    progress: [],
    trialEndsAt: null,
  };

  if (earning.kind === "none") return { status: closed, grant: null };
  if (earning.kind === "trial_over" || (earning.kind === "trial" && trialDailyFree === 0)) {
    return { status: { ...closed, trialEndsAt: trialDailyFree > 0 ? earning.endsAt : null }, grant: null };
  }

  const trial = earning.kind === "trial" ? earning : null;
  const amount = trial ? trialDailyFree : dailyFree;
  const key = trial ? trialGrantKey(organizationId, trial.day) : dailyGrantKey(organizationId, now);
  const { grants, firstDatedKey } = await readGrants(organizationId);
  const today = grants.find((grant) => grant.key === key)?.amount ?? 0;
  const days = new Set(grants.map(grantDay));

  let nextAt: Date | null = null;
  if (today > 0 && amount > 0) {
    if (!trial) nextAt = new Date((dayNumber(now) + 1) * DAY_MS);
    else if (trial.day + 1 < TRIAL_CREDIT_DAYS) nextAt = new Date(trial.endsAt.getTime() - (TRIAL_CREDIT_DAYS - trial.day - 1) * DAY_MS);
  }

  return {
    status: {
      ...closed,
      eligible: true,
      perDay: amount,
      today,
      claimable: amount > 0 && today === 0,
      nextAt,
      streak: streakOf(days, now),
      progress: amount === 0 ? [] : trial ? trialProgress(grants, organizationId, trial.day) : paidProgress(days, firstDatedKey, now),
      trialEndsAt: trial?.endsAt ?? null,
    },
    grant:
      amount > 0
        ? {
            key,
            amount,
            note: trial ? `Trial credits, day ${trial.day + 1} of ${TRIAL_CREDIT_DAYS}` : "Daily credits",
            referenceId: trial ? utcDay(now) : null,
          }
        : null,
  };
}

/**
 * The workspace's daily credits as the ledger has them. Safe on any page, in
 * any number of requests: it never writes. Never throws: a failed read is
 * logged and shows as nothing to claim, and the next page load reads again.
 */
export async function readDailyStatus(organizationId: string, now: Date = new Date()): Promise<DailyCredits> {
  try {
    return (await loadStatus(organizationId, now)).status;
  } catch (error) {
    console.error("[credits] daily credits could not be read", error);
    return { plan: "none", eligible: false, perDay: 0, paidPerDay: 0, today: 0, claimable: false, nextAt: null, streak: 0, progress: [], trialEndsAt: null };
  }
}

/**
 * The customer's check-in: the ONLY way daily credits are given. Callers pass
 * the workspace of the signed-in session (lib/credits/daily-actions.ts), never
 * one a client named.
 *
 * The ledger's unique key decides: of any number of simultaneous claims one
 * inserts and the rest find its row, so tabs, double clicks and retries give
 * credits once, and a grant already made for the day - the automatic one on
 * the day claims went live included - counts as claimed.
 *
 * Throws if the ledger cannot be reached, so a claim is never reported as
 * done without a row behind it. Never call it inside a transaction: it writes
 * through the shared `db`.
 */
export async function claimDailyCredits(organizationId: string, now: Date = new Date()): Promise<DailyClaim> {
  const { status, grant } = await loadStatus(organizationId, now);
  if (!status.eligible) return { outcome: "not_eligible", amount: 0, status };
  if (status.today > 0) return { outcome: "already_claimed", amount: status.today, status };
  if (!grant) return { outcome: "not_eligible", amount: 0, status };

  const inserted = await recordCredit(organizationId, {
    type: "daily_grant",
    amount: grant.amount,
    idempotencyKey: grant.key,
    referenceId: grant.referenceId,
    note: grant.note,
  });
  const after = (await loadStatus(organizationId, now)).status;
  if (after.today <= 0) throw new Error("[credits] a daily claim left no grant in the ledger");
  return { outcome: inserted ? "claimed" : "already_claimed", amount: after.today, status: after };
}
