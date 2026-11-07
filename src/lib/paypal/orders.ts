import "server-only";

import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { fulfilAddonPurchase } from "@/lib/addons/fulfil";
import { db as appDb } from "@/lib/db";
import { payments, paypalOrders } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { PayPalError } from "@/lib/paypal/client";
import {
  captureOf,
  captureOrder,
  createOrder,
  fromPayPalAmount,
  getOrder,
  type PayPalCapture,
  type PayPalOrder,
} from "@/lib/paypal/payments";

/**
 * PayPal one-off purchases (reviews P4 credit packs, P8 "Get Featured"),
 * shared by both products. What each product grants stays its own
 * (fulfilAddonPurchase, confirmSponsorshipPayPal); this decides only WHEN the
 * money is real.
 *
 *  1. startOrder: our row first, with the amount the SERVER chose, then the
 *     PayPal order (keyed by our row, so a retried create is the same order).
 *  2. The buyer approves on PayPal. Nothing is granted for that.
 *  3. settleOrder - from the return page, the CHECKOUT.ORDER.APPROVED and
 *     PAYMENT.CAPTURE.* webhooks and the maintenance sweep alike - reads the
 *     order from PayPal, captures it if approved (keyed by the order, so
 *     racing callers capture once), and grants only on a COMPLETED capture
 *     of exactly our amount and currency, carrying our custom_id. Pending
 *     waits; declined fails; a lost answer is "unknown" and asked again.
 *
 * Each step is idempotent on its own (the purchase is unique per order, the
 * payment per capture), so a crash between them is finished by the next call.
 */

/** plan_upgrade: the difference of a PayPal upgrade, paid now (lib/paypal/plan-changes.ts). */
export type OrderPurpose = "addon_credits" | "blog_sponsorship" | "plan_upgrade";

export type OrderOps = {
  createOrder: typeof createOrder;
  getOrder: typeof getOrder;
  captureOrder: typeof captureOrder;
};
export const payPalOrderOps: OrderOps = { createOrder, getOrder, captureOrder };

/** What a settled order grants, per product. Returns true once granted (or already granted). */
export type Fulfilment = (order: OrderRow, capture: PayPalCapture) => Promise<boolean>;

type OrderRow = typeof paypalOrders.$inferSelect;

export const customIdFor = (purpose: OrderPurpose, rowId: string) => `${purpose}:${rowId}`;

/** Our row named by a PayPal custom_id, if it is one of ours. */
export function parseOrderCustomId(value: string | undefined | null): { purpose: OrderPurpose; rowId: string } | null {
  const match = /^(addon_credits|blog_sponsorship|plan_upgrade):([0-9a-f-]{36})$/i.exec(value ?? "");
  return match ? { purpose: match[1] as OrderPurpose, rowId: match[2] } : null;
}

export type StartResult = { kind: "started"; rowId: string; url: string } | { kind: "error"; error: string; rowId?: string };

export async function startOrder(
  input: {
    purpose: OrderPurpose;
    organizationId: string | null;
    referenceId: string;
    amountCents: number;
    currency: string;
    description: string;
    userId?: string | null;
    returnUrl: (rowId: string) => string;
    cancelUrl: (rowId: string) => string;
  },
  options: { database?: Database; ops?: OrderOps } = {},
): Promise<StartResult> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? payPalOrderOps;
  const [row] = await database
    .insert(paypalOrders)
    .values({
      organizationId: input.organizationId,
      purpose: input.purpose,
      referenceId: input.referenceId,
      amountCents: input.amountCents,
      currency: input.currency.toLowerCase(),
      description: input.description,
      userId: input.userId ?? null,
      status: "creating",
      /*
        From the app clock, not the column default: the abandonment and sweep
        windows compare these with the app clock, and a database session in
        another time zone would shift a default by hours (as in checkouts.ts).
      */
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: paypalOrders.id });
  return createAtPayPal(database, ops, row.id, input);
}

/** Creates (or re-creates, with the same key) the PayPal order for a row still "creating" or "unknown". */
async function createAtPayPal(
  database: Database,
  ops: OrderOps,
  rowId: string,
  input: { purpose: OrderPurpose; amountCents: number; currency: string; description: string; returnUrl: (id: string) => string; cancelUrl: (id: string) => string },
): Promise<StartResult> {
  try {
    const created = await ops.createOrder({
      reference: rowId,
      customId: customIdFor(input.purpose, rowId),
      amountCents: input.amountCents,
      currency: input.currency,
      description: input.description,
      returnUrl: input.returnUrl(rowId),
      cancelUrl: input.cancelUrl(rowId),
    });
    await database
      .update(paypalOrders)
      .set({ status: "created", paypalOrderId: created.orderId, approveUrl: created.approveUrl, error: null, updatedAt: new Date() })
      .where(eq(paypalOrders.id, rowId));
    return { kind: "started", rowId, url: created.approveUrl };
  } catch (error) {
    // A definite refusal: nothing exists at PayPal. Anything else may have created it.
    const unknown = !(error instanceof PayPalError) || error.kind === "unknown";
    await database
      .update(paypalOrders)
      .set({ status: unknown ? "unknown" : "failed", error: (error instanceof Error ? error.message : String(error)).slice(0, 500), updatedAt: new Date() })
      .where(eq(paypalOrders.id, rowId));
    console.error(`[paypal-orders] could not create order for ${rowId}`, error);
    return { kind: "error", error: "PayPal could not start the payment. Please try again, or pay by card.", rowId };
  }
}

export type SettleResult =
  | { kind: "completed"; granted: boolean }
  | { kind: "waiting" }
  | { kind: "pending" }
  | { kind: "failed"; reason: string }
  | { kind: "voided" }
  | { kind: "unknown"; reason: string }
  | { kind: "not_found" };

/** The capture PayPal reports matches what we decided the buyer pays, for this row. */
function captureMatches(row: OrderRow, capture: PayPalCapture): string | null {
  if (capture.custom_id && capture.custom_id !== customIdFor(row.purpose as OrderPurpose, row.id)) return "custom_id differs";
  const cents = fromPayPalAmount(capture.amount?.value);
  if (cents !== row.amountCents) return `amount ${capture.amount?.value} differs from ${row.amountCents}`;
  if ((capture.amount?.currency_code ?? "").toLowerCase() !== row.currency) return `currency ${capture.amount?.currency_code} differs from ${row.currency}`;
  return null;
}

async function setStatus(database: Database, rowId: string, values: Partial<OrderRow>) {
  await database.update(paypalOrders).set({ ...values, updatedAt: new Date() }).where(eq(paypalOrders.id, rowId));
}

/** Records the captured money as a payment, once (unique per provider and capture id). */
async function recordPayment(database: Database, row: OrderRow, capture: PayPalCapture) {
  if (!row.organizationId) return; // A public placement belongs to no workspace: its record is the request itself.
  await database
    .insert(payments)
    .values({
      organizationId: row.organizationId,
      provider: "paypal",
      externalId: capture.id,
      providerObject: "paypal_capture",
      amountCents: row.amountCents,
      currency: row.currency,
      status: "paid",
      description: row.description,
      paidAt: capture.create_time ? new Date(capture.create_time) : new Date(),
    })
    .onConflictDoNothing({ target: [payments.provider, payments.externalId] });
}

/**
 * Brings one order row to what PayPal says now, capturing and granting when
 * that is due. Safe from any caller, any number of times, in any order.
 */
export async function settleOrder(
  rowId: string,
  fulfil: Fulfilment,
  options: { database?: Database; ops?: OrderOps; now?: Date } = {},
): Promise<SettleResult> {
  const database = options.database ?? appDb;
  const ops = options.ops ?? payPalOrderOps;
  const [row] = await database.select().from(paypalOrders).where(eq(paypalOrders.id, rowId)).limit(1);
  if (!row) return { kind: "not_found" };
  if (row.status === "failed") return { kind: "failed", reason: row.error ?? "failed" };
  if (row.status === "voided") return { kind: "voided" };
  if (row.status === "completed" && row.fulfilledAt) return { kind: "completed", granted: false };
  const now = options.now ?? new Date();
  if (!row.paypalOrderId) {
    /*
      The create's answer was lost. Whatever PayPal made, the buyer was never
      sent to approve it, and PayPal cannot take money without that approval:
      after an hour it is simply abandoned.
    */
    if (now.getTime() - row.createdAt.getTime() > 60 * 60_000) {
      await setStatus(database, row.id, { status: "voided", error: "never confirmed created; the buyer was not sent to PayPal" });
      return { kind: "voided" };
    }
    return { kind: "unknown", reason: "the order was never confirmed created" };
  }

  let order: PayPalOrder;
  try {
    order = await ops.getOrder(row.paypalOrderId);
  } catch (error) {
    if (error instanceof PayPalError && error.kind === "not_found") {
      // PayPal no longer knows an order never approved: abandoned.
      await setStatus(database, row.id, { status: "voided", error: "PayPal no longer has this order" });
      return { kind: "voided" };
    }
    return { kind: "unknown", reason: error instanceof Error ? error.message : "PayPal did not answer" };
  }

  if (order.status === "VOIDED") {
    await setStatus(database, row.id, { status: "voided" });
    return { kind: "voided" };
  }
  if (order.status === "APPROVED") {
    try {
      order = await ops.captureOrder(row.paypalOrderId);
    } catch (error) {
      if (error instanceof PayPalError && error.issue === "ORDER_ALREADY_CAPTURED") {
        order = await ops.getOrder(row.paypalOrderId);
      } else if (error instanceof PayPalError && error.kind !== "unknown") {
        // INSTRUMENT_DECLINED and the like: the buyer can try again on PayPal; nothing moved.
        await setStatus(database, row.id, { error: `${error.message}${error.issue ? ` (${error.issue})` : ""}`.slice(0, 500) });
        return { kind: "waiting" };
      } else {
        await setStatus(database, row.id, { status: "unknown", error: "capture unanswered" });
        return { kind: "unknown", reason: error instanceof Error ? error.message : "capture unanswered" };
      }
    }
  }

  const capture = captureOf(order);
  if (!capture) {
    // CREATED / PAYER_ACTION_REQUIRED / SAVED: the buyer has not finished. Never approved in time: abandoned.
    if (order.status !== "APPROVED" && now.getTime() - row.createdAt.getTime() > ABANDON_AFTER_MS) {
      await setStatus(database, row.id, { status: "voided", error: "not approved in time" });
      return { kind: "voided" };
    }
    return { kind: "waiting" };
  }
  const mismatch = captureMatches(row, capture);
  if (mismatch) {
    // Money moved that is not what we sold: never granted, and a person looks at it.
    await setStatus(database, row.id, { status: "failed", paypalCaptureId: capture.id, error: `capture mismatch: ${mismatch}` });
    console.error(`[paypal-orders] ${row.id}: capture ${capture.id} does not match the order (${mismatch}) - NOT granted; review and refund in PayPal`);
    return { kind: "failed", reason: mismatch };
  }

  const status = capture.status.toUpperCase();
  if (status === "PENDING") {
    await setStatus(database, row.id, { status: "pending", paypalCaptureId: capture.id });
    return { kind: "pending" };
  }
  if (status === "DECLINED" || status === "FAILED") {
    await setStatus(database, row.id, { status: "failed", paypalCaptureId: capture.id, error: `capture ${status.toLowerCase()}` });
    return { kind: "failed", reason: `capture ${status.toLowerCase()}` };
  }
  // COMPLETED, or refunded since (it was completed first): the purchase stands; a refund is its own record.
  if (status !== "COMPLETED" && status !== "PARTIALLY_REFUNDED" && status !== "REFUNDED") {
    return { kind: "waiting" };
  }

  await setStatus(database, row.id, { paypalCaptureId: capture.id });
  await recordPayment(database, row, capture);
  const granted = await fulfil({ ...row, paypalCaptureId: capture.id }, capture);
  if (!granted) {
    // The product could not be granted (it no longer exists, say): the money is recorded, a person decides.
    await setStatus(database, row.id, { status: "completed", error: "paid, but nothing could be granted: review" });
    return { kind: "completed", granted: false };
  }
  await setStatus(database, row.id, { status: "completed", fulfilledAt: now, error: null });
  return { kind: "completed", granted: true };
}

/** A credit pack's grant: the add-on purchase, keyed by our order row, with its credits once. */
export const fulfilCreditPack: Fulfilment = async (row) => {
  if (!row.organizationId) return false;
  await fulfilAddonPurchase({
    organizationId: row.organizationId,
    addonId: row.referenceId,
    paypalOrderId: row.id,
    amountTotal: row.amountCents,
    currency: row.currency,
  });
  return true;
};

/** The order rows the maintenance sweep should look at again: unanswered, clearing, or abandoned. */
export async function ordersToReconcile(database: Database = appDb, now: Date = new Date(), limit = 25) {
  return database
    .select({ id: paypalOrders.id, purpose: paypalOrders.purpose, status: paypalOrders.status, updatedAt: paypalOrders.updatedAt })
    .from(paypalOrders)
    .where(
      and(
        or(
          inArray(paypalOrders.status, ["creating", "created", "pending", "unknown"]),
          // Paid but not yet granted (a crash between the steps) - not one already left for a person.
          and(
            eq(paypalOrders.status, "completed"),
            isNull(paypalOrders.fulfilledAt),
            sql`coalesce(${paypalOrders.error}, '') not like 'paid, but nothing%'`,
          ),
        ),
        // Recent ones are still with the buyer.
        lt(paypalOrders.updatedAt, new Date(now.getTime() - 10 * 60_000)),
      ),
    )
    .limit(limit);
}

/** Abandoned: approval never given within PayPal's window. PayPal keeps an unapproved order about 3 hours. */
export const ABANDON_AFTER_MS = 6 * 60 * 60_000;
