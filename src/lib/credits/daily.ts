import "server-only";

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

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
 * So they are ordinary ledger rows ("daily_grant"), given on each UTC day a
 * paying workspace USES RepGet: the first page that shows its credits that
 * day grants them (lib/credits/overview.ts), the way the monthly plan credits
 * are granted lazily. A day without a visit gives nothing - that is the
 * reason to come back. Once given they are like any other credit: they never
 * expire, and pay for anything, backlinks included.
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

export type DailyCredits = {
  /** Whether this workspace earns daily credits now (a paid plan, or a trial's first days). */
  eligible: boolean;
  /** Credits given per day of use: the trial's amount on a trial, otherwise the paid plan's. */
  perDay: number;
  /** What today's visit was given (0 before it, or when not eligible). */
  today: number;
  /** On the free articles: when the trial's daily credits stop (or stopped). Null otherwise. */
  trialEndsAt: Date | null;
};

/**
 * Grants today's credits if this workspace earns them and has not had them
 * yet. Keyed per workspace per UTC day (per trial day on a trial), so any
 * number of page loads - concurrent ones included - grant once. Never throws:
 * a failed grant is logged and the next page load tries again.
 *
 * Never call it inside a transaction: it writes through the shared `db`.
 */
export async function ensureDailyCredits(organizationId: string, now: Date = new Date()): Promise<DailyCredits> {
  try {
    const { dailyFree, trialDailyFree } = await readCreditSettings();
    const earning = await dailyEarning(db, organizationId, now);

    if (earning.kind === "trial_over" || (earning.kind === "trial" && trialDailyFree === 0)) {
      return { eligible: false, perDay: dailyFree, today: 0, trialEndsAt: trialDailyFree > 0 ? earning.endsAt : null };
    }
    if (earning.kind === "none") return { eligible: false, perDay: dailyFree, today: 0, trialEndsAt: null };

    const trial = earning.kind === "trial" ? earning : null;
    const amount = trial ? trialDailyFree : dailyFree;
    const key = trial ? trialGrantKey(organizationId, trial.day) : dailyGrantKey(organizationId, now);
    if (amount > 0) {
      await recordCredit(organizationId, {
        type: "daily_grant",
        amount,
        idempotencyKey: key,
        note: trial ? `Trial credits, day ${trial.day + 1} of ${TRIAL_CREDIT_DAYS}` : "Daily credits",
      });
    }
    const [given] = await db
      .select({ amount: creditLedger.amount })
      .from(creditLedger)
      .where(eq(creditLedger.idempotencyKey, key))
      .limit(1);
    return { eligible: true, perDay: amount, today: given?.amount ?? 0, trialEndsAt: trial?.endsAt ?? null };
  } catch (error) {
    console.error("[credits] daily credits failed", error);
    return { eligible: false, perDay: 0, today: 0, trialEndsAt: null };
  }
}
