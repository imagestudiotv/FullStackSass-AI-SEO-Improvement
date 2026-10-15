import { describe, expect, it } from "vitest";

import { categoryAlternates } from "@/lib/blog/locale";
import { categoryText, hasText, plainText, readingMinutes } from "@/lib/blog/shared";

/**
 * FAQ answers are written in a rich text editor (2026-10-04), so they arrive
 * as HTML: an emptied editor still holds markup, and structured data needs
 * the words without it.
 */
describe("hasText: an answer with words, not the markup an emptied editor leaves", () => {
  it("markup with no words in it is blank", () => {
    for (const blank of ["", "   ", "<p></p>", "<p> </p>", "<p><br></p>", "<p><br /></p>", "<ul><li></li></ul>", "<ul><li><p></p></li></ul>", "<p>&nbsp;</p>", "<p><strong> </strong></p>"]) {
      expect(hasText(blank), blank).toBe(false);
    }
  });

  it("a word in any tag is text", () => {
    for (const written of ["<p>x</p>", "x", "<ul><li><p>a</p></li></ul>", "<p><a href=\"https://example.com\">here</a></p>", "<p>&amp;</p>"]) {
      expect(hasText(written), written).toBe(true);
    }
  });
});

describe("plainText: the words of an answer, for structured data", () => {
  it("puts each list item and paragraph on its own line, instead of gluing them together", () => {
    expect(plainText("<p>It depends:</p><ul><li><p>a</p></li><li><p>b</p></li></ul><p>Then c.</p>")).toBe("It depends:\na\nb\nThen c.");
    expect(plainText("<ol><li>one</li><li>two</li></ol>")).toBe("one\ntwo");
    expect(plainText("<p>line one<br>line two</p>")).toBe("line one\nline two");
  });

  it("drops inline tags without splitting the words they sit in", () => {
    expect(plainText('<p>An <strong>un</strong><em>usual</em> <a href="https://example.com/a?b=1&amp;c=2" target="_blank">link</a>.</p>')).toBe(
      "An unusual link.",
    );
  });

  it("decodes character references, once", () => {
    expect(plainText("<p>Tom &amp; Jerry&#39;s &quot;show&quot;&nbsp;&nbsp;now</p>")).toBe("Tom & Jerry's \"show\" now");
    expect(plainText("<p>&lt;p&gt; is a tag; &amp;lt; is not decoded twice</p>")).toBe("<p> is a tag; &lt; is not decoded twice");
    expect(plainText("<p>caf&#xE9; &rsquo;quoted&rsquo; &hellip;</p>")).toBe("café ’quoted’ …");
    // Unknown names stay as written; an impossible number reads as nothing.
    expect(plainText("<p>&madeup; &#0;x &#x110000;y</p>")).toBe("&madeup; x y");
  });

  it("collapses the source's own line breaks and spaces", () => {
    expect(plainText("<p>one\n   two</p>\n\n<p>  three </p>")).toBe("one two\nthree");
  });

  it("is not fooled by a > inside an attribute", () => {
    expect(plainText('<p><a href="https://example.com" title="a > b">words</a></p>')).toBe("words");
  });
});

describe("readingMinutes", () => {
  it("counts list items as separate words (tags become spaces, not glue)", () => {
    const words = Array.from({ length: 200 }, (_, i) => `<li>w${i}</li>`).join("");
    expect(readingMinutes({ body: `<ul>${words}</ul>`, shortAnswer: undefined, faqs: [] })).toBe(1);
    expect(readingMinutes({ body: `<ul>${words}${words}${words}</ul>`, shortAnswer: undefined, faqs: [] })).toBe(3);
  });
});

/**
 * A category's name and description on another language's blog (client,
 * 2026-10-15). Admin -> Blog keeps a language given only a description with a
 * blank name (lib/admin/blog.ts cleanCategory), so a blank field reads as the
 * English one, field by field - never as an empty chip, heading or title.
 */
describe("categoryText: a category's words in a language", () => {
  const english = { name: "Field notes", blurb: "What we learned on real websites." };
  const category = {
    ...english,
    translations: {
      it: { name: "Note dal campo", blurb: "Cosa abbiamo imparato sui siti veri." },
      fr: { name: "", blurb: "Ce que nous avons appris sur de vrais sites." },
      de: { name: "Feldnotizen", blurb: "" },
      es: { name: "   ", blurb: " " },
    },
  };

  it("is the translation where there is one", () => {
    expect(categoryText(category, "it")).toEqual({ name: "Note dal campo", blurb: "Cosa abbiamo imparato sui siti veri." });
  });

  it("takes the English for each field left blank or spaces only", () => {
    expect(categoryText(category, "fr")).toEqual({ name: "Field notes", blurb: "Ce que nous avons appris sur de vrais sites." });
    expect(categoryText(category, "de")).toEqual({ name: "Feldnotizen", blurb: english.blurb });
    expect(categoryText(category, "es")).toEqual(english);
  });

  it("is the English in English, without translations, and in a language the blog does not have", () => {
    expect(categoryText(category, "en")).toEqual(english);
    expect(categoryText(category)).toEqual(english);
    expect(categoryText(english, "it")).toEqual(english);
    expect(categoryText(category, "pt")).toEqual(english);
  });
});

/** hreflang for a category's pages (lib/blog/locale.ts): the languages with posts in it. */
describe("categoryAlternates", () => {
  it("is nothing under two languages", () => {
    expect(categoryAlternates("guides", [])).toBeUndefined();
    expect(categoryAlternates("guides", ["en"])).toBeUndefined();
    expect(categoryAlternates("guides", ["it"])).toBeUndefined();
  });

  it("lists every language's page, and x-default is the English one", () => {
    expect(categoryAlternates("guides", ["en", "it"])).toEqual({
      en: "/blog/category/guides",
      it: "/it/blog/category/guides",
      "x-default": "/blog/category/guides",
    });
  });

  it("without English, x-default is the first language's page", () => {
    expect(categoryAlternates("guides", ["it", "de"])).toEqual({
      it: "/it/blog/category/guides",
      de: "/de/blog/category/guides",
      "x-default": "/it/blog/category/guides",
    });
  });
});
