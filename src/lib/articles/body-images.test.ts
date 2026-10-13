import { describe, expect, it } from "vitest";

import { parseBodyScenes } from "@/lib/images/scene";

import { imageSlots, placeBodyImages } from "./body-images";

/**
 * Pictures inside the article (client, 2026-10-13: "3 more images for the
 * article and not just the hero image"): which sections, and where.
 */

const section = (n: number, extra = "") => `<h2>Section ${n}</h2><p>Opening ${n}.</p>${extra}<p>More ${n}.</p>`;
const article = (count: number, faq = false) =>
  Array.from({ length: count }, (_, i) => section(i + 1)).join("") +
  (faq ? "<h2>Frequently asked questions</h2><h3>Why?</h3><p>Because.</p>" : "");

const image = (h2: number, url = `https://storage.example/${h2}.jpg`) => ({ h2, url, alt: `Picture ${h2}`, width: 1200, height: 800 });

describe("which sections get a picture", () => {
  it("spreads them through the article, never the first section or the FAQ", () => {
    const slots = imageSlots(article(7, true), 3, { faq: true });
    // Six candidates (sections 2-7), three stretches of two: the second of each.
    expect(slots.map((slot) => slot.h2)).toEqual([2, 4, 6]);
    expect(slots.map((slot) => slot.heading)).toEqual(["Section 3", "Section 5", "Section 7"]);
    expect(slots[0].text).toBe("Opening 3. More 3.");
  });

  it("never more than there are sections to put them in", () => {
    expect(imageSlots(article(3), 3, { faq: false }).map((slot) => slot.h2)).toEqual([1, 2]);
    expect(imageSlots(article(2, true), 3, { faq: true }).map((slot) => slot.h2)).toEqual([1]);
    expect(imageSlots(article(1), 3, { faq: false })).toEqual([]);
    expect(imageSlots(article(6), 0, { faq: false })).toEqual([]);
  });

  it("without an FAQ, the last section can have one", () => {
    expect(imageSlots(article(4), 3, { faq: false }).map((slot) => slot.h2)).toEqual([1, 2, 3]);
  });
});

describe("where a picture goes", () => {
  it("after the section's first paragraph, with its size and alt text, loaded lazily", () => {
    const html = placeBodyImages(article(3), [image(1), image(2)]);
    expect(html).toContain(
      '<h2>Section 2</h2><p>Opening 2.</p><img src="https://storage.example/1.jpg" alt="Picture 1" width="1200" height="800" loading="lazy" decoding="async" /><p>More 2.</p>',
    );
    expect(html).toContain('<h2>Section 3</h2><p>Opening 3.</p><img src="https://storage.example/2.jpg"');
    expect(html.match(/<img /g)).toHaveLength(2);
  });

  it("never inside a table: the first paragraph after it instead", () => {
    const table = "<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>";
    const html = placeBodyImages(`<h2>One</h2><p>x</p><h2>Two</h2>${table}<p>After the table.</p>`, [image(1)]);
    expect(html).toContain("</table><p>After the table.</p><img ");
  });

  it("right under the heading when the section has no paragraph", () => {
    expect(placeBodyImages("<h2>One</h2><p>x</p><h2>Two</h2><ul><li>a</li></ul>", [image(1)])).toContain("<h2>Two</h2><img ");
  });

  it("escapes its alt text and takes only https addresses", () => {
    const html = placeBodyImages(article(3), [
      { ...image(1), alt: 'A "quoted" <b>bride</b> & groom' },
      image(2, "javascript:alert(1)"),
    ]);
    expect(html).toContain('alt="A &quot;quoted&quot; &lt;b&gt;bride&lt;/b&gt; &amp; groom"');
    expect(html).not.toContain("javascript:");
    expect(html.match(/<img /g)).toHaveLength(1);
  });
});

describe("the pictures' descriptions", () => {
  const sections = [{ heading: "Budget" }, { heading: "Venue" }, { heading: "Season" }];

  it("one per section, in order; a missing one is skipped rather than guessed", () => {
    const parsed = parseBodyScenes(
      JSON.stringify({ images: [{ scene: " A couple reviewing a budget. ", alt: "Couple with a budget" }, { scene: "", alt: "x" }] }),
      sections,
    );
    expect(parsed).toEqual([{ scene: "A couple reviewing a budget.", alt: "Couple with a budget" }, null, null]);
  });

  it("falls back to the section heading for missing alt text, and to nothing for unreadable output", () => {
    expect(parseBodyScenes(JSON.stringify({ images: [{ scene: "A villa" }] }), sections)?.[0]).toEqual({ scene: "A villa", alt: "Budget" });
    expect(parseBodyScenes("not json", sections)).toBeNull();
  });
});
