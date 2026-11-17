import { randomUUID } from "node:crypto";

import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import { CONSENT_MAX_AGE } from "@/lib/consent";
import { billingCheckouts, paidAcquisitions, payments, plans } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { measurementId } from "@/lib/google-analytics";

import { conversionId, gaApiSecret, validConsentKey } from "./config";
import type { CheckoutVisitor } from "./conversions";

type Send = (url: string, init: RequestInit) => Promise<Response>;
type Payment = { provider: "stripe" | "paypal"; providerSubscriptionId: string; externalId: string; amountCents: number; currency: string; paidAt?: Date | null };
const MAX_AGE_MS = 72 * 60 * 60 * 1000;
// A batch is bounded to 20 five-second requests. Leave room for DB work too.
const CLAIM_MS = 5 * 60_000;
const LIMIT = 20;
// A provider clock slightly ahead of ours: the payment waits until it is due instead of being suppressed.
const SKEW_MS = 5 * 60_000;
// Subscription money only. PayPal credit packs share this ledger without a subscription id (Stripe's go to
// addon_purchases), so otherwise a trial's credit purchase would block its first subscription charge.
const positivePayment = and(gt(payments.amountCents, 0), inArray(payments.status, ["paid", "refunded"]), isNotNull(payments.providerSubscriptionId));

function visitor(value: unknown, now: Date): CheckoutVisitor | null {
  if (!value || typeof value !== "object") return null;
  const v = value as CheckoutVisitor;
  const age = now.getTime() - new Date(v.capturedAt).getTime();
  if (!/^\d+\.\d+$/.test(v.clientId) || !validConsentKey(v.consentKey) || !Number.isFinite(age) || age < 0 || age >= CONSENT_MAX_AGE * 1000) return null;
  if (v.sessionId !== null && !/^\d+$/.test(v.sessionId)) return null;
  return v;
}

/**
 * The acquisition unit is a workspace's first positive payment, and it must
 * belong to a subscription checkout. Prior positive payments (including
 * refunded ones) prevent a renewal/reactivation/second provider from being
 * called a new paying workspace. Credit/one-off purchases never emit this event.
 * The ledger is authoritative; webhook arguments are only lookup keys.
 */
async function enqueueFirstPayment(database: Database, organizationId: string, now: Date): Promise<string | null> {
  const [payment] = await database.select().from(payments)
    .where(and(eq(payments.organizationId, organizationId), positivePayment))
    .orderBy(asc(payments.paidAt), asc(payments.createdAt), asc(payments.id)).limit(1);
  if (!payment) return null;
  const [checkout] = payment.providerSubscriptionId
    ? await database.select().from(billingCheckouts).where(and(
        eq(billingCheckouts.organizationId, organizationId), eq(billingCheckouts.provider, payment.provider),
        eq(billingCheckouts.providerSubscriptionId, payment.providerSubscriptionId), eq(billingCheckouts.status, "completed"),
      )).orderBy(asc(billingCheckouts.createdAt), asc(billingCheckouts.id)).limit(1)
    : [];
  const age = now.getTime() - payment.paidAt.getTime();
  if (!checkout && payment.providerSubscriptionId && age < MAX_AGE_MS) {
    // Activation can trail the payment (PayPal may report the sale before the subscription is active).
    // Leave it to a later recovery pass rather than suppress it for good.
    const [unfinished] = await database.select({ id: billingCheckouts.id }).from(billingCheckouts).where(and(
      eq(billingCheckouts.organizationId, organizationId), eq(billingCheckouts.provider, payment.provider),
      eq(billingCheckouts.providerSubscriptionId, payment.providerSubscriptionId), inArray(billingCheckouts.status, ["open", "unresolved", "abandoned"]),
    )).limit(1);
    if (unfinished) return null;
  }
  const saved = visitor(checkout?.analytics, now);
  const id = measurementId();
  const reason = !checkout ? "not_subscription_checkout" : payment.status === "refunded" ? "refunded_before_delivery"
    : !saved ? "no_current_consent_identity" : !id ? "measurement_not_configured" : age < -SKEW_MS || age >= MAX_AGE_MS ? "outside_measurement_window" : null;
  const [inserted] = await database.insert(paidAcquisitions).values({
    organizationId, paymentId: payment.id, checkoutId: checkout?.id ?? null,
    visitor: reason ? null : saved, measurementId: id,
    status: reason ? "suppressed" : "pending", lastError: reason,
    occurredAt: payment.paidAt, nextAttemptAt: age < 0 ? payment.paidAt : now,
  }).onConflictDoNothing({ target: paidAcquisitions.organizationId }).returning({ id: paidAcquisitions.id });
  return inserted?.id ?? null;
}

/** Persist first, then try a bounded delivery; the scheduled worker recovers either failure window. */
export async function reportFirstPayment(database: Database, payment: Payment, send: Send = fetch, now = new Date()): Promise<"sent" | "skipped" | "failed"> {
  if (payment.amountCents <= 0) return "skipped";
  try {
    const [record] = await database.select({ organizationId: payments.organizationId }).from(payments).where(and(
      eq(payments.provider, payment.provider), eq(payments.externalId, payment.externalId),
      eq(payments.providerSubscriptionId, payment.providerSubscriptionId), positivePayment,
    )).limit(1);
    if (!record) return "skipped";
    const inserted = await enqueueFirstPayment(database, record.organizationId, now);
    if (!inserted) return "skipped";
    const result = await deliverPaidAcquisitions(database, { only: [inserted], now, limit: 1 }, send);
    return result.delivered ? "sent" : result.retrying ? "failed" : "skipped";
  } catch {
    // The payment ledger is already committed. Discovery retries from it even if this insert failed.
    console.error("[analytics] paid acquisition could not be queued; scheduled ledger recovery will retry");
    return "failed";
  }
}

export type AcquisitionDelivery = { delivered: number; retrying: number; suppressed: number; expired: number };

/** Token leases prevent overlapping workers; stable transaction_id handles acknowledgement-lost retries. */
export async function deliverPaidAcquisitions(
  database: Database,
  options: { now?: Date; only?: string[]; limit?: number } = {},
  send: Send = fetch,
): Promise<AcquisitionDelivery> {
  const result: AcquisitionDelivery = { delivered: 0, retrying: 0, suppressed: 0, expired: 0 };
  const now = options.now ?? new Date();
  const secret = gaApiSecret();
  // A temporarily absent server credential does not lose or consume a queued conversion.
  if (!secret) {
    // Still enforce the retention/window limit when reporting is unconfigured.
    const old = database.select({ id: paidAcquisitions.id }).from(paidAcquisitions)
      .where(and(eq(paidAcquisitions.status, "pending"), lte(paidAcquisitions.occurredAt, new Date(now.getTime() - MAX_AGE_MS))))
      .limit(options.limit ?? LIMIT);
    const expired = await database.update(paidAcquisitions).set({ status: "expired", visitor: null,
      lastError: "outside_measurement_window", claimToken: null, claimedUntil: null, updatedAt: now,
    }).where(and(inArray(paidAcquisitions.id, old), eq(paidAcquisitions.status, "pending"))).returning({ id: paidAcquisitions.id });
    result.expired = expired.length;
    return result;
  }
  const free = or(isNull(paidAcquisitions.claimedUntil), lt(paidAcquisitions.claimedUntil, now));
  const due = database.select({ id: paidAcquisitions.id }).from(paidAcquisitions).where(and(
    eq(paidAcquisitions.status, "pending"), lte(paidAcquisitions.nextAttemptAt, now), free,
    options.only?.length ? inArray(paidAcquisitions.id, options.only) : undefined,
  )).orderBy(paidAcquisitions.nextAttemptAt).limit(options.limit ?? LIMIT);
  const token = randomUUID();
  const claimed = await database.update(paidAcquisitions).set({
    claimToken: token, claimedUntil: new Date(now.getTime() + CLAIM_MS),
    attempts: sql`${paidAcquisitions.attempts} + 1`, updatedAt: now,
  }).where(and(inArray(paidAcquisitions.id, due), eq(paidAcquisitions.status, "pending"), free)).returning();

  for (const row of claimed) {
    const mine = and(eq(paidAcquisitions.id, row.id), eq(paidAcquisitions.claimToken, token), eq(paidAcquisitions.status, "pending"));
    const finish = async (status: "delivered" | "suppressed" | "expired", reason: string | null) => {
      const recorded = await database.update(paidAcquisitions).set({
        status, lastError: reason, visitor: null, claimToken: null, claimedUntil: null,
        deliveredAt: status === "delivered" ? now : null, updatedAt: now,
      }).where(mine).returning({ id: paidAcquisitions.id });
      if (recorded.length) result[status]++;
    };
    try {
      const age = now.getTime() - row.occurredAt.getTime();
      // Never due before occurredAt (enqueue schedules it so); beyond the skew allowance is not a real payment time.
      if (age < -SKEW_MS || age >= MAX_AGE_MS) { await finish("expired", "outside_measurement_window"); continue; }
      const saved = visitor(row.visitor, now);
      const [checkout] = row.checkoutId ? await database.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.checkoutId)).limit(1) : [];
      const current = visitor(checkout?.analytics, now);
      const [payment] = row.paymentId ? await database.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1) : [];
      if (!saved || !current || current.consentKey !== saved.consentKey || !payment || payment.status !== "paid" || payment.amountCents <= 0) {
        await finish("suppressed", "consent_or_payment_no_longer_eligible"); continue;
      }
      if (!row.measurementId || row.measurementId !== measurementId()) {
        // Do not send a previously captured identity to a different GA property.
        throw new Error("measurement_configuration_changed");
      }
      const [plan] = checkout?.planId ? await database.select({ name: plans.name }).from(plans).where(eq(plans.id, checkout.planId)).limit(1) : [];
      const value = payment.amountCents / 100;
      const sameVisit = saved.sessionId && row.occurredAt.getTime() - new Date(saved.capturedAt).getTime() >= 0
        && row.occurredAt.getTime() - new Date(saved.capturedAt).getTime() < 30 * 60_000;
      const body = {
        client_id: saved.clientId,
        // Always the actual payment time, also on retry. Never shift an old payment to the present.
        timestamp_micros: row.occurredAt.getTime() * 1000,
        consent: { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
        events: [{ name: "purchase", params: {
          transaction_id: conversionId("purchase", `${payment.provider}:${payment.externalId}`),
          value, currency: payment.currency.toUpperCase(), payment_type: payment.provider,
          ...(sameVisit ? { session_id: saved.sessionId } : {}), engagement_time_msec: 1,
          items: [{ item_id: checkout?.planId ?? "plan", item_name: plan?.name ?? "Subscription", price: value, quantity: 1 }],
        } }],
      };
      const response = await send(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(row.measurementId)}&api_secret=${encodeURIComponent(secret)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      // This records transport acceptance, not proof of GA4 validation or Ads attribution.
      await finish("delivered", null);
    } catch (error) {
      const reason = error instanceof Error && /^(http_\d{3}|measurement_configuration_changed)$/.test(error.message) ? error.message : "transport_or_recording_failure";
      const backoff = Math.min(30_000 * 2 ** Math.min(row.attempts - 1, 10), 30 * 60_000);
      const recorded = await database.update(paidAcquisitions).set({
        lastError: reason, nextAttemptAt: new Date(now.getTime() + backoff), claimToken: null, claimedUntil: null, updatedAt: now,
      }).where(mine).returning({ id: paidAcquisitions.id });
      if (recorded.length) result.retrying++;
      console.error(`[analytics] paid acquisition ${row.id} requires retry (${reason})`);
    }
  }
  return result;
}

/**
 * Finds ledger commits whose request died before enqueueing. Migration 0094
 * marks existing paying workspaces as legacy, so this cannot replay historical sales.
 */
export async function recoverPaidAcquisitions(database: Database, send: Send = fetch, now = new Date()): Promise<AcquisitionDelivery & { discovered: number }> {
  const missing = await database.selectDistinct({ organizationId: payments.organizationId }).from(payments)
    .leftJoin(paidAcquisitions, eq(paidAcquisitions.organizationId, payments.organizationId))
    .where(and(positivePayment, isNull(paidAcquisitions.id))).limit(LIMIT);
  let discovered = 0;
  for (const row of missing) if (await enqueueFirstPayment(database, row.organizationId, now)) discovered++;
  return { discovered, ...await deliverPaidAcquisitions(database, { now }, send) };
}

/** Same-browser withdrawal: no account id or GA identity is accepted from the request body. */
export async function revokeCheckoutConsent(database: Database, key: string): Promise<void> {
  if (!validConsentKey(key)) return;
  await database.transaction(async tx => {
    await tx.update(billingCheckouts).set({ analytics: null, updatedAt: sql`${billingCheckouts.updatedAt}` })
      .where(sql`${billingCheckouts.analytics}->>'consentKey' = ${key}`);
    await tx.update(paidAcquisitions).set({
      visitor: null, status: "suppressed", lastError: "consent_withdrawn", claimToken: null, claimedUntil: null,
    }).where(and(eq(paidAcquisitions.status, "pending"), sql`${paidAcquisitions.visitor}->>'consentKey' = ${key}`));
  });
}
