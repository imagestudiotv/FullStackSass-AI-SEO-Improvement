import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { billingCheckouts, lifecycleEmails, member } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { REPGET_CODE } from "./repget-offer";
import { WINBACK_BONUS_CREDITS, WINBACK_CODE } from "./winback-offer";

/**
 * The win-back offer's credits (lib/billing/winback-offer.ts): WINBACK_BONUS_CREDITS
 * added once the plan restarted WITH the win-back discount has its first
 * payment for money - called by the Stripe (invoice.paid) and PayPal
 * (PAYMENT.SALE.COMPLETED) webhooks, beside the referral conversion.
 *
 * ONCE PER PERSON, EVER. The ledger row's idempotency key names the person who
 * was sent the win-back email (`winback-bonus:<userId>`), and the ledger's
 * unique index on it decides: of any number of retried or simultaneous
 * deliveries, one inserts and the rest find its row. The discount itself is
 * one use per account through its completed checkout (lib/billing/checkouts.ts),
 * so the checkout row and this ledger row are the redemption's record.
 *
 * Qualifies: a subscription whose checkout carried the win-back discount, or
 * one that carried REPGET instead (REPGET is bigger and wins at checkout) when
 * that checkout was made AFTER the owner was sent the win-back email - the
 * email promised the credits, so they are kept (lead's decision, 2026-11-11).
 * Either restart ends the win-back offer (checkouts.ts winbackOfferState). A
 * checkout with no offer gets nothing here.
 */

export function winbackBonusKey(userId: string): string {
  return `winback-bonus:${userId}`;
}

export type WinbackBonusOutcome =
  | { status: "granted"; userId: string; credits: number }
  | { status: "already_granted"; userId: string }
  | { status: "skipped"; reason: "no_money" | "not_winback" | "no_recipient" };

/**
 * Adds the credits for a payment just recorded, if it is the first payment of
 * a win-back subscription. Throws only if the ledger cannot be written, so the
 * webhook is retried rather than the credits lost.
 */
export async function grantWinbackBonus(
  input: { provider: "stripe" | "paypal"; providerSubscriptionId: string; amountCents: number },
  executor: Executor = db,
): Promise<WinbackBonusOutcome> {
  if (!(input.amountCents > 0)) return { status: "skipped", reason: "no_money" };

  const [checkout] = await executor
    .select({ organizationId: billingCheckouts.organizationId, offer: sql<string>`${billingCheckouts.requestParams} ->> 'offer'`, createdAt: billingCheckouts.createdAt })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.provider, input.provider),
        eq(billingCheckouts.providerSubscriptionId, input.providerSubscriptionId),
        eq(billingCheckouts.status, "completed"),
        sql`${billingCheckouts.requestParams} ->> 'offer' in (${WINBACK_CODE}, ${REPGET_CODE})`,
      ),
    )
    .limit(1);
  if (!checkout) return { status: "skipped", reason: "not_winback" };

  // The owner who was sent the email: the person the offer was made to.
  const owners = await executor
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, checkout.organizationId), eq(member.role, "owner")))
    .orderBy(asc(member.userId));
  const ownerIds = owners.map((row) => row.userId);
  const [emailed] = ownerIds.length
    ? await executor
        .select({ userId: lifecycleEmails.userId, sentAt: lifecycleEmails.updatedAt })
        .from(lifecycleEmails)
        .where(
          and(
            eq(lifecycleEmails.kind, "winback"),
            eq(lifecycleEmails.status, "sent"),
            inArray(lifecycleEmails.userId, ownerIds),
          ),
        )
        .orderBy(asc(lifecycleEmails.userId))
        .limit(1)
    : [];
  const userId = emailed?.userId ?? null;
  if (!userId) return { status: "skipped", reason: "no_recipient" };
  // REPGET counts only for a restart after the email went out (both app-clock times); an earlier REPGET plan is not a win-back.
  if (checkout.offer === REPGET_CODE && !(checkout.createdAt > emailed!.sentAt)) return { status: "skipped", reason: "not_winback" };

  const inserted = await recordCredit(
    checkout.organizationId,
    {
      type: "reward",
      amount: WINBACK_BONUS_CREDITS,
      referenceId: input.providerSubscriptionId,
      idempotencyKey: winbackBonusKey(userId),
      note: `Welcome back: ${WINBACK_BONUS_CREDITS} credits with the first payment of a restarted plan`,
    },
    executor,
  );
  return inserted ? { status: "granted", userId, credits: WINBACK_BONUS_CREDITS } : { status: "already_granted", userId };
}
