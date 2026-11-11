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

import { OFFER_CODE } from "@/lib/i18n/offer-code";

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
  cancelAt: null,
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

describe("the REPGET field", () => {
  const none = null as unknown as CurrentSubscription;

  it("shows on the monthly plans while the offer is on, labelled in the reader's language", () => {
    expect(render(none, { offerCopy: OFFER_CODE.de, entitled: false, websiteSubscriptions: [] })).toContain(OFFER_CODE.de.label);
  });

  it("does not show while the offer is off", () => {
    expect(render(none, { entitled: false, websiteSubscriptions: [] })).not.toContain(OFFER_CODE.en.label);
  });
});

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

describe("the Grow + Visibility bundle in Billing", () => {
  const BUNDLE = plan("plan_bundle", "Grow + Visibility", "grow_visibility", 9900, 10);
  const none = null as unknown as CurrentSubscription;

  it("is not offered in the plan list: it is sold from its own button on /pricing", () => {
    const html = render(none, { plans: [GROW, SCALE, BUNDLE], entitled: false, websiteSubscriptions: [] });
    expect(html).toContain("Scale");
    expect(html).not.toContain("Grow + Visibility");
  });

  it("is shown to the website on it, as its current plan", () => {
    const onBundle = { ...onPayPal("active"), planId: BUNDLE.id, planName: BUNDLE.name, tier: BUNDLE.tier };
    expect(render(onBundle, { plans: [GROW, SCALE, BUNDLE] })).toContain("Grow + Visibility");
  });
});
