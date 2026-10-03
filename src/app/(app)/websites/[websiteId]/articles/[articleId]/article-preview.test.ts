import { describe, expect, it } from "vitest";

import { previewHtml } from "@/lib/articles/use-draft";
import { getMessages } from "@/lib/i18n/messages";

import { resolveSiteLinks } from "./article-preview";
import { imageSizeErrorText } from "./failure-copy";

const ORIGIN = "https://example.com";

/** What Preview renders for this stored HTML. */
function preview(html: string, origin: string | null = ORIGIN): string {
  return resolveSiteLinks(previewHtml(html), origin);
}

describe("links in Preview", () => {
  it("sends a link written as a path to the customer's site, in a new tab, not into this app", () => {
    expect(preview('<p><a href="/services/weddings">Our films</a></p>')).toBe(
      '<p><a href="https://example.com/services/weddings" target="_blank" rel="noopener">Our films</a></p>',
    );
  });

  it("keeps a link's other attributes, whatever their order", () => {
    const html = preview('<p><a title="Prices > all" href="/pricing?x=1&amp;y=2">Prices</a></p>');
    expect(html).toContain('href="https://example.com/pricing?x=1&amp;y=2"');
    expect(html).toContain('title="Prices > all"');
    expect(html).toContain(">Prices</a>");
  });

  it("leaves contents links on the page, so they still jump to the heading", () => {
    const html = preview('<ul><li><a href="#intro">Intro</a></li></ul><h2 id="intro">Intro</h2>');
    expect(html).toContain('<a href="#intro">Intro</a>');
    expect(html).toContain('<h2 id="intro">');
  });

  it("leaves absolute links exactly as they are, so a partner link keeps its highlight (matched by exact address)", () => {
    const partner = '<p><a href="https://partner.example.org/page?ref=1">partner</a></p>';
    expect(preview(partner)).toBe(previewHtml(partner));
    expect(preview(partner)).toContain('href="https://partner.example.org/page?ref=1"');
    // Protocol-relative addresses already leave this app.
    expect(preview('<p><a href="//cdn.example.org/x">x</a></p>')).toContain('href="//cdn.example.org/x"');
  });

  it("changes nothing when the website has no usable address", () => {
    const html = '<p><a href="/services">x</a></p>';
    expect(preview(html, null)).toBe(previewHtml(html));
  });
});

describe("the upload size message", () => {
  it("writes the sizes in the reader's convention", () => {
    const de = getMessages("de").app.editor;
    const en = getMessages("en").app.editor;
    const size = 9.4 * 1024 * 1024;
    const max = 8 * 1024 * 1024;
    expect(imageSizeErrorText(size, max, "de", de)).toContain("9,4");
    expect(imageSizeErrorText(size, max, "en", en)).toBe("That image is 9.4 MB. The limit is 8 MB.");
  });
});
