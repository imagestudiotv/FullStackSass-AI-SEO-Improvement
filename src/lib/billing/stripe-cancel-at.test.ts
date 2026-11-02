import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

/**
 * Stripe's two ways to say a subscription will stop (2026-11-03): the older
 * cancel_at_period_end, and cancel_at, a scheduled date the newer customer
 * portal can set ALONE. Either counts, and the date shown is the scheduled
 * one, which can come before the period's end.
 */

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/stripe/client", () => ({ stripe: {} }));

import { cancellationFor } from "@/lib/billing/stripe-events";
import { planDate } from "@/lib/billing-shared";

const PERIOD_END = 1_792_600_000;
const sub = (fields: { cancel_at?: number | null; cancel_at_period_end?: boolean }) =>
  ({
    cancel_at: null,
    cancel_at_period_end: false,
    items: { data: [{ current_period_start: 1_790_000_000, current_period_end: PERIOD_END }] },
    ...fields,
  }) as unknown as Stripe.Subscription;

describe("cancellationFor", () => {
  it("nothing scheduled: renewing, no date", () => {
    expect(cancellationFor(sub({}))).toEqual({ cancelAtPeriodEnd: false, cancelAt: null });
  });

  it("cancel_at alone, as the newer portal sets it, counts - with its date", () => {
    const at = PERIOD_END - 5 * 86_400;
    expect(cancellationFor(sub({ cancel_at: at }))).toEqual({ cancelAtPeriodEnd: true, cancelAt: new Date(at * 1000) });
  });

  it("cancel_at_period_end alone ends at the period's end", () => {
    expect(cancellationFor(sub({ cancel_at_period_end: true }))).toEqual({
      cancelAtPeriodEnd: true,
      cancelAt: new Date(PERIOD_END * 1000),
    });
  });

  it("a payload without the cancel_at field at all is not a cancellation", () => {
    const { cancel_at: _omitted, ...rest } = sub({}) as unknown as Record<string, unknown>;
    expect(cancellationFor(rest as unknown as Stripe.Subscription)).toEqual({ cancelAtPeriodEnd: false, cancelAt: null });
  });
});

describe("planDate", () => {
  const end = new Date("2027-01-20T12:00:00Z");
  const at = new Date("2027-01-09T12:00:00Z");
  it("shows the scheduled end when the plan is set to stop", () => {
    expect(planDate({ cancelAtPeriodEnd: true, cancelAt: at, currentPeriodEnd: end })).toEqual(at);
  });
  it("falls back to the period's end, and shows the renewal otherwise", () => {
    expect(planDate({ cancelAtPeriodEnd: true, cancelAt: null, currentPeriodEnd: end })).toEqual(end);
    expect(planDate({ cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: end })).toEqual(end);
  });
});
