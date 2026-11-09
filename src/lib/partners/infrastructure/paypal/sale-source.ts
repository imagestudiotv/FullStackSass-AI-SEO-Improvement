import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { paymentRefunds, payments } from "@/lib/db/schema";
import { payPalMode, payPalRequest } from "@/lib/paypal/client";
import { fromPayPalAmount } from "@/lib/paypal/payments";

import type { NormalizedPayPalSale, PayPalSaleSource } from "../../application/ports/billing-source";
import type { Environment } from "../../application/ports/repositories";

/**
 * PayPal subscription sales for the partner program (review P7), read from
 * PayPal NOW (GET /v1/payments/sale/{id}) - the event only says which one.
 * What was refunded comes from RepGet's own refund records (payment_refunds,
 * lib/billing/refunds.ts), kept from PayPal's REFUNDED/REVERSED events and the
 * admin's refunds: a sale does not report its refunded total itself.
 */

type Sale = {
  id: string;
  state?: string;
  amount?: { total?: string; currency?: string; details?: { subtotal?: string; tax?: string } };
  create_time?: string;
  billing_agreement_id?: string;
};

/** Money moved for these (refunded or reversed since, perhaps): the sale was collected. */
const COLLECTED = new Set(["completed", "partially_refunded", "refunded", "reversed"]);

export function paypalEnvironment(): Environment | null {
  const mode = payPalMode();
  return mode === "live" ? "live" : mode === "sandbox" ? "test" : null;
}

export function payPalSaleSource(environment: Environment): PayPalSaleSource {
  return {
    environment: () => environment,

    async loadSale(saleId) {
      const sale = await payPalRequest<Sale>(`/v1/payments/sale/${encodeURIComponent(saleId)}`);
      const state = (sale.state ?? "").toLowerCase();
      const cash = fromPayPalAmount(sale.amount?.total) ?? 0;
      const tax = fromPayPalAmount(sale.amount?.details?.tax) ?? 0;
      const [{ refunded }] = await db
        .select({ refunded: sql<number>`coalesce(sum(${paymentRefunds.amountCents}), 0)::int` })
        .from(paymentRefunds)
        .innerJoin(payments, eq(payments.id, paymentRefunds.paymentId))
        .where(and(eq(payments.provider, "paypal"), eq(payments.externalId, saleId), inArray(paymentRefunds.status, ["pending", "completed"])));
      const normalized: NormalizedPayPalSale = {
        environment,
        saleId: sale.id ?? saleId,
        subscriptionId: sale.billing_agreement_id ?? null,
        state,
        verified: COLLECTED.has(state),
        cash: BigInt(cash),
        currency: (sale.amount?.currency ?? "").toLowerCase(),
        tax: BigInt(tax),
        paidAt: sale.create_time ? new Date(sale.create_time) : null,
        refunded: BigInt(Number(refunded)),
        reversed: state === "reversed",
        // No personal data: what the commission is reproduced from.
        evidence: { provider: "paypal", sale: sale.id ?? saleId, state, total: sale.amount?.total ?? null, tax: sale.amount?.details?.tax ?? null, currency: sale.amount?.currency ?? null, subscription: sale.billing_agreement_id ?? null },
      };
      return normalized;
    },

    async organizationForSale(saleId) {
      const [row] = await db
        .select({ organizationId: payments.organizationId })
        .from(payments)
        .where(and(eq(payments.provider, "paypal"), eq(payments.externalId, saleId)))
        .limit(1);
      return row?.organizationId ?? null;
    },
  };
}
