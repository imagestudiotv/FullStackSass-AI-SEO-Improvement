/**
 * The PayPal plans RepGet creates (scripts/paypal-setup.mjs): for each of
 * RepGet's plans, the plan itself and the same plan with the free articles
 * first. Kept apart from the script so a test reads exactly what is sent to
 * PayPal (src/lib/paypal/plans-body.test.ts).
 *
 * The free articles (client, 2026-10-22: PayPal "as same as the case of
 * Stripe"): FREE_ARTICLES_DAYS free in a TRIAL billing cycle, priced 0 as
 * PayPal's own examples do, then the plan's price every month or year. A
 * first-time workspace paying with PayPal subscribes to this plan; RepGet
 * gives its free articles while PayPal reports the trial cycle running, and
 * "Start your plan now" replaces it with the paid plan once they are written
 * (PayPal cannot end a trial early).
 */

/** Days free before a free-articles plan charges: lib/plans/features.ts FREE_ARTICLES_DAYS (a test keeps the two equal). */
export const FREE_ARTICLES_DAYS = 30;

function regularCycle(plan, sequence) {
  return {
    frequency: {
      interval_unit: plan.interval === "year" ? "YEAR" : "MONTH",
      interval_count: 1,
    },
    tenure_type: "REGULAR",
    sequence,
    // Billed until cancelled.
    total_cycles: 0,
    pricing_scheme: {
      fixed_price: {
        value: (plan.price_cents / 100).toFixed(2),
        currency_code: plan.currency.toUpperCase(),
      },
    },
  };
}

/**
 * An offer plan's intro cycle (review P5): ONE month or year, priced like the
 * regular cycle. Only a checkout carrying a first-payment discount - the
 * win-back one now - subscribes to an offer plan, and it overrides this
 * cycle's price on its own subscription (lib/paypal/actions.ts), so the plan
 * itself never sells at a discount to anyone.
 *
 * The REPGET launch price (2026-11-11) is every payment, so it needs no offer
 * plan: its checkout overrides the REGULAR cycle of the plan itself (or of its
 * free-articles plan, after the free days) on its own subscription. The offer
 * plans keep their "REPGET offer" name, the one PayPal already has.
 */
function introCycle(plan, sequence) {
  return { ...regularCycle(plan, sequence), tenure_type: "TRIAL", total_cycles: 1 };
}

/**
 * The body of POST /v1/billing/plans for one of RepGet's plans.
 * `freeArticles` puts FREE_ARTICLES_DAYS free first; `offer` adds the intro
 * cycle before the regular one (after the free days, so they never use the
 * discount up). PayPal allows two TRIAL cycles, which the free-articles offer
 * plan uses.
 */
export function planBody(plan, productId, { freeArticles = false, offer = false } = {}) {
  const cycles = [];
  if (freeArticles) {
    cycles.push({
      frequency: { interval_unit: "DAY", interval_count: FREE_ARTICLES_DAYS },
      tenure_type: "TRIAL",
      sequence: 1,
      total_cycles: 1,
      pricing_scheme: {
        fixed_price: { value: "0", currency_code: plan.currency.toUpperCase() },
      },
    });
  }
  if (offer) cycles.push(introCycle(plan, cycles.length + 1));
  cycles.push(regularCycle(plan, cycles.length + 1));
  const suffix = [freeArticles ? "free articles first" : null, offer ? "REPGET offer" : null].filter(Boolean).join(", ");
  return {
    product_id: productId,
    name: suffix ? `${plan.name} - ${suffix}` : plan.name,
    status: "ACTIVE",
    billing_cycles: cycles,
    payment_preferences: {
      auto_bill_outstanding: true,
      // Applies only to a setup fee, and these plans have none.
      setup_fee_failure_action: "CANCEL",
      // After three failed payments PayPal SUSPENDS it (stored as "unpaid").
      payment_failure_threshold: 3,
    },
  };
}
