import { describe, expect, it } from "vitest";

import { anchorPhrases, guardLinks, internalLinkKeys, readHref, siteScope, type LinkVerdict } from "./link-guard";
import { sanitizeHtml } from "./sanitize";

/**
 * The HTML pass on its own: deterministic, no network, no database. The
 * verdicts stand in for what link-verify.ts would have found.
 */

const scope = siteScope({ url: "https://imagestudio.com", domain: "imagestudio.com" });

function verdict(url: string, status: LinkVerdict["status"], extra: Partial<LinkVerdict> = {}): [string, LinkVerdict] {
  return [
    url,
    {
      url,
      status,
      finalUrl: status === "ok" ? url : null,
      httpStatus: status === "ok" ? 200 : status === "missing" ? 404 : null,
      reason: status === "missing" ? "the page does not exist (404)" : status,
      title: null,
      isHtml: true,
      checkedAt: new Date(0).toISOString(),
      ...extra,
    },
  ];
}

const WEDDING = "https://imagestudio.com/destination-wedding-photography-films";
const SERVICES = "https://imagestudio.com/services/";

describe("the reported links", () => {
  it('unwraps href="#" (WordPress post 11186) and keeps the words and formatting', () => {
    const html = '<p>Book a <a href="#">consultation with <strong>our team</strong></a> today.</p>';
    const result = guardLinks(html, { scope, mode: "existing", verdicts: new Map() });

    expect(result.html).toBe("<p>Book a consultation with <strong>our team</strong> today.</p>");
    expect(result.findings).toMatchObject([{ href: "#", outcome: "unwrapped", reason: /placeholder/ }]);
  });

  it("unwraps /destination-wedding-photography-films (post 11180) once the site answers 404, resolving it on the CLIENT's site", () => {
    const html = '<p>See our <a href="/destination-wedding-photography-films">destination wedding films</a>.</p>';
    expect(internalLinkKeys(html, scope)).toEqual([WEDDING]);

    const result = guardLinks(html, { scope, mode: "existing", verdicts: new Map([verdict(WEDDING, "missing")]) });
    expect(result.html).toBe("<p>See our destination wedding films.</p>");
    expect(result.findings[0]).toMatchObject({ url: WEDDING, outcome: "unwrapped", verdict: "missing" });
  });

  it("does not treat a relative link as invalid just because it is relative", () => {
    const html = '<p>Our <a href="/services/">photography services</a>.</p>';
    const result = guardLinks(html, { scope, mode: "existing", verdicts: new Map([verdict(SERVICES, "ok")]) });
    // Verified, so kept - made absolute on the customer's site.
    expect(result.html).toBe(`<p>Our <a href="${SERVICES}">photography services</a>.</p>`);
    expect(result.findings[0]).toMatchObject({ outcome: "rewritten", replacement: SERVICES });
  });
});

describe("reading an href", () => {
  it.each([
    ["", "placeholder"],
    ["#", "placeholder"],
    ["#!", "placeholder"],
    ["javascript:void(0)", "placeholder"],
    ["[LINK]", "placeholder"],
    ["{{url}}", "placeholder"],
    ["https://example.com/page", "placeholder"],
    ["https://yourwebsite.com/contact", "placeholder"],
    ["#pricing", "fragment"],
    ["mailto:hello@imagestudio.com", "special"],
    ["tel:+390000000", "special"],
    ["ftp://imagestudio.com/file", "invalid"],
    ["https://en.wikipedia.org/wiki/Photography", "external"],
    ["https://shop.imagestudio.com/", "external"],
    ["/about", "internal"],
    ["https://www.imagestudio.com/about", "internal"],
  ])("%s is %s", (href, kind) => {
    expect(readHref(href, scope).kind).toBe(kind);
  });

  it("resolves against the client's site, never this application", () => {
    const href = readHref("/about?ref=blog#team", scope);
    expect(href).toEqual({ kind: "internal", key: "https://imagestudio.com/about?ref=blog", fragment: "#team" });
  });

  it("resolves a document-relative link against the article's own public page when known", () => {
    const href = readHref("prices", scope, "https://imagestudio.com/blog/wedding-guide/");
    expect(href).toMatchObject({ kind: "internal", key: "https://imagestudio.com/blog/wedding-guide/prices" });
  });
});

describe("real WordPress addresses survive untouched", () => {
  it("keeps a query-string permalink exactly, query included", () => {
    const url = "https://imagestudio.com/?p=11180";
    const html = `<p>Read <a href="${url}">the wedding story</a>.</p>`;
    expect(internalLinkKeys(html, scope)).toEqual([url]);
    const result = guardLinks(html, { scope, mode: "existing", verdicts: new Map([verdict(url, "ok")]) });
    expect(result.changed).toBe(false);
    expect(result.html).toBe(html);
  });

  it("keeps a multilingual path and its encoded characters", () => {
    const url = "https://imagestudio.com/it/servizi/fotografia-matrimonio-citt%C3%A0/";
    const html = `<p>Vedi <a href="${url}">i nostri servizi</a>.</p>`;
    const result = guardLinks(html, { scope, mode: "existing", verdicts: new Map([verdict(url, "ok")]) });
    expect(result.html).toBe(html);
  });

  it("points a moved page at where it moved, without a fragment that may not exist there", () => {
    const moved = "https://imagestudio.com/wedding-films/";
    const html = `<p>Our <a href="${WEDDING}#prices">wedding films</a>.</p>`;
    const result = guardLinks(html, {
      scope,
      mode: "existing",
      verdicts: new Map([verdict(WEDDING, "ok", { finalUrl: moved, reason: "redirected to a related page" })]),
    });
    expect(result.html).toBe(`<p>Our <a href="${moved}">wedding films</a>.</p>`);
  });
});

describe("section links and the contents list", () => {
  it("keeps #fragment only when the id exists after sanitizing", () => {
    const html = sanitizeHtml(
      '<ul><li><a href="#pricing">Pricing</a></li><li><a href="#faq">Questions</a></li></ul>' +
        '<h2 id="pricing">Pricing</h2><p>x</p><h2>Something else</h2><p>y</p>',
    );
    // The sanitizer keeps the heading id now, so the link has a target.
    expect(html).toContain('<h2 id="pricing">');

    const result = guardLinks(html, { scope, mode: "generated", verdicts: new Map() });
    expect(result.html).toContain('<a href="#pricing">Pricing</a>');
    expect(result.html).toContain("<li>Questions</li>");
    expect(result.findings).toMatchObject([{ href: "#faq", outcome: "unwrapped", reason: /no matching heading/ }]);
  });

  it("points a contents entry at the heading with the same text when its id was lost", () => {
    const html = '<ul><li><a href="#how-much-it-costs">How much it costs</a></li></ul><h2>How much it costs</h2><p>x</p>';
    const result = guardLinks(html, { scope, mode: "generated", verdicts: new Map() });
    expect(result.html).toContain('<a href="#how-much-it-costs">How much it costs</a>');
    expect(result.html).toContain('<h2 id="how-much-it-costs">How much it costs</h2>');
  });

  it("drops an unsafe id rather than publishing it", () => {
    expect(sanitizeHtml('<h2 id="x&quot; onclick=&quot;alert(1)">T</h2>')).toBe("<h2>T</h2>");
    expect(sanitizeHtml('<h2 id="1-starts-with-digit">T</h2>')).toBe("<h2>T</h2>");
  });
});

describe("what is never touched", () => {
  it("keeps citations, the backlink, social profiles, mailto and tel exactly", () => {
    const html =
      '<p>Per <a href="https://en.wikipedia.org/wiki/Photography" target="_blank" rel="noopener nofollow">Wikipedia</a>, ' +
      '<a href="https://partner.test/offer" target="_blank" rel="noopener nofollow">a partner</a>, ' +
      '<a href="https://instagram.com/imagestudio" target="_blank" rel="noopener nofollow">Instagram</a>, ' +
      '<a href="mailto:hello@imagestudio.com">email</a> or <a href="tel:+390000">call</a>.</p>';
    const result = guardLinks(html, {
      scope,
      mode: "generated",
      verdicts: new Map(),
      protectedHrefs: ["https://partner.test/offer"],
    });
    expect(result.changed).toBe(false);
    expect(result.html).toBe(html);
  });

  it("still removes javascript: and other unsafe schemes through the sanitizer", () => {
    expect(sanitizeHtml('<p><a href="javascript:alert(1)">x</a></p>')).toBe("<p><a>x</a></p>");
    const result = guardLinks("<p><a>x</a></p>", { scope, mode: "existing", verdicts: new Map() });
    expect(result.html).toBe("<p>x</p>");
  });
});

describe("uncertainty is not proof", () => {
  const html = '<p>Our <a href="/services/">photography services</a>.</p>';

  it("keeps a link in stored content when the check timed out, and reports it", () => {
    const result = guardLinks(html, {
      scope,
      mode: "existing",
      verdicts: new Map([verdict(SERVICES, "unavailable", { reason: "no response (timeout or network error)" })]),
    });
    expect(result.changed).toBe(false);
    expect(result.findings[0]).toMatchObject({ outcome: "unverified", verdict: "unavailable" });
  });

  it("drops a link from a NEW article when it cannot be verified, inventing nothing in its place", () => {
    const result = guardLinks(html, {
      scope,
      mode: "generated",
      maxAutoLinks: 3,
      verdicts: new Map([verdict(SERVICES, "unavailable")]),
    });
    expect(result.html).toBe("<p>Our photography services.</p>");
  });
});

describe("replacements", () => {
  const html = '<p>See our <a href="/destination-wedding-photography-films">destination wedding photography</a>.</p>';

  it("replaces a confirmed-missing link only with a verified page on the same topic", () => {
    const target = { url: "https://imagestudio.com/destination-wedding-photography/", title: "Destination Wedding Photography", score: 3 };
    const result = guardLinks(html, { scope, mode: "existing", verdicts: new Map([verdict(WEDDING, "missing")]), targets: [target] });
    expect(result.html).toBe(`<p>See our <a href="${target.url}">destination wedding photography</a>.</p>`);
    expect(result.findings[0]).toMatchObject({ outcome: "replaced", replacement: target.url });
  });

  it("does not substitute an unrelated page, and never the homepage", () => {
    const unrelated = { url: "https://imagestudio.com/corporate-events/", title: "Corporate Events", score: 5 };
    const result = guardLinks(html, {
      scope,
      mode: "existing",
      verdicts: new Map([verdict(WEDDING, "missing")]),
      targets: [unrelated],
    });
    expect(result.html).toBe("<p>See our destination wedding photography.</p>");
  });
});

describe("automatic links and internalLinkTarget", () => {
  const body =
    "<h2>Wedding photography in Italy</h2>" +
    "<p>Planning wedding photography abroad takes time.</p>" +
    "<p>A <strong>destination wedding</strong> needs a film crew and <code>wedding</code> gear.</p>" +
    "<p>Engagement sessions are popular too.</p>";
  const targets = [
    { url: "https://imagestudio.com/wedding-photography/", title: "Wedding Photography", score: 3 },
    { url: "https://imagestudio.com/engagement-sessions/", title: "Engagement Sessions", score: 2 },
  ];

  it("adds nothing when internalLinkTarget is 0, and removes the writer's own internal links", () => {
    const withModelLink = body.replace("film crew", '<a href="https://imagestudio.com/wedding-photography/">film crew</a>');
    const result = guardLinks(withModelLink, {
      scope,
      mode: "generated",
      maxAutoLinks: 0,
      targets,
      verdicts: new Map([verdict("https://imagestudio.com/wedding-photography/", "ok")]),
    });
    expect(result.html).not.toContain("<a ");
    expect(result.inserted).toEqual([]);
  });

  it("adds at most the configured number, in paragraphs only, never in headings or code, without nesting", () => {
    const result = guardLinks(body, { scope, mode: "generated", maxAutoLinks: 1, targets, verdicts: new Map() });
    expect(result.inserted).toHaveLength(1);
    expect(result.html).toBe(
      "<h2>Wedding photography in Italy</h2>" +
        '<p>Planning <a href="https://imagestudio.com/wedding-photography/">wedding photography</a> abroad takes time.</p>' +
        "<p>A <strong>destination wedding</strong> needs a film crew and <code>wedding</code> gear.</p>" +
        "<p>Engagement sessions are popular too.</p>",
    );
  });

  it("uses each destination once and never links the article to itself", () => {
    const self = "https://imagestudio.com/wedding-photography/";
    const result = guardLinks(body, {
      scope,
      mode: "generated",
      maxAutoLinks: 5,
      targets: [...targets, { ...targets[0] }],
      verdicts: new Map(),
      articleUrl: self,
    });
    expect(result.html).not.toContain(self);
    expect(result.inserted.map((t) => t.url)).toEqual(["https://imagestudio.com/engagement-sessions/"]);
    expect(result.html.match(/<a /g)).toHaveLength(1);
  });

  it("does not remove a person's links to meet the setting", () => {
    const edited = '<p>Our <a href="https://imagestudio.com/services/">services</a> and <a href="https://imagestudio.com/about/">story</a>.</p>';
    const result = guardLinks(edited, {
      scope,
      mode: "existing",
      maxAutoLinks: 0,
      verdicts: new Map([verdict(SERVICES, "ok"), verdict("https://imagestudio.com/about/", "ok")]),
    });
    expect(result.changed).toBe(false);
  });

  it("prefers a two-word phrase from the title as anchor text", () => {
    expect(anchorPhrases("Destination Wedding Photography")[0]).toBe("destination wedding");
  });
});

describe("structure and repeat runs", () => {
  const messy =
    '<h2 id="intro">Intro</h2><p>Text <a href="#">with <em>emphasis</em></a> and <a href="/destination-wedding-photography-films">films</a>.</p>' +
    '<p><img src="https://imagestudio.com/a.jpg" alt="A wedding" /><br />Caption</p>' +
    "<ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote>";
  const options = {
    scope,
    mode: "generated" as const,
    maxAutoLinks: 2,
    verdicts: new Map([verdict(WEDDING, "missing")]),
    targets: [{ url: "https://imagestudio.com/wedding-photography/", title: "Wedding Photography", score: 3 }],
  };

  it("keeps headings, images, lists and formatting", () => {
    const result = guardLinks(messy, options);
    expect(result.html).toBe(
      '<h2 id="intro">Intro</h2><p>Text with <em>emphasis</em> and films.</p>' +
        '<p><img src="https://imagestudio.com/a.jpg" alt="A wedding" /><br />Caption</p>' +
        "<ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote>",
    );
  });

  it("is idempotent, and the sanitizer does not undo it", () => {
    const once = guardLinks(messy, options).html;
    const twice = guardLinks(once, options);
    expect(twice.changed).toBe(false);
    expect(twice.html).toBe(once);
    expect(sanitizeHtml(once, { siteHosts: scope.hosts })).toBe(once);
  });

  it("is idempotent after inserting links (the inserted pages verify on the next pass)", () => {
    const target = options.targets[0];
    const withText = `${messy}<p>Our wedding photography packages.</p>`;
    const run = (html: string) =>
      guardLinks(html, { ...options, verdicts: new Map([...options.verdicts, verdict(target.url, "ok")]) });
    const once = run(withText);
    expect(once.inserted).toHaveLength(1);
    const twice = run(once.html);
    expect(twice.changed).toBe(false);
    expect(twice.html).toBe(once.html);
  });

  it("does not replace a missing link whose visible text is about something else", () => {
    // The slug mentions wedding photography; the words the reader sees do not.
    const result = guardLinks('<p>Watch the <a href="/destination-wedding-photography-films">films</a>.</p>', options);
    expect(result.html).toBe("<p>Watch the films.</p>");
  });

  it("does not mark links to the client's own site nofollow, but still does for other sites", () => {
    const html = sanitizeHtml(
      '<p><a href="https://imagestudio.com/a">a</a> <a href="https://other.test/b">b</a></p>',
      { siteHosts: scope.hosts },
    );
    expect(html).toBe(
      '<p><a href="https://imagestudio.com/a">a</a> <a href="https://other.test/b" target="_blank" rel="noopener nofollow">b</a></p>',
    );
  });
});
