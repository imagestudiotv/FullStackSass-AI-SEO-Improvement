import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { prepareForDelivery } from "./delivery";
import { sanitizeHtml } from "./sanitize";

const payloads = [
  '<img src=x onerror="window.__auditProbe=1" ">',
  '<a href="javascript:void(0)" ">probe</a>',
  '<img src=x onerror="window.__auditProbe=1" foo\'>',
  '<IMG SRC=x oNeRrOr=alert(1)>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="java&Tab;script&colon;alert(1)">x</a>',
  '<a href="jav\nascript:alert(1)">x</a>',
  '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  '<svg><g/onload=alert(1)//<p>bad</p></svg>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe><object data="javascript:alert(1)"></object>',
  '<form><input name=__proto__><button formaction="javascript:alert(1)">x</button></form>',
  '<img src="/safe.png" src="javascript:alert(1)" onerror=alert(1)>',
  '<h2 id="x\" onmouseover=alert(1)">Title</h2>',
];

/** Parse the result with parse5 (Cheerio's browser-compatible parser), not
 * the sanitizer's htmlparser2, so assertions see what a renderer sees. */
function expectInert(html: string) {
  const $ = cheerio.load(html);
  expect($("script,iframe,object,embed,svg,math,form,input,button,style").length).toBe(0);
  for (const element of $("*").toArray()) {
    if (!("attribs" in element)) continue;
    for (const [key, value] of Object.entries(element.attribs)) {
      expect(key).not.toMatch(/^on|^srcdoc$|^formaction$/i);
      if (key === "href" || key === "src") {
        const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value.replace(/[\s\u0000-\u001f]/g, ""));
        if (scheme) expect(["http", "https", "mailto", "tel"]).toContain(scheme[1].toLowerCase());
      }
    }
  }
}

describe("HTML security boundaries", () => {
  it.each(payloads)("removes executable markup: %s", (payload) => {
    expectInert(sanitizeHtml(payload));
    // Existing stored HTML is protected without rewriting or approving it.
    expectInert(prepareForDelivery(payload, { poweredBy: true }));
  });

  it("preserves headings, anchors, image attributes, formatting and tables", () => {
    const clean = sanitizeHtml('<h1 id="intro">Title</h1><p><strong>Hi</strong> &amp; welcome <a href="#intro">up</a></p><img src="/photo.jpg" width="640" height="480" loading="lazy"><table><tbody><tr><td>Cell</td></tr></tbody></table>');
    const $ = cheerio.load(clean);
    expect($("h2#intro").text()).toBe("Title");
    expect($("a").attr("href")).toBe("#intro");
    expect($("img").attr("width")).toBe("640");
    expect($("td").text()).toBe("Cell");
    expect(sanitizeHtml(clean)).toBe(clean);
  });

  it("keeps internal links and derives protection on external links", () => {
    const clean = sanitizeHtml('<a href="https://site.test/a?q=x&amp;y=2" target="evil" rel="opener">in</a><a href="//other.test/a">out</a>', { siteHosts: new Set(["site.test"]) });
    const $ = cheerio.load(clean);
    expect($("a").first().attr("target")).toBeUndefined();
    expect($("a").first().attr("href")).toBe("https://site.test/a?q=x&y=2");
    expect($("a").last().attr("rel")).toBe("noopener nofollow");
  });
});
