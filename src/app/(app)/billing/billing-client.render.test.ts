import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The billing page for a website on its free articles through PayPal
 * (2026-10-22): PayPal cannot cut the free days short, so the plan section
 * says when PayPal starts the plan and offers "Start my plan now", and the
 * plans below say that choosing one starts it today. Static markup; the
 * actions are stubs.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/paypal/actions", () => ({ createPayPalCheckout: vi.fn(), confirmPayPalReturn: vi.fn() }));
vi.mock("@/lib/stripe/actions", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/lib/stripe/portal", () => ({ createPortalSession: vi.fn() }));

import type { CurrentSubscription, PlanRow } from "@/lib/billing-shared";
import { getMessages } from "@/lib/i18n/messages";

import { BillingClient } from "./billing-client";

const messages = getMessages("en");
const t = messages.app.billing;

const plan = (id: string, name: string, tier: string, priceCents: number, sortOrder: number) =>
  ({
    id,
    name,
    tier,
    interval: "month",
    priceCents,
    currency: "eur",
    articleLimit: 30,
    keywordLimit: 100,
    siteLimit: 1,
    monthlyCredits: 0,
    sortOrder,
    isActive: true,
    stripePriceId: `price_${tier}`,
    paypalPlanId: `P-${tier.toUpperCase()}`,
    paypalTrialPlanId: `P-${tier.toUpperCase()}-FREE`,
  }) as unknown as PlanRow;

const GROW = plan("plan_grow", "Grow", "grow", 9900, 1);
const SCALE = plan("plan_scale", "Scale", "scale", 19900, 2);

const onPayPal = (status: string): CurrentSubscription => ({
  status,
  planId: GROW.id,
  planName: "Grow",
  tier: "grow",
  interval: "month",
  currentPeriodEnd: new Date("2026-11-21T10:00:00Z"),
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  provider: "paypal",
});

const render = (subscription: CurrentSubscription, props: Partial<ComponentProps<typeof BillingClient>> = {}) =>
  renderToStaticMarkup(
    createElement(BillingClient, {
      plans: [GROW, SCALE],
      subscription,
      entitled: true,
      paypalAvailable: true,
      websiteId: "site_1",
      websiteSubscriptions: [{ ...subscription, websiteId: "site_1", domain: "acme.test" }],
      viewingSharedDomain: null,
      t,
      locale: "en",
      tCommon: messages.app.common,
      ...props,
    }),
  );

describe("billing, on the free articles through PayPal", () => {
  it("says when PayPal starts the plan, offers to start it now, and that a plan chosen below starts today", () => {
    const html = render(onPayPal("trialing"));
    expect(html).toMatch(/Your Grow plan starts on [^<]*2026/);
    expect(html).toContain(t.paypalFreeBody);
    expect(html).toContain(t.startPlanNow);
    expect(html).toContain(t.paypalFreePlans);
    expect(html).not.toContain(t.billedByPayPal);
  });

  it("offers nothing of the kind once the plan has started", () => {
    const html = render(onPayPal("active"));
    expect(html).not.toContain(t.startPlanNow);
    expect(html).not.toContain(t.paypalFreeBody);
    expect(html).toContain(t.billedByPayPal);
  });

  it("offers no button while PayPal checkout is unavailable: the plan starts when the free days end", () => {
    const html = render(onPayPal("trialing"), { paypalAvailable: false });
    expect(html).not.toContain(t.startPlanNow);
    expect(html).not.toContain(t.paypalFreePlans);
  });
});
