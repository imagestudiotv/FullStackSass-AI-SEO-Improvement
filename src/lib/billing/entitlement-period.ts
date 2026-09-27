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
 *  - A trial is its own billing period; conversion moves the anchor to the
 *    trial end, and the first paid month starts a fresh allowance.
 *  - Upgrading within the same interval keeps the anchor (Stripe prorates
 *    in place): the new plan's limit applies to the current period's usage.
 *    Changing interval moves the billing anchor, and a new period starts.
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
