import { readFileSync } from "node:fs";
import path from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { guestCopilotCopy } from "@/lib/i18n/guest-copilot";
import { faqCopy } from "@/lib/i18n/home/faq";
import { heroCopy } from "@/lib/i18n/home/hero";
import { getMessages } from "@/lib/i18n/messages";

vi.stubGlobal("React", React);
vi.mock("@/components/guest-copilot/guest-copilot-chat", () => ({ GuestCopilotChat: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => React.createElement("a", { href, className }, children),
}));

import { GuestCopilotCard } from "@/components/guest-copilot/guest-copilot-card";

/** The copy fixes from the outside product review (2026-11-27), in every language. */

describe("copy the product keeps", () => {
  it.each(LOCALES)("the hero promises no results in seconds (%s)", (locale) => {
    const benefits = heroCopy(locale).hero.benefits.join(" ");
    expect(benefits).not.toMatch(/second|segund|Sekunde/i);
    expect(heroCopy(locale).hero.benefits[2]).toMatch(/minut/i);
  });

  it.each(LOCALES)("the FAQ does not call the existing social review 'planned' (%s)", (locale) => {
    const answers = faqCopy(locale).groups.flatMap((group) => group.items.map((item) => item.answer)).join(" ");
    expect(answers).not.toMatch(/planned social workflow|redes sociales previsto|flux social prévu|flusso social previsto|geplante Social-Workflow/);
  });

  it.each([
    ["en", "subscription"],
    ["es", "suscripción"],
    ["fr", "abonnement"],
    ["it", "abbonamento"],
    ["de", "Abonnement"],
  ] as const)("credits are explained next to one website per subscription, not 'shared by all your websites' (%s)", (locale, word) => {
    const t = getMessages(locale).app;
    expect(t.credits.intro).toContain(word);
    expect(t.reports.creditsScopeNote).toContain(word);
    expect(getMessages("en").app.credits.intro).not.toContain("shared by all your websites");
  });
});

describe("Try the AI copilot free", () => {
  it.each(LOCALES)("keeps its words in one span, so the button's gap is not read as double spaces (%s)", (locale) => {
    const copy = guestCopilotCopy(locale);
    const html = renderToStaticMarkup(
      React.createElement(GuestCopilotCard, { copy, locale, tryHref: "/tools/growth-copilot", signUpHref: "/sign-up", toolTitle: null, titleId: "t" }),
    );
    const words = copy.section.tryFree.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    expect(html).toContain(`<span>${words}</span>`);
    expect(copy.section.tryFree).not.toMatch(/ {2}/);
  });
});

describe("the home hero's address field on a phone", () => {
  it("gives the field the width: the globe goes below 450px, the button's words are clipped (still its name) below 400px", () => {
    const root = path.join(process.cwd(), "src/app/(marketing)/_home");
    const css = readFileSync(path.join(root, "sections/hero.module.css"), "utf8");
    expect(css).toMatch(/@media \(max-width: 450px\) \{\s*\.rgx-input-icon \{\s*display: none;/);
    expect(css).toMatch(/@media \(max-width: 400px\) \{[\s\S]*?\.rgx-primary-label \{[\s\S]*?clip: rect\(0, 0, 0, 0\);/);
    expect(readFileSync(path.join(root, "hero-form.tsx"), "utf8")).toContain('<span className={styles["rgx-primary-label"]}>{strings.startTrial}</span>');
  });
});
