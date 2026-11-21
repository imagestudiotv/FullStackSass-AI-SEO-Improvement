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

/**
 * Where the customer was when they started paying.
 *
 * "growth-plan" (Daniel, 2026-11-21): the public growth plan flow
 * (/growth-plan), which ends in its own billing step. Paying there goes
 * straight to the dashboard, not into the onboarding steps after the plan
 * (Connect Google, AI visibility, the content plan): those wait on the
 * Tasks page instead (lib/tasks/tasks.ts ONBOARDING_STEP_TASKS).
 */
export type CheckoutOrigin = "onboarding" | "billing" | "growth-plan";

export function isCheckoutOrigin(value: unknown): value is CheckoutOrigin {
  return value === "onboarding" || value === "billing" || value === "growth-plan";
}

/**
 * The dashboard for the website the growth plan set up, saying it was just
 * started (`welcome=1`: the dashboard's note pointing to Tasks). Where the
 * growth plan sends someone who started Free, or whose website already had a
 * plan: nothing to wait for.
 */
export function growthPlanDashboardPath(websiteId: string): string {
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
  const site = websiteId ? `&site=${websiteId}` : "";
  /*
    The growth plan. Paid: the dashboard for the website just paid for,
    which waits there for the webhook (the dashboard page's checkout wait)
    rather than trusting this redirect. Walked away: the onboarding plan
    screen for that website, which releases an abandoned PayPal approval and
    offers the plans again - the growth plan's own page needs the address
    typed on the homepage, which this return does not carry.
  */
  if (origin === "growth-plan") {
    return outcome === "success" ? `/dashboard?${key}=success${site}` : `/onboarding/plan?${key}=cancelled${site}`;
  }
  if (origin === "onboarding") {
    return `/onboarding/plan?${key}=${outcome}${site}`;
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
