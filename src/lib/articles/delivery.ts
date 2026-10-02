import * as cheerio from "cheerio";

import { repairSectionLinks } from "@/lib/articles/toc";
import { comparableLinkUrl, followedRel } from "@/lib/backlinks/follow";
import { siteUrl } from "@/lib/site-url";

/**
 * The last step before an article leaves RepGet - the WordPress plugin's
 * pull and every direct CMS publish call this on the exact HTML they send.
 * It changes what is SENT, never what is stored, so it cannot disturb an
 * approval (lib/articles/review.ts) and running it twice changes nothing.
 *
 *  - "This article was powered by RepGet": when the website's setting is on,
 *    one small credit line at the end, linking to RepGet's public site. It
 *    is a full sentence on purpose: the shorter "Powered by RepGet" (17
 *    characters) was dropped by themes and reader scripts that skip short
 *    paragraphs as UI labels - imagestudio.com's story panel skips anything
 *    under 24 characters. Added here,
 *    deterministically - never left to the writer - and exactly once: any
 *    credit line already in the article (from an earlier version, a paste,
 *    a retry) is removed first, by its text rather than its URL, so a change
 *    of domain cannot leave two. Off means none, including one pasted in.
 *    It is an ordinary external link: the internal-link checks leave it
 *    alone, and it is not a network placement and earns no credits.
 *  - Section links: any "#section" link whose heading lost its id in editing
 *    is re-pointed (lib/articles/toc.ts).
 *  - Images: sized to the article column on any theme, with an inline
 *    max-width on each image - nothing is added to the customer's theme.
 *  - Network backlinks: sent FOLLOWED. The editor marks every link to
 *    another site nofollow (lib/articles/sanitize.ts), which is right for
 *    citations and wrong for a placement - a nofollow backlink passes no SEO
 *    value, which is what the beneficiary is paying credits for (client,
 *    2026-10-01). Only the article's recorded placements lose it; every
 *    other external link keeps nofollow. Done here and not in storage so an
 *    editor save, which re-sanitises, cannot put it back before sending.
 *  - Tables (the comparison table, Article Settings): each goes out inside
 *    WordPress's own table block wrapper, <figure class="wp-block-table">,
 *    so the customer's theme styles it as it styles its own tables; and a
 *    cell holding one paragraph loses the <p> the editor puts in every cell,
 *    which themes space out like body text and which made rows very tall.
 */

/**
 * The credit line, recognised by its words (any link target, any case) - the
 * current wording and the earlier "Powered by RepGet", so republishing an
 * older article replaces its line instead of adding a second one.
 */
const CREDIT_TEXT = /^\s*(this article was )?powered by repget\.?\s*$/i;

/** The public address the credit line links to. See lib/site-url.ts. */
export function poweredByUrl(): string {
  return `${siteUrl()}/`;
}

export function poweredByHtml(): string {
  return `<p><small>This article was powered by <a href="${poweredByUrl()}" target="_blank" rel="noopener nofollow">RepGet</a></small></p>`;
}

export type DeliveryOptions = {
  /** websites.powered_by_link. */
  poweredBy: boolean;
  /** The website's own hosts, so its links stay followed. See sanitize.ts. */
  siteHosts?: ReadonlySet<string>;
  /**
   * Target URLs of the network placements this article carries
   * (placementUrlsForArticle). Links to them go out without nofollow.
   */
  followUrls?: readonly string[];
};

export function prepareForDelivery(html: string, options: DeliveryOptions): string {
  const $ = cheerio.load(repairSectionLinks(html, options.siteHosts), null, false);

  // Every existing credit line, wherever it is: exactly one is added back below.
  for (const block of $("p").toArray()) {
    if (CREDIT_TEXT.test($(block).text())) $(block).remove();
  }

  for (const image of $("img").toArray()) {
    $(image).attr("style", "max-width:100%;height:auto");
    if (!$(image).attr("loading")) $(image).attr("loading", "lazy");
  }

  for (const cell of $("td, th").toArray()) {
    const only = $(cell).children();
    if (only.length === 1 && only.first().is("p") && $(cell).text().trim() === only.first().text().trim()) {
      $(cell).html(only.first().html() ?? "");
    }
  }
  for (const table of $("table").toArray()) {
    if (!$(table).parent().is("figure.wp-block-table")) $(table).wrap('<figure class="wp-block-table"></figure>');
  }

  const follow = new Set((options.followUrls ?? []).map(comparableLinkUrl));
  if (follow.size > 0) {
    for (const link of $("a[href]").toArray()) {
      if (!follow.has(comparableLinkUrl($(link).attr("href") ?? ""))) continue;
      const rel = followedRel($(link).attr("rel") ?? "");
      if (rel) $(link).attr("rel", rel);
      else $(link).removeAttr("rel");
    }
  }

  let out = $.html().trim();
  if (options.poweredBy) out = `${out}\n${poweredByHtml()}`;
  return out;
}
