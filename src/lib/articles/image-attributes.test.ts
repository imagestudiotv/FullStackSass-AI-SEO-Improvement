import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { prepareForDelivery } from "./delivery";
import { sanitizeHtml } from "./sanitize";

/**
 * Article images keep their size and loading hints from the editor to the
 * customer's site (client's launch review, 2026-10-03: image dimensions, lazy
 * loading, async decoding, and no lazy-loading for the top image).
 */

function imageAttrs(html: string): Record<string, string>[] {
  const $ = cheerio.load(html, null, false);
  return $("img")
    .toArray()
    .map((el) => ({ ...(el.attribs ?? {}) }));
}

describe("sanitizeHtml: image size and loading hints", () => {
  it("keeps what the editor writes for a measured picture", () => {
    // The form TipTap's getHTML() produces once recordImageSize has run.
    const html = '<p><img src="https://cdn.test/a.jpg" alt="A cake" width="1200" height="800"></p>';
    expect(sanitizeHtml(html)).toBe(
      '<p><img src="https://cdn.test/a.jpg" alt="A cake" width="1200" height="800" /></p>',
    );
  });

  it("keeps the loading hints browsers know", () => {
    const html = '<img src="/a.jpg" loading="lazy" decoding="async"><img src="/b.jpg" loading="eager" decoding="sync"><img src="/c.jpg" decoding="auto">';
    expect(imageAttrs(sanitizeHtml(html))).toEqual([
      { src: "/a.jpg", loading: "lazy", decoding: "async" },
      { src: "/b.jpg", loading: "eager", decoding: "sync" },
      { src: "/c.jpg", decoding: "auto" },
    ]);
  });

  it("writes each kept value in its one exact form", () => {
    const html = "<img src=\"/a.jpg\" width=' 640 ' height=480 loading=\"LAZY\" decoding=\" Async \">";
    expect(imageAttrs(sanitizeHtml(html))).toEqual([
      { src: "/a.jpg", width: "640", height: "480", loading: "lazy", decoding: "async" },
    ]);
  });

  it("accepts sizes from 1 to 10000 pixels", () => {
    for (const size of ["1", "9", "10", "640", "9999", "10000"]) {
      expect(imageAttrs(sanitizeHtml(`<img src="/a.jpg" width="${size}">`))[0].width).toBe(size);
    }
  });

  it("drops a size that is not a whole number of pixels rather than repairing it", () => {
    for (const size of ["100%", "800px", "0", "00", "08", "-5", "10001", "99999", "1e3", "12.5", "", " ", "auto", "0x10"]) {
      expect(imageAttrs(sanitizeHtml(`<img src="/a.jpg" width="${size}" height="${size}">`))).toEqual([{ src: "/a.jpg" }]);
    }
  });

  it("drops loading hints browsers do not know", () => {
    const html = '<img src="/a.jpg" loading="auto" decoding="fast"><img src="/b.jpg" loading="" decoding="">';
    expect(imageAttrs(sanitizeHtml(html))).toEqual([{ src: "/a.jpg" }, { src: "/b.jpg" }]);
  });

  /**
   * The values are checked after the browser's decoding, as href and src are,
   * so an encoded quote cannot close the attribute and start an event handler.
   */
  it("cannot be used to smuggle script or a second attribute", () => {
    const attacks = [
      '<img src="/a.jpg" width="javascript:alert(1)">',
      '<img src="/a.jpg" width="1 onerror=alert(1)">',
      '<img src="/a.jpg" width="100&#x22; onerror=&#x22;alert(1)">',
      '<img src="/a.jpg" height="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
      '<img src="/a.jpg" loading="lazy&#34; onload=&#34;alert(1)">',
      "<img src=\"/a.jpg\" decoding='async\" onerror=\"alert(1)'>",
      '<img src="/a.jpg" width="1>2" onerror="alert(1)">',
    ];
    for (const html of attacks) {
      const out = sanitizeHtml(html);
      expect(out, html).toBe('<img src="/a.jpg" />');
      expect(out, html).not.toMatch(/onerror|onload|script|alert/i);
    }
  });

  it("keeps the hints on images only, and still drops style", () => {
    const html =
      '<table width="100"><tbody><tr><td width="5" height="5">x</td></tr></tbody></table>' +
      '<p loading="lazy" decoding="async">y</p>' +
      '<img src="/a.jpg" width="10" style="width:50px" class="big">';
    expect(sanitizeHtml(html)).toBe(
      '<table><tbody><tr><td>x</td></tr></tbody></table><p>y</p><img src="/a.jpg" width="10" />',
    );
  });

  it("still drops an unsafe image address", () => {
    expect(sanitizeHtml('<img src="javascript:alert(1)" width="10" height="10">')).toBe('<img width="10" height="10" />');
  });
});

describe("prepareForDelivery: image loading", () => {
  const article =
    '<p><img src="https://cdn.test/top.jpg" alt="Top" width="1200" height="800" /></p>' +
    "<h2>Section</h2><p>Text.</p>" +
    '<p><img src="https://cdn.test/two.jpg" alt="Two" width="800" height="600" /></p>' +
    '<p><img src="https://cdn.test/three.jpg" alt="Three" /></p>';

  it("loads the first image at once and the rest lazily, all decoded off the main thread", () => {
    const images = imageAttrs(prepareForDelivery(article, { poweredBy: false }));
    expect(images.map((img) => [img.src, img.loading, img.decoding])).toEqual([
      ["https://cdn.test/top.jpg", "eager", "async"],
      ["https://cdn.test/two.jpg", "lazy", "async"],
      ["https://cdn.test/three.jpg", "lazy", "async"],
    ]);
  });

  it("sends the recorded size with each image, and fits it to the column", () => {
    const images = imageAttrs(prepareForDelivery(article, { poweredBy: false }));
    expect(images[0]).toMatchObject({ width: "1200", height: "800", style: "max-width:100%;height:auto" });
    expect(images[1]).toMatchObject({ width: "800", height: "600", style: "max-width:100%;height:auto" });
    // No size recorded (an image from before sizes were kept): none invented.
    expect(images[2].width).toBeUndefined();
    expect(images[2].height).toBeUndefined();
  });

  it("never lazy-loads the first image, even when it was marked lazy", () => {
    const html = '<p><img src="/top.jpg" loading="lazy" /></p><p><img src="/two.jpg" /></p>';
    expect(imageAttrs(prepareForDelivery(html, { poweredBy: false })).map((img) => img.loading)).toEqual(["eager", "lazy"]);
  });

  it("keeps a decoding hint already set", () => {
    const html = '<p><img src="/top.jpg" decoding="sync" /></p>';
    expect(imageAttrs(prepareForDelivery(html, { poweredBy: false }))[0].decoding).toBe("sync");
  });

  it("changes nothing when run twice", () => {
    const once = prepareForDelivery(article, { poweredBy: true });
    expect(prepareForDelivery(once, { poweredBy: true })).toBe(once);
  });

  it("carries a cleaned editor save through to what is sent", () => {
    const saved = sanitizeHtml(
      '<p><img src="https://cdn.test/top.jpg" alt="Top" width="1200" height="800" onerror="alert(1)"></p>' +
        '<p><img src="https://cdn.test/two.jpg" width="100%" loading="LAZY"></p>',
    );
    expect(imageAttrs(prepareForDelivery(saved, { poweredBy: false }))).toEqual([
      {
        src: "https://cdn.test/top.jpg",
        alt: "Top",
        width: "1200",
        height: "800",
        style: "max-width:100%;height:auto",
        loading: "eager",
        decoding: "async",
      },
      {
        src: "https://cdn.test/two.jpg",
        loading: "lazy",
        style: "max-width:100%;height:auto",
        decoding: "async",
      },
    ]);
  });
});
