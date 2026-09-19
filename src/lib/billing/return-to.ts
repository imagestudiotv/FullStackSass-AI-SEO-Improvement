/**
 * Where a customer comes back to after paying.
 *
 * Every checkout used to send them to /billing regardless of where they
 * started. For someone part-way through setup that is the wrong place twice
 * over: they are dropped into the dashboard's billing screen — the sidebar,
 * the whole app — when they were three steps into a guided flow that
 * deliberately hides all of it, and the flow itself just stops with no sign
 * of what to do next.
 *
 * So the caller says where it started and the return URL follows.
 *
 * WHY AN ENUM AND NOT A URL: the value crosses the browser on its way to
 * Stripe and comes back in a redirect. Accepting a URL would let anyone turn
 * our checkout into an open redirect — pay, then land on a page of someone
 * else's choosing wearing our domain in the referrer. A fixed set of names
 * resolved on the server cannot be pointed anywhere we did not write.
 */

/** Where the customer was when they started paying. */
export type CheckoutOrigin = "onboarding" | "billing";

export function isCheckoutOrigin(value: unknown): value is CheckoutOrigin {
  return value === "onboarding" || value === "billing";
}

/**
 * The path to come back to, by origin and outcome.
 *
 * Onboarding returns to /onboarding/plan rather than jumping ahead to the
 * next step. That page already forwards a paid customer onward, so the
 * forward happens in ONE place — and it is the place that reads real
 * subscription state rather than trusting a success redirect. Stripe's
 * success_url fires as soon as the browser is sent back; the subscription is
 * only real once the webhook has been processed, which may be a moment later.
 * Landing on a page that checks, rather than one that assumes, means a
 * customer who arrives early sees the plan step again for a second instead of
 * a broken screen further on.
 */
export function checkoutReturnPath(
  origin: CheckoutOrigin,
  outcome: "success" | "cancelled",
  /** Carried through so the next screen acts on the site that was paid for. */
  websiteId?: string | null,
  /**
   * Which processor is returning.
   *
   * The billing page reads `?checkout=` for Stripe and `?paypal=` for PayPal
   * and shows a different message for each — PayPal subscriptions are
   * approved rather than charged immediately, so "payment received" would be
   * wrong there. Keeping the two names is what preserves that distinction.
   */
  provider: "stripe" | "paypal" = "stripe",
): string {
  const key = provider === "paypal" ? "paypal" : "checkout";
  if (origin === "onboarding") {
    const site = websiteId ? `&site=${websiteId}` : "";
    return `/onboarding/plan?${key}=${outcome}${site}`;
  }
  return `/billing?${key}=${outcome}`;
}
