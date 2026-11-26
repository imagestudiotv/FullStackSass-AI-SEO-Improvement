import * as cheerio from "cheerio";

import { readHref, type SiteScope } from "@/lib/articles/link-guard";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { comparableLinkUrl } from "@/lib/backlinks/follow";

/**
 * No links to other websites in what RepGet writes for a client (Daniel,
 * 2026-11-26: "We don't need to insert external links on generated articles
 * for clients, I will insert myself from Partner Network if needed, because
 * now I manually delete all the external links. Only internal links should be
 * present that promote the site internally.").
 *
 * The writer is told not to link anywhere else (lib/articles/generate.ts,
 * writing-evidence.ts), and research is still named in plain text ("Deus
 * Marketing's editorial playbook (April 2026) says ..."). This is the code
 * that makes sure, on every path that turns a model's answer into a stored
 * article: the first draft, a rewrite, the evidence corrections (all through
 * lib/articles/internal-links.ts) and translations (translations.ts).
 *
 * Every <a> whose address leaves the site is unwrapped: its words and
 * formatting stay, the link goes. Left alone:
 *  - links on the site itself (link-guard's siteScope: the host and its www
 *    twin; another subdomain is another site), relative links included;
 *  - "#section" links, mailto: and tel:, and anything link-guard reads as a
 *    placeholder or unusable (link-guard deals with those);
 *  - the addresses in `keep`: the Partner Network placement the article was
 *    asked to carry and any placement already recorded for it, and the
 *    business's own social profiles (brand voice, "Mentioned once in an
 *    article"). Matched as delivery matches placements (comparableLinkUrl:
 *    any scheme, www or trailing slash), and a link written in another form
 *    is put back to the exact address, so the placement is recognised in the
 *    draft (generate-article.ts save-article) and sent followed (delivery.ts).
 *
 * Administrator placements (lib/backlinks/managed.ts) are added in review,
 * after this has run, and an editor's own changes never pass through here:
 * only text a model wrote does.
 */

export type OutsideLinkOptions = {
  scope: SiteScope;
  /** Addresses on other websites that stay linked: placements, social profiles. */
  keep?: readonly (string | null | undefined)[];
  /** The article's public address, when it has one: the base for document-relative links. */
  articleUrl?: string | null;
};

export type OutsideLinkResult = {
  html: string;
  changed: boolean;
  /** Each unwrapped link, as written, for the run's log counts. */
  removed: { href: string; text: string }[];
};

export function unwrapOutsideLinks(html: string, options: OutsideLinkOptions): OutsideLinkResult {
  const keep = new Map<string, string>();
  for (const url of options.keep ?? []) {
    if (url) keep.set(comparableLinkUrl(url), url);
  }
  const $ = cheerio.load(html, null, false);
  const removed: OutsideLinkResult["removed"] = [];
  let changed = false;

  for (const el of $("a[href]").toArray()) {
    const written = $(el).attr("href") ?? "";
    const href = readHref(written, options.scope, options.articleUrl);
    if (href.kind !== "external") continue;
    const kept = keep.get(comparableLinkUrl(href.url));
    if (kept !== undefined) {
      if (written !== kept) {
        $(el).attr("href", kept);
        changed = true;
      }
      continue;
    }
    removed.push({ href: written, text: $(el).text().replace(/\s+/g, " ").trim() });
    $(el).replaceWith($(el).contents());
    changed = true;
  }

  if (!changed) return { html, changed: false, removed };
  // Back through the sanitizer, as every other link pass does (link-guard.ts).
  return { html: sanitizeHtml($.html(), { siteHosts: options.scope.hosts }), changed: true, removed };
}
