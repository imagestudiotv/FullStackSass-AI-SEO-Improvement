import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { blogWriterCopy } from "@/lib/i18n/blog-writer";
import type { Locale } from "@/lib/i18n/config";
import { TOOL_UNAVAILABLE } from "@/lib/tools/i18n/unavailable";

/**
 * The free AI Blog Writer's page (owner's mockup, 2026-11-27) in a language,
 * before anything is written, and the on/off gate every tool page sits in.
 */

const nav = vi.hoisted(() => ({ segment: null as string | null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSelectedLayoutSegment: () => nav.segment }));

import { ToolGate } from "@/components/tool-gate";

import { BlogWriterTool } from "./tool";

const html = (markup: string) => markup.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("the Blog Writer page", () => {
  it("shows the mockup's layout in English, with the samples word for word", () => {
    const markup = html(renderToStaticMarkup(BlogWriterTool({ locale: "en" })));
    expect(markup).toContain(">Free AI Blog Writer</h1>");
    expect(markup).toContain("Get an editable opening for your own article before you sign up.");
    expect(markup).toContain('href="/tools"');
    expect(markup).toContain("← All free tools");
    expect(markup).toContain("Explore writing samples");
    expect(markup).toMatch(/aria-pressed="true"[^>]*>How-to guide</);
    expect(markup).toContain('maxLength="550"');
    expect(markup).toContain('maxLength="1000"');
    expect(markup).toContain('placeholder="How much time should we leave for wedding portraits on Lake Como?"');
    expect(markup).toContain("Write my opening");
    expect(markup).toContain("How to plan Lake Como wedding portraits around the aperitivo");
    expect(markup).toContain("Image Studio / Wedding photography · imagestudio.com");
    expect(markup).toContain(
      "Walk from the ceremony exit to the boarding point in the shoes you will wear. Then ask the boat operator about boarding, turning and docking.",
    );
    expect(markup).toContain("RepGet · AI Blog Writer");
    // Nothing is written before the visitor asks: no result, no sign-up prompt yet.
    expect(markup).not.toContain("Your article opening");
    expect(markup).not.toContain("Sign up free to get the full article");
  });

  it("is in Spanish on the Spanish page, links included", () => {
    const markup = html(renderToStaticMarkup(BlogWriterTool({ locale: "es" })));
    const copy = blogWriterCopy("es");
    expect(markup).toContain(">Redactor de blog con IA gratis</h1>");
    expect(markup).toContain(copy.form.topicLabel);
    expect(markup).toContain(copy.samples.guide.title);
    expect(markup).toContain(copy.samples.guide.sections[1].body);
    expect(markup).toContain('href="/es/tools"');
    expect(markup).not.toContain("Explore writing samples");
  });
});

describe("the free tools' on/off gate", () => {
  const page = createElement("p", null, "the tool itself");
  /** The gate around the tool, its children passed as React passes them (not as a prop). */
  const gate = (props: { disabled: readonly string[]; locale: Locale }) =>
    renderToStaticMarkup(createElement(ToolGate as (p: typeof props & { children?: ReactNode }) => ReactNode, props, page));

  it("shows the tool while it is on", () => {
    nav.segment = "blog-writer";
    expect(gate({ disabled: ["robots-checker"], locale: "en" })).toContain("the tool itself");
  });

  it("shows a friendly unavailable page, in the visitor's language, while it is off", () => {
    nav.segment = "blog-writer";
    const markup = html(gate({ disabled: ["blog-writer"], locale: "de" }));
    expect(markup).not.toContain("the tool itself");
    expect(markup).toContain(TOOL_UNAVAILABLE.de.title);
    expect(markup).toContain('href="/de/tools"');
  });

  it("never hides the tools hub itself", () => {
    nav.segment = null;
    expect(gate({ disabled: ["blog-writer"], locale: "en" })).toContain("the tool itself");
  });
});
