import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeRefund,
  recordProviderRefund,
  reserveRefund,
  resolveRefund,
  type ProviderRefundAnswer,
  type RefundProviderOps,
} from "@/lib/billing/refunds";
import { organization, paymentRefunds, payments } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createTestDb } from "@/test/db";

/**
 * The refund rules (lib/billing/refunds.ts) on a disposable PGlite with the
 * provider stubbed: what remains refundable, one refund in flight, an
 * unanswered call resolved with the same key, webhooks recorded once. The
 * concurrent double press on real Postgres is refunds.concurrency.test.ts.
 */

let db: Database;
let paymentId: string;

function ops(...answers: ProviderRefundAnswer[]): RefundProviderOps & { calls: { operationKey: string; amountCents: number; refundRowId: string }[] } {
  const calls: { operationKey: string; amountCents: number; refundRowId: string }[] = [];
  return {
    calls,
    refund: vi.fn(async (input) => {
      calls.push({ operationKey: input.operationKey, amountCents: input.amountCents, refundRowId: input.refundRowId });
      const next = answers.shift();
      if (!next) throw new Error("unexpected provider call");
      return next;
    }),
  };
}

const ok = (id: string, settled: "completed" | "pending" = "completed"): ProviderRefundAnswer => ({ kind: "succeeded", providerRefundId: id, settled });

async function paymentRow() {
  const [row] = await db.select().from(payments).where(eq(payments.id, paymentId));
  return row;
}

async function refundRows() {
  return db.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, paymentId));
}

beforeEach(async () => {
  ({ db } = (await createTestDb()) as unknown as { db: Database });
  await db.insert(organization).values({ id: "org_a", name: "A", slug: "a", createdAt: new Date() });
  const [row] = await db
    .insert(payments)
    .values({ organizationId: "org_a", provider: "paypal", externalId: "SALE-1", providerObject: "paypal_sale", amountCents: 14900, currency: "eur", status: "paid" })
    .returning({ id: payments.id });
  paymentId = row.id;
});

const reserve = (amountCents?: number) => reserveRefund(db, { paymentId, amountCents, reason: "goodwill", actor: "ops@example.test" });

describe("refunding a payment", () => {
  it("refunds all of it by default, once", async () => {
    const reserved = await reserve();
    expect(reserved).toMatchObject({ kind: "reserved", amountCents: 14900, partial: false });
    const provider = ops(ok("REF-1"));
    const outcome = await executeRefund(db, reserved.kind === "reserved" ? reserved.refundId : "", provider);
    expect(outcome).toMatchObject({ kind: "completed", providerRefundId: "REF-1", fullyRefunded: true, becameFull: true });
    expect(await paymentRow()).toMatchObject({ status: "refunded", refundedCents: 14900 });
    expect(await reserve()).toEqual({ kind: "refused", error: "This payment has already been refunded in full." });
  });

  it("allows several partial refunds up to what was paid, never beyond", async () => {
    const first = await reserve(5000);
    expect(first).toMatchObject({ kind: "reserved", partial: true });
    await executeRefund(db, first.kind === "reserved" ? first.refundId : "", ops(ok("REF-1")));
    // Partly refunded: still paid (refunded only once all of it went back), the rest refundable.
    expect(await paymentRow()).toMatchObject({ status: "paid", refundedCents: 5000 });

    const tooMuch = await reserve(9901);
    expect(tooMuch).toMatchObject({ kind: "refused" });
    expect(tooMuch.kind === "refused" && tooMuch.error).toContain("99.00 EUR");

    const rest = await reserve();
    expect(rest).toMatchObject({ kind: "reserved", amountCents: 9900 });
    const outcome = await executeRefund(db, rest.kind === "reserved" ? rest.refundId : "", ops(ok("REF-2")));
    expect(outcome).toMatchObject({ fullyRefunded: true, becameFull: true });
    expect((await paymentRow()).refundedCents).toBe(14900);
  });

  it("refuses more than the customer paid, zero, and fractions", async () => {
    expect(await reserve(14901)).toEqual({ kind: "refused", error: "That is more than the customer paid." });
    expect(await reserve(0)).toMatchObject({ kind: "refused", error: "Enter an amount greater than zero." });
    expect(await reserve(10.5)).toMatchObject({ kind: "refused", error: "Enter an amount greater than zero." });
    expect(await refundRows()).toHaveLength(0);
  });

  it("refuses a second refund while the first has no confirmed outcome (a double press)", async () => {
    const first = await reserve(1000);
    const second = await reserve(1000);
    expect(second).toMatchObject({ kind: "refused", unresolvedRefundId: first.kind === "reserved" ? first.refundId : "x" });
    expect(await refundRows()).toHaveLength(1);
  });

  it("keeps an unanswered call open and resolves it with the SAME key, never a second refund", async () => {
    const reserved = await reserve(3000);
    const refundId = reserved.kind === "reserved" ? reserved.refundId : "";
    const provider = ops({ kind: "unknown", message: "PayPal took too long to respond" }, ok("REF-9"));

    expect(await executeRefund(db, refundId, provider)).toMatchObject({ kind: "unknown" });
    // Counted against what remains while unknown, and it blocks another refund.
    expect(await reserve(1)).toMatchObject({ kind: "refused", unresolvedRefundId: refundId });
    expect((await paymentRow()).refundedCents).toBe(0);

    expect(await resolveRefund(db, refundId, provider)).toMatchObject({ kind: "completed", providerRefundId: "REF-9" });
    expect(provider.calls.map((call) => call.operationKey)).toEqual([`refund:${paymentId}:1`, `refund:${paymentId}:1`]);
    expect(await paymentRow()).toMatchObject({ status: "paid", refundedCents: 3000 });
  });

  it("releases the amount of a refused refund; the next one gets a new key", async () => {
    const first = await reserve(3000);
    expect(await executeRefund(db, first.kind === "reserved" ? first.refundId : "", ops({ kind: "refused", message: "REFUND_AMOUNT_EXCEEDED" }))).toMatchObject({ kind: "failed" });
    expect(await paymentRow()).toMatchObject({ status: "paid", refundedCents: 0 });
    const second = await reserve();
    expect(second).toMatchObject({ kind: "reserved", amountCents: 14900, operationKey: `refund:${paymentId}:2` });
  });

  it("counts a refund the provider accepted but has not finished (pending)", async () => {
    const reserved = await reserve(2000);
    expect(await executeRefund(db, reserved.kind === "reserved" ? reserved.refundId : "", ops(ok("REF-P", "pending")))).toMatchObject({ kind: "pending" });
    expect((await paymentRow()).refundedCents).toBe(2000);
    expect(await reserve(13000)).toMatchObject({ kind: "refused" });
  });

  it("refuses a payment refunded before amounts were kept, rather than guessing", async () => {
    await db.update(payments).set({ status: "refunded", refundedCents: 0 }).where(eq(payments.id, paymentId));
    expect(await reserve(100)).toMatchObject({ kind: "refused" });
  });

  it("refuses a payment that is not paid", async () => {
    await db.update(payments).set({ status: "failed" }).where(eq(payments.id, paymentId));
    expect(await reserve()).toMatchObject({ kind: "refused", error: 'Only a paid payment can be refunded; this one is "failed".' });
  });
});

describe("refunds the provider reports", () => {
  const event = (overrides: Partial<Parameters<typeof recordProviderRefund>[1]> = {}) =>
    recordProviderRefund(db, {
      provider: "paypal",
      paymentExternalIds: ["SALE-1"],
      providerRefundId: "REF-D",
      amountCents: 4000,
      currency: "EUR",
      settled: "completed",
      reason: "Refunded in PayPal",
      ...overrides,
    });

  it("records a dashboard refund once, however often the webhook arrives", async () => {
    expect(await event()).toMatchObject({ kind: "recorded", fullyRefunded: false, becameFull: false });
    await event();
    await event();
    const rows = await refundRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "provider", status: "completed", amountCents: 4000 });
    expect(await paymentRow()).toMatchObject({ status: "paid", refundedCents: 4000 });
  });

  it("matches the webhook of our own refund to our row, and never moves a completed refund back", async () => {
    const reserved = await reserve(4000);
    const refundId = reserved.kind === "reserved" ? reserved.refundId : "";
    await executeRefund(db, refundId, ops(ok("REF-OWN")));
    // A late "pending" delivery for the same refund, carrying our id.
    await event({ providerRefundId: "REF-OWN", settled: "pending", ourRefundId: refundId });
    const rows = await refundRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: refundId, status: "completed", source: "admin" });
    expect((await paymentRow()).refundedCents).toBe(4000);
  });

  it("counts a refund once when the webhook recorded it before the admin's call returned", async () => {
    const reserved = await reserve(4000);
    const refundId = reserved.kind === "reserved" ? reserved.refundId : "";
    // Webhook first, without our id (as if PayPal had not echoed it).
    await event({ providerRefundId: "REF-RACE" });
    expect((await paymentRow()).refundedCents).toBe(4000);
    await executeRefund(db, refundId, ops(ok("REF-RACE")));
    const live = (await refundRows()).filter((row) => row.status === "completed");
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(refundId);
    expect((await paymentRow()).refundedCents).toBe(4000);
  });

  it("reports a full refund once, and ignores a payment it does not know", async () => {
    expect(await event({ amountCents: 14900 })).toMatchObject({ fullyRefunded: true, becameFull: true });
    expect(await event({ amountCents: 14900 })).toMatchObject({ fullyRefunded: true, becameFull: false });
    expect(await event({ paymentExternalIds: ["SALE-UNKNOWN"] })).toEqual({ kind: "unknown_payment" });
  });
});
