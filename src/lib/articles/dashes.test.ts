import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import { cleanDashes, cleanDashesHtml } from "./dashes";

/** Client, 2026-11-24: no "GPT dashes" in the articles written for clients. */

const anyDash = /[‒-―]|\s-\s|--/;

describe("plain text", () => {
  it.each([
    // The client's own screenshot.
    [
      "Endpoint management tools — the UEM and MDM platforms that govern every laptop, phone, and tablet touching the network — aren't an optional add-on at this scale.",
      "Endpoint management tools, the UEM and MDM platforms that govern every laptop, phone, and tablet touching the network, aren't an optional add-on at this scale.",
    ],
    ["It is fast — but not cheap.", "It is fast, but not cheap."],
    ["It is fast—but not cheap.", "It is fast, but not cheap."],
    ["It is fast – but not cheap.", "It is fast, but not cheap."],
    ["It is fast - but not cheap.", "It is fast, but not cheap."],
    ["It is fast -- but not cheap.", "It is fast, but not cheap."],
    ["It is fast ― but not cheap.", "It is fast, but not cheap."],
    ["Choose three things — price, speed and support.", "Choose three things: price, speed and support."],
    ["Check the following – size, colour, and fit.", "Check the following: size, colour, and fit."],
    ["He said \"it works.\" — then left", "He said \"it works.\" then left"],
    ["Wait, — he said", "Wait, he said"],
    ["Nothing (— or little)", "Nothing (or little)"],
    ["Ends with a dash —", "Ends with a dash"],
    ["— Starts with one", "Starts with one"],
    ["Nothing — .", "Nothing."],
  ])("%s", (input, expected) => {
    expect(cleanDashes(input)).toBe(expected);
  });

  it.each([
    ["10–20 pages", "10-20 pages"],
    ["2024–2026", "2024-2026"],
    ["2024—2026", "2024-2026"],
    ["from 10 – 20 km", "from 10-20 km"],
    ["10% – 20%", "10%-20%"],
    ["€1,000 – €2,500", "€1,000-€2,500"],
    ["9:00 – 17:30", "9:00-17:30"],
    ["10 - 20 people", "10-20 people"],
    ["Open Monday – Friday", "Open Monday-Friday"],
    ["Mon–Fri", "Mon-Fri"],
    ["lunedì – venerdì", "lunedì-venerdì"],
    ["a cost–benefit analysis", "a cost-benefit analysis"],
    ["from A–Z", "from A-Z"],
    ["It froze at –5 °C", "It froze at -5 °C"],
  ])("a range keeps a plain hyphen: %s", (input, expected) => {
    expect(cleanDashes(input)).toBe(expected);
  });

  it("a number that does not go up is not a range", () => {
    expect(cleanDashes("It grew in 2024 — 3 of them left.")).toBe("It grew in 2024, 3 of them left.");
    expect(cleanDashes("We sold 10 — 20 fewer than last year.")).toBe("We sold 10, 20 fewer than last year.");
  });

  it.each([
    "on-premises and cloud-managed",
    "two- and three-day trips",
    "Haupt- und Nebenkosten",
    "https://example.com/a–b--c and www.example.com/x—y",
    "ada--b@example.com",
    "A state-of-the-art, well-known add-on",
    "−5 °C",
    "",
    "No dashes at all.",
  ])("leaves %j as it is", (text) => {
    expect(cleanDashes(text)).toBe(text);
  });

  it("a title's dash is a colon, once", () => {
    expect(cleanDashes("Endpoint Security — A Complete Guide", { kind: "title" })).toBe("Endpoint Security: A Complete Guide");
    expect(cleanDashes("Endpoint Security - A Complete Guide", { kind: "title" })).toBe("Endpoint Security: A Complete Guide");
    expect(cleanDashes("Guide: Security — What to Know", { kind: "title" })).toBe("Guide: Security, What to Know");
    expect(cleanDashes("Fast — and Cheap", { kind: "title" })).toBe("Fast, and Cheap");
    expect(cleanDashes("Sécurité — le guide complet", { kind: "title", language: "French" })).toBe("Sécurité\u00a0: le guide complet");
    expect(cleanDashes("Trends 2024–2026", { kind: "title" })).toBe("Trends 2024-2026");
  });

  it("works in every language RepGet writes", () => {
    expect(cleanDashes("Las herramientas — como UEM y MDM — son esenciales.")).toBe("Las herramientas, como UEM y MDM, son esenciales.");
    expect(cleanDashes("Les outils – comme UEM et MDM – sont essentiels.")).toBe("Les outils, comme UEM et MDM, sont essentiels.");
    expect(cleanDashes("Gli strumenti — come UEM e MDM — sono essenziali.")).toBe("Gli strumenti, come UEM e MDM, sono essenziali.");
    expect(cleanDashes("Die Werkzeuge – etwa UEM und MDM – sind unverzichtbar.")).toBe("Die Werkzeuge, etwa UEM und MDM, sind unverzichtbar.");
    expect(cleanDashes("Elija tres cosas — precio, plazo y garantía.")).toBe("Elija tres cosas: precio, plazo y garantía.");
    expect(cleanDashes("Wählen Sie drei Dinge – Preis, Zeit und Service.")).toBe("Wählen Sie drei Dinge: Preis, Zeit und Service.");
  });

  it("is the same when run twice, and never leaves two marks in a row", () => {
    const text = "One — two — three, — four. — Five; – six (— seven) 10 – 20 —";
    const once = cleanDashes(text);
    expect(cleanDashes(once)).toBe(once);
    expect(once).not.toMatch(anyDash);
    expect(once).not.toMatch(/[,;:.]\s*[,;:]/);
  });
});

describe("HTML", () => {
  it("reads an aside across links and emphasis", () => {
    expect(cleanDashesHtml('<p>Tools — the <a href="https://x.example/a—b">UEM — platforms</a> we use — help.</p>')).toBe(
      '<p>Tools, the <a href="https://x.example/a—b">UEM, platforms</a> we use, help.</p>',
    );
    expect(cleanDashesHtml("<p>Tools <em>— all of them —</em> help.</p>")).toBe("<p>Tools<em>, all of them, </em>help.</p>");
  });

  it("keeps blocks apart", () => {
    expect(cleanDashesHtml("<p>One —</p><p>two</p>")).toBe("<p>One</p><p>two</p>");
    expect(cleanDashesHtml("<h2>Costs — What to Expect</h2><p>It varies — a lot.</p>")).toBe("<h2>Costs: What to Expect</h2><p>It varies, a lot.</p>");
  });

  it("a term that opens its line takes a colon", () => {
    expect(cleanDashesHtml("<ul><li><strong>Price</strong> — what you pay each month.</li><li><strong>Speed —</strong> how long it takes.</li><li>Support – who answers.</li></ul>")).toBe(
      "<ul><li><strong>Price</strong>: what you pay each month.</li><li><strong>Speed: </strong>how long it takes.</li><li>Support: who answers.</li></ul>",
    );
    expect(cleanDashesHtml("<p>It is <strong>fast</strong> — very fast.</p>")).toBe("<p>It is <strong>fast</strong>, very fast.</p>");
  });

  it("reads entities and hard spaces", () => {
    expect(cleanDashesHtml("<p>Fast&nbsp;&mdash; cheap &#8212; good &ndash; done</p>")).toBe("<p>Fast, cheap, good, done</p>");
    expect(cleanDashesHtml("<p>10&ndash;20 pages &amp; more</p>")).toBe("<p>10-20 pages &amp; more</p>");
  });

  it("never touches code, preformatted text, addresses, attributes or comments", () => {
    for (const html of [
      "<pre>a — b -- c</pre>",
      "<p>Run <code>git log -- file — x</code> now</p>",
      "<!-- note — keep -->",
      '<p title="a — b" data-x="1 – 2">Text</p>',
      '<img src="/a—b.jpg" alt="left — right">',
      "<p>See https://example.com/a—b/c--d for more</p>",
      "<script>let a = b -- c;</script>",
    ]) {
      expect(cleanDashesHtml(html)).toBe(html);
    }
    expect(cleanDashesHtml('<p>Use <code>x</code> — it works</p><p title="a > b">One — two</p>')).toBe('<p>Use <code>x</code>, it works</p><p title="a > b">One, two</p>');
  });

  it("cleans table cells and FAQ answers", () => {
    expect(cleanDashesHtml("<table><tr><th>Best for — teams</th><td>Yes — with limits</td><td>—</td><td>10–20</td></tr></table>")).toBe(
      "<table><tr><th>Best for, teams</th><td>Yes, with limits</td><td>-</td><td>10-20</td></tr></table>",
    );
    expect(cleanDashesHtml("<h3>Is it worth it — really?</h3><p>Yes — usually.</p>")).toBe("<h3>Is it worth it: really?</h3><p>Yes, usually.</p>");
  });

  it("keeps the markup exactly: the same tags, attributes and ids in the same order", () => {
    const html = '<h2 id="a—b">A — b</h2><p>Text <a href="https://s.example/p?x=1&amp;y=2" rel="nofollow">link — here</a> and <br>more — text</p><figure><img src="x.jpg" alt="q"><figcaption>One — two</figcaption></figure>';
    const tags = (value: string) => value.match(/<[^>]+>/g);
    const cleaned = cleanDashesHtml(html);
    expect(tags(cleaned)).toEqual(tags(html));
    expect(load(cleaned, null, false).root().text()).not.toMatch(anyDash);
    expect(cleanDashesHtml(cleaned)).toBe(cleaned);
  });

  it("returns an article without dashes byte for byte", () => {
    const html = "<h2>On-premises vs cloud</h2>\n<p>A 10-20 person team&nbsp;needs &quot;both&quot;.</p>";
    expect(cleanDashesHtml(html)).toBe(html);
  });
});
