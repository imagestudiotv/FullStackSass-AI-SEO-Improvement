import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { creditLedger, organization, payments, referralCodes, referrals } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";

/**
 * Referrals.
 *
 * Rewards are paid in ACCOUNT CREDIT, never cash. That is a deliberate limit:
 * cash payouts mean tax reporting, a payout rail, and a fraud surface where a
 * stolen card buys a subscription that pays out real money before the
 * chargeback arrives. Credit costs margin instead of cash, cannot be
 * withdrawn, and is worthless to a fraudster — while still being worth
 * something real to a genuine customer.
 *
 * Nothing here is credited on signup. A referral only pays once the referred
 * workspace actually pays MONEY, because rewarding a signup pays for
 * throwaway accounts and rewarding a payment cannot be gamed without a real
 * charge. "Paid" means an amount above zero: Stripe also marks the zero
 * invoice at the start of a free trial (and a 100%-off period) as paid, and
 * rewarding that let a trial cancelled within three days earn the referrer
 * credits that nobody paid for.
 *
 * ONLY NEW CUSTOMERS. A referral attaches to a workspace created after the
 * link was opened and that has never paid (attachReferral). Without that, an
 * existing customer who clicked someone's link became "referred", and their
 * next routine renewal paid the referrer.
 *
 * Both payment providers convert (Stripe invoice.paid, PayPal
 * PAYMENT.SALE.COMPLETED); PayPal used to record the payment and never
 * convert, leaving its customers' referrals "waiting" forever. When a refund
 * leaves the referred workspace with no real money paid, the reward is taken
 * back and the referral waits again (reverseReferralReward).
 *
 * This module is imported by server actions and the payment webhooks, so it
 * carries no "use server" directive.
 */

// Re-exported so existing imports keep working; defined in shared.ts so a
// page can read the figure without pulling in the database client.
export { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";

/**
 * Characters used in generated codes.
 *
 * No 0/O or 1/I/L: codes get read aloud, written down and typed back, and an
 * ambiguous pair turns a working code into a support ticket.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * The workspace's referral code, creating one if it has none.
 *
 * Retries on collision rather than assuming uniqueness: the space is large,
 * but "large" is not "guaranteed", and the unique index would otherwise
 * surface as an unexplained error to a customer clicking a button.
 */
export async function ensureReferralCode(orgId: string): Promise<string> {
  const [existing] = await db
    .select({ code: referralCodes.code })
    .from(referralCodes)
    .where(eq(referralCodes.organizationId, orgId))
    .limit(1);

  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    try {
      await db.insert(referralCodes).values({ organizationId: orgId, code });
      return code;
    } catch {
      /**
       * Either the code collided or this workspace got a code concurrently.
       * Re-read: if a row now exists for this org, that is the answer.
       */
      const [row] = await db
        .select({ code: referralCodes.code })
        .from(referralCodes)
        .where(eq(referralCodes.organizationId, orgId))
        .limit(1);
      if (row) return row.code;
    }
  }

  throw new Error("Could not allocate a referral code");
}

/** The workspace that owns a code, or null. Case-insensitive. */
export async function resolveReferralCode(
  code: string,
): Promise<string | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return null;

  const [row] = await db
    .select({ organizationId: referralCodes.organizationId })
    .from(referralCodes)
    .where(eq(referralCodes.code, cleaned))
    .limit(1);

  return row?.organizationId ?? null;
}

export type AttachOutcome =
  | { ok: true }
  | { ok: false; reason: "unknown_code" | "self_referral" | "not_new" | "already_referred" };

/**
 * How long before the click a workspace may have been created and still count
 * as new: clock skew between the server that set the cookie and the database,
 * and the seconds a sign-up takes. Not a grace period for existing accounts.
 */
const CLICK_SKEW_MS = 10 * 60 * 1000;

/** For a cookie that predates the click time: created within its lifetime. */
const LEGACY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether a workspace is a NEW customer for a link opened at `clickedAt`:
 * created after it, and never charged anything. A payment of zero (a trial
 * start) does not count as having paid.
 */
async function isNewCustomer(orgId: string, clickedAt: Date | null, now: Date): Promise<boolean> {
  const [org] = await db
    .select({ createdAt: organization.createdAt })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  if (!org) return false;
  const earliest = clickedAt
    ? clickedAt.getTime() - CLICK_SKEW_MS
    : now.getTime() - LEGACY_WINDOW_MS;
  if (org.createdAt.getTime() < earliest) return false;

  const [paid] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, orgId),
        gt(payments.amountCents, 0),
        inArray(payments.status, ["paid", "refunded"]),
      ),
    )
    .limit(1);
  return !paid;
}

/**
 * Records that a new workspace came from a referral code.
 *
 * Creates a PENDING row. Nothing is credited here — see the note at the top of
 * this file about paying on payment rather than on signup. Refused for a
 * workspace that is not a new customer (isNewCustomer).
 */
export async function attachReferral(
  referredOrgId: string,
  code: string,
  options: { clickedAt?: Date | null; now?: Date } = {},
): Promise<AttachOutcome> {
  const referrerOrgId = await resolveReferralCode(code);
  if (!referrerOrgId) return { ok: false, reason: "unknown_code" };

  /**
   * Referring yourself is the most obvious abuse, and the cheapest to close.
   * It would otherwise let one workspace mint credit by creating a second one
   * and paying for a month.
   */
  if (referrerOrgId === referredOrgId) {
    return { ok: false, reason: "self_referral" };
  }

  if (!(await isNewCustomer(referredOrgId, options.clickedAt ?? null, options.now ?? new Date()))) {
    return { ok: false, reason: "not_new" };
  }

  try {
    await db
      .insert(referrals)
      // The app clock, like organization.created_at and payments.paid_at that
      // it is compared with (convertReferral), not the database's.
      .values({ referrerOrgId, referredOrgId, status: "pending", createdAt: new Date() });
    return { ok: true };
  } catch (error) {
    /*
      The unique index on referred_org_id: a workspace is referred once,
      ever. Anything else (a dropped connection) is thrown, so claimReferral
      keeps the cookie and the next page load retries - it used to be
      reported as "already referred" and, the cookie now being cleared, lost.
    */
    if (isUniqueViolation(error)) return { ok: false, reason: "already_referred" };
    throw error;
  }
}

/** True for Postgres's unique-violation error, however the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return (e?.code ?? e?.cause?.code) === "23505";
}

/**
 * The ledger operation id for a referral's `grant`-th reward. The first keeps
 * the original "referral:<id>"; a reward granted again after a reversal
 * (reverseReferralReward) needs its own, or the ledger would skip it.
 */
export function referralCreditKey(referralId: string, grant = 1): string {
  return grant <= 1 ? `referral:${referralId}` : `referral:${referralId}:${grant}`;
}

/** The ledger operation id for taking back a referral's `grant`-th reward. */
export function referralReversalKey(referralId: string, grant = 1): string {
  return grant <= 1 ? `referral:${referralId}:reversal` : `referral:${referralId}:reversal:${grant}`;
}

/** How many referral ledger entries of one sign exist for a referral. */
async function referralEntries(tx: Pick<typeof db, "select">, referralId: string, sign: "credit" | "reversal") {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.type, "referral"),
        eq(creditLedger.referenceId, referralId),
        sign === "credit" ? gt(creditLedger.amount, 0) : lt(creditLedger.amount, 0),
      ),
    );
  return Number(row?.n ?? 0);
}

/*
  The subqueries below name every column with an alias or its table. Drizzle
  may leave a column unqualified in an UPDATE, and an unqualified
  "created_at" inside "from organization" means the organization's own - the
  comparison would have been with itself.
*/

/**
 * A payment of real money that still stands: paid and above zero. Matched in
 * SQL against the referral row being updated.
 */
const STANDING_PAYMENT = sql`exists (
  select 1 from payments sp
  where sp.organization_id = "referrals"."referred_org_id"
    and sp.amount_cents > 0
    and sp.status = 'paid'
)`;

/**
 * A referral attached by the old code to an EXISTING customer: the workspace
 * was more than thirty days old (the cookie's lifetime) when it was attached.
 * New attachments cannot be (isNewCustomer); this stops those already in the
 * table from paying out on their next renewal.
 */
const ATTACHED_TO_NEW_WORKSPACE = sql`exists (
  select 1 from organization o
  where o.id = "referrals"."referred_org_id"
    and o.created_at >= "referrals"."created_at" - interval '30 days'
)`;

/**
 * Converts a pending referral once the referred workspace has paid.
 *
 * Called from the Stripe and PayPal webhooks after they record a payment,
 * with the amount actually paid: nothing is granted for zero, and nothing
 * unless a payment of real money still STANDS (paid, not refunded) - a
 * webhook replayed from its stored payload after the payment was refunded
 * used to convert anyway. Safe to call repeatedly: the update is conditional
 * on the row still being pending, so a retry or a second invoice cannot pay
 * the referrer twice.
 *
 * THE STATUS CHANGE AND THE CREDIT COMMIT TOGETHER. They used to be two
 * statements: the referral was marked rewarded, then the credit written. A
 * failure between them left a referral that said "rewarded" with no credit
 * behind it, and every retry skipped it because it was no longer pending -
 * the reward was lost for good. Now both are in one transaction, so a
 * failure leaves the referral pending and the next paid invoice (or the
 * webhook's retry) converts it. The credit also carries an idempotency key,
 * so even a duplicate write cannot double it. The notification is sent after
 * commit, and failing to send it changes nothing.
 *
 * Returns whether a reward was actually granted.
 */
export async function convertReferral(referredOrgId: string, paidAmountCents: number): Promise<boolean> {
  // A trial start or a fully discounted period: no money moved, nothing earned.
  if (!(paidAmountCents > 0)) return false;

  const rewarded = await db.transaction(async (tx) => {
    /**
     * The status change is the guard. Constraining the UPDATE to rows still
     * pending means two concurrent webhooks race on the same row and exactly
     * one wins — without this, both would read "pending" and both would
     * credit.
     */
    const [updated] = await tx
      .update(referrals)
      .set({
        status: "rewarded",
        rewardCredits: REFERRAL_REWARD_CREDITS,
        rewardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(referrals.referredOrgId, referredOrgId),
          eq(referrals.status, "pending"),
          STANDING_PAYMENT,
          ATTACHED_TO_NEW_WORKSPACE,
        ),
      )
      .returning({ id: referrals.id, referrerOrgId: referrals.referrerOrgId });

    if (!updated) return null;

    // Serialised by the row lock the update took: a second grant after a reversal gets the next key.
    const grant = (await referralEntries(tx, updated.id, "credit")) + 1;
    await recordCredit(
      updated.referrerOrgId,
      {
        type: "referral",
        amount: REFERRAL_REWARD_CREDITS,
        referenceId: updated.id,
        idempotencyKey: referralCreditKey(updated.id, grant),
        note: "Someone you referred paid for their first month",
      },
      tx,
    );
    return updated;
  });

  if (!rewarded) return false;

  try {
    await notify({
      organizationId: rewarded.referrerOrgId,
      type: "referral.rewarded",
      title: `You earned ${REFERRAL_REWARD_CREDITS} credits`,
      body: "Someone you referred paid for their first month. Thank you.",
      href: "/settings#referral",
    });
  } catch (error) {
    console.error("[referrals] reward granted but the notification failed", error);
  }

  return true;
}

/**
 * Takes a referral's reward back when the referred workspace no longer has
 * any real money paid: its payment was refunded IN FULL and no other payment
 * of real money remains. The referral then rests on nothing paid, which is
 * the case the reward exists to exclude.
 *
 * What counts as money kept: a payment still "paid", or one refunded only IN
 * PART - those are marked "refunded" too (lib/admin/operations.ts keeps the
 * amount on the audit entry), so the latest refund entry for the payment is
 * read to tell them apart.
 *
 * The referral goes back to PENDING, not to a dead end: a customer given a
 * goodwill refund who stays and pays again converts it again, with a new
 * ledger key per grant. The negative entry carries its own key per reversal,
 * all in one transaction conditional on the row still being rewarded, so a
 * repeat reverses once. The referrer's balance may go below zero if the
 * credits were already spent, as with a reversed host reward. Returns whether
 * anything was reversed.
 *
 * Called by the admin refund (lib/admin/operations.ts) and the PayPal refund
 * and reversal events (lib/billing/paypal-events.ts). Refunds made in the
 * Stripe dashboard, and Stripe chargebacks, reach no handler and are not
 * covered.
 */
export async function reverseReferralReward(referredOrgId: string): Promise<boolean> {
  const reversed = await db.transaction(async (tx) => {
    const [kept] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, referredOrgId),
          gt(payments.amountCents, 0),
          or(
            eq(payments.status, "paid"),
            and(
              eq(payments.status, "refunded"),
              // Refunded only in part: the latest refund entry for THIS payment says so.
              sql`(
                select (al.detail ->> 'partial') = 'true'
                from admin_audit_log al
                where al.action = 'payment.refunded'
                  and al.target_id = "payments"."id"::text
                order by al.created_at desc
                limit 1
              ) is true`,
            ),
          ),
        ),
      )
      .limit(1);
    if (kept) return null;

    const [current] = await tx
      .select({ rewardCredits: referrals.rewardCredits })
      .from(referrals)
      .where(and(eq(referrals.referredOrgId, referredOrgId), eq(referrals.status, "rewarded")))
      .limit(1);
    if (!current) return null;

    const [updated] = await tx
      .update(referrals)
      .set({ status: "pending", rewardCredits: null, rewardedAt: null, updatedAt: new Date() })
      .where(and(eq(referrals.referredOrgId, referredOrgId), eq(referrals.status, "rewarded")))
      .returning({ id: referrals.id, referrerOrgId: referrals.referrerOrgId });
    if (!updated) return null;

    const credits = current.rewardCredits ?? REFERRAL_REWARD_CREDITS;
    const grant = (await referralEntries(tx, updated.id, "reversal")) + 1;
    await recordCredit(
      updated.referrerOrgId,
      {
        type: "referral",
        amount: -credits,
        referenceId: updated.id,
        idempotencyKey: referralReversalKey(updated.id, grant),
        note: "Referral reward reversed: the referred payment was refunded",
      },
      tx,
    );
    return { ...updated, credits };
  });

  if (!reversed) return false;

  try {
    await notify({
      organizationId: reversed.referrerOrgId,
      type: "referral.reversed",
      title: `A referral reward of ${reversed.credits} credits was reversed`,
      body: "The payment of someone you referred was refunded. The referral counts again if they pay again.",
      href: "/settings#referral",
    });
  } catch (error) {
    console.error("[referrals] reward reversed but the notification failed", error);
  }
  return true;
}
