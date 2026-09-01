import { and, eq, gte, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { backlinkRequests, creditLedger, plans, subscriptions } from "@/lib/db/schema";

/**
 * Credit ledger.
 *
 * Credits are money to the customer, so the balance is the SUM of immutable
 * movement rows rather than a stored counter. A counter that drifts leaves you
 * unable to answer "why did my balance drop", which is not an acceptable reply
 * about something they paid for. Every movement records why it happened.
 *
 * Nothing outside this module writes to credit_ledger.
 */

export type CreditType =
  /** Monthly allowance from the plan. */
  | "plan_grant"
  /** Earned by hosting someone else's link. */
  | "link_given"
  /** Spent requesting a link. */
  | "link_received"
  /** Returned because a link was removed or a request was cancelled. */
  | "refund"
  /** Bought as an add-on. */
  | "purchase"
  /** Earned because someone you referred started paying. */
  | "referral"
  /** Manual adjustment by an admin. */
  | "adjustment";

export type CreditEntry = {
  type: CreditType;
  /** Signed: positive adds, negative spends. */
  amount: number;
  referenceId?: string | null;
  note?: string | null;
};

/** Records one movement. The only way credits ever change. */
export async function recordCredit(
  organizationId: string,
  entry: CreditEntry,
): Promise<void> {
  if (entry.amount === 0) return;
  await db.insert(creditLedger).values({
    organizationId,
    type: entry.type,
    amount: entry.amount,
    referenceId: entry.referenceId ?? null,
    note: entry.note ?? null,
  });
}

/** Sum of every movement ever recorded. */
export async function getBalance(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ balance: raw<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId));
  return row?.balance ?? 0;
}

/**
 * Credits available to spend right now.
 *
 * Reserved credits belong to requests that are matched but not yet placed. If
 * they counted as spendable, an organization could promise more links than it
 * can pay for and the shortfall would only surface when placements complete.
 */
export async function getAvailable(organizationId: string): Promise<{
  balance: number;
  reserved: number;
  available: number;
}> {
  const balance = await getBalance(organizationId);

  const [row] = await db
    .select({
      reserved: raw<number>`coalesce(sum(${backlinkRequests.creditsReserved}), 0)::int`,
    })
    .from(backlinkRequests)
    .innerJoin(
      raw`websites`,
      raw`websites.id = ${backlinkRequests.websiteId}`,
    )
    .where(
      and(
        raw`websites.organization_id = ${organizationId}`,
        raw`${backlinkRequests.status} in ('pending', 'matched')`,
      ),
    );

  const reserved = row?.reserved ?? 0;
  return { balance, reserved, available: Math.max(balance - reserved, 0) };
}

/**
 * Grants the plan's monthly credit allowance, once per billing month.
 *
 * Idempotent by design: this runs on demand rather than from a scheduler, so
 * it can be called on every page load. The reference id encodes the month, and
 * an existing row for that month means the grant already happened.
 */
export async function grantMonthlyCredits(
  organizationId: string,
): Promise<number> {
  const [sub] = await db
    .select({
      status: subscriptions.status,
      monthlyCredits: plans.monthlyCredits,
      periodStart: subscriptions.currentPeriodStart,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (!sub || sub.monthlyCredits === null) return 0;
  if (!["active", "trialing", "past_due"].includes(sub.status)) return 0;

  // Keyed on the billing period when known, so a customer who upgrades
  // mid-month does not get a second full allowance for the same period.
  const period = sub.periodStart ?? new Date();
  const key = `plan_grant:${period.toISOString().slice(0, 7)}`;

  const [existing] = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organizationId, organizationId),
        eq(creditLedger.referenceId, key),
      ),
    )
    .limit(1);

  if (existing) return 0;

  await recordCredit(organizationId, {
    type: "plan_grant",
    amount: sub.monthlyCredits,
    referenceId: key,
    note: "Monthly plan allowance",
  });
  return sub.monthlyCredits;
}

export type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: Date;
};

export async function listLedger(
  organizationId: string,
  limit = 50,
): Promise<LedgerRow[]> {
  return db
    .select({
      id: creditLedger.id,
      type: creditLedger.type,
      amount: creditLedger.amount,
      note: creditLedger.note,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId))
    .orderBy(raw`${creditLedger.createdAt} desc`)
    .limit(limit);
}

/** Credits earned this calendar month, for the dashboard. */
export async function earnedThisMonth(
  organizationId: string,
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({ total: raw<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.organizationId, organizationId),
        eq(creditLedger.type, "link_given"),
        gte(creditLedger.createdAt, start),
      ),
    );
  return row?.total ?? 0;
}
