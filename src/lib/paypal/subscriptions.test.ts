import { beforeEach, describe, expect, it, vi } from "vitest";

import { isEntitled } from "@/lib/billing-shared";

/**
 * How PayPal's statuses are stored, how our custom_id is recognised, and
 * what a new subscription asks PayPal for. No request leaves the test.
 */

const paypal = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  payPalRequest: paypal.request,
}));

import {
  createSubscription,
  mapStatus,
  parseCustomId,
  parseExactCustomId,
} from "@/lib/paypal/subscriptions";

const WEBSITE = "4f6c1c55-3c1a-4c11-9d0e-2b8f2b1f6a01";
const CHECKOUT = "9a0b7e3e-5d2c-4b7e-8f61-0c3d2a9e4b12";

beforeEach(() => {
  paypal.request.mockReset();
});

describe("mapStatus", () => {
  it("stores a suspended subscription as unpaid, which is not entitled", () => {
    expect(mapStatus("SUSPENDED")).toBe("unpaid");
    expect(isEntitled(mapStatus("SUSPENDED"))).toBe(false);
  });

  it("stores an active subscription PayPal is retrying as past_due, still entitled", () => {
    expect(mapStatus("ACTIVE", { failed_payments_count: 2 })).toBe("past_due");
    expect(isEntitled(mapStatus("ACTIVE", { failed_payments_count: 2 }))).toBe(true);
    expect(mapStatus("ACTIVE", { failed_payments_count: 0 })).toBe("active");
    expect(mapStatus("ACTIVE")).toBe("active");
  });

  it("keeps the other statuses as they were", () => {
    expect(mapStatus("APPROVAL_PENDING")).toBe("incomplete");
    expect(mapStatus("APPROVED")).toBe("incomplete");
    expect(mapStatus("CANCELLED")).toBe("canceled");
    expect(mapStatus("EXPIRED")).toBe("canceled");
    expect(mapStatus("SOMETHING_NEW")).toBe("inactive");
  });
});

describe("our custom_id", () => {
  it("recognises exactly the three-id shape our checkout writes", () => {
    expect(parseExactCustomId(`org_1:${WEBSITE}:${CHECKOUT}`)).toEqual({
      organizationId: "org_1",
      websiteId: WEBSITE,
      checkoutId: CHECKOUT,
    });
  });

  it("rejects anything else, however close", () => {
    for (const value of [
      "ORDER-123",
      "",
      null,
      undefined,
      `org_1:${WEBSITE}`,
      `org_1:${WEBSITE}:not-a-uuid`,
      `:${WEBSITE}:${CHECKOUT}`,
      `org_1:${WEBSITE}:${CHECKOUT}:extra`,
    ]) {
      expect(parseExactCustomId(value)).toBeNull();
    }
  });

  it("still reads the older forms tolerantly, for subscriptions known to be ours", () => {
    expect(parseCustomId("org_1")).toEqual({ organizationId: "org_1", websiteId: null, checkoutId: null });
    expect(parseCustomId(`org_1:${WEBSITE}`)).toMatchObject({ organizationId: "org_1", websiteId: WEBSITE });
  });
});

describe("createSubscription", () => {
  it("asks PayPal for no shipping address and carries our ids", async () => {
    paypal.request.mockResolvedValueOnce({
      id: "I-NEW",
      status: "APPROVAL_PENDING",
      links: [{ rel: "approve", href: "https://paypal.test/approve", method: "GET" }],
    });

    await expect(
      createSubscription({
        planId: "P-GROW",
        organizationId: "org_1",
        websiteId: WEBSITE,
        checkoutId: CHECKOUT,
        returnUrl: "https://app.test/billing?paypal=success",
        cancelUrl: "https://app.test/billing?paypal=cancelled",
      }),
    ).resolves.toEqual({ subscriptionId: "I-NEW", approveUrl: "https://paypal.test/approve" });

    const [path, init] = paypal.request.mock.calls[0];
    expect(path).toBe("/v1/billing/subscriptions");
    expect(init.idempotencyKey).toBe(`checkout:${CHECKOUT}`);
    const body = JSON.parse(init.body);
    expect(body.application_context).toMatchObject({ shipping_preference: "NO_SHIPPING", user_action: "SUBSCRIBE_NOW" });
    expect(body.custom_id).toBe(`org_1:${WEBSITE}:${CHECKOUT}`);
    expect(parseExactCustomId(body.custom_id)).not.toBeNull();
  });
});
