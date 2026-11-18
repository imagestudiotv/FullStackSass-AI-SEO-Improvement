import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/paypal/actions", () => ({ confirmPayPalReturn: vi.fn() }));

import { PAYPAL_PENDING_COPY } from "@/lib/i18n/paypal-pending";

import { PayPalPendingPrompt } from "./paypal-pending-prompt";

/**
 * The prompt beside the payment buttons when an unfinished PayPal payment
 * blocks paying another way (Daniel, 2026-11-18: "there is no way to
 * cancel"). Rendered in every language: says what happened and offers the
 * one button that cancels it and carries on.
 */
describe("the unfinished PayPal payment prompt", () => {
  it.each(Object.entries(PAYPAL_PENDING_COPY))("offers to cancel it and continue (%s)", (_locale, copy) => {
    const html = renderToStaticMarkup(createElement(PayPalPendingPrompt, { websiteId: "site-1", copy, onContinue: () => {} }));
    expect(html).toContain(copy.promptBody);
    expect(html).toContain(copy.cancelAndContinue);
    expect(html).not.toContain(copy.failed);
  });

  it("says PayPal has not let go of it when the repeat was refused again", () => {
    const copy = PAYPAL_PENDING_COPY.en;
    const html = renderToStaticMarkup(createElement(PayPalPendingPrompt, { websiteId: "site-1", copy, onContinue: () => {}, failed: true }));
    expect(html).toContain(copy.failed);
  });
});
