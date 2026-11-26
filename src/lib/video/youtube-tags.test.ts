import { describe, expect, it } from "vitest";

import { VIDEO_LIBRARY_COPY } from "@/lib/i18n/videos-library";

import { cleanTags, parseTags, readTags, sensibleTag, suggestedTags, tagsLength, YOUTUBE_TAGS_MAX } from "./youtube-tags";

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

  it("start from the post's own hashtags, then its words and the general ones", () => {
    expect(suggestedTags("Not all heroes wear capes #SmallBusiness #seo #seo #social_media")).toBe(
      "Small Business, seo, social media, heroes, wear, capes, shorts, youtube shorts",
    );
    expect(suggestedTags("No hashtags")).toBe("hashtags, shorts, youtube shorts");
    expect(suggestedTags("")).toBe("shorts, youtube shorts");
  });

  const idea = {
    caption: "Your website is losing visitors every day. Fix it in 10 minutes! #SEO #SmallBusiness #marketingtips",
    title: "3 SEO mistakes killing your traffic",
    hook: "Your website is losing visitors right now",
    points: ["Slow pages lose visitors", "No meta descriptions", "Broken links on your website"],
    brand: "RepGet",
    topics: "content marketing, local SEO\nGoogle rankings",
  };

  it("are richer from the idea, the brand and the topics: 10 to 15, the post's hashtags and the brand first", () => {
    const tags = parseTags(suggestedTags(idea));
    expect(tags.length).toBeGreaterThanOrEqual(10);
    expect(tags.length).toBeLessThanOrEqual(15);
    expect(tags.slice(0, 4)).toEqual(["SEO", "Small Business", "marketingtips", "RepGet"]);
    expect(tags).toEqual(expect.arrayContaining(["content marketing", "local SEO", "Google rankings", "website", "visitors", "shorts", "youtube shorts"]));
    // The words used most (the title's counting most) first; one said once in a scene is left out past 15.
    expect(tags.indexOf("visitors")).toBeLessThan(tags.indexOf("mistakes"));
    expect(tags).not.toContain("broken");
    expect(tags.at(-1)).toBe("youtube shorts");
  });

  it("are each sensible: 2 to 30 characters, never only small words, never twice, within 500 characters", () => {
    const tags = parseTags(suggestedTags({ ...idea, title: "This is the title that is far too long to be one tag", topics: "a, the and, of it, x".repeat(3) }));
    for (const tag of tags) {
      expect([...tag].length, tag).toBeGreaterThanOrEqual(2);
      expect([...tag].length, tag).toBeLessThanOrEqual(30);
    }
    expect(tags).not.toContain("This is the title that is far too long to be one tag");
    expect(tags.map((tag) => tag.toLowerCase())).not.toEqual(expect.arrayContaining(["the", "the and", "of it", "your", "is", "x"]));
    expect(new Set(tags.map((tag) => tag.toLowerCase())).size).toBe(tags.length);
    expect(sensibleTag("the and")).toBe(false);
    expect(sensibleTag("x")).toBe(false);
    expect(sensibleTag("123")).toBe(false);
    expect(sensibleTag("AI")).toBe(true);
    expect(sensibleTag("y".repeat(31))).toBe(false);

    const long = { caption: Array.from({ length: 40 }, (_, i) => `#${"k".repeat(25)}${i}`).join(" ") };
    const fitted = suggestedTags(long);
    expect(tagsLength(parseTags(fitted))).toBeLessThanOrEqual(YOUTUBE_TAGS_MAX);
    expect(parseTags(fitted).length).toBeLessThanOrEqual(15);
  });

  it("keep the post's language and its names as written", () => {
    const tags = parseTags(
      suggestedTags({
        caption: "¿Tu página web no aparece en Google? #MarketingDigital",
        title: "Los errores de SEO más comunes",
        hook: "Tu web pierde clientes cada día",
        brand: "Café Lumière",
      }),
    );
    expect(tags.slice(0, 2)).toEqual(["Marketing Digital", "Café Lumière"]);
    expect(tags).toEqual(expect.arrayContaining(["Los errores de SEO más comunes", "errores", "SEO", "comunes", "clientes", "página"]));
    expect(tags.map((tag) => tag.toLowerCase())).not.toEqual(expect.arrayContaining(["los", "de", "más", "tu", "en", "cada"]));
    // French and English apostrophes: the word, not its article or its "'s".
    expect(parseTags(suggestedTags({ caption: "L'automne arrive, et Google's update don't wait" }))).toEqual(["automne", "arrive", "Google", "update", "wait", "shorts", "youtube shorts"]);
  });

  it("never change saved tags: the suggestion is only offered when none were saved", () => {
    expect(readTags({ youtubeTags: "mine" })).toBe("mine");
    expect(readTags({ youtubeTags: "" })).toBe("");
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
