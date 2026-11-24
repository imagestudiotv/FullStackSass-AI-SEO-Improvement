import { describe, expect, it } from "vitest";

import { checkoutReturnPath, isCheckoutOrigin, readCheckoutReturn, startedDashboardPath } from "./return-to";

/**
 * Where a checkout comes back to (return-to.ts): a fixed set of origins, each
 * resolved on the server, never a URL from the browser. A plan paid for from
 * onboarding or the growth plan returns to the dashboard for that website, and
 * to the onboarding plan screen when the customer walked away.
 */

describe("checkoutReturnPath", () => {
  it("sends an onboarding payment straight to the dashboard, Stripe or PayPal: onboarding ends at the plan", () => {
    expect(checkoutReturnPath("onboarding", "success", "site-1")).toBe("/dashboard?checkout=success&site=site-1");
    expect(checkoutReturnPath("onboarding", "success", "site-1", "paypal")).toBe("/dashboard?paypal=success&site=site-1");
    // No website to wait for: the plan step waits.
    expect(checkoutReturnPath("onboarding", "success")).toBe("/onboarding/plan?checkout=success");
  });

  it("keeps an onboarding checkout walked away from on the plan screen", () => {
    expect(checkoutReturnPath("onboarding", "cancelled", "site-1")).toBe("/onboarding/plan?checkout=cancelled&site=site-1");
    expect(checkoutReturnPath("onboarding", "cancelled", "site-1", "paypal")).toBe("/onboarding/plan?paypal=cancelled&site=site-1");
  });

  it("keeps billing as it was", () => {
    expect(checkoutReturnPath("billing", "success", "site-1")).toBe("/billing?checkout=success");
    expect(checkoutReturnPath("billing", "success", "site-1", "paypal")).toBe("/billing?paypal=success&site=site-1");
  });

  it("sends a growth plan payment straight to the dashboard for the website paid for", () => {
    expect(checkoutReturnPath("growth-plan", "success", "site-1")).toBe("/dashboard?checkout=success&site=site-1");
    expect(checkoutReturnPath("growth-plan", "success", "site-1", "paypal")).toBe("/dashboard?paypal=success&site=site-1");
  });

  it("sends a growth plan checkout walked away from to the plan screen, which releases a PayPal approval", () => {
    expect(checkoutReturnPath("growth-plan", "cancelled", "site-1")).toBe("/onboarding/plan?checkout=cancelled&site=site-1");
    expect(checkoutReturnPath("growth-plan", "cancelled", "site-1", "paypal")).toBe("/onboarding/plan?paypal=cancelled&site=site-1");
  });

  it("never follows an origin it does not know (it arrives from the browser): billing", () => {
    expect(checkoutReturnPath("https://evil.test" as never, "success", "site-1")).toBe("/billing?checkout=success");
    expect(isCheckoutOrigin("growth-plan")).toBe(true);
    expect(isCheckoutOrigin("onboarding")).toBe(true);
    expect(isCheckoutOrigin("billing")).toBe(true);
    expect(isCheckoutOrigin("/dashboard")).toBe(false);
  });
});

describe("startedDashboardPath", () => {
  it("opens the dashboard on the website, saying it was just started", () => {
    const url = new URL(startedDashboardPath("a b"), "https://x.test");
    expect(url.pathname).toBe("/dashboard");
    expect(url.searchParams.get("site")).toBe("a b");
    expect(url.searchParams.get("welcome")).toBe("1");
  });
});

describe("readCheckoutReturn", () => {
  it("reads Stripe's ?checkout= and PayPal's ?paypal=, nothing else", () => {
    expect(readCheckoutReturn({ checkout: "success" })).toEqual({ provider: "stripe", outcome: "success" });
    expect(readCheckoutReturn({ paypal: "cancelled" })).toEqual({ provider: "paypal", outcome: "cancelled" });
    expect(readCheckoutReturn({ checkout: "done" })).toBeNull();
    expect(readCheckoutReturn({ checkout: ["success"] })).toBeNull();
    expect(readCheckoutReturn({})).toBeNull();
  });
});
