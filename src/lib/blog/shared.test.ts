import { describe, expect, it } from "vitest";

import { hasText, plainText, readingMinutes } from "@/lib/blog/shared";

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
