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

import { getMessages } from "@/lib/i18n/messages";

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
    expect(html).toContain("With PayPal too, your 3 free articles come first: nothing is charged today, and your plan starts after 30 days.");
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
