import { describe, expect, it } from "vitest";

import { siteScope } from "./link-guard";
import { unwrapOutsideLinks } from "./outside-links";
import { sanitizeHtml } from "./sanitize";

/**
 * No links to other websites in a client article (Daniel, 2026-11-26), on
 * its own: deterministic, no network, no database.
 */

const scope = siteScope({ url: "https://imagestudio.com", domain: "imagestudio.com" });
const run = (html: string, keep: string[] = [], articleUrl?: string) => unwrapOutsideLinks(html, { scope, keep, articleUrl });

describe("links to other websites", () => {
  it("unwraps the reported research link, keeping its words and formatting", () => {
    // What Daniel deleted by hand in Admin -> Partner Network -> Review.
    const html = sanitizeHtml(
      "<p>Deus Marketing's editorial playbook (updated April 2026) makes a similar point in different terms. " +
        '<a href="https://deusmarketing.example/playbook"><em>Mass-market content marketing optimises for traffic</em>, luxury content marketing optimises for perception</a>, and that changes everything.</p>',
    );
    expect(html).toContain('target="_blank" rel="noopener nofollow"');
    const result = run(html);
    expect(result.changed).toBe(true);
    expect(result.html).toBe(
      "<p>Deus Marketing's editorial playbook (updated April 2026) makes a similar point in different terms. " +
        "<em>Mass-market content marketing optimises for traffic</em>, luxury content marketing optimises for perception, and that changes everything.</p>",
    );
    expect(result.removed).toEqual([
      {
        href: "https://deusmarketing.example/playbook",
        text: "Mass-market content marketing optimises for traffic, luxury content marketing optimises for perception",
      },
    ]);
  });

  it("treats another subdomain, a protocol-relative link and plain http as other websites", () => {
    const html =
      '<p><a href="https://shop.imagestudio.com/">shop</a> <a href="//competitor.example/x">rival</a> ' +
      '<a href="http://en.wikipedia.org/wiki/Photography">wiki</a> <a href="HTTPS://OTHER.EXAMPLE/A">loud</a></p>';
    expect(run(html).html).toBe("<p>shop rival wiki loud</p>");
  });

  it("unwraps every outside link in lists, tables and headings", () => {
    const html = '<h2><a href="https://a.example/">A</a></h2><ul><li><a href="https://b.example/">B</a></li></ul><table><tbody><tr><td><a href="https://c.example/">C</a></td></tr></tbody></table>';
    expect(run(html).html).toBe("<h2>A</h2><ul><li>B</li></ul><table><tbody><tr><td>C</td></tr></tbody></table>");
  });
});

describe("what stays", () => {
  it("keeps the site's own links: absolute, www twin, relative and document-relative", () => {
    const html =
      '<p><a href="https://imagestudio.com/services/">services</a> <a href="https://www.imagestudio.com/about">about</a> ' +
      '<a href="/contact/">contact</a> <a href="prices">prices</a> <a href="?p=11180">story</a></p>';
    const result = run(html, [], "https://imagestudio.com/blog/guide/");
    expect(result.changed).toBe(false);
    expect(result.html).toBe(html);
  });

  it("leaves #sections, mailto:, tel: and anchors without an href untouched", () => {
    const html = '<p><a href="#pricing">Pricing</a> <a href="mailto:hello@imagestudio.com">email</a> <a href="tel:+390000">call</a> <a>bare</a></p>';
    expect(run(html)).toEqual({ html, changed: false, removed: [] });
  });

  it("keeps the Partner Network placement and the social profiles, exactly", () => {
    const html = sanitizeHtml(
      '<p><a href="https://partner.test/wedding-films/">wedding films</a>, ' +
        '<a href="https://instagram.com/imagestudio">Instagram</a> and <a href="https://source.example/">a source</a>.</p>',
    );
    const result = run(html, ["https://partner.test/wedding-films/", "https://instagram.com/imagestudio"]);
    expect(result.html).toContain('<a href="https://partner.test/wedding-films/" target="_blank" rel="noopener nofollow">wedding films</a>');
    expect(result.html).toContain('<a href="https://instagram.com/imagestudio" target="_blank" rel="noopener nofollow">Instagram</a>');
    expect(result.html).toContain("and a source.");
    expect(result.removed.map((link) => link.href)).toEqual(["https://source.example/"]);
  });

  it("recognises a placement written in another form and puts back its exact address", () => {
    const html = '<p>See <a href="http://www.partner.test/wedding-films">wedding films</a>.</p>';
    const result = run(html, ["https://partner.test/wedding-films/"]);
    expect(result.html).toContain('href="https://partner.test/wedding-films/"');
    expect(result.removed).toEqual([]);
  });

  it("does not keep a different page of the placement's website", () => {
    const html = '<p><a href="https://partner.test/pricing/">pricing</a></p>';
    expect(run(html, ["https://partner.test/wedding-films/"]).html).toBe("<p>pricing</p>");
  });

  it("ignores empty keep entries and changes nothing a second time", () => {
    const html = '<p><a href="https://source.example/">a source</a> and <a href="/x">x</a></p>';
    const once = unwrapOutsideLinks(html, { scope, keep: [null, undefined, ""] });
    expect(once.html).toBe('<p>a source and <a href="/x">x</a></p>');
    expect(run(once.html)).toEqual({ html: once.html, changed: false, removed: [] });
  });
});
