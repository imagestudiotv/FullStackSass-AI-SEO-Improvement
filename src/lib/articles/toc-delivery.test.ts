import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { poweredByHtml, prepareForDelivery } from "./delivery";
import { guardLinks, siteScope } from "./link-guard";
import { sanitizeHtml } from "./sanitize";
import { applyTableOfContents, repairSectionLinks } from "./toc";

const scope = siteScope({ url: "https://imagestudio.com", domain: "imagestudio.com" });

/** Every "#x" link in the HTML points at an element that has id="x". */
function fragmentsResolve(html: string): boolean {
  const $ = cheerio.load(html, null, false);
  const ids = $("[id]").toArray().map((el) => $(el).attr("id"));
  return $('a[href^="#"]')
    .toArray()
    .every((a) => ids.includes(($(a).attr("href") ?? "").slice(1)));
}

function duplicateIds(html: string): string[] {
  const $ = cheerio.load(html, null, false);
  const ids = $("[id]").toArray().map((el) => $(el).attr("id") as string);
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

const ARTICLE =
  "<p>Intro paragraph.</p>" +
  "<h2>Choosing a venue</h2><p>a</p>" +
  "<h3>Indoor options</h3><p>b</p>" +
  "<h2>Choosing a venue</h2><p>c</p>" +
  '<h2 id="1bad">Costs &amp; budget</h2><p>d</p>';

describe("the table of contents", () => {
  it("links every entry to a real, unique heading id, after the introduction", () => {
    const html = applyTableOfContents(ARTICLE, { enabled: true, language: "en" });
    expect(fragmentsResolve(html)).toBe(true);
    expect(duplicateIds(html)).toEqual([]);
    expect(html.startsWith("<p>Intro paragraph.</p><p><strong>Contents</strong></p><ul>")).toBe(true);
    // Duplicate headings get distinct ids; an unsafe id is replaced.
    expect(html).toContain('<li><a href="#choosing-a-venue">Choosing a venue</a></li>');
    expect(html).toContain('<li><a href="#choosing-a-venue-2">Choosing a venue</a></li>');
    expect(html).toContain('<li><a href="#costs-budget">Costs &amp; budget</a></li>');
    // Only main headings are listed.
    expect(html).not.toContain('href="#indoor-options"');
  });

  it("replaces a contents list the writer made instead of adding a second one", () => {
    const written =
      '<ul><li><a href="#nowhere">Nowhere</a></li><li><a href="#also-nowhere">Also nowhere</a></li></ul>' + ARTICLE;
    const html = applyTableOfContents(written, { enabled: true, language: "Italian" });
    expect(html).not.toContain("#nowhere");
    expect(html.match(/<ul>/g)).toHaveLength(1);
    expect(html).toContain("<strong>Indice</strong>");
    expect(fragmentsResolve(html)).toBe(true);
  });

  it("is idempotent", () => {
    const once = applyTableOfContents(ARTICLE, { enabled: true });
    expect(applyTableOfContents(once, { enabled: true })).toBe(once);
  });

  it("with the setting off: no list, and a writer's list is removed, but ids still unique", () => {
    const written = '<p><strong>Contents</strong></p><ul><li><a href="#x">X</a></li></ul>' + ARTICLE;
    const html = applyTableOfContents(written, { enabled: false });
    expect(html).not.toContain("<ul>");
    expect(html).not.toContain("Contents");
    expect(duplicateIds(html)).toEqual([]);
  });

  it("skips a list for an article with fewer than two sections", () => {
    expect(applyTableOfContents("<p>a</p><h2>Only one</h2><p>b</p>", { enabled: true })).not.toContain("<ul>");
  });

  it("keeps heading ids through the sanitizer, and the link checks keep the list", () => {
    const html = applyTableOfContents(ARTICLE, { enabled: true });
    expect(sanitizeHtml(html)).toBe(html);
    const guarded = guardLinks(html, { scope, mode: "generated", verdicts: new Map(), maxAutoLinks: 0 });
    expect(guarded.changed).toBe(false);
  });

  it("repairs section links after an edit dropped the ids, pointing them at the same heading", () => {
    const edited = '<ul><li><a href="#choosing-a-venue">Choosing a venue</a></li></ul><h2>Choosing a venue</h2><p>x</p>';
    const repaired = repairSectionLinks(edited);
    expect(fragmentsResolve(repaired)).toBe(true);
    expect(repairSectionLinks(repaired)).toBe(repaired);
  });
});

describe("the Powered by RepGet line", () => {
  const body = '<p>Text with <a href="https://imagestudio.com/wedding/">a link</a>.</p><p><img src="https://cdn.test/a.jpg" alt="A" /></p>';

  it("is added exactly once when the setting is on, at the end, linking to RepGet's public site", () => {
    const out = prepareForDelivery(body, { poweredBy: true, siteHosts: scope.hosts });
    expect(out.match(/Powered by/g)).toHaveLength(1);
    expect(out.endsWith(poweredByHtml())).toBe(true);
    expect(poweredByHtml()).toMatch(/^<p><small>Powered by <a href="https:\/\/[^"]+\/" target="_blank" rel="noopener nofollow">RepGet<\/a><\/small><\/p>$/);
  });

  it("is never added twice - reprocessing and retries change nothing", () => {
    const once = prepareForDelivery(body, { poweredBy: true, siteHosts: scope.hosts });
    expect(prepareForDelivery(once, { poweredBy: true, siteHosts: scope.hosts })).toBe(once);
    // A copy pasted into the body (any URL) is replaced, not doubled.
    const pasted = `${body}<p>Powered by <a href="https://old.example.org/">RepGet</a></p>`;
    expect(prepareForDelivery(pasted, { poweredBy: true }).match(/Powered by/g)).toHaveLength(1);
  });

  it("is absent when the setting is off - even one pasted into the article", () => {
    const pasted = `${body}<p>Powered by <a href="https://old.example.org/">RepGet</a></p>`;
    expect(prepareForDelivery(pasted, { poweredBy: false })).not.toMatch(/Powered by/i);
  });

  it("survives the link checks as an ordinary external link, and is not an internal link", () => {
    const out = prepareForDelivery(body, { poweredBy: true, siteHosts: scope.hosts });
    const guarded = guardLinks(out, { scope, mode: "existing", verdicts: new Map() });
    expect(guarded.html).toContain("Powered by");
    expect(guarded.findings.filter((f) => f.href.includes("RepGet") || f.text === "RepGet")).toEqual([]);
  });

  it("makes images fit the article column without touching the theme", () => {
    const out = prepareForDelivery(body, { poweredBy: false });
    expect(out).toContain('style="max-width:100%;height:auto"');
    expect(out).toContain('loading="lazy"');
  });
});
