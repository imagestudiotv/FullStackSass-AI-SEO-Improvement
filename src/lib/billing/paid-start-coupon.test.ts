import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A coupon whose month starts with the paid service (lib/billing/paid-start-coupon.ts).
 * Stripe is replaced at its boundary. What Stripe does with these requests is
 * checked in test mode, not here.
 */

const stripeMock = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: stripeMock.retrieve, update: stripeMock.update } },
}));

import { applyPaidStartCoupon, holdPaidStartCoupon, paidStartUpdate } from "@/lib/billing/paid-start-coupon";

const SUB = "sub_1";
const COUPON = "GROW40";
const discount = (id: string, coupon: string) => ({ id, source: { coupon } });
const items = (interval: "month" | "year") => ({ data: [{ price: { recurring: { interval } } }] });
const live = (fields: Record<string, unknown>) => stripeMock.retrieve.mockResolvedValue({ id: SUB, status: "trialing", metadata: {}, discounts: [], items: items("month"), ...fields });

beforeEach(() => {
  stripeMock.retrieve.mockReset();
  stripeMock.update.mockReset();
  stripeMock.update.mockResolvedValue({});
  process.env.STRIPE_PAID_START_COUPON = COUPON;
});
afterEach(() => {
  delete process.env.STRIPE_PAID_START_COUPON;
});

describe("holding the coupon through the free period", () => {
  it("takes it off and remembers it", async () => {
    live({ discounts: [discount("di_1", COUPON)] });
    await holdPaidStartCoupon(SUB);
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
    expect(stripeMock.update.mock.calls[0].slice(0, 2)).toEqual([SUB, { discounts: "", metadata: { paid_start_coupon: COUPON } }]);
  });

  it("does nothing when the setting is unset", async () => {
    delete process.env.STRIPE_PAID_START_COUPON;
    live({ discounts: [discount("di_1", COUPON)] });
    await holdPaidStartCoupon(SUB);
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("leaves a partner coupon alone", async () => {
    live({ discounts: [discount("di_2", "PARTNER10")] });
    await holdPaidStartCoupon(SUB);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("keeps any other discount on the subscription when taking this one off", async () => {
    live({ discounts: [discount("di_1", COUPON), discount("di_2", "PARTNER10")] });
    await holdPaidStartCoupon(SUB);
    expect(stripeMock.update.mock.calls[0][1]).toEqual({ discounts: [{ discount: "di_2" }], metadata: { paid_start_coupon: COUPON } });
  });

  it("leaves a subscription with no free period: its month starts now anyway", async () => {
    live({ status: "active", discounts: [discount("di_1", COUPON)] });
    await holdPaidStartCoupon(SUB);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("repeating finds nothing left to take off", async () => {
    live({ metadata: { paid_start_coupon: COUPON } });
    await holdPaidStartCoupon(SUB);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });
});

describe("putting it back when the paid service starts", () => {
  it("puts it back on a monthly plan and forgets it", () => {
    expect(paidStartUpdate({ metadata: { paid_start_coupon: COUPON }, items: items("month") } as never)).toEqual({
      discounts: [{ coupon: COUPON }],
      metadata: { paid_start_coupon: "" },
    });
  });

  it("never on an annual plan: the discount is dropped, not moved to the full payment", () => {
    expect(paidStartUpdate({ metadata: { paid_start_coupon: COUPON }, items: items("year") } as never)).toEqual({ metadata: { paid_start_coupon: "" } });
  });

  it("nothing held, nothing added", () => {
    expect(paidStartUpdate({ metadata: {}, items: items("month") } as never)).toBeNull();
  });

  it("before the free period runs out", async () => {
    live({ metadata: { paid_start_coupon: COUPON } });
    await applyPaidStartCoupon(SUB);
    expect(stripeMock.update.mock.calls[0].slice(0, 2)).toEqual([SUB, { discounts: [{ coupon: COUPON }], metadata: { paid_start_coupon: "" } }]);
  });

  it("still, if the setting was unset meanwhile: a customer who was shown it keeps it", async () => {
    delete process.env.STRIPE_PAID_START_COUPON;
    live({ metadata: { paid_start_coupon: COUPON } });
    await applyPaidStartCoupon(SUB);
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
  });

  it("not once the free period is over, and not a second time", async () => {
    live({ status: "active", metadata: { paid_start_coupon: COUPON } });
    await applyPaidStartCoupon(SUB);
    live({ metadata: {} });
    await applyPaidStartCoupon(SUB);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });
});
