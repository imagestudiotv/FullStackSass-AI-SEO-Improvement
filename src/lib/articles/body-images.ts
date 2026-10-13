import { sanitizeHtml } from "@/lib/articles/sanitize";

/**
 * Pictures inside the article, besides the cover (client, 2026-10-13: "We
 * need to provide 3 more images for the article and not just the hero
 * image"). Which sections get one, and where in the section it goes.
 *
 * Spread through the text rather than bunched: a picture every few sections
 * breaks up a long article the way the reference article does. Never in the
 * first section - the cover already sits above it - and never in the FAQ.
 * Placed after the section's first paragraph, so the heading still leads into
 * the text, and never inside a table.
 */

export type ImageSlot = {
  /** Which <h2> of the body (0 = the first). */
  h2: number;
  heading: string;
  /** The section's opening text, for describing a matching picture. */
  text: string;
};

export type PlacedImage = { h2: number; url: string; alt: string; width: number; height: number };

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

type Section = { start: number; end: number; headingEnd: number; heading: string };

/** Each <h2> and where its section ends (the next <h2>, or the end of the body). */
function sections(html: string): Section[] {
  const found = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  return found.map((match, i) => ({
    start: match.index,
    headingEnd: match.index + match[0].length,
    end: i + 1 < found.length ? found[i + 1].index : html.length,
    heading: plain(match[1]),
  }));
}

/**
 * Up to `count` sections to illustrate. With an FAQ, its heading - the last
 * <h2> - is left out.
 */
export function imageSlots(html: string, count: number, options: { faq: boolean }): ImageSlot[] {
  const all = sections(html);
  const last = options.faq ? all.length - 1 : all.length;
  const candidates = all.map((section, h2) => ({ ...section, h2 })).slice(1, Math.max(1, last));
  const wanted = Math.min(Math.max(0, Math.trunc(count)), candidates.length);
  const slots: ImageSlot[] = [];
  for (let i = 0; i < wanted; i++) {
    // Evenly spread: the middle of each of `wanted` equal stretches of the candidates.
    const pick = candidates[Math.floor(((i + 0.5) * candidates.length) / wanted)];
    slots.push({
      h2: pick.h2,
      heading: pick.heading,
      text: plain(html.slice(pick.headingEnd, pick.end)).slice(0, 700),
    });
  }
  return slots;
}

const attribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Where the pictures go: after the first paragraph of each chosen section that is not inside a table. */
export function placeBodyImages(html: string, images: PlacedImage[]): string {
  const all = sections(html);
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => [m.index, m.index + m[0].length] as const);
  const inTable = (at: number) => tables.some(([from, to]) => at > from && at < to);

  const inserts: { at: number; tag: string }[] = [];
  for (const image of images) {
    const section = all[image.h2];
    if (!section || !/^https:\/\//i.test(image.url)) continue;
    let at = section.headingEnd;
    const closers = /<\/p>/gi;
    closers.lastIndex = section.headingEnd;
    for (let m = closers.exec(html); m && m.index < section.end; m = closers.exec(html)) {
      if (!inTable(m.index)) {
        at = m.index + m[0].length;
        break;
      }
    }
    inserts.push({
      at,
      tag: `<img src="${attribute(image.url)}" alt="${attribute(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">`,
    });
  }

  let out = html;
  for (const insert of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, insert.at) + insert.tag + out.slice(insert.at);
  }
  // Through the same cleaner as everything else, so nothing it would refuse can ride in.
  return sanitizeHtml(out);
}
