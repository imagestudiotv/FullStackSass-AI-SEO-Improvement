import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The plan step's PayPal button and the line under it (client, 2026-10-22:
 * PayPal "as same as the case of Stripe"): the free articles with PayPal
 * when the plan has its free-articles PayPal plan, the same confirmed address
 * first, and the plain truth otherwise. Static markup; the actions are stubs.
 */

vi.mock("@/lib/paypal/actions", () => ({ createPayPalCheckout: vi.fn() }));
vi.mock("@/lib/stripe/actions", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { emailOtp: { sendVerificationOtp: vi.fn() } } }));
vi.mock("@/lib/auth/confirm-email-actions", () => ({ confirmEmail: vi.fn() }));

import { DIRECT_PURCHASE } from "@/lib/i18n/direct-purchase";
import { getMessages } from "@/lib/i18n/messages";
import { OFFER_CODE } from "@/lib/i18n/offer-code";

import { PlanStep } from "./plan-step";

const t = getMessages("en").app.onboarding;
const GROW = { id: "plan_grow", tier: "grow", name: "Grow", priceCents: 9900, currency: "eur", interval: "month", articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 50 };

const render = (props: Partial<ComponentProps<typeof PlanStep>> = {}) =>
  renderToStaticMarkup(
    createElement(PlanStep, {
      monthlyPlans: [GROW],
      annualPlans: [],
      paypalAvailable: true,
      paypalPlanIds: [GROW.id],
      paypalFreeArticlePlanIds: [GROW.id],
      websiteId: "site_1",
      t,
      ...props,
    }),
  );

/** The PayPal button's markup, up to its label; a missing button fails the test rather than passing a "not disabled" check. */
function paypalButton(html: string): string {
  const found = html.match(/<button(?:(?!<button).)*?Pay with PayPal/)?.[0];
  if (!found) throw new Error("no PayPal button on the page");
  return found.slice(0, found.indexOf(">") + 1);
}

describe("PayPal on the plan step", () => {
  it("offers the free articles with PayPal too, when the plan has its free-articles PayPal plan", () => {
    const html = render();
    expect(html).toContain(
      "With PayPal too, your 3 free articles come first and nothing is charged today. Your plan starts after 30 days, or sooner if you start it in Billing.",
    );
    expect(html).not.toContain(t.paypalNoTrial);
    expect(paypalButton(html)).not.toMatch(/disabled=""/);
  });

  it("waits for the confirmed address, as the card button does", () => {
    const html = render({ emailVerified: false });
    expect(paypalButton(html)).toMatch(/disabled=""/);
  });

  it("says PayPal starts at once for a plan without its free-articles PayPal plan, and needs no address for it", () => {
    const html = render({ paypalFreeArticlePlanIds: [], emailVerified: false });
    expect(html).toContain(t.paypalNoTrial);
    expect(paypalButton(html)).not.toMatch(/disabled=""/);
  });

  it("adds nothing for a workspace that has had its free articles: card and PayPal both charge today", () => {
    const html = render({ trialEligible: false });
    expect(html).not.toContain(t.paypalNoTrial);
    expect(html).not.toContain("free articles come first");
  });
});

describe("REPGET, applied automatically (2026-11-11)", () => {
  const GROW_2 = { ...GROW, priceCents: 14900 };

  it("says the discount is applied, with the plan's launch price on every payment, instead of asking for a code", () => {
    const html = render({ monthlyPlans: [GROW_2], offerCopy: OFFER_CODE.en });
    expect(html).toContain(OFFER_CODE.en.label);
    expect(html).toContain("Each monthly payment: €89 instead of €149.");
    expect(html).toContain("40% off regular price on every payment");
    expect(html).not.toMatch(/<input[^>]*maxLength="24"/i);
  });

  it("shows the regular price struck through beside the launch price, and quotes the launch price in the terms (2026-11-13)", () => {
    const html = render({ monthlyPlans: [GROW_2], offerCopy: OFFER_CODE.en, trialEligible: true });
    expect(html).toMatch(/<del[^>]*>€149<\/del>/);
    expect(html).toContain(">€89<");
    expect(html).toContain("then €89");
    // Off: the regular price alone, nothing struck.
    const plain = render({ monthlyPlans: [GROW_2] });
    expect(plain).not.toContain("<del");
    expect(plain).toContain("then €149");
  });

  it("lists the pricing page's benefits when the server passes them", () => {
    const html = render({ monthlyPlans: [GROW_2], benefits: { [GROW_2.id]: ["**AI Growth Copilot** with insights from your website data"] } });
    expect(html).toContain("<strong class=\"font-semibold\">AI Growth Copilot</strong> with insights from your website data");
  });

  it("says nothing for a plan it does not cover, or while the offer is off (no copy passed)", () => {
    expect(render({ offerCopy: OFFER_CODE.en })).not.toContain(OFFER_CODE.en.label);
    expect(render({ monthlyPlans: [GROW_2] })).not.toContain(OFFER_CODE.en.label);
  });
});

describe("a direct purchase on the plan step (Grow + Visibility)", () => {
  const BUNDLE = { ...GROW, id: "plan_bundle", tier: "grow_visibility", name: "Grow + Visibility", priceCents: 9900, articleLimit: 60 };
  const direct = (props: Partial<ComponentProps<typeof PlanStep>> = {}) =>
    render({ monthlyPlans: [BUNDLE], paypalPlanIds: [BUNDLE.id], paypalFreeArticlePlanIds: [], directPurchase: DIRECT_PURCHASE.en, offerCopy: OFFER_CODE.en, ...props });

  it("charges at checkout: no free articles, no email code, no REPGET, and says so", () => {
    const html = direct({ emailVerified: false });
    expect(html).toContain("€99 billed at checkout, then monthly. The 3-day free trial does not apply to this offer.");
    expect(html).toContain(DIRECT_PURCHASE.en.button);
    expect(html).not.toContain("free articles");
    expect(html).not.toContain("Email me a code");
    expect(html).not.toContain(OFFER_CODE.en.label);
    expect(paypalButton(html)).not.toMatch(/disabled=""/);
    // Its list value struck through, as /pricing shows it; the charge stays EUR 99.
    expect(html).toMatch(/<del[^>]*>€299<\/del>/);
  });
});
