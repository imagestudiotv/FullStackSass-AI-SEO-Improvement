import type { CheckoutReturn } from "@/lib/billing/return-to";

/**
 * The dashboard's answer to a payment that has just come back from the
 * growth plan (lib/billing/return-to.ts, origin "growth-plan").
 *
 * Stripe and PayPal send the browser back the moment the payment is
 * authorised; the subscription is written by the webhook a moment later. In
 * that gap the dashboard's paywall (requirePlan) would send someone who has
 * just paid to the plan screen, asking them to pay again. So while the
 * website named by the return has no plan yet, the dashboard shows the
 * onboarding plan step's waiting screen (checkout-pending.tsx), which
 * refreshes until the server sees the plan.
 *
 * IT GRANTS NOTHING: it only chooses what to show while waiting. Only a
 * successful return for a website of the caller's own workspace waits; any
 * other address takes the dashboard's usual path, paywall included.
 */
export function waitsForPayment(
  back: CheckoutReturn | null,
  /** The page's ?site=. */
  requested: string | null,
  /** That website's setup state, read for the caller's own workspace (null when not read). */
  state: { websiteId: string | null; hasPlan: boolean } | null,
): boolean {
  if (back?.outcome !== "success" || !requested || !state) return false;
  return state.websiteId === requested && !state.hasPlan;
}

/**
 * Whether the dashboard greets a website just started from the growth plan:
 * back from its checkout, or sent by its Free start (`welcome=1`). The note
 * points to Tasks, where the onboarding steps the growth plan skips are.
 */
export function arrivedFromGrowthPlan(back: CheckoutReturn | null, welcome: unknown): boolean {
  return back?.outcome === "success" || welcome === "1";
}
