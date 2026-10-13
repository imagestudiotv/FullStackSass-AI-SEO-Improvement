import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, localePath, splitLocale, type Locale } from "@/lib/i18n/config";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";

/**
 * Every free tool page, and the hub, in every language (client, 2026-10-13):
 * the visitor's words, links that stay in their language, nothing left in
 * English. Rendered before a check is run, so nothing reaches the network.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { ToolsHub } from "./tools-hub";
import { AiCrawlersTool } from "./ai-crawler-checker/tool";
import { KeywordDensityTool } from "./keyword-density/tool";
import { LlmHtmlTool } from "./llm-html-checker/tool";
import { LlmsTxtTool } from "./llms-txt-generator/tool";
import { MetaDescriptionTool } from "./meta-description-generator/tool";
import { MetaTagsTool } from "./meta-tag-checker/tool";
import { RobotsTool } from "./robots-checker/tool";
import { SitemapTool } from "./sitemap-checker/tool";
import { SnippetTool } from "./snippet-preview/tool";

type Render = (locale: Locale) => Promise<ReactElement> | ReactElement;

const TOOLS: [string, Render][] = [
  ["/tools/robots-checker", (locale) => RobotsTool({ locale, searchParams: {} })],
  ["/tools/sitemap-checker", (locale) => SitemapTool({ locale, searchParams: {} })],
  ["/tools/meta-tag-checker", (locale) => MetaTagsTool({ locale, searchParams: {} })],
  ["/tools/ai-crawler-checker", (locale) => AiCrawlersTool({ locale, searchParams: {} })],
  ["/tools/llms-txt-generator", (locale) => LlmsTxtTool({ locale, searchParams: {} })],
  ["/tools/llm-html-checker", (locale) => LlmHtmlTool({ locale, searchParams: {} })],
  ["/tools/keyword-density", (locale) => KeywordDensityTool({ locale, searchParams: {} })],
  ["/tools/meta-description-generator", (locale) => MetaDescriptionTool({ locale, searchParams: {} })],
  ["/tools/snippet-preview", (locale) => SnippetTool({ locale })],
];

const html = async (render: Render, locale: Locale) => renderToStaticMarkup(await render(locale));
const hrefs = (markup: string) => [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

describe("the free tools in every language", () => {
  for (const [path, render] of TOOLS) {
    describe(path, () => {
      it.each(LOCALES)("%s: its title, its words, and links in that language", async (locale) => {
        const markup = await html(render, locale);
        const title = TOOLS_COMMON[locale].tools[path].title.replace(/&/g, "&amp;");
        expect(markup).toContain(`>${title}</h1>`);
        expect(markup).not.toMatch(/\{(count|min|max|name|domain|url|total|blocked|described)\}/);
        if (locale !== "en") {
          // Internal links stay in the visitor's language wherever that page exists in it.
          for (const href of hrefs(markup).filter((h) => h.startsWith("/"))) {
            expect(href, href).toBe(localePath(locale, splitLocale(href).path));
          }
          // Nothing from the English page leaks in.
          const english = await html(render, "en");
          const englishParagraphs = [...english.matchAll(/<p[^>]*>([^<]{40,})<\/p>/g)].map((m) => m[1]);
          for (const paragraph of englishParagraphs) expect(markup, paragraph).not.toContain(paragraph);
        }
      });
    });
  }

  it.each(LOCALES)("the hub in %s lists every tool under its translated name", (locale) => {
    const markup = renderToStaticMarkup(createElement(ToolsHub, { locale }));
    for (const tool of Object.values(TOOLS_COMMON[locale].tools)) expect(markup).toContain(tool.title.replace(/&/g, "&amp;"));
    expect(markup).toContain(TOOLS_COMMON[locale].hub.title.replace(/&/g, "&amp;"));
  });
});
