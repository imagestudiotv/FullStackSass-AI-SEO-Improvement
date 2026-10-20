import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The notice for a PayPal payment started and never finished (review H1,
 * 2026-10-20): what it says and its button, in each language.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/paypal/actions", () => ({ confirmPayPalReturn: vi.fn() }));

import { LOCALES } from "@/lib/i18n/config";
import { PAYPAL_PENDING_COPY } from "@/lib/i18n/paypal-pending";

import { PayPalPendingNotice } from "./paypal-pending-notice";

describe("the unfinished PayPal payment notice", () => {
  it("says what is blocked and offers to cancel it", () => {
    const html = renderToStaticMarkup(createElement(PayPalPendingNotice, { websiteId: "site-1", copy: PAYPAL_PENDING_COPY.en }));
    expect(html).toContain("A PayPal payment was started but not finished");
    expect(html).toContain("cannot be paid by card or moved to another plan");
    expect(html).toMatch(/<button[^>]*>Cancel the PayPal payment<\/button>/);
  });

  it.each(LOCALES)("has every line in %s", (locale) => {
    const copy = PAYPAL_PENDING_COPY[locale];
    expect(Object.values(copy).every((text) => text.trim().length > 0)).toBe(true);
    expect(renderToStaticMarkup(createElement(PayPalPendingNotice, { websiteId: "site-1", copy }))).toContain(copy.cancel);
  });
});
