import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/paypal/actions", () => ({ createPayPalCheckout: vi.fn() }));
vi.mock("@/lib/stripe/actions", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { emailOtp: { sendVerificationOtp: vi.fn() } } }));
vi.mock("@/lib/auth/confirm-email-actions", () => ({ confirmEmail: vi.fn() }));

import { PlanStep } from "@/app/(site)/(onboarding)/onboarding/plan/plan-step";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { CONFIRM_EMAIL_FIRST } from "@/lib/plans/features";

import { PLAN_STEP_COPY, planStepCopy, type PlanStepCopy } from "./plan-step";

/** Every entry as text: plain strings as they are, functions called with sample values. */
function texts(copy: PlanStepCopy): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(copy)) {
    out[key] = typeof value === "function" ? (value as (...args: unknown[]) => string)("€123", 7) : value;
  }
  return out;
}

describe("the plan step's words", () => {
  it("has every key, non-empty, in all five languages", () => {
    const keys = Object.keys(PLAN_STEP_COPY.en).sort();
    expect(Object.keys(PLAN_STEP_COPY).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      const copy = PLAN_STEP_COPY[locale];
      expect(Object.keys(copy).sort(), locale).toEqual(keys);
      for (const [key, text] of Object.entries(texts(copy))) {
        expect(text.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("translates every entry away from the English (bar the shared word Plan in Spanish)", () => {
    const en = texts(PLAN_STEP_COPY.en);
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const words = texts(PLAN_STEP_COPY[locale]);
      for (const key of Object.keys(en)) {
        if (locale === "es" && key === "planLabel") continue;
        expect(words[key], `${locale}.${key}`).not.toBe(en[key]);
      }
    }
  });

  it("keeps the English word for word", () => {
    const en = PLAN_STEP_COPY.en;
    expect(en.sendCodeFailed).toBe("We could not send the code. Please try again in a minute.");
    expect(en.codeSent("a@b.co")).toBe("We sent a 6-digit code to a@b.co.");
    expect(en.codeInvalid).toBe("That code is not right. Check the email and try again.");
    expect(en.confirmEmailFirst).toBe(CONFIRM_EMAIL_FIRST);
    expect(en.defaultDescription).toBe("Everything you need to grow organic traffic from Google and AI search, on autopilot.");
    expect(en.badgePopular).toBe("Most popular plan");
    expect(en.badgeBestValue).toBe("Best value");
    expect(en.planName("Grow")).toBe("Grow plan");
    expect(en.perMonth).toBe("/month");
    expect(en.save(17)).toBe("save 17%");
    expect(en.confirmEmailTitle(3)).toBe("Confirm your email to start your 3-day free trial");
    expect(en.startTrial).toBe("Start free trial");
    expect(en.continueToPayment).toBe("Continue to payment");
    expect(en.trialToday("€0", 3)).toBe("€0 today · 3 days free.");
    expect(en.thenYearDiscounted).toBe(
      "Then your discounted annual plan begins at the total shown at checkout, unless you cancel before the trial ends.",
    );
    expect(en.thenYear("€990")).toBe("Then €990/year, unless you cancel before the trial ends.");
    expect(en.thenMonthDiscounted("€89", 40)).toBe("Then €89/month with your 40% discount, unless you cancel before the trial ends.");
    expect(en.thenMonth("€149")).toBe("Then €149/month, unless you cancel before the trial ends.");
    expect(en.chargedTodayMonth("€99")).toBe("€99 a month, charged today. This workspace has already had its free trial.");
    expect(en.chargedTodayYear("€990")).toBe("€990 a year, charged today. This workspace has already had its free trial.");
    expect(en.redirectingPayPal).toBe("Redirecting to PayPal…");
    expect(en.payWithPayPal).toBe("Pay with PayPal");
  });

  it("puts every number and address it is given into every language", () => {
    for (const locale of LOCALES) {
      const copy = PLAN_STEP_COPY[locale];
      expect(copy.codeSent("x@y.z"), locale).toContain("x@y.z");
      expect(copy.sentTo("x@y.z"), locale).toContain("x@y.z");
      expect(copy.weSendItTo("x@y.z"), locale).toContain("x@y.z");
      expect(copy.planName("Scale"), locale).toContain("Scale");
      expect(copy.save(23), locale).toContain("23");
      expect(copy.confirmEmailTitle(3), locale).toContain("3");
      const today = copy.trialToday("€0", 3);
      expect(today, locale).toContain("€0");
      expect(today, locale).toContain("3");
      expect(copy.thenYear("€912"), locale).toContain("€912");
      expect(copy.thenMonth("€149"), locale).toContain("€149");
      const discounted = copy.thenMonthDiscounted("€89", 40);
      expect(discounted, locale).toContain("€89");
      expect(discounted, locale).toContain("40");
      expect(copy.chargedTodayMonth("€99"), locale).toContain("€99");
      expect(copy.chargedTodayYear("€990"), locale).toContain("€990");
    }
  });

  it("falls back to English for an unknown locale", () => {
    expect(planStepCopy("xx" as never)).toBe(PLAN_STEP_COPY.en);
  });
});

describe("the plan step in the reader's language", () => {
  const GROW = { id: "plan_grow", tier: "grow", name: "Grow", priceCents: 14900, currency: "eur", interval: "month", articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 50 };

  it("shows the German words, with the same price and trial length", () => {
    const html = renderToStaticMarkup(
      createElement(PlanStep, {
        monthlyPlans: [GROW],
        annualPlans: [],
        paypalAvailable: true,
        paypalPlanIds: [GROW.id],
        paypalTrialPlanIds: [GROW.id],
        websiteId: "site_1",
        t: getMessages("de").app.onboarding,
        locale: "de",
        emailVerified: false,
      }),
    );
    const de = PLAN_STEP_COPY.de;
    expect(html).toContain(`${de.planName("Grow")}</h2>`);
    expect(html).toContain(de.badgePopular);
    expect(html).toContain(de.startTrial);
    expect(html).toContain(de.trialToday("€0", 3));
    expect(html).toContain(de.thenMonth("€149"));
    expect(html).toContain(de.confirmEmailTitle(3));
    expect(html).toContain(de.payWithPayPal);
    expect(html).not.toContain("Start free trial");
    expect(html).not.toContain("Most popular plan");
    expect(html).not.toContain("/month");
  });
});
