import { randomUUID } from "node:crypto";

import { and, asc, eq, exists, gt, inArray, isNull, lt, lte, not, notExists, or, sql } from "drizzle-orm";

import { CONSENT_MAX_AGE } from "@/lib/consent";
import { billingCheckouts, metaPurchases, payments, plans } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { metaPixelId } from "@/lib/meta-pixel";

import { conversionId, validConsentKey } from "./config";
import { readMetaUser, sendMetaEvents, metaCapiToken, type MetaUser } from "./meta-capi";
import { MAX_AGE_MS, SKEW_MS, UNFINISHED, firstSubscriptionPayment, positivePayment } from "./paid-acquisitions";

/**
 * Meta's Purchase (client's guide, 2026-11-18, section 2 row 7 and section
 * 4): a workspace's first subscription payment for money, from the payment
 * webhooks, never a renewal - the same payment Google hears about
 * (paid-acquisitions.ts firstSubscriptionPayment), queued and delivered on
 * its own, so neither destination waits for the other.
 *
 * Sent with the identity the payer had when they started paying, kept on
 * their checkout only if they accepted the cookie banner (conversions.ts
 * rememberPayer): the webhook has no browser (guide, section 4, rule 5).
 * The queue keeps it until the event is decided, then erases it; withdrawing
 * consent erases it at once (paid-acquisitions.ts revokeCheckoutConsent).
 */

type Send = (url: string, init: RequestInit) => Promise<Response>;
type Payment = { provider: "stripe" | "paypal"; providerSubscriptionId: string; externalId: string; amountCents: number; currency: string };
/** Kept on the checkout and in the queue in the same shape: Meta's fields under `meta`, beside the consent proof. */
type Saved = { meta: MetaUser; consentKey: string; capturedAt: string };

const CLAIM_MS = 5 * 60_000;
const LIMIT = 20;

/** The Meta identity a checkout kept, with its consent proof; null when there is none or consent has aged out. */
function saved(value: unknown, now: Date): Saved | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { meta?: unknown; consentKey?: unknown; capturedAt?: unknown };
  const capturedAt = typeof v.capturedAt === "string" ? v.capturedAt : "";
  const age = now.getTime() - new Date(capturedAt).getTime();
  if (!validConsentKey(v.consentKey) || !Number.isFinite(age) || age < 0 || age >= CONSENT_MAX_AGE * 1000) return null;
  const user = readMetaUser(v.meta);
  return user ? { meta: user, consentKey: v.consentKey, capturedAt } : null;
}

/** The first payment's queue row, decided now: pending, or suppressed with the reason. */
async function enqueue(database: Database, organizationId: string, now: Date): Promise<string | null> {
  const first = await firstSubscriptionPayment(database, organizationId, now);
  if (!first) return null;
  const { payment, checkout, age } = first;
  const identity = saved(checkout?.analytics, now);
  const pixel = metaPixelId();
  const reason = !checkout ? "not_subscription_checkout" : payment.status === "refunded" ? "refunded_before_delivery"
    : !identity ? "no_current_consent_identity" : !pixel ? "pixel_not_configured" : age < -SKEW_MS || age >= MAX_AGE_MS ? "outside_measurement_window" : null;
  const [inserted] = await database.insert(metaPurchases).values({
    organizationId, paymentId: payment.id, checkoutId: checkout?.id ?? null,
    visitor: reason ? null : identity, pixelId: pixel,
    status: reason ? "suppressed" : "pending", lastError: reason,
    occurredAt: payment.paidAt, nextAttemptAt: age < 0 ? payment.paidAt : now,
  }).onConflictDoNothing({ target: metaPurchases.organizationId }).returning({ id: metaPurchases.id });
  return inserted?.id ?? null;
}

/** From the payment webhooks, after the payment is recorded: queue, then one bounded try. Never throws. */
export async function reportMetaPurchase(database: Database, payment: Payment, send: Send = fetch, now = new Date()): Promise<"sent" | "skipped" | "failed"> {
  if (payment.amountCents <= 0) return "skipped";
  try {
    const [record] = await database.select({ organizationId: payments.organizationId }).from(payments).where(and(
      eq(payments.provider, payment.provider), eq(payments.externalId, payment.externalId),
      eq(payments.providerSubscriptionId, payment.providerSubscriptionId), positivePayment,
    )).limit(1);
    if (!record) return "skipped";
    const inserted = await enqueue(database, record.organizationId, now);
    if (!inserted) return "skipped";
    const result = await deliverMetaPurchases(database, { only: [inserted], now, limit: 1 }, send);
    return result.delivered ? "sent" : result.retrying ? "failed" : "skipped";
  } catch {
    // The payment ledger is already committed: the scheduled recovery finds it.
    console.error("[meta] purchase could not be queued; scheduled recovery will retry");
    return "failed";
  }
}

export type MetaDelivery = { delivered: number; retrying: number; suppressed: number; expired: number };

/** Leases keep overlapping workers apart; the stable event id keeps a lost acknowledgement from counting twice. */
export async function deliverMetaPurchases(
  database: Database,
  options: { now?: Date; only?: string[]; limit?: number } = {},
  send: Send = fetch,
): Promise<MetaDelivery> {
  const result: MetaDelivery = { delivered: 0, retrying: 0, suppressed: 0, expired: 0 };
  const now = options.now ?? new Date();
  if (!metaCapiToken()) {
    // Without the token nothing is lost, but nothing outlives the window either.
    const old = database.select({ id: metaPurchases.id }).from(metaPurchases)
      .where(and(eq(metaPurchases.status, "pending"), lte(metaPurchases.occurredAt, new Date(now.getTime() - MAX_AGE_MS))))
      .limit(options.limit ?? LIMIT);
    const expired = await database.update(metaPurchases).set({ status: "expired", visitor: null,
      lastError: "outside_measurement_window", claimToken: null, claimedUntil: null, updatedAt: now,
    }).where(and(inArray(metaPurchases.id, old), eq(metaPurchases.status, "pending"))).returning({ id: metaPurchases.id });
    result.expired = expired.length;
    return result;
  }
  const free = or(isNull(metaPurchases.claimedUntil), lt(metaPurchases.claimedUntil, now));
  const due = database.select({ id: metaPurchases.id }).from(metaPurchases).where(and(
    eq(metaPurchases.status, "pending"), lte(metaPurchases.nextAttemptAt, now), free,
    options.only?.length ? inArray(metaPurchases.id, options.only) : undefined,
  )).orderBy(metaPurchases.nextAttemptAt).limit(options.limit ?? LIMIT);
  const token = randomUUID();
  const claimed = await database.update(metaPurchases).set({
    claimToken: token, claimedUntil: new Date(now.getTime() + CLAIM_MS),
    attempts: sql`${metaPurchases.attempts} + 1`, updatedAt: now,
  }).where(and(inArray(metaPurchases.id, due), eq(metaPurchases.status, "pending"), free)).returning();

  for (const row of claimed) {
    const mine = and(eq(metaPurchases.id, row.id), eq(metaPurchases.claimToken, token), eq(metaPurchases.status, "pending"));
    const finish = async (status: "delivered" | "suppressed" | "expired", reason: string | null) => {
      const recorded = await database.update(metaPurchases).set({
        status, lastError: reason, visitor: null, claimToken: null, claimedUntil: null,
        deliveredAt: status === "delivered" ? now : null, updatedAt: now,
      }).where(mine).returning({ id: metaPurchases.id });
      if (recorded.length) result[status]++;
    };
    try {
      const age = now.getTime() - row.occurredAt.getTime();
      // Meta takes events up to 7 days old; this queue keeps Google's 72 hours, and never a future time.
      if (age < -SKEW_MS || age >= MAX_AGE_MS) { await finish("expired", "outside_measurement_window"); continue; }
      const queued = saved(row.visitor, now);
      const [checkout] = row.checkoutId ? await database.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.checkoutId)).limit(1) : [];
      const current = saved(checkout?.analytics, now);
      const [payment] = row.paymentId ? await database.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1) : [];
      if (!queued || !current || current.consentKey !== queued.consentKey || !payment || payment.status !== "paid" || payment.amountCents <= 0) {
        await finish("suppressed", "consent_or_payment_no_longer_eligible"); continue;
      }
      // Never send a queued identity to a different pixel than the one it was queued for.
      if (!row.pixelId || row.pixelId !== metaPixelId()) throw new Error("pixel_configuration_changed");
      const [plan] = checkout?.planId ? await database.select({ name: plans.name }).from(plans).where(eq(plans.id, checkout.planId)).limit(1) : [];
      const sent = await sendMetaEvents([{
        name: "Purchase",
        // The id Google's purchase carries as its transaction id: one payment, one id.
        id: conversionId("purchase", `${payment.provider}:${payment.externalId}`),
        time: row.occurredAt.getTime() > now.getTime() ? now : row.occurredAt,
        path: "/pricing",
        user: queued.meta,
        custom: { value: payment.amountCents / 100, currency: payment.currency.toUpperCase(), content_name: (plan?.name ?? "subscription").toLowerCase() },
      }], send, row.pixelId);
      if (sent !== "sent") throw new Error("meta_refused_or_unreachable");
      await finish("delivered", null);
    } catch (error) {
      const reason = error instanceof Error && /^(pixel_configuration_changed|meta_refused_or_unreachable)$/.test(error.message) ? error.message : "transport_or_recording_failure";
      const backoff = Math.min(30_000 * 2 ** Math.min(row.attempts - 1, 10), 30 * 60_000);
      const recorded = await database.update(metaPurchases).set({
        lastError: reason, nextAttemptAt: new Date(now.getTime() + backoff), claimToken: null, claimedUntil: null, updatedAt: now,
      }).where(mine).returning({ id: metaPurchases.id });
      if (recorded.length) result.retrying++;
      console.error(`[meta] purchase ${row.id} requires retry (${reason})`);
    }
  }
  return result;
}

/**
 * Payments whose request ended before they were queued, then delivery: the
 * five-minute maintenance (inngest/functions/maintenance.ts). Selected
 * exactly as recoverPaidAcquisitions selects Google's, deferred checkouts
 * left out so the bounded batch always moves. Migration 0095 marked every
 * workspace that had already paid, so no old sale is ever sent.
 */
export async function recoverMetaPurchases(database: Database, send: Send = fetch, now = new Date()): Promise<MetaDelivery & { discovered: number }> {
  const first = database.selectDistinctOn([payments.organizationId], {
    organizationId: payments.organizationId, provider: payments.provider,
    subscriptionId: payments.providerSubscriptionId, paidAt: payments.paidAt,
  }).from(payments)
    .leftJoin(metaPurchases, eq(metaPurchases.organizationId, payments.organizationId))
    .where(and(positivePayment, isNull(metaPurchases.id)))
    .orderBy(payments.organizationId, asc(payments.paidAt), asc(payments.createdAt), asc(payments.id))
    .as("first_payment");
  const checkoutIn = (statuses: string[]) => database.select({ id: billingCheckouts.id }).from(billingCheckouts).where(and(
    eq(billingCheckouts.organizationId, first.organizationId), eq(billingCheckouts.provider, first.provider),
    eq(billingCheckouts.providerSubscriptionId, first.subscriptionId), inArray(billingCheckouts.status, statuses),
  ));
  const deferred = and(gt(first.paidAt, new Date(now.getTime() - MAX_AGE_MS)), notExists(checkoutIn(["completed"])), exists(checkoutIn(UNFINISHED)));
  const missing = await database.select({ organizationId: first.organizationId }).from(first)
    .where(not(deferred!)).orderBy(asc(first.paidAt), asc(first.organizationId)).limit(LIMIT);
  let discovered = 0;
  for (const row of missing) if (await enqueue(database, row.organizationId, now)) discovered++;
  return { discovered, ...await deliverMetaPurchases(database, { now }, send) };
}
