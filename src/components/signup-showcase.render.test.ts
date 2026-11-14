import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { signupShowcaseCopy } from "@/lib/i18n/signup-showcase";

/**
 * Sign-up's right-hand panel (client's design, 2026-11-15). Only sign-up's:
 * sign-in keeps the panel it had, and the two share one layout.
 */

const segment = vi.hoisted(() => ({ value: "sign-up" as string | null }));

vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => segment.value }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { AuthAside } from "./auth-aside";
import { SignUpShowcase } from "./signup-showcase";

const panel = (locale: (typeof LOCALES)[number]) => renderToStaticMarkup(createElement(SignUpShowcase, { locale }));

describe("which panel the layout shows", () => {
  const signIn = createElement("p", null, "sign-in panel");
  const signUp = createElement("p", null, "sign-up panel");
  const shown = () => renderToStaticMarkup(createElement(AuthAside, { signIn, signUp }));

  beforeEach(() => {
    segment.value = "sign-up";
  });

  it("is the new one on sign-up", () => {
    expect(shown()).toBe("<p>sign-up panel</p>");
  });

  it.each(["sign-in", null])("is the old one everywhere else (%s)", (value) => {
    segment.value = value;
    expect(shown()).toBe("<p>sign-in panel</p>");
  });
});

describe("the sign-up panel", () => {
  it.each(LOCALES)("in %s says everything in that language", (locale) => {
    const html = panel(locale);
    const t = signupShowcaseCopy(locale);
    for (const text of [t.kicker, t.titleLead, t.titleAccent, t.lead, ...t.nodes, t.footLead, t.footAccent, t.footNote, t.tag]) {
      expect(html).toContain(text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
    }
    if (locale !== "en") expect(html).not.toContain(signupShowcaseCopy("en").titleLead);
  });

  it("shows the design's gecko and owl, as one named illustration", () => {
    const html = panel("en");
    expect(html).toContain('role="img" aria-label="RepGet&#x27;s gecko and owl mascots, surrounded by search, AI and social signals"');
    for (const picture of ["gecko-photo.webp", "gecko-hand.webp", "owl.webp"]) expect(html).toContain(`/images/signup/${picture}`);
  });

  it("carries no control that could take focus from the form", () => {
    expect(panel("en")).not.toMatch(/<(a|button|input)/);
  });
});
