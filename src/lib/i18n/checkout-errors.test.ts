import { describe, expect, it } from "vitest";

import { OFFER_UNAVAILABLE, REPGET_CODE } from "@/lib/billing/repget-offer";
import { WINBACK_UNAVAILABLE } from "@/lib/billing/winback-offer";
import { CHECKOUT_ERRORS, checkoutErrors, type CheckoutErrorsCopy } from "@/lib/i18n/checkout-errors";
import { LOCALES } from "@/lib/i18n/config";

/**
 * Why a checkout could not start, in the payer's language (2026-11-18). The
 * English is what the checkout actions said before, word for word; the other
 * languages translate it and never change a plan name, offer code or date.
 */

/** Every entry as text, the ones taking values called with recognisable ones. */
function texts(copy: CheckoutErrorsCopy): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(copy).filter(([, value]) => typeof value === "string")),
    noStripePrice: copy.noStripePrice("Grow"),
    offerUnavailable: copy.offerUnavailable(REPGET_CODE),
    alreadyOnPlan: copy.alreadyOnPlan("Grow"),
    launchPriceDoesNotCover: copy.launchPriceDoesNotCover(REPGET_CODE),
    planNotOnPayPal: copy.planNotOnPayPal("Grow"),
    winbackNotOnPayPal: copy.winbackNotOnPayPal("Grow"),
    payPalCancelledRuns: copy.payPalCancelledRuns("2026-12-01"),
    payPalCancelledRunsUndated: copy.payPalCancelledRuns(null),
    billedElsewherePayPal: copy.billedElsewhere("paypal"),
    billedElsewhereCard: copy.billedElsewhere("stripe"),
    subscriptionStatus: copy.subscriptionStatus("incomplete"),
    offerUsed: copy.offerUsed("SPRING"),
    offerUsedWinback: copy.offerUsed(null),
    offerHeld: copy.offerHeld("SPRING"),
    offerHeldWinback: copy.offerHeld(null),
  };
}

const en = CHECKOUT_ERRORS.en;
const FUNCTION_KEYS = Object.keys(en).filter((key) => typeof en[key as keyof CheckoutErrorsCopy] === "function");

describe("checkout's refusals", () => {
  it("has every key, non-empty, in all five languages", () => {
    expect(Object.keys(CHECKOUT_ERRORS).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      const copy = CHECKOUT_ERRORS[locale];
      expect(Object.keys(copy).sort(), locale).toEqual(Object.keys(en).sort());
      for (const key of FUNCTION_KEYS) expect(typeof copy[key as keyof CheckoutErrorsCopy], `${locale}.${key}`).toBe("function");
      for (const [key, text] of Object.entries(texts(copy))) expect(text.trim(), `${locale}.${key}`).not.toBe("");
    }
  });

  it("words every entry in each other language, keeping every name, code and date", () => {
    const english = texts(en);
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const own = texts(CHECKOUT_ERRORS[locale]);
      for (const key of Object.keys(english)) expect(own[key], `${locale}.${key}`).not.toBe(english[key]);
      for (const key of ["noStripePrice", "alreadyOnPlan", "planNotOnPayPal", "winbackNotOnPayPal"]) expect(own[key], `${locale}.${key}`).toContain("Grow");
      for (const key of ["offerUnavailable", "launchPriceDoesNotCover"]) expect(own[key], `${locale}.${key}`).toContain(REPGET_CODE);
      for (const key of ["offerUsed", "offerHeld"]) expect(own[key], `${locale}.${key}`).toContain("SPRING");
      expect(own.payPalCancelledRuns, locale).toContain("2026-12-01");
      expect(own.billedElsewherePayPal, locale).toContain("PayPal");
      expect(own.billedElsewhereCard, locale).toContain("Stripe");
    }
  });

  it("keeps the English word for word", () => {
    expect(en.offerUnavailable(REPGET_CODE)).toBe(OFFER_UNAVAILABLE);
    expect(en.winbackUnavailable).toBe(WINBACK_UNAVAILABLE);
    // lib/billing/repget-subscription.ts offerForPlanChange's refusal.
    expect(en.launchPriceDoesNotCover(REPGET_CODE)).toBe(
      "Your REPGET launch price does not cover this plan, and moving to it would end your discount. Please contact us if you want to change to it.",
    );
    expect(texts(en)).toMatchObject({
      websiteNotFound: "Website not found",
      paymentsNotConfigured: "Payments are not configured yet.",
      planNotFound: "Plan not found",
      noStripePrice: 'Plan "Grow" has no Stripe price configured',
      checkoutNotStarted: "We could not start the checkout. Please try again.",
      alreadyOnPlan: "This website is already on Grow.",
      checkoutFailed: "Something went wrong starting checkout. Please try again.",
      payPalUnavailable: "PayPal is not available yet. Please pay by card.",
      payPalPaused: "Paying with PayPal is paused for now. Please pay by card, or try again later.",
      planNotOnPayPal: '"Grow" is not available through PayPal yet. Please pay by card.',
      winbackNotOnPayPal: 'The welcome-back discount is not available with PayPal for "Grow" yet. Please pay by card to get it.',
      payPalChangeFailed: "PayPal could not change the plan.",
      payPalStartFailed: "PayPal could not start the subscription.",
      payPalCancelledRuns:
        "This website's PayPal subscription is cancelled and its plan runs until 2026-12-01. You can choose a plan again, by card or PayPal, once it has ended.",
      payPalCancelledRunsUndated:
        "This website's PayPal subscription is cancelled and its plan runs. You can choose a plan again, by card or PayPal, once it has ended.",
      billedElsewhereCard: "This website is already billed by card (Stripe). Change its plan there, or cancel that subscription first.",
      offerUsedWinback: "Your account has already used the welcome-back discount.",
      offerHeld: "The SPRING discount is on another checkout of your account. Finish that one, or try again once it has expired.",
    });
    expect(en.subscriptionStatus("past_due")).toBe(
      "This website's subscription is past due. Settle or cancel it before starting another.",
    );
  });

  it("falls back to English for no language, and to the stored words for an unknown status", () => {
    expect(checkoutErrors(null)).toBe(en);
    expect(checkoutErrors(undefined)).toBe(en);
    expect(checkoutErrors("it")).toBe(CHECKOUT_ERRORS.it);
    expect(CHECKOUT_ERRORS.it.subscriptionStatus("some_new_state")).toContain("some new state");
    expect(CHECKOUT_ERRORS.de.subscriptionStatus("constructor")).toContain("constructor");
  });
});
