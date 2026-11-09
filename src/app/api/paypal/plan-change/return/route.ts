import { NextResponse, type NextRequest } from "next/server";

import { returnFromRevision } from "@/lib/paypal/plan-changes";

/**
 * Where PayPal sends a buyer back from approving (or declining) the revision
 * of their subscription (lib/paypal/plan-changes.ts). Only OUR change id is
 * read from the address; what happened is what PayPal says when asked now.
 * Coming back through "success" is recorded as a sign of approval - it never
 * grants anything by itself, it only keeps a paid difference from being
 * refunded without a person looking.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const changeId = params.get("change") ?? "";
  const outcome = params.get("outcome") === "cancelled" ? "cancelled" : "success";
  const to = (state: string) => NextResponse.redirect(new URL(`/billing?plan_change=${state}&via=paypal`, request.nextUrl.origin), 303);
  if (!UUID.test(changeId)) return NextResponse.redirect(new URL("/billing", request.nextUrl.origin), 303);

  let status: string | null;
  try {
    status = await returnFromRevision(changeId, outcome);
  } catch (error) {
    console.error(`[paypal-plan-change] return for ${changeId} could not settle; the webhook and the sweep will`, error);
    status = "awaiting_approval";
  }
  switch (status) {
    case "completed":
      return to("completed");
    case "refunding":
    case "refunded":
      return to("refunded");
    case "cancelled":
      return to("cancelled");
    case "failed":
      return to("failed");
    case null:
      return NextResponse.redirect(new URL("/billing", request.nextUrl.origin), 303);
    default:
      return to("pending");
  }
}
