/**
 * Monthly entitlement periods, separate from how often the customer pays.
 *
 * WHY. Allowances (articles, link credits) are advertised per MONTH. The
 * usage window used to be the subscription's billing period, which is a year
 * for annual plans, so an annual customer could use a month's articles once
 * and then wait eleven months - and one credit grant covered the year.
 *
 * POLICY (every date is UTC; nothing depends on the server's time zone):
 *
 *  - Periods are consecutive calendar months ANCHORED on the subscription's
 *    billing anchor (its current period start): anchored on 15 March 10:00,
 *    they run 15 Mar → 15 Apr → 15 May, at 10:00 UTC, for monthly and annual
 *    plans alike. A monthly plan's periods therefore equal its billing
 *    periods, as before.
 *  - Month ends clamp to the anchor's DAY, not to the previous period: an
 *    anchor on 31 January gives 28 (or 29) February, then 31 March - it does
 *    not drift to the 28th for good.
 *  - Leap years: an anchor on 29 February gives 28 February in other years.
 *  - THE TRIAL IS PART OF THE FIRST MONTH (the client's rule, approved by the
 *    owner on 2026-10-05). A trial is its own billing period at the
 *    provider, and conversion moves the anchor to the trial's end - but the
 *    allowance does NOT start again there: "the first monthly billing period
 *    is not over yet". So a 3-day trial and the first paid month share one
 *    allowance, and fresh allowances start with the SECOND paid period.
 *    ONE predicate decides it for credits and articles alike,
 *    firstPeriodAfterTrial - so the two can never disagree about which
 *    month a customer is in:
 *      - Link credits: the trial is granted the month's credits when it
 *        starts; the conversion is granted only what the paid plan gives
 *        beyond that - nothing, on the same plan (grantMonthlyCredits in
 *        lib/backlinks/credits.ts).
 *      - Articles: in the first period after a trial the window opens at
 *        the subscription's creation, not at the period start, so what was
 *        written during the trial counts against the first paid month
 *        (allowanceWindowStart, used by usage.ts for display and
 *        enforcement alike).
 *    The first allowance therefore lasts the trial plus a month; every later
 *    period is exactly as described above. The rule is about the FIRST month
 *    only: a later re-anchor (an interval change, a PayPal renewal paid
 *    late) starts a new period with its own credits and articles, as it
 *    always did.
 *  - Upgrading within the same interval keeps the anchor (Stripe prorates
 *    in place): the new plan's limit applies to the current period's usage.
 *    Changing interval moves the billing anchor, and a new period starts -
 *    except in the subscription's first month, where by the rule above the
 *    article count carries on and the credits are topped up to the new
 *    plan rather than granted again.
 *  - A cancelled or unpaid subscription has no allowance at all; that is an
 *    entitlement question answered elsewhere (usage.ts), not a period one.
 */

export type Period = { start: Date; end: Date };

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** The anchor moved by whole months, keeping its time and clamping the day. */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const total = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonth(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

/**
 * The monthly period containing `now`, for periods anchored at `anchor`.
 *
 * An anchor in the future (clock skew, or a period start the provider has
 * already moved forward) yields the period starting at the anchor.
 */
export function entitlementPeriod(anchor: Date, now: Date = new Date()): Period {
  if (now < anchor) {
    return { start: anchor, end: addMonthsClamped(anchor, 1) };
  }
  let months =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - anchor.getUTCMonth());
  if (addMonthsClamped(anchor, months) > now) months -= 1;
  return {
    start: addMonthsClamped(anchor, months),
    end: addMonthsClamped(anchor, months + 1),
  };
}

/**
 * The billing anchor for a subscription row.
 *
 * The period start the provider reported, when known. Otherwise derived from
 * the period end by stepping back one billing interval - a year for annual
 * plans, which the old month-only fallback got wrong - and failing both, the
 * row's creation time.
 */
export function billingAnchor(input: {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  interval: string | null;
  createdAt: Date | null;
}): Date | null {
  if (input.currentPeriodStart) return input.currentPeriodStart;
  if (input.currentPeriodEnd) {
    return addMonthsClamped(
      input.currentPeriodEnd,
      input.interval === "year" ? -12 : -1,
    );
  }
  return input.createdAt;
}

/** The UTC calendar month containing `now`, for accounts with no billing anchor. */
export function calendarMonth(now: Date = new Date()): Period {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end: addMonthsClamped(start, 1) };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/*
  How much earlier than a whole month a provider may legitimately start the
  next period.

  Stripe renews on the anchor to the second, and our own month arithmetic
  never puts one period start less than a month after the previous one. But
  PayPal has no period start: we use the time of the last payment
  (paypal-events.ts), and PayPal charges a renewal at a time of day of its
  own choosing - hours before "one month after the first payment", and with
  a time-zone date shift up to about a day. Without this allowance a PayPal
  customer's second month would read as "still the first month"
  (firstPeriodAfterTrial) and earn no credits. Three days covers that drift
  and is nowhere near what a trial leaves (TRIAL_DAYS = 3 into a month of
  28-31 days: ~25 days short).
*/
const EARLY_RENEWAL_MS = 3 * DAY_MS;

/**
 * Whether two instants are less than a month apart (by the clamped month
 * arithmetic above, allowing for a provider renewing a little early). Order
 * does not matter. A 3-day trial's period and the paid period after it are;
 * a period and its renewal are not.
 *
 * Distance only. On its own it does NOT mean "the same allowance month": a
 * PayPal renewal paid five days late through PayPal's retries starts a
 * period less than a month before the next on-schedule renewal, and both
 * are paid months. Which periods share an allowance is decided by
 * firstPeriodAfterTrial.
 */
export function lessThanAMonthApart(a: Date, b: Date): boolean {
  const [earlier, later] = a <= b ? [a, b] : [b, a];
  return later.getTime() < addMonthsClamped(earlier, 1).getTime() - EARLY_RENEWAL_MS;
}

/*
  How long after the subscription row was written a period can start before
  that gap means "a trial came first".

  The row is written by the webhook a few seconds AFTER the provider starts
  the subscription, so without a trial the first period starts just BEFORE
  createdAt. A PayPal row can be written at approval, minutes (rarely hours)
  before the first payment that we take as its period start. Neither is a
  trial. Half a day separates the two with room on both sides, and also
  absorbs a database session that wrote createdAt in a time zone other than
  UTC.

  What the gap measures is when the trial ENDED (the paid period starts at
  the conversion), not how long it was configured to last. A trial ended
  early - from the Stripe Dashboard or API, or by a portal plan switch set
  to end the trial - within 12 hours of starting therefore reads as no trial
  at all: the first paid period is a fresh month, with its own credits AND
  its own articles. Credits and articles take that from the same predicate
  (firstPeriodAfterTrial), so they still agree; such a customer keeps what
  the trial was given on top of the first month's allowance. Telling those
  trials apart would need the trial stored (the trial end, or the
  checkout's trial days), for both rules at once.
*/
const CREATION_LAG_MS = 12 * HOUR_MS;

/**
 * Whether a period starting at `start` is still the subscription's FIRST
 * allowance month - the period right after a trial, or any other re-anchor
 * inside the first month - rather than a month of its own.
 *
 * Detected without trial columns: the subscription existed well before the
 * period started (more than CREATION_LAG_MS - not the webhook's few seconds,
 * not a PayPal approval) but less than a month before it. From the second
 * paid period on, and for the first period of every subscription without a
 * trial, this is false.
 *
 * THE one rule for "the trial is part of the first month": the article
 * window (allowanceWindowStart) and the credit grant (grantMonthlyCredits)
 * both ask it, so a customer is never in a fresh month for one and the same
 * month for the other. It deliberately says nothing about later periods: a
 * rule of "no two grants less than a month apart" reached across renewals
 * and zeroed a paid month after a PayPal renewal paid late.
 */
export function firstPeriodAfterTrial(createdAt: Date | null, start: Date): boolean {
  return (
    createdAt !== null &&
    start.getTime() - createdAt.getTime() > CREATION_LAG_MS &&
    lessThanAMonthApart(createdAt, start)
  );
}

/**
 * Where the CURRENT allowance window starts: what articles are counted from.
 *
 * Normally the start of the monthly entitlement period. In the first period
 * after a trial (firstPeriodAfterTrial) it is the subscription's creation
 * instead, so the trial's usage counts against the first paid month (the
 * policy above). From the second paid period on, and for every subscription
 * without a trial, this is exactly the entitlement period start.
 *
 * Null when there is no anchor at all (no billing dates and no creation
 * time); callers fall back to the calendar month.
 */
export function allowanceWindowStart(
  sub: {
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    interval: string | null;
    createdAt: Date | null;
  },
  now: Date = new Date(),
): Date | null {
  const anchor = billingAnchor(sub);
  if (!anchor) return null;
  const { start } = entitlementPeriod(anchor, now);
  return sub.createdAt && firstPeriodAfterTrial(sub.createdAt, start) ? sub.createdAt : start;
}
