import { describe, expect, it } from "vitest";

import { VIDEO_LIBRARY_COPY } from "@/lib/i18n/videos-library";

import { cleanTags, parseTags, readTags, suggestedTags, tagsLength, YOUTUBE_TAGS_MAX } from "./youtube-tags";

describe("a YouTube Short's tags", () => {
  it("are trimmed, without # or quotes, and never twice", () => {
    expect(parseTags(' seo , #SEO, "small  business",,\nads; Ads ')).toEqual(["seo", "small business", "ads"]);
    expect(parseTags("  , ;\n")).toEqual([]);
  });

  it("count as YouTube counts them: the commas, and quotes around a tag with a space", () => {
    expect(tagsLength(["Foo-Baz"])).toBe(7);
    expect(tagsLength(["Foo Baz"])).toBe(9);
    expect(tagsLength(["Foo-Baz", "Foo Baz"])).toBe(17);
    expect(tagsLength([])).toBe(0);
  });

  it("stay within 500 characters, whole tags only", () => {
    const many = Array.from({ length: 80 }, (_, i) => `tag number ${i}`).join(", ");
    const clean = cleanTags(many);
    expect(tagsLength(parseTags(clean))).toBeLessThanOrEqual(YOUTUBE_TAGS_MAX);
    for (const tag of parseTags(clean)) expect(many).toContain(tag);
    expect(cleanTags("x".repeat(501))).toBe("");
    expect(cleanTags("x".repeat(500))).toBe("x".repeat(500));
    // One that does not fit is left out; a shorter one after it still goes in.
    expect(cleanTags(`${"a".repeat(498)}, bbb, c`)).toBe(`${"a".repeat(498)}, c`);
  });

  it("start from the post's own hashtags", () => {
    expect(suggestedTags("Not all heroes wear capes #SmallBusiness #seo #seo #social_media")).toBe("Small Business, seo, social media");
    expect(suggestedTags("No hashtags")).toBe("");
  });

  it("are read back, an emptied field staying empty", () => {
    expect(readTags({ youtubeTags: "a" })).toBe("a");
    expect(readTags({ youtubeTags: "" })).toBe("");
    expect(readTags({ tone: "calm" })).toBeNull();
    expect(readTags(null)).toBeNull();
  });
});

describe("the library's words", () => {
  const keys = (value: unknown, path = ""): string[] =>
    value && typeof value === "object" ? Object.entries(value).flatMap(([key, item]) => keys(item, `${path}.${key}`)) : [path];
  const at = (value: unknown, path: string) => path.split(".").filter(Boolean).reduce<unknown>((item, key) => (item as Record<string, unknown>)[key], value);

  it("are whole in the five languages, with the same placeholders and forms", () => {
    const wanted = keys(VIDEO_LIBRARY_COPY.en).sort();
    for (const [locale, copy] of Object.entries(VIDEO_LIBRARY_COPY)) {
      expect(keys(copy).sort(), locale).toEqual(wanted);
      for (const path of wanted) {
        const en = String(at(VIDEO_LIBRARY_COPY.en, path));
        const text = String(at(copy, path));
        const holes = (value: string) => [...new Set(value.match(/\{\w+\}/g) ?? [])].sort();
        expect(text.trim().length, `${locale}${path}`).toBeGreaterThan(0);
        expect(holes(text), `${locale}${path}`).toEqual(holes(en));
        expect(text.split("|").length, `${locale}${path}`).toBe(en.split("|").length);
      }
    }
  });
});
