import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";

import { localizeToolMessage } from "./messages";

/**
 * Every message a free tool can show is translated (client, 2026-10-13). Read
 * from the checks' own source, so a message added there without a translation
 * fails here instead of appearing in English on a Spanish page.
 */

const SOURCES = [
  "../public-guard.ts",
  "../robots.ts",
  "../sitemap.ts",
  "../readability.ts",
  "../llms-txt.ts",
  "../meta-tags.ts",
  "../description-writer.ts",
  "../../audit/public-audit.ts",
  "../../websites/url.ts",
];

/** The text after message:, error:, problem:, note:, missingNote:, heading:, label:, or in an InvalidUrlError. */
function messagesIn(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:\b(?:message|error|problem|note|missingNote|heading|label)\s*[:=]\s*|InvalidUrlError\(|\breturn\s+|\bconst [A-Z_]+\s*=\s*)\s*(?:[^"'`\n]*\?\s*)?("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  for (const match of source.matchAll(pattern)) {
    const literal = match[1];
    // Template parts become a sample number, as the checks fill them in.
    const text = literal.slice(1, -1).replace(/\$\{[^}]+\}/g, "42").replace(/\\(["'`])/g, "$1");
    found.push(text);
  }
  return found;
}

const TECHNICAL = /^(og|twitter):|^Viewport$|^<|^meta |^link /;
/** Not shown to visitors: the generated llms.txt's own heading (the file follows the site, not the page language), a rate-limit key and a cache key. */
const NOT_MESSAGES = new Set(["Home", "public-meta-description", "public-audit:v4:42"]);

describe("the free tools' messages", () => {
  const all = [...new Set(SOURCES.flatMap((file) => messagesIn(readFileSync(path.resolve(__dirname, file), "utf8"))))].filter(
    (text) => /[a-z]{3}/.test(text) && !TECHNICAL.test(text) && !NOT_MESSAGES.has(text),
  );

  it("are found in the checks' source (the scan itself works)", () => {
    expect(all).toContain("Enter a valid website address");
    expect(all).toContain("That page returned 42 instead of loading.");
    expect(all).toContain("Falls back to og:image.");
    expect(all.length).toBeGreaterThan(35);
  });

  it.each(LOCALES.filter((locale) => locale !== "en"))("are all translated into %s", (locale) => {
    // The same word on purpose: French and Italian SEO say "meta description" too.
    const SAME: Record<string, string[]> = { fr: ["Meta description"], it: ["Meta description"] };
    const untranslated = all.filter((text) => localizeToolMessage(text, locale) === text && !SAME[locale]?.includes(text));
    expect(untranslated).toEqual([]);
  });

  it("keep the numbers, and leave English and unknown text alone", () => {
    expect(localizeToolMessage("That page returned 503 instead of loading.", "it")).toBe("Quella pagina ha restituito 503 invece di caricarsi.");
    expect(localizeToolMessage("71 characters - will be cut short at about 60.", "de")).toBe("71 Zeichen: wird bei etwa 60 abgeschnitten.");
    expect(localizeToolMessage("Enter a valid website address", "en")).toBe("Enter a valid website address");
    expect(localizeToolMessage("Something new", "fr")).toBe("Something new");
  });
});
