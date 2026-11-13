import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { FREE_SOCIAL_GOALS, FREE_SOCIAL_TONES } from "@/lib/tools/social-posts-shared";

import { socialPostGeneratorCopy } from "./social-post-generator";

/**
 * The free AI Social Media Post Generator's words in all five languages
 * (client, 2026-11-13): every key present and filled, the same placeholders
 * as the English, and nothing left in English.
 */

type Leaf = [path: string, value: string];

function leaves(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  return [];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Words that are the same in some languages on purpose: names, "Post", "CSV", short labels. */
const SAME_OK = /^(Post( \{n\})?|Instagram|LinkedIn|X|Facebook|Threads|TikTok|Pinterest|Reddit|Bluesky|Social|Angle|Texte?|Professional|Tono|Ton|Ziel|\(optional\)|Preview|Copy all|\{platform\} · 3 posts)$/;

describe("the social post generator's copy", () => {
  const english = leaves(socialPostGeneratorCopy("en"));

  it("has every goal and tone the tool offers", () => {
    for (const locale of LOCALES) {
      const copy = socialPostGeneratorCopy(locale);
      for (const goal of FREE_SOCIAL_GOALS) expect(copy.form.goals[goal], `${locale} ${goal}`).toBeTruthy();
      for (const tone of FREE_SOCIAL_TONES) expect(copy.form.tones[tone], `${locale} ${tone}`).toBeTruthy();
    }
  });

  it.each(LOCALES)("%s: every text filled, with the English placeholders", (locale) => {
    const texts = new Map(leaves(socialPostGeneratorCopy(locale)));
    expect([...texts.keys()].sort()).toEqual(english.map(([path]) => path).sort());
    for (const [path, value] of english) {
      const translated = texts.get(path) ?? "";
      expect(translated.trim(), `${locale} ${path}`).not.toBe("");
      expect(placeholders(translated), `${locale} ${path}`).toEqual(placeholders(value));
    }
  });

  it.each(LOCALES.filter((locale) => locale !== "en"))("%s: nothing left in English", (locale) => {
    const texts = new Map(leaves(socialPostGeneratorCopy(locale)));
    const untranslated = english.filter(([path, value]) => texts.get(path) === value && !SAME_OK.test(value)).map(([path]) => path);
    expect(untranslated).toEqual([]);
  });

  it("never promises unlimited or free generation after signing up", () => {
    for (const locale of LOCALES) {
      const copy = socialPostGeneratorCopy(locale);
      const invitations = [copy.unlock.text, copy.results.usedText, copy.errors.limit, copy.form.quotaRest].join(" ");
      expect(invitations, locale).not.toMatch(/unlimited|ilimitad|illimit|unbegrenzt|unbegrenzte/i);
    }
  });
});
