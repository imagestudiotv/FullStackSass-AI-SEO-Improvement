import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { headingId } from "@/lib/articles/link-guard";
import { sanitizeHtml } from "@/lib/articles/sanitize";

/**
 * The table of contents, built from the article's real headings.
 *
 * It used to be requested from the writer ("open with a short contents list
 * linking to the main headings"), which produced lists linking to ids that
 * did not exist, duplicated ids, and entries for sections the article never
 * had. Now the writer is not asked for one; this builds it:
 *
 *  - every H2 gets a unique, safe id (an id it already had is kept when it
 *    is valid and not already taken);
 *  - any contents list already in the article - a list made only of
 *    "#section" links - is removed, with its label, so the result never
 *    holds two;
 *  - when the website has "Table of contents" on and the article has at
 *    least MIN_SECTIONS main headings, a list of links to them goes in
 *    before the first one (after the introduction).
 *
 * Deterministic and idempotent: running it again changes nothing.
 */

const MIN_SECTIONS = 2;
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,80}$/;

/** The contents label, in the article's language. English when unknown. */
const LABELS: Record<string, string> = {
  en: "Contents",
  es: "Contenido",
  fr: "Sommaire",
  it: "Indice",
  de: "Inhalt",
  pt: "Índice",
  nl: "Inhoud",
};
const ALL_LABELS = new Set(Object.values(LABELS).map((label) => label.toLowerCase()));

export function contentsLabel(language: string | null | undefined): string {
  const code = (language ?? "").trim().toLowerCase();
  const byName: Record<string, string> = {
    english: "en",
    spanish: "es",
    french: "fr",
    italian: "it",
    german: "de",
    portuguese: "pt",
    dutch: "nl",
  };
  const key = byName[code] ?? code.slice(0, 2);
  return LABELS[key] ?? LABELS.en;
}

type Api = cheerio.CheerioAPI;

/** Unique, safe ids on every heading; duplicates and unsafe ids replaced. */
function assignHeadingIds($: Api): Element[] {
  const taken = new Set<string>();
  const headings = $("h2, h3, h4, h5, h6").toArray();
  for (const heading of headings) {
    const current = $(heading).attr("id");
    if (current && SAFE_ID.test(current) && !taken.has(current)) {
      taken.add(current);
      continue;
    }
    const base = headingId($(heading).text());
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    $(heading).attr("id", id);
  }
  return headings.filter((heading) => heading.name === "h2");
}

/** A list whose every item is one "#section" link: a contents list. */
function isContentsList($: Api, list: Element): boolean {
  const items = $(list).children("li").toArray();
  if (items.length === 0) return false;
  return items.every((item) => {
    const links = $(item).find("a");
    return links.length === 1 && ($(links[0]).attr("href") ?? "").startsWith("#") && $(item).text().trim() === $(links[0]).text().trim();
  });
}

function removeContentsLists($: Api) {
  for (const list of $("ul, ol").toArray()) {
    if (!isContentsList($, list)) continue;
    const label = $(list).prev();
    if (label.is("p") && ALL_LABELS.has(label.text().trim().toLowerCase())) label.remove();
    $(list).remove();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function applyTableOfContents(
  html: string,
  options: {
    enabled: boolean;
    language?: string | null;
    /** The website's own hosts, so its links stay followed (see sanitize.ts). */
    siteHosts?: ReadonlySet<string>;
  },
): string {
  const $ = cheerio.load(html, null, false);
  removeContentsLists($);
  const sections = assignHeadingIds($);

  if (options.enabled && sections.length >= MIN_SECTIONS) {
    const items = sections
      .map((heading) => {
        const text = $(heading).text().replace(/\s+/g, " ").trim();
        return `<li><a href="#${$(heading).attr("id")}">${escapeHtml(text)}</a></li>`;
      })
      .join("");
    $(sections[0]).before(`<p><strong>${escapeHtml(contentsLabel(options.language))}</strong></p><ul>${items}</ul>`);
  }
  return sanitizeHtml($.html(), { siteHosts: options.siteHosts });
}

/**
 * Makes every "#section" link point at a heading that exists, for content
 * that has been edited or pasted since it was written: unique ids on every
 * heading, and a section link whose target is gone re-pointed at the
 * heading with the same text. Changes nothing else, and nothing at all when
 * everything already resolves.
 */
export function repairSectionLinks(html: string, siteHosts?: ReadonlySet<string>): string {
  const $ = cheerio.load(html, null, false);
  const before = $.html();
  assignHeadingIds($);
  const ids = new Set($("[id]").toArray().map((el) => $(el).attr("id") as string));
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
  const headings = $("h2, h3, h4, h5, h6").toArray();
  for (const link of $('a[href^="#"]').toArray()) {
    const target = ($(link).attr("href") ?? "").slice(1);
    if (!target || ids.has(target)) continue;
    const text = normalize($(link).text());
    const match = headings.find((heading) => normalize($(heading).text()) === text || headingId($(heading).text()) === target);
    if (match) $(link).attr("href", `#${$(match).attr("id")}`);
  }
  const after = $.html();
  return after === before ? html : sanitizeHtml(after, { siteHosts });
}
