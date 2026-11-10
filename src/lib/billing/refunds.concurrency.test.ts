import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { recordProviderRefund, reserveRefund } from "@/lib/billing/refunds";
import { organization, paymentRefunds, payments } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Refund reservations under real concurrency (lib/billing/refunds.ts), on a
 * real Postgres with separate connections - a lock cannot be shown on PGlite.
 * Skipped unless TEST_POSTGRES_URL names a disposable server.
 */

const available = Boolean(testPostgresUrl());

describe.skipIf(!available)("refunds, two connections at once", () => {
  let a: Database;
  let b: Database;
  let dispose: () => Promise<void>;
  let paymentId: string;

  beforeAll(async () => {
    const created = await createPostgresTestDb(2);
    [a, b] = created.dbs as unknown as Database[];
    dispose = created.dispose;
  }, 120_000);
  afterAll(async () => dispose?.());

  beforeEach(async () => {
    await a.delete(paymentRefunds);
    await a.delete(payments);
    await a.delete(organization);
    await a.insert(organization).values({ id: "org_a", name: "A", slug: "a", createdAt: new Date() });
    const [row] = await a
      .insert(payments)
      .values({ organizationId: "org_a", provider: "paypal", externalId: "SALE-1", providerObject: "paypal_sale", amountCents: 14900, currency: "eur", status: "paid" })
      .returning({ id: payments.id });
    paymentId = row.id;
  });

  it("lets one of two simultaneous refund presses through, never both (five rounds)", async () => {
    for (let round = 0; round < 5; round += 1) {
      await a.delete(paymentRefunds);
      const results = await Promise.all([
        reserveRefund(a, { paymentId, reason: "double press", actor: "ops-1@example.test" }),
        reserveRefund(b, { paymentId, reason: "double press", actor: "ops-2@example.test" }),
      ]);
      expect(results.filter((result) => result.kind === "reserved")).toHaveLength(1);
      expect(results.filter((result) => result.kind === "refused")).toHaveLength(1);
      expect(await a.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, paymentId))).toHaveLength(1);
    }
  });

  it("records the same provider refund once when its webhook is delivered twice at once", async () => {
    const event = (database: Database) =>
      recordProviderRefund(database, {
        provider: "paypal",
        paymentExternalIds: ["SALE-1"],
        providerRefundId: "REF-DUP",
        amountCents: 5000,
        currency: "EUR",
        settled: "completed",
        reason: "Refunded in PayPal",
      });
    await Promise.all([event(a), event(b)]);
    const rows = await a.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, paymentId));
    expect(rows).toHaveLength(1);
    const [payment] = await a.select().from(payments).where(eq(payments.id, paymentId));
    expect(payment).toMatchObject({ status: "paid", refundedCents: 5000 });
  });
});
