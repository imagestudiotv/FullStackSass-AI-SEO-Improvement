/**
 * The PayPal plans RepGet creates (scripts/paypal-setup.mjs): for each of
 * RepGet's plans, the plan itself and the same plan with the free trial
 * first. Kept apart from the script so a test reads exactly what is sent to
 * PayPal (src/lib/paypal/plans-body.test.ts).
 *
 * The free trial (client, 2026-10-22: PayPal "as same as the case of
 * Stripe"; 2026-11-13: "3-day free trial is good instead of 3 free
 * articles"): TRIAL_DAYS free in a TRIAL billing cycle, priced 0 as PayPal's
 * own examples do, then the plan's price every month or year - PayPal moves
 * to the regular cycle by itself. A first-time workspace paying with PayPal
 * subscribes to this plan; RepGet gives the plan's normal service while
 * PayPal reports the trial cycle running, and "Start your plan now" replaces
 * it with the paid plan at once (PayPal cannot end a trial early).
 *
 * PayPal cannot change a plan's billing cycles, so the 30-day plans of the
 * free articles (until 2026-11-13) are REPLACED by new ones:
 * scripts/paypal-trial-3day.mjs. Their subscribers stay on them until their
 * free days end (paypal_plan_versions keeps the old ids).
 */

/** Days free before a trial plan charges: lib/plans/features.ts TRIAL_DAYS (a test keeps the two equal). */
export const TRIAL_DAYS = 3;

/** A trial plan's name suffix ("Grow - 3-day free trial"). The 30-day ones said "free articles first". */
export const TRIAL_SUFFIX = `${TRIAL_DAYS}-day free trial`;

/**
 * The free days of a PayPal plan as PayPal returns it (GET /v1/billing/plans/
 * {id}): its first cycle when that is a TRIAL priced 0 and counted in days;
 * null for a plan without free days, or one whose free cycle is in other
 * units. What scripts/paypal-trial-3day.mjs reads to tell a 30-day plan from
 * a TRIAL_DAYS one.
 */
export function freeTrialDays(paypalPlan) {
  const cycles = paypalPlan?.billing_cycles ?? [];
  const first = cycles.find((cycle) => (cycle.sequence ?? 1) === 1);
  if (!first || first.tenure_type !== "TRIAL") return null;
  if (Number(first.pricing_scheme?.fixed_price?.value ?? "0") !== 0) return null;
  if (first.frequency?.interval_unit !== "DAY") return null;
  return (first.frequency.interval_count ?? 1) * (first.total_cycles || 1);
}

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
 * trial plan, after the free days) on its own subscription. The offer plans
 * keep their "REPGET offer" name, the one PayPal already has.
 */
function introCycle(plan, sequence) {
  return { ...regularCycle(plan, sequence), tenure_type: "TRIAL", total_cycles: 1 };
}

/**
 * The body of POST /v1/billing/plans for one of RepGet's plans.
 * `trial` puts TRIAL_DAYS free first; `offer` adds the intro cycle before
 * the regular one (after the free days, so they never use the discount up).
 * PayPal allows two TRIAL cycles, which the trial offer plan uses.
 */
export function planBody(plan, productId, { trial = false, offer = false } = {}) {
  const cycles = [];
  if (trial) {
    cycles.push({
      frequency: { interval_unit: "DAY", interval_count: TRIAL_DAYS },
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
  const suffix = [trial ? TRIAL_SUFFIX : null, offer ? "REPGET offer" : null].filter(Boolean).join(", ");
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
