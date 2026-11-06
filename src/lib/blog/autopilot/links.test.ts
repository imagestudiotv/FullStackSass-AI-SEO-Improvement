import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanBlogPost } from "@/lib/blog/post-fields";

import { checkLinks, removeAddedLinks, removeExternalLinks } from "./links";

/**
 * No automatic outbound links in RepGet's own blog (client, 2026-11-05): what
 * the writer or a translator generated loses its links to other websites,
 * keeping the words. RepGet's own links, pictures and fragments stay, and so
 * does anything a person adds when saving a post.
 */

const SITE = { siteOrigin: "https://www.repget.com", siteHosts: new Set(["www.repget.com", "repget.com"]) };
const RULES = { ...SITE, internalPaths: new Set(["/audit", "/blog/local-seo", "/"]) };

const checked = (html: string) => checkLinks([html], RULES);

describe("the writer's check", () => {
  it.each([
    ["full address with www", "https://www.repget.com/audit"],
    ["full address without www", "https://repget.com/audit"],
    ["upper case host", "https://WWW.REPGET.COM/audit"],
    ["http", "http://www.repget.com/audit"],
    ["protocol-relative with www", "//www.repget.com/audit"],
    ["protocol-relative without www", "//repget.com/audit/"],
    ["site path", "/audit"],
    ["padded with spaces", "  https://www.repget.com/audit  "],
  ])("keeps a link to one of RepGet's pages: %s", (_name, href) => {
    const result = checked(`<p><a href="${href}">the audit</a></p>`);
    expect(result.html[0]).toBe('<p><a href="https://www.repget.com/audit">the audit</a></p>');
    expect(result.kept.internal).toBe(1);
    expect(result.removed).toEqual([]);
  });

  it.each([
    ["another site", "https://ahrefs.com/blog/local-seo/"],
    ["official documentation", "https://developers.google.com/search/docs"],
    ["protocol-relative", "//example.com/page"],
    ["a look-alike host", "https://repget.com.evil.example/audit"],
    ["a host with RepGet in front of an @", "https://www.repget.com@evil.example/audit"],
    ["a subdomain of RepGet's that is not the site", "https://blog.repget.com/audit"],
    ["backslashes", "https:\\\\evil.example\\audit"],
  ])("removes a link to another website, keeping its words: %s", (_name, href) => {
    const result = checked(`<p>Read <a href="${href}">this <em>guide</em></a> now.</p>`);
    expect(result.html[0]).toBe("<p>Read this <em>guide</em> now.</p>");
    expect(result.removed).toEqual([{ href, text: "this guide", reason: "a link to another website" }]);
  });

  it.each(["mailto:someone@example.com", "tel:+390000000", "javascript:alert(1)"])("removes what is not a web address: %s", (href) => {
    const result = checked(`<p><a href="${href}">words</a></p>`);
    expect(result.html[0]).toBe("<p>words</p>");
    expect(result.removed[0].reason).toBe("not a web address");
  });

  it("removes a RepGet page the writer was not given, an empty address and a bare #", () => {
    const result = checked('<p><a href="https://www.repget.com/secret">a</a> <a href="">b</a> <a href="#">c</a> <a>d</a></p>');
    expect(result.html[0]).toBe("<p>a b c d</p>");
  });

  it("keeps a place in the article, and the fragment of a RepGet page", () => {
    const result = checked('<p><a href="#worked-example">below</a> <a href="https://repget.com/blog/local-seo/#maps">maps</a></p>');
    expect(result.html[0]).toBe('<p><a href="#worked-example">below</a> <a href="https://www.repget.com/blog/local-seo#maps">maps</a></p>');
    expect(result.kept).toEqual({ internal: 1, fragments: 1 });
  });

  it("never touches a picture, wherever it is stored, even inside a removed link", () => {
    const img = '<img src="https://storage.example/blog/en/1.webp" srcset="https://cdn.example/1.webp 1x" alt="A diagram" width="1536" height="1024">';
    const result = checked(`<p>${img}</p><p><a href="https://example.com/x">${img}</a></p>`);
    expect(result.html[0]).toBe(`<p>${img}</p><p>${img}</p>`);
    expect(result.removed).toHaveLength(1);
  });

  it("checks the body and each FAQ answer, in order", () => {
    const result = checkLinks(['<p><a href="https://example.com">a</a></p>', '<p><a href="/audit">b</a></p>', '<p><a href="//example.org">c</a></p>'], RULES);
    expect(result.html).toEqual(["<p>a</p>", '<p><a href="https://www.repget.com/audit">b</a></p>', "<p>c</p>"]);
  });
});

describe("a translation's last check", () => {
  it("keeps any RepGet page in any language, in the form it is written, and removes other websites", () => {
    const html =
      '<p><a href="https://www.repget.com/it/audit">audit</a> <a href="//repget.com/it/blog/guida#mappe">guida</a> <a href="#sotto">sotto</a> <a href="https://example.com/x">fonte</a> <a href="//example.org">altra</a></p><img src="https://storage.example/it/1.webp" alt="Diagramma">';
    const result = removeExternalLinks(html, SITE);
    expect(result.html).toBe(
      '<p><a href="https://www.repget.com/it/audit">audit</a> <a href="//repget.com/it/blog/guida#mappe">guida</a> <a href="#sotto">sotto</a> fonte altra</p><img src="https://storage.example/it/1.webp" alt="Diagramma">',
    );
    expect(result.removed.map((link) => link.href)).toEqual(["https://example.com/x", "//example.org"]);
  });

  it("returns HTML with nothing to remove exactly as it was", () => {
    const html = '<p>Testo &amp; <a href="/it/audit">audit</a></p>';
    expect(removeExternalLinks(html, SITE)).toEqual({ html, removed: [] });
    expect(removeExternalLinks("<p>Testo</p>", SITE)).toEqual({ html: "<p>Testo</p>", removed: [] });
  });
});

describe("the editor's Draft with AI", () => {
  it("keeps the links a person put in the English post and removes the ones the translator added", () => {
    const original = '<p>A <a href="https://partner.example/page">sponsor</a> and <a href="https://developers.google.com/search">docs</a>.</p>';
    const translated = '<p>Uno <a href="https://partner.example/page">sponsor</a>, <a href="https://developers.google.com/search">documenti</a> e <a href="https://invented.example">altro</a>.</p>';
    const result = removeAddedLinks(translated, [original], SITE);
    expect(result.html).toBe('<p>Uno <a href="https://partner.example/page">sponsor</a>, <a href="https://developers.google.com/search">documenti</a> e altro.</p>');
    expect(result.removed.map((link) => link.href)).toEqual(["https://invented.example"]);
  });
});

describe("a person's mailto: and tel: links, in the editor's Draft with AI", () => {
  const ORIGINAL = '<p><a href="mailto:press@example.com">Write</a> or <a href="tel:+390000000">call</a>.</p>';

  it("stay in the translation", () => {
    const translated = '<p><a href="mailto:press@example.com">Scriva</a> o <a href="tel:+390000000">chiami</a>.</p>';
    expect(removeAddedLinks(translated, [ORIGINAL], SITE)).toEqual({ html: translated, removed: [] });
  });

  it("are not a licence: one the translator added goes, keeping its words", () => {
    const translated = '<p><a href="mailto:press@example.com">Scriva</a>, <a href="mailto:added@example.com">altro</a>, <a href="tel:+391111111">numero</a>, <a href="javascript:alert(1)">qui</a>.</p>';
    const result = removeAddedLinks(translated, [ORIGINAL], SITE);
    expect(result.html).toBe('<p><a href="mailto:press@example.com">Scriva</a>, altro, numero, qui.</p>');
    expect(result.removed.map((link) => link.href)).toEqual(["mailto:added@example.com", "tel:+391111111", "javascript:alert(1)"]);
  });
});

describe("generated autopilot articles", () => {
  it.each(["mailto:someone@example.com", "tel:+390000000"])("keep no %s link, in the writer's check or a translation's last check", (href) => {
    const html = `<p><a href="${href}">words</a></p>`;
    expect(checked(html).html[0]).toBe("<p>words</p>");
    expect(removeExternalLinks(html, SITE).html).toBe("<p>words</p>");
  });
});

describe("what a person saves", () => {
  it("is not stripped: a manual or sponsored link in a post saved later survives the save", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    const fields = cleanBlogPost(
      {
        title: "A post edited by hand",
        slug: "edited-by-hand",
        description: "A description.",
        seoTitle: "",
        primaryKeyword: "",
        secondaryKeywords: [],
        breadcrumbLabel: "",
        category: "Guides",
        author: "RepGet team",
        shortAnswer: "",
        bodyHtml: '<p>Sponsored by <a href="https://sponsor.example/page">Sponsor</a>. <img src="https://storage.example/1.webp" alt="A picture"></p>',
        faqs: [{ question: "Where?", answer: '<p><a href="https://manual.example">Here</a>.</p>' }],
        sources: [],
      },
      false,
    );
    expect(fields.bodyHtml).toContain("https://sponsor.example/page");
    expect(fields.bodyHtml).toContain('src="https://storage.example/1.webp"');
    expect(fields.faqs[0].answer).toContain("https://manual.example");
    vi.unstubAllEnvs();
  });
});
