import "server-only";

/**
 * The credit ledger: recordCredit takes an organizationId and an unbounded
 * amount, and is meant to be reached only from jobs, the webhook fulfiller
 * and guarded actions. Marking the module server-only makes an accidental
 * re-export from a "use server" file a build error rather than a way for
 * anyone signed in to mint the product's paid currency.
 */
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql as raw,
} from "drizzle-orm";

import { billingAnchor, entitlementPeriod } from "@/lib/billing/entitlement-period";
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
  /**
   * Stable id of the operation, e.g. "purchase:<id>". With one, a repeated
   * or concurrent write of the same movement is a no-op (unique index), so
   * every automated movement passes one. Admin adjustments do not.
   */
  idempotencyKey?: string | null;
};

type Writer = Pick<typeof db, "insert">;

/**
 * Records one movement. The only way credits ever change.
 *
 * Pass the caller's transaction as `executor` to commit the movement WITH
 * the business change that causes it - a purchase recorded, a referral
 * rewarded, a placement going live - so neither can exist without the other.
 *
 * Returns whether a row was written: false for a zero amount, or for an
 * idempotency key that was already used.
 */
export async function recordCredit(
  organizationId: string,
  entry: CreditEntry,
  executor: Writer = db,
): Promise<boolean> {
  if (entry.amount === 0) return false;
  const insert = executor.insert(creditLedger).values({
    organizationId,
    type: entry.type,
    amount: entry.amount,
    referenceId: entry.referenceId ?? null,
    note: entry.note ?? null,
    idempotencyKey: entry.idempotencyKey ?? null,
  });
  const rows = entry.idempotencyKey
    ? await insert
        .onConflictDoNothing({
          target: creditLedger.idempotencyKey,
          where: raw`${creditLedger.idempotencyKey} is not null`,
        })
        .returning({ id: creditLedger.id })
    : await insert.returning({ id: creditLedger.id });
  return rows.length > 0;
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

const ENTITLED_STATUSES = ["active", "trialing", "past_due"];

/** Plan grants from before per-subscription keys: "plan_grant:YYYY-MM". */
const LEGACY_GRANT = /^plan_grant:\d{4}-\d{2}$/;

/** The grant id for one subscription's one monthly entitlement period. */
export function planGrantKey(subscriptionId: string, periodStart: Date): string {
  return `plan_grant:${subscriptionId}:${periodStart.toISOString()}`;
}

/**
 * Grants each paid website's monthly credit allowance, once per
 * subscription per monthly entitlement period.
 *
 * WHAT WAS WRONG. One arbitrary subscription row was read for the whole
 * workspace, so a workspace paying for three sites was granted one site's
 * credits; and the key was the calendar month of the BILLING period start,
 * which for an annual plan is one month a year.
 *
 * NOW. Every entitled subscription attached to a website contributes its own
 * plan's credits, keyed `plan_grant:<subscription>:<period start>` where the
 * period is the MONTHLY entitlement period (lib/billing/entitlement-period.ts)
 * - so monthly and annual customers get the advertised monthly amount, and
 * the key is idempotent under any number of concurrent page loads.
 *
 * Only the CURRENT period is ever granted. Nothing is back-filled for months
 * that passed without a page load, and nothing already granted is removed.
 *
 * TRANSITION. A grant written under the old workspace-wide key
 * ("plan_grant:YYYY-MM") inside a subscription's current period is counted
 * towards that period, against the first eligible subscription (oldest
 * first) whose period contains it, so the rollout month is not granted twice.
 */
export async function grantMonthlyCredits(
  organizationId: string,
  now: Date = new Date(),
): Promise<number> {
  const subs = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      monthlyCredits: plans.monthlyCredits,
      interval: plans.interval,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        isNotNull(subscriptions.websiteId),
        inArray(subscriptions.status, ENTITLED_STATUSES),
      ),
    )
    .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));

  const eligible = subs.filter((sub) => sub.monthlyCredits > 0);
  if (eligible.length === 0) return 0;

  const legacy = (
    await db
      .select({
        id: creditLedger.id,
        amount: creditLedger.amount,
        referenceId: creditLedger.referenceId,
        createdAt: creditLedger.createdAt,
      })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.organizationId, organizationId),
          eq(creditLedger.type, "plan_grant"),
          isNull(creditLedger.idempotencyKey),
        ),
      )
  ).filter((row) => row.referenceId && LEGACY_GRANT.test(row.referenceId));
  const attributed = new Set<string>();

  let total = 0;
  for (const sub of eligible) {
    const anchor = billingAnchor(sub);
    if (!anchor) continue;
    const period = entitlementPeriod(anchor, now);

    let already = 0;
    for (const grant of legacy) {
      if (attributed.has(grant.id)) continue;
      if (grant.createdAt >= period.start && grant.createdAt < period.end) {
        attributed.add(grant.id);
        already += grant.amount;
      }
    }
    const amount = Math.max(sub.monthlyCredits - already, 0);
    const key = planGrantKey(sub.id, period.start);

    /*
      Written even when the old grant already covered it (amount 0): the row
      is the record that this period is settled. One statement, keyed, so
      simultaneous page loads grant once.
    */
    const granted = await db
      .insert(creditLedger)
      .values({
        organizationId,
        type: "plan_grant",
        amount,
        referenceId: key,
        idempotencyKey: key,
        note:
          already > 0
            ? `Monthly plan allowance (${already} already granted this month)`
            : "Monthly plan allowance",
      })
      .onConflictDoNothing()
      .returning({ id: creditLedger.id });
    if (granted.length > 0) total += amount;
  }
  return total;
}

/**
 * The current month's plan credits, granted before a balance is shown or
 * used. Never throws: a failed grant is logged, and the caller reads whatever
 * balance exists (the next read grants again - it is keyed, so it cannot
 * grant twice).
 *
 * WHY EVERY READER CALLS THIS. Monthly credits are granted lazily, on first
 * use in each period - there is no job that grants them. The page that used
 * to do it (the old Backlinks page, through getNetworkStatus) was replaced by
 * the Backlinks Overview, which only READ the balance, and the managed network
 * switched off requestBacklink, the other caller. From then on nobody's
 * monthly credits were granted: a new Grow subscriber saw 0, and an
 * administrator could not place a link for them. So the balance is now
 * granted wherever it is shown or spent: the sidebar, the Backlinks pages,
 * the dashboard, and the administrator's placement screens.
 *
 * Never call it inside a transaction: it writes through the shared `db`.
 */
export async function ensureMonthlyCredits(organizationId: string): Promise<void> {
  try {
    await grantMonthlyCredits(organizationId);
  } catch (error) {
    console.error("[credits] could not grant this month's plan credits", { organizationId, error });
  }
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
    // Zero rows only mark a period as settled (grantMonthlyCredits).
    .where(and(eq(creditLedger.organizationId, organizationId), ne(creditLedger.amount, 0)))
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
