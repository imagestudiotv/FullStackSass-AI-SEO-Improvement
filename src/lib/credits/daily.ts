import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { creditLedger, subscriptions } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { readCreditSettings } from "./prices";

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
 */

/** Statuses that earn daily credits: a paid plan, as for the monthly credits (lib/backlinks/credits.ts). */
const DAILY_CREDIT_STATUSES = ["active"];

/** The UTC calendar day of a moment, "YYYY-MM-DD". */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The ledger operation id of one workspace's credits for one day. */
export function dailyGrantKey(organizationId: string, now: Date): string {
  return `daily:${organizationId}:${utcDay(now)}`;
}

/** Whether a workspace earns daily credits: it pays for a plan on at least one website. */
export async function earnsDailyCredits(executor: Executor, organizationId: string): Promise<boolean> {
  const [paying] = await executor
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        isNotNull(subscriptions.websiteId),
        inArray(subscriptions.status, DAILY_CREDIT_STATUSES),
      ),
    )
    .limit(1);
  return Boolean(paying);
}

export type DailyCredits = {
  /** Whether this workspace earns daily credits at all (a paid plan). */
  eligible: boolean;
  /** The setting: credits given per day of use. */
  perDay: number;
  /** What today's visit was given (0 before it, or when not eligible). */
  today: number;
};

/**
 * Grants today's credits if this workspace earns them and has not had them
 * yet. Keyed per workspace per UTC day, so any number of page loads -
 * concurrent ones included - grant once. Never throws: a failed grant is
 * logged and the next page load tries again.
 *
 * Never call it inside a transaction: it writes through the shared `db`.
 */
export async function ensureDailyCredits(organizationId: string, now: Date = new Date()): Promise<DailyCredits> {
  try {
    const { dailyFree } = await readCreditSettings();
    const eligible = await earnsDailyCredits(db, organizationId);
    if (eligible && dailyFree > 0) {
      await recordCredit(organizationId, {
        type: "daily_grant",
        amount: dailyFree,
        idempotencyKey: dailyGrantKey(organizationId, now),
        note: "Daily credits",
      });
    }
    const [given] = await db
      .select({ amount: creditLedger.amount })
      .from(creditLedger)
      .where(eq(creditLedger.idempotencyKey, dailyGrantKey(organizationId, now)))
      .limit(1);
    return { eligible, perDay: dailyFree, today: given?.amount ?? 0 };
  } catch (error) {
    console.error("[credits] daily credits failed", error);
    return { eligible: false, perDay: 0, today: 0 };
  }
}
