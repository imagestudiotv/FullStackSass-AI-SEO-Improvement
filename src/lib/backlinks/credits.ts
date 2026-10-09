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
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  sql as raw,
} from "drizzle-orm";

import {
  billingAnchor,
  entitlementPeriod,
  firstPeriodAfterTrial,
  lessThanAMonthApart,
} from "@/lib/billing/entitlement-period";
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

/*
  Statuses that EARN a monthly grant. past_due is entitled to use the product
  (usage.ts) but earns no new grant while a payment is failing: the customer
  keeps the balance they have, and once the payment succeeds and the status
  is active again, the next page load grants the current period as usual -
  same key, so once. A trial earns nothing: it is a new account's free
  articles (lib/billing/free-articles.ts), and backlinks wait for the plan;
  the paid period after it is granted in full (below).
*/
const GRANTING_STATUSES = ["active"];

/** Plan grants from before per-subscription keys: "plan_grant:YYYY-MM". */
const LEGACY_GRANT = /^plan_grant:\d{4}-\d{2}$/;

/** The grant id for one subscription's one monthly entitlement period. */
export function planGrantKey(subscriptionId: string, periodStart: Date): string {
  return `plan_grant:${subscriptionId}:${periodStart.toISOString()}`;
}

/** The period start a planGrantKey names, or null for any other reference. */
function grantPeriodStart(subscriptionId: string, key: string | null): Date | null {
  const prefix = `plan_grant:${subscriptionId}:`;
  if (!key?.startsWith(prefix)) return null;
  const start = new Date(key.slice(prefix.length));
  return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * Grants each paid website's monthly credit allowance, once per
 * subscription per allowance month.
 *
 * WHAT WAS WRONG. One arbitrary subscription row was read for the whole
 * workspace, so a workspace paying for three sites was granted one site's
 * credits; and the key was the calendar month of the BILLING period start,
 * which for an annual plan is one month a year.
 *
 * NOW. Every granting (active) subscription attached to a
 * website contributes its own plan's credits, keyed
 * `plan_grant:<subscription>:<period start>` where the period is the MONTHLY
 * entitlement period (lib/billing/entitlement-period.ts) - so monthly and
 * annual customers get the advertised monthly amount, and the key is
 * idempotent under any number of concurrent page loads.
 *
 * A TRIAL EARNS NO CREDITS (client, 2026-10-09: the trial is now a new
 * account's free articles, and backlinks wait for the plan - lib/billing/
 * free-articles.ts). It replaces the 2026-10-05 rule that the trial was part
 * of the first month and was granted that month's credits. The paid period
 * after a trial is therefore granted in full at the conversion.
 *
 * THE FIRST-MONTH TOP-UP is kept for one case: a 3-day trial that was
 * granted credits under the old rule and converts after this shipped. Its
 * paid period (firstPeriodAfterTrial) is granted only what the current plan
 * gives beyond what the trial was already granted: nothing on the same
 * plan, the difference after an upgrade. With no trial grant, nothing is
 * covered and the period is granted in full.
 *
 * ONLY THE FIRST MONTH. The broader rule - settle at zero ANY period
 * starting less than a month after another grant - reaches across
 * renewals: a PayPal renewal paid five days late (its period starts at the
 * payment) would zero the on-schedule renewal after it, a paid month with no
 * credits, depending on when the customer happened to load a page. Later
 * re-anchors (an interval change, a late PayPal payment) are granted as new
 * periods, as they always were - and as their articles are. The one known
 * cost: a PayPal renewal paid late AFTER a page load had already granted the
 * on-schedule period is granted again at the payment; preventing that needs
 * the provider's period end stored with each grant.
 *
 * past_due earns no new grant while the payment is failing (the balance
 * already granted is kept); see GRANTING_STATUSES.
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
        inArray(subscriptions.status, GRANTING_STATUSES),
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
    const key = planGrantKey(sub.id, period.start);

    /*
      Decided and written under a per-subscription lock. The key alone makes
      ONE period idempotent, but "the first month was already granted" is a
      question about OTHER keys: two page loads either side of the
      conversion webhook - one still reading the trial's period, one the paid
      period - could each see no grant and write their own. Serialised, the
      second sees the first. Both directions are checked, so whichever writes
      first is granted and the other only tops up to its plan (zero on the
      same plan).
    */
    total += await db.transaction(async (tx) => {
      await tx.execute(
        raw`select pg_advisory_xact_lock(hashtextextended(${`plan_grant:${sub.id}`}, 0))`,
      );
      const granted = await tx
        .select({ key: creditLedger.idempotencyKey, amount: creditLedger.amount })
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.organizationId, organizationId),
            eq(creditLedger.type, "plan_grant"),
            gt(creditLedger.amount, 0),
            like(creditLedger.idempotencyKey, `plan_grant:${sub.id}:%`),
          ),
        );
      /*
        The grants of the same first month: another period of this
        subscription, less than a month from this one, where the LATER of the
        two is still the first month (firstPeriodAfterTrial: the period after
        a trial, or another re-anchor inside the first month). Only then - a
        renewal is a month of its own however close the provider put its
        start.
      */
      const covering = granted.flatMap((row) => {
        const start = grantPeriodStart(sub.id, row.key);
        if (!start || start.getTime() === period.start.getTime()) return [];
        const later = start > period.start ? start : period.start;
        return firstPeriodAfterTrial(sub.createdAt, later) && lessThanAMonthApart(start, period.start)
          ? [{ start, amount: row.amount }]
          : [];
      });
      const coveredAmount = covering.reduce((sum, grant) => sum + grant.amount, 0);
      const coveredFrom = covering.reduce<Date | null>(
        (earliest, grant) => (earliest && earliest <= grant.start ? earliest : grant.start),
        null,
      );
      const amount = Math.max(sub.monthlyCredits - already - coveredAmount, 0);

      /*
        Written even when the period earns nothing (amount 0): the row is the
        record that this period is settled, and why. One statement, keyed, so
        simultaneous page loads grant once.
      */
      const written = await tx
        .insert(creditLedger)
        .values({
          organizationId,
          type: "plan_grant",
          amount,
          referenceId: key,
          idempotencyKey: key,
          /*
            Zero rows are hidden from the customer (listLedger), so that note
            is for support; a top-up is shown on the Credits page, like the
            others.
          */
          note: coveredFrom
            ? amount > 0
              ? `Monthly plan allowance, topped up to the current plan (${coveredAmount + already} already granted this month)`
              : `Covered by the allowance granted for the period from ${coveredFrom.toISOString()}, the same first month (a trial granted credits before 2026-10-09)`
            : already > 0
              ? `Monthly plan allowance (${already} already granted this month)`
              : "Monthly plan allowance",
        })
        .onConflictDoNothing()
        .returning({ id: creditLedger.id });
      return written.length > 0 ? amount : 0;
    });
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
