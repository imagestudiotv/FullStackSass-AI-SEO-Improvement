import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The plan step's checkout card (Daniel's "Grow Plan Checkout Card",
 * 2026-11-13): the 3-day free trial with the plan's normal service, its terms
 * under "Start free trial", PayPal with the same trial when the plan has its
 * trial PayPal plan, the REPGET box, and Grow + Visibility bought outright
 * with no trial. Static markup; the actions are stubs.
 */

vi.mock("@/lib/paypal/actions", () => ({ createPayPalCheckout: vi.fn() }));
vi.mock("@/lib/stripe/actions", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { emailOtp: { sendVerificationOtp: vi.fn() } } }));
vi.mock("@/lib/auth/confirm-email-actions", () => ({ confirmEmail: vi.fn() }));

import { DIRECT_PURCHASE } from "@/lib/i18n/direct-purchase";
import { format } from "@/lib/i18n/format";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { OFFER_CODE } from "@/lib/i18n/offer-code";
import { TRIAL_DAYS } from "@/lib/plans/features";
import { referencePriceMatches } from "@/test/reference-price";

import { PlanStep } from "./plan-step";

const t = getMessages("en").app.onboarding;
const GROW = { id: "plan_grow", tier: "grow", name: "Grow", priceCents: 9900, currency: "eur", interval: "month", articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 50 };
/** Grow at its catalogue price, which REPGET's launch price covers (EUR 149 -> 89). */
const GROW_2 = { ...GROW, priceCents: 14900 };

const render = (props: Partial<ComponentProps<typeof PlanStep>> = {}) =>
  renderToStaticMarkup(
    createElement(PlanStep, {
      monthlyPlans: [GROW],
      annualPlans: [],
      paypalAvailable: true,
      paypalPlanIds: [GROW.id],
      paypalTrialPlanIds: [GROW.id],
      websiteId: "site_1",
      t,
      ...props,
    }),
  );

/** Text as React writes it into markup (an apostrophe becomes &#x27;). */
const markup = (text: string) => renderToStaticMarkup(createElement("i", null, text)).slice(3, -4);

/** The PayPal button's markup, up to its label; a missing button fails the test rather than passing a "not disabled" check. */
function paypalButton(html: string): string {
  const found = html.match(/<button(?:(?!<button).)*?Pay with PayPal/)?.[0];
  if (!found) throw new Error("no PayPal button on the page");
  return found.slice(0, found.indexOf(">") + 1);
}

/** The card button's markup, up to its label. */
function cardButton(html: string, label: string): string {
  const found = html.match(new RegExp(`<button(?:(?!<button).)*?${label}`))?.[0];
  if (!found) throw new Error(`no "${label}" button on the page`);
  return found.slice(0, found.indexOf(">") + 1);
}

describe("the checkout card's 3-day free trial", () => {
  it("starts the trial with the plan's normal price after it, from TRIAL_DAYS", () => {
    expect(TRIAL_DAYS).toBe(3);
    const html = render({ monthlyPlans: [GROW_2] });
    expect(html).toContain("Start free trial");
    expect(html).toContain("€0 today · 3 days free.");
    expect(html).toContain("Then €149/month, unless you cancel before the trial ends.");
    expect(html).toContain(t.cancelAnyTime);
    expect(cardButton(html, "Start free trial")).not.toMatch(/disabled=""/);
    // The legacy offer is gone from the card.
    expect(html).not.toMatch(/free articles are written|Start with \d+ free articles|30 days/);
  });

  it("is drawn as Daniel's card: the 1.5px orange ring, the 19px corner, the popular pill on Grow", () => {
    const html = render({ monthlyPlans: [GROW_2] });
    expect(html).toMatch(/<section aria-label="Grow plan" class="[^"]*rounded-\[19px\] border-\[1\.5px\] border-primary/);
    expect(html).toContain("Grow plan</h2>");
    expect(html).toContain("Most popular plan");
    expect(html).toContain(markup(t.whatsIncluded));
  });

  it("puts the popular pill on Grow only: Scale keeps its own badge, Launch has none", () => {
    const SCALE = { ...GROW, id: "plan_scale", tier: "scale", name: "Scale" };
    const LAUNCH = { ...GROW, id: "plan_launch", tier: "launch", name: "Launch" };
    const scale = render({ monthlyPlans: [SCALE], paypalPlanIds: [] });
    expect(scale).not.toContain("Most popular plan");
    expect(scale).toContain("Best value");
    expect(scale).toContain("Start free trial");
    const launch = render({ monthlyPlans: [LAUNCH], paypalPlanIds: [] });
    expect(launch).not.toContain("Most popular plan");
    expect(launch).not.toContain("Best value");
    expect(launch).toContain("Launch plan</h2>");
  });

  it("shows each plan's own description and the usage note the server passes", () => {
    const html = render({
      monthlyPlans: [GROW_2],
      descriptions: { [GROW_2.id]: "For growing brands that want more consistent reach and output." },
      usageNote: "AI Growth Copilot includes five free messages per day in the current workspace.",
    });
    expect(html).toContain("For growing brands that want more consistent reach and output.");
    expect(html).toContain("AI Growth Copilot includes five free messages per day in the current workspace.");
    // Without them: the general line, and no note.
    const plain = render({ monthlyPlans: [GROW_2] });
    expect(plain).toContain("Everything you need to grow organic traffic from Google and AI search, on autopilot.");
    expect(plain).not.toContain("five free messages");
  });

  it("asks for the confirmed address first, and holds both buttons until then", () => {
    const html = render({ emailVerified: false });
    expect(html).toContain("Confirm your email to start your 3-day free trial");
    expect(cardButton(html, "Start free trial")).toMatch(/disabled=""/);
    expect(paypalButton(html)).toMatch(/disabled=""/);
  });

  it("charges today, without the trial, for a workspace that has had one", () => {
    const html = render({ trialEligible: false, emailVerified: false, paypalPlanIds: [] });
    expect(html).toContain("Continue to payment");
    expect(html).toContain("€99 a month, charged today. This workspace has already had its free trial.");
    expect(html).not.toContain("Start free trial");
    expect(html).not.toContain("days free");
    expect(html).not.toContain("Email me a code");
  });
});

describe("PayPal on the plan step", () => {
  it("offers the same free trial with PayPal, when the plan has its trial PayPal plan", () => {
    const html = render();
    expect(html).toContain(markup(format(t.paypalFreeArticles, { n: TRIAL_DAYS, days: TRIAL_DAYS })));
    expect(html).not.toContain(markup(t.paypalNoTrial));
    expect(paypalButton(html)).not.toMatch(/disabled=""/);
    expect(paypalButton(html)).toContain("rounded-full");
  });

  it("fills the design's PayPal line, written with {days}", () => {
    const html = render({
      t: {
        ...t,
        paypalFreeArticles:
          "Start your {days}-day free trial with PayPal too. No charge today. Your paid plan starts after the trial unless you cancel before it ends.",
      },
    });
    expect(html).toContain(
      "Start your 3-day free trial with PayPal too. No charge today. Your paid plan starts after the trial unless you cancel before it ends.",
    );
  });

  it("says PayPal starts at once for a plan without its trial PayPal plan, and needs no address for it", () => {
    const html = render({ paypalTrialPlanIds: [], emailVerified: false });
    expect(html).toContain(markup(t.paypalNoTrial));
    expect(paypalButton(html)).not.toMatch(/disabled=""/);
  });

  it("adds nothing for a workspace that has had its trial: card and PayPal both charge today", () => {
    const html = render({ trialEligible: false });
    expect(html).not.toContain(markup(t.paypalNoTrial));
    expect(html).not.toContain(markup(format(t.paypalFreeArticles, { n: TRIAL_DAYS, days: TRIAL_DAYS })));
  });
});

describe("REPGET, applied automatically (2026-11-11)", () => {
  it("says the launch price is applied, with the plan's payment on every payment, instead of asking for a code", () => {
    const html = render({ monthlyPlans: [GROW_2], offerCopy: OFFER_CODE.en });
    expect(html).toContain(OFFER_CODE.en.label);
    expect(html).toContain("REPGET launch price applied");
    expect(html).toContain("Each monthly payment: €89.");
    expect(html).toContain("The launch price applies to every payment, monthly or yearly.");
    expect(html).not.toMatch(/<input[^>]*maxLength="24"/i);
  });

  it("shows the launch price large, the only price on the card, and quotes it in the trial's terms", () => {
    const html = render({ monthlyPlans: [GROW_2], offerCopy: OFFER_CODE.en, trialEligible: true });
    expect(html).toMatch(/text-5xl[^>]*>€89</);
    expect(html).not.toContain("€149");
    expect(html).not.toContain("<del");
    expect(html).toContain("€0 today · 3 days free.");
    expect(html).toContain("Then €89/month, unless you cancel before the trial ends.");
    // Off: the plan's own price, said the same way.
    const plain = render({ monthlyPlans: [GROW_2] });
    expect(plain).toMatch(/text-5xl[^>]*>€149</);
    expect(plain).not.toContain("<del");
    expect(plain).toContain("Then €149/month, unless you cancel before the trial ends.");
  });

  it("lists the pricing page's benefits when the server passes them", () => {
    const html = render({ monthlyPlans: [GROW_2], benefits: { [GROW_2.id]: ["**AI Growth Copilot** with insights from your website data"] } });
    expect(html).toContain("<strong class=\"font-semibold\">AI Growth Copilot</strong> with insights from your website data");
  });

  it("says nothing for a plan it does not cover, or while the offer is off (no copy passed)", () => {
    const covered = render({ offerCopy: OFFER_CODE.en });
    expect(covered).not.toContain(OFFER_CODE.en.label);
    expect(covered).toContain("Then €99/month, unless you cancel before the trial ends.");
    expect(render({ monthlyPlans: [GROW_2] })).not.toContain(OFFER_CODE.en.label);
  });
});

describe("the charged price only (conservative copy, 2026-11-18)", () => {
  const BUNDLE = { ...GROW, id: "plan_bundle", tier: "grow_visibility", name: "Grow + Visibility", priceCents: 9900 };

  for (const locale of LOCALES) {
    for (const offer of [true, false]) {
      it(`${locale}, REPGET ${offer ? "on" : "off"}: the price checkout charges, nothing struck, no percentage off`, () => {
        const offerCopy = offer ? OFFER_CODE[locale] : null;
        const tiers = render({ locale, t: getMessages(locale).app.onboarding, monthlyPlans: [GROW_2], offerCopy });
        expect(tiers).toMatch(new RegExp(`text-5xl[^>]*>${offer ? "€89" : "€149"}<`));
        if (offer) expect(tiers).not.toContain("€149");
        expect(referencePriceMatches(tiers)).toEqual([]);

        const bundle = render({
          locale,
          t: getMessages(locale).app.onboarding,
          monthlyPlans: [BUNDLE],
          paypalPlanIds: [BUNDLE.id],
          directPurchase: DIRECT_PURCHASE[locale],
          offerCopy,
        });
        expect(bundle).toMatch(/text-5xl[^>]*>€99</);
        expect(bundle).not.toContain("€299");
        expect(referencePriceMatches(bundle)).toEqual([]);
      });
    }
  }
});

describe("a direct purchase on the plan step (Grow + Visibility)", () => {
  const BUNDLE = { ...GROW, id: "plan_bundle", tier: "grow_visibility", name: "Grow + Visibility", priceCents: 9900, articleLimit: 60 };
  const direct = (props: Partial<ComponentProps<typeof PlanStep>> = {}) =>
    render({ monthlyPlans: [BUNDLE], paypalPlanIds: [BUNDLE.id], paypalTrialPlanIds: [], directPurchase: DIRECT_PURCHASE.en, offerCopy: OFFER_CODE.en, ...props });

  it("charges at checkout: no free trial, no email code, no REPGET, and says so", () => {
    const html = direct({ emailVerified: false });
    expect(html).toContain("€99 billed at checkout, then monthly. The 3-day free trial does not apply to this offer.");
    expect(html).toContain(DIRECT_PURCHASE.en.button);
    expect(html).toContain(DIRECT_PURCHASE.en.badge);
    expect(html).not.toContain("Start free trial");
    expect(html).not.toContain("days free");
    expect(html).not.toContain("free articles");
    expect(html).not.toContain("Email me a code");
    expect(html).not.toContain(OFFER_CODE.en.label);
    expect(html).not.toContain(markup(t.paypalNoTrial));
    expect(paypalButton(html)).not.toMatch(/disabled=""/);
    // Its charge alone: no list value struck through beside it.
    expect(html).toMatch(/text-5xl[^>]*>€99</);
    expect(html).not.toContain("<del");
    expect(html).not.toContain("€299");
    // The same card styling as the trial plans.
    expect(html).toMatch(/rounded-\[19px\] border-\[1\.5px\] border-primary/);
  });
});
