import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";

import { fill, growthPlanCopy } from "./growth-plan";

/**
 * The growth plan's words (lib/i18n/growth-plan.ts): every language says
 * every line, with the same placeholders as English, so a value read from the
 * visitor's site is never lost - or left as "{name}" - in translation.
 */

type Tree = string | Tree[] | { [key: string]: Tree };

function leaves(tree: Tree, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  if (Array.isArray(tree)) return tree.flatMap((child, i) => leaves(child, `${path}[${i}]`));
  return Object.entries(tree).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("growth plan copy", () => {
  const english = new Map(leaves(growthPlanCopy("en") as unknown as Tree));

  it.each(LOCALES.filter((locale) => locale !== "en"))("%s has every line, translated, with English's placeholders", (locale) => {
    const lines = new Map(leaves(growthPlanCopy(locale) as unknown as Tree));
    expect([...lines.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [path, text] of lines) {
      expect(text.trim(), path).not.toBe("");
      expect(placeholders(text), path).toEqual(placeholders(english.get(path)!));
    }
    expect(growthPlanCopy(locale).title).not.toBe(growthPlanCopy("en").title);
  });

  it("never promises an AI engine RepGet does not check", () => {
    for (const locale of LOCALES) {
      const all = leaves(growthPlanCopy(locale) as unknown as Tree)
        .map(([, text]) => text)
        .join(" ");
      // The check asks ChatGPT, Gemini and Claude (lib/geo/engines.ts), never Perplexity.
      expect(all).not.toMatch(/Perplexity|Microsoft Copilot/);
    }
  });
});

describe("fill", () => {
  it("fills known placeholders and leaves unknown ones alone", () => {
    expect(fill("Fix the {count} problems on {name}", { count: 3, name: "Acme" })).toBe("Fix the 3 problems on Acme");
    expect(fill("Hello {who}", {})).toBe("Hello {who}");
  });
});
