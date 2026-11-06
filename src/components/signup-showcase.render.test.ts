import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { signupShowcaseCopy } from "@/lib/i18n/signup-showcase";

/**
 * Sign-up's right-hand panel (client's design, 2026-11-05). Only sign-up's:
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
    expect(html).toContain(t.titleAccent);
    for (const feature of t.features) expect(html).toContain(feature.replace("&", "&amp;"));
    if (locale !== "en") expect(html).not.toContain(signupShowcaseCopy("en").panelTitle);
  });

  it("names itself an illustration, and carries no control that could take focus from the form", () => {
    const html = panel("en");
    expect(html).toContain('role="img" aria-label="Illustrative RepGet dashboard preview"');
    expect(html).not.toMatch(/<(a|button|input)\b/);
  });

  it("lists only channels the product works with", () => {
    expect(panel("en")).not.toContain("LinkedIn");
  });
});
