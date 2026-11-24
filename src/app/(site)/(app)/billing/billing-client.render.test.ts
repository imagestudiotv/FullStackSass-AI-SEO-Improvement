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

import { BILLING_PLANS_COPY } from "@/lib/i18n/billing-plans";
import { PAYMENT_CHOICE_COPY } from "@/lib/i18n/buy-credits";
import { LOCALES } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { OFFER_CODE } from "@/lib/i18n/offer-code";
import { PLAN_CARDS_COPY } from "@/lib/i18n/plan-cards";
import { TRIAL_DAYS } from "@/lib/plans/features";

import { BillingClient } from "./billing-client";
import { PlanCheckoutView } from "./plan-picker";
import { orderPlans, planCompareRows } from "./plan-compare";
import { planCardsFor } from "./plan-cards";

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

  it("is offered in the plan list with its own terms: a direct purchase, EUR 99 against EUR 299, no free trial (2026-11-13)", () => {
    const plans = [GROW, SCALE, BUNDLE];
    const planCards = planCardsFor(plans, { offerOn: true, trialEligible: true, locale: "en", t });
    const html = render(none, { plans, entitled: false, websiteSubscriptions: [], planCards });
    expect(html).toContain("Scale");
    expect(html).toContain("Grow + Visibility");
    expect(html).toContain("Direct purchase");
    expect(html).toContain("<del");
    expect(html).toContain("€299");
    expect(html).toContain("€99 billed at checkout, then monthly. The 3-day free trial does not apply to this offer.");
    // The free trial is said for the other plans only, with the trial's days (TRIAL_DAYS).
    const trialLine = renderToStaticMarkup(createElement("i", null, format(PLAN_CARDS_COPY.en.trial, { n: TRIAL_DAYS, days: TRIAL_DAYS }))).slice(3, -4);
    expect(html.split(trialLine).length - 1).toBe(2);
  });

  it("stands between Grow and Scale as the best value, and a plan named in the address is marked", () => {
    const plans = [GROW, SCALE, BUNDLE];
    const planCards = planCardsFor(plans, { offerOn: true, trialEligible: true, locale: "en", t });
    const html = render(none, { plans, entitled: false, websiteSubscriptions: [], planCards, selectedPlan: { tier: "scale", interval: null } });
    const order = ["grow", "grow_visibility", "scale"].map((tier) => html.indexOf(`id="plan-card-${tier}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.split("Best value").length - 1).toBe(1);
    expect(html).toMatch(/id="plan-card-scale"[^>]*data-selected="true"/);
    expect(html).toContain("Your choice");
    expect(html).toContain("Get Grow + Visibility");
  });

  it("is refused, with a way to ask, to a website on the launch price - as the server refuses it", () => {
    const plans = [{ ...GROW, priceCents: 14900 }, BUNDLE, { ...SCALE, priceCents: 34900 }];
    const planCards = planCardsFor(plans, { offerOn: true, trialEligible: false, switching: true, launchPrice: true, locale: "en", t });
    expect(planCards[BUNDLE.id].launchNotCovered).toBe(true);
    expect(planCards[SCALE.id].launchNotCovered).toBe(false);
    const html = render({ ...onPayPal("active"), provider: "stripe", hasCustomer: true }, { plans, planCards, launchPriceKept: true });
    expect(html).toContain("Your launch price does not cover this plan");
    expect(html).toContain("Your launch price stays with you.");
    expect(html.split(t.switchPlan).length - 1).toBe(1);
    // Not on the launch price: it can be moved to.
    expect(planCardsFor(plans, { offerOn: true, trialEligible: false, switching: true, launchPrice: false, locale: "en", t })[BUNDLE.id].launchNotCovered).toBe(false);
  });

  it("is not a rung of the upgrade ladder", () => {
    const onScale = { ...onPayPal("active"), planId: SCALE.id, planName: SCALE.name, tier: SCALE.tier };
    expect(render(onScale, { plans: [GROW, SCALE, BUNDLE] })).not.toContain(format(t.upgradeLink, { plan: BUNDLE.name }));
  });

  it("is shown to the website on it, as its current plan", () => {
    const onBundle = { ...onPayPal("active"), planId: BUNDLE.id, planName: BUNDLE.name, tier: BUNDLE.tier };
    expect(render(onBundle, { plans: [GROW, SCALE, BUNDLE] })).toContain("Grow + Visibility");
  });
});

describe("the comparison and the checkout dialog", () => {
  const CATALOG = [
    { ...GROW, priceCents: 14900, socialPostLimit: 90, keywordLimit: 300, monthlyCredits: 250, siteLimit: 3 },
    { ...SCALE, priceCents: 34900, articleLimit: 60, socialPostLimit: 180, keywordLimit: 1200, monthlyCredits: 700, siteLimit: 10 },
    { ...plan("plan_bundle", "Grow + Visibility", "grow_visibility", 9900, 10), socialPostLimit: 120, keywordLimit: 400, monthlyCredits: 250, siteLimit: 3 },
  ] as PlanRow[];

  it("compares the rows' own figures, with one website per subscription, and nothing the product does not claim", () => {
    for (const locale of LOCALES) {
      const ordered = orderPlans(CATALOG);
      const rows = planCompareRows(ordered, locale, BILLING_PLANS_COPY[locale], "unlimited");
      const cells = (key: string) => rows.find((row) => row.key === key)!.cells.map((cell) => (cell.kind === "text" ? cell.text.replace(/\D/g, "") : cell.kind));
      expect(cells("articles")).toEqual(["30", "30", "60"]);
      expect(cells("posts")).toEqual(["90", "120", "180"]);
      expect(cells("terms")).toEqual(["300", "400", "1200"]);
      expect(cells("credits")).toEqual(["250", "250", "700"]);
      expect(cells("websites")).toEqual(["1", "1", "1"]);
      expect(cells("custom")).toEqual(["no", "no", "yes"]);
      expect(JSON.stringify(rows)).not.toMatch(/DA ?60/i);
      // Five figures at a glance; the rest with "Show complete comparison".
      expect(rows.filter((row) => !row.extra)).toHaveLength(5);
      expect(rows.length).toBeGreaterThan(12);
    }
  });

  it("shows on each card the figures, the credits, the videos and Growth Copilot, all lines of the full list", () => {
    for (const locale of LOCALES) {
      const words = getMessages(locale).app.billing;
      for (const [id, view] of Object.entries(planCardsFor(CATALOG, { offerOn: true, trialEligible: false, locale, t: words }))) {
        expect(view.highlights.length, id).toBeGreaterThanOrEqual(7);
        for (const line of view.highlights) expect(view.features).toContain(line);
        expect(view.highlights.some((line) => line.includes("Growth Copilot"))).toBe(true);
        expect(new Set(view.highlights).size).toBe(view.highlights.length);
      }
    }
  });

  it("says in the dialog what one payment is: the year's total for a yearly plan, and PayPal's own terms where it gives no trial", () => {
    const yearly = { ...CATALOG[0], id: "plan_grow_year", interval: "year", priceCents: 149000, paypalTrialPlanId: null } as PlanRow;
    const views = planCardsFor([yearly], { offerOn: true, trialEligible: true, locale: "en", t });
    const dialog = (method: "card" | "paypal") =>
      renderToStaticMarkup(
        createElement(PlanCheckoutView, {
          plan: yearly,
          name: "Grow",
          view: views.plan_grow_year,
          methods: ["card", "paypal"],
          method,
          onMethod: () => {},
          switching: false,
          domain: "acme.test",
          pending: false,
          prompt: null,
          onPay: () => {},
          copy: BILLING_PLANS_COPY.en,
          choice: PAYMENT_CHOICE_COPY.en,
          locale: "en",
          title: null,
          description: null,
        }),
      );
    // 40% off EUR 1,490 a year is the coupon's EUR 890, never twelve times the monthly price.
    expect(dialog("card")).toContain("€890");
    expect(dialog("card")).toContain("3 days free");
    expect(dialog("card")).toContain("Continue with card");
    expect(dialog("paypal")).not.toContain("3 days free");
    expect(dialog("paypal")).toContain(PLAN_CARDS_COPY.en.paypalNoTrial);
    expect(dialog("paypal")).toContain("€890 charged today, then every year until you cancel.");
    expect(dialog("paypal")).toContain("Continue with PayPal");
  });
});
