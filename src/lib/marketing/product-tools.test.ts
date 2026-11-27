import { describe, expect, it } from "vitest";

import { FEATURE_TOOLS } from "@/components/marketing-mega-menu";
import { LOCALES } from "@/lib/i18n/config";
import { featuresPageCopy } from "@/lib/i18n/features-page";
import { homeMenuCopy } from "@/lib/i18n/home-redesign";
import { pricingCopy } from "@/lib/i18n/home/pricing";
import { siteMenuCopy } from "@/lib/i18n/home/site-menu";
import { storyCopy } from "@/lib/i18n/home/story";
import { getMessages } from "@/lib/i18n/messages";

import { PRODUCT_TOOL_COUNT, PRODUCT_TOOLS, TOOL_FEATURES } from "./product-tools";

/**
 * ONE tool count on the whole site (client, 2026-11-27): five tools, in one
 * order, with Growth Copilot running them and never counted. The menu used to
 * say six, the homepage nine and four, the pricing row ticked five.
 */

/** The counts the site used to give, in every language. Any of them back means two counts again. */
const RETIRED_COUNTS = [
  /\bsix tools\b/i,
  /\bnine capabilities\b/i,
  /\b9 capabilities\b/i,
  /\bfour growth engines\b/i,
  /\bseis herramientas\b/i,
  /\b9 capacidades\b/i,
  /\bcuatro motores\b/i,
  /\bsix outils\b/i,
  /\b9 fonctionnalités\b/i,
  /\bquatre moteurs\b/i,
  /\bsei strumenti\b/i,
  /\b9 funzionalità\b/i,
  /\bquattro motori\b/i,
  /\bsechs werkzeuge\b/i,
  /\b9 funktionen\b/i,
  /\bvier wachstumsmotoren\b/i,
];

/** Every string in a copy object. */
const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

describe("the five tools", () => {
  it("are five, with Growth Copilot apart", () => {
    expect(PRODUCT_TOOL_COUNT).toBe(5);
    expect(PRODUCT_TOOLS).toEqual(["articles", "backlinks", "aiVisibility", "social", "websiteHealth"]);
    expect(Object.keys(TOOL_FEATURES)).toEqual([...PRODUCT_TOOLS, "copilot"]);
  });

  it.each(LOCALES)("%s: the header menu lists the same five, by the same names, in the same order", (locale) => {
    const menu = homeMenuCopy(locale);
    const { tools } = featuresPageCopy(locale);
    expect(FEATURE_TOOLS).toHaveLength(PRODUCT_TOOL_COUNT);
    expect(menu.tools.map((tool) => tool.title)).toEqual(PRODUCT_TOOLS.map((tool) => tools[tool].name));
  });

  it.each(LOCALES)("%s: the words that count the tools say five", (locale) => {
    const five = { en: /\bfive\b/i, es: /\bcinco\b/i, fr: /\bcinq\b/i, it: /\bcinque\b/i, de: /\bfünf\b/i }[locale];
    expect(homeMenuCopy(locale).featuresTagline).toMatch(five);
    expect(featuresPageCopy(locale).home.title).toMatch(five);
    expect(pricingCopy(locale).includedLabel).toMatch(five);
  });

  it.each(LOCALES)("%s: no copy gives the old counts any more", (locale) => {
    const copy = [
      ...strings(homeMenuCopy(locale)),
      ...strings(siteMenuCopy(locale)),
      ...strings(storyCopy(locale)),
      ...strings(pricingCopy(locale)),
      ...strings(featuresPageCopy(locale)),
      ...strings(getMessages(locale).nav),
      ...strings(getMessages(locale).footer),
    ];
    const found = copy.filter((text) => RETIRED_COUNTS.some((count) => count.test(text)));
    expect(found).toEqual([]);
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%s: /features is translated, apart from product names", (locale) => {
    const SAME = new Set(["Backlinks", "Growth Copilot", "Social", "Articles", "Google Search and Analytics"]);
    const english = strings(featuresPageCopy("en"));
    const local = strings(featuresPageCopy(locale));
    expect(local).toHaveLength(english.length);
    const untranslated = local.filter((text, i) => text === english[i] && !SAME.has(text));
    expect(untranslated).toEqual([]);
  });
});
