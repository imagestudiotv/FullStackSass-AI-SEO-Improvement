import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The feedback form (client, 2026-10-19) as people meet it: on the Contact
 * page in every language - linked from the footer - and in the dashboard's
 * header, where a customer is not asked for an address.
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }) }));
vi.mock("@/lib/feedback/actions", () => ({ sendFeedback: vi.fn() }));

import { ContactContent } from "@/app/(marketing)/static-pages";
import { FEEDBACK_COPY } from "@/lib/feedback/copy";
import { FEEDBACK_KINDS } from "@/lib/feedback/shared";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

import { FeedbackForm } from "./feedback-form";
import { MarketingShell } from "./marketing-shell";

describe("the feedback form on the Contact page", () => {
  it.each(LOCALES)("is there in %s, in that language, asking for an address to reply to", (locale) => {
    const copy = FEEDBACK_COPY[locale];
    const html = renderToStaticMarkup(createElement(ContactContent, { t: getMessages(locale), locale, supportEmail: "support@repget.com" }));
    expect(html).toContain('id="feedback"');
    expect(html).toContain(copy.title);
    for (const kind of FEEDBACK_KINDS) expect(html).toContain(copy.kinds[kind]);
    expect(html).toContain(copy.emailLabel);
    expect(html).toContain(copy.send);
    // Several pictures at once, up to five.
    expect(html).toContain(copy.screenshotHint.replace("{max}", "5"));
    expect(html).toMatch(/<input[^>]*type="file"[^>]*multiple=""/);
    // The field only a bot fills in is in the form, out of sight and out of the tab order.
    expect(html).toMatch(/<div aria-hidden="true" class="absolute -left-\[9999px\][^"]*"><label>Company<input [^>]*tabindex="-1"[^>]*name="company"/);
  });

  it("is linked from the footer in every language", () => {
    for (const locale of LOCALES) {
      nav.pathname = locale === "en" ? "/pricing" : `/${locale}/pricing`;
      const html = renderToStaticMarkup(createElement(MarketingShell, null, createElement("p", null, "page")));
      const contact = locale === "en" ? "/contact" : `/${locale}/contact`;
      expect(html).toMatch(new RegExp(`href="${contact}#feedback"[^>]*>${getMessages(locale).footer.feedback}</a>`));
    }
  });
});

describe("the feedback form in the dashboard", () => {
  it("tells a customer where the reply goes instead of asking for an address", () => {
    const copy = FEEDBACK_COPY.de;
    const html = renderToStaticMarkup(createElement(FeedbackForm, { copy, locale: "de", source: "dashboard", accountEmail: "dana@shop.example" }));
    expect(html).toContain("Wir antworten an dana@shop.example.");
    expect(html).not.toContain(copy.emailLabel);
  });
});

describe("the form's words", () => {
  it.each(LOCALES)("are complete in %s", (locale) => {
    const copy = FEEDBACK_COPY[locale];
    const strings = JSON.stringify(copy).match(/"[^"]*"/g) ?? [];
    expect(strings.every((value) => value !== '""')).toBe(true);
    expect(copy.accountEmail).toContain("{email}");
    expect(copy.screenshotHint).toContain("{max}");
    expect(copy.errors.screenshot_count).toContain("{max}");
    expect(copy.screenshotRemove).toContain("{n}");
  });
});
