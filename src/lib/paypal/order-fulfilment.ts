import "server-only";

import { confirmSponsorshipPayPal } from "@/lib/blog/sponsorship";
import { db } from "@/lib/db";
import { paypalOrders } from "@/lib/db/schema";
import { fulfilPlanUpgrade } from "@/lib/paypal/plan-changes";
import { fulfilCreditPack, ordersToReconcile, parseOrderCustomId, settleOrder, type Fulfilment, type OrderPurpose, type SettleResult } from "@/lib/paypal/orders";
import { eq } from "drizzle-orm";

/**
 * What each PayPal purchase grants (lib/paypal/orders.ts decides when).
 * One place, so the return page, the webhook and the sweep cannot disagree.
 */
export const FULFILMENTS: Record<OrderPurpose, Fulfilment> = {
  addon_credits: fulfilCreditPack,
  blog_sponsorship: (row) => confirmSponsorshipPayPal(row),
  plan_upgrade: fulfilPlanUpgrade,
};

/** Settles our order row, whatever it is for. */
export async function settlePayPalOrder(rowId: string): Promise<SettleResult> {
  const [row] = await db.select({ purpose: paypalOrders.purpose }).from(paypalOrders).where(eq(paypalOrders.id, rowId)).limit(1);
  if (!row) return { kind: "not_found" };
  return settleOrder(rowId, FULFILMENTS[row.purpose as OrderPurpose]);
}

/** A PayPal webhook naming one of our orders by custom_id: settled; anyone else's is left alone. */
export async function settleFromWebhook(customId: string | undefined | null): Promise<SettleResult | null> {
  const ours = parseOrderCustomId(customId);
  if (!ours) return null;
  return settlePayPalOrder(ours.rowId);
}

/** The maintenance sweep: orders the buyer left, PayPal is clearing, or a crash interrupted. */
export async function reconcilePayPalOrders(now: Date = new Date()): Promise<number> {
  const due = await ordersToReconcile(db, now);
  let settled = 0;
  for (const row of due) {
    try {
      await settlePayPalOrder(row.id);
      settled += 1;
    } catch (error) {
      console.error(`[paypal-orders] could not reconcile ${row.id}; the next run tries again`, error);
    }
  }
  return settled;
}
