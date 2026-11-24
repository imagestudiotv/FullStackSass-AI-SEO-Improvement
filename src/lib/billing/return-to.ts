/**
 * Where a customer comes back to after paying.
 *
 * Every checkout used to send them to /billing regardless of where they
 * started. For someone part-way through setup that is the wrong place twice
 * over: they are dropped into the dashboard's billing screen — the sidebar,
 * the whole app — when they were part-way through a guided flow that
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

/**
 * Where the customer was when they started paying.
 *
 * "onboarding" (the plan step) and "growth-plan" (the public growth plan
 * flow, which ends in its own billing step) both start a website's plan, and
 * both go straight to the dashboard: onboarding ends at the plan (Daniel,
 * 2026-11-21 for the growth plan, 2026-11-24 for everyone). What the steps
 * after it used to ask for - Connect Google, AI visibility, the content plan -
 * waits on the Tasks page (lib/tasks/tasks.ts ONBOARDING_STEP_TASKS).
 * "billing" is an existing customer's Billing page.
 */
export type CheckoutOrigin = "onboarding" | "billing" | "growth-plan";

export function isCheckoutOrigin(value: unknown): value is CheckoutOrigin {
  return value === "onboarding" || value === "billing" || value === "growth-plan";
}

/**
 * The dashboard for a website whose plan has just started, saying so
 * (`welcome=1`: the dashboard's note pointing to Tasks). Where someone goes who
 * started Free, or whose plan is already in place: nothing to wait for.
 */
export function startedDashboardPath(websiteId: string): string {
  return `/dashboard?site=${encodeURIComponent(websiteId)}&welcome=1`;
}

/** A return from a checkout, as a page's ?checkout= (Stripe) or ?paypal= says it. */
export type CheckoutReturn = { provider: "stripe" | "paypal"; outcome: "success" | "cancelled" };

/** What a page's ?checkout= / ?paypal= say, or null when neither is a return. */
export function readCheckoutReturn(params: Record<string, string | string[] | undefined>): CheckoutReturn | null {
  const outcome = (value: unknown) => (value === "success" || value === "cancelled" ? value : null);
  const paypal = outcome(params.paypal);
  if (paypal) return { provider: "paypal", outcome: paypal };
  const stripe = outcome(params.checkout);
  return stripe ? { provider: "stripe", outcome: stripe } : null;
}

/**
 * The path to come back to, by origin and outcome.
 *
 * A plan that was paid for returns to the DASHBOARD for that website, which
 * reads real subscription state rather than trusting a success redirect:
 * Stripe's success_url fires as soon as the browser is sent back, while the
 * subscription is only real once the webhook has been processed, a moment
 * later. Until then the dashboard shows the waiting screen
 * (lib/dashboard/checkout-wait.ts), so a customer who arrives early is never
 * asked to pay again.
 *
 * A checkout walked away from returns to the plan step for that website,
 * which releases an abandoned PayPal approval and offers the plans again (the
 * growth plan's own page needs the address typed on the homepage, which this
 * return does not carry).
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
  const site = websiteId ? `&site=${websiteId}` : "";
  if (origin === "growth-plan" || origin === "onboarding") {
    // Without a website the dashboard has nothing to wait for: the plan step waits instead.
    return outcome === "success" && websiteId ? `/dashboard?${key}=success${site}` : `/onboarding/plan?${key}=${outcome}${site}`;
  }
  /*
    PayPal's billing return names the website too: the page settles the
    return for the website it shows (components/paypal-return.tsx), and
    without it that was whichever site the switcher remembered - not
    necessarily the one just paid for. The page checks it against the
    workspace like any ?site=.
  */
  return `/billing?${key}=${outcome}${provider === "paypal" ? site : ""}`;
}
