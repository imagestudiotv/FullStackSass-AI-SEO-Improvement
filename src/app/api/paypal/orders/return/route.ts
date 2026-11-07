import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { blogPath } from "@/lib/blog/locale";
import { sponsorshipThanksPath } from "@/lib/blog/sponsorship";
import { db } from "@/lib/db";
import { blogSponsorships, paypalOrders } from "@/lib/db/schema";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { settlePayPalOrder } from "@/lib/paypal/order-fulfilment";

/**
 * Where PayPal sends a buyer back after a one-off purchase (lib/paypal/
 * orders.ts): approved ("success") or "Cancel and return" ("cancelled").
 *
 * It takes nothing from the address but OUR row's id. What happened is what
 * PayPal says when asked now (settlePayPalOrder): an approved order is
 * captured here - the buyer is waiting - and granted only once PayPal
 * reports the capture completed. The token PayPal appends is never read.
 * The webhook and the maintenance sweep do the same for a buyer who never
 * comes back. Then the buyer goes on to Billing or the placement's thanks page.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rowId = params.get("row") ?? "";
  const cancelled = params.get("outcome") === "cancelled";
  const lang = params.get("lang");
  const locale: Locale = lang && isLocale(lang) ? lang : "en";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);

  if (!UUID.test(rowId)) return to("/billing");
  const [row] = await db
    .select({ id: paypalOrders.id, purpose: paypalOrders.purpose, referenceId: paypalOrders.referenceId, status: paypalOrders.status })
    .from(paypalOrders)
    .where(eq(paypalOrders.id, rowId))
    .limit(1);
  if (!row) return to("/billing");

  let state: string;
  try {
    const settled = await settlePayPalOrder(row.id);
    state = settled.kind;
    // "Cancel and return" on an order PayPal never captured: abandoned now, so the buyer can pay another way.
    if (cancelled && settled.kind === "waiting") {
      await db
        .update(paypalOrders)
        .set({ status: "voided", error: "cancelled by the buyer on PayPal", updatedAt: new Date() })
        .where(eq(paypalOrders.id, row.id));
      state = "voided";
    }
  } catch (error) {
    console.error(`[paypal-orders] return for ${row.id} could not settle; the webhook and the sweep will`, error);
    state = "unknown";
  }

  if (row.purpose === "addon_credits") {
    const addon = state === "completed" ? "success" : state === "voided" ? "cancelled" : state === "failed" ? "failed" : "pending";
    return to(`/billing?addon=${addon}&via=paypal`);
  }

  // A "Get Featured" placement: the thanks page (in the article's language) reports it; a cancelled one goes back to the article.
  if (state === "voided") {
    const [request] = await db.select({ postSlug: blogSponsorships.postSlug }).from(blogSponsorships).where(eq(blogSponsorships.id, row.referenceId)).limit(1);
    return to(request ? `${blogPath(locale, encodeURIComponent(request.postSlug))}?featured=cancelled` : blogPath(locale));
  }
  return to(`${sponsorshipThanksPath(locale)}?paypal_row=${row.id}`);
}
