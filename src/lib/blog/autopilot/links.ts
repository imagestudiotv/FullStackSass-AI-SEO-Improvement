import "server-only";

import * as cheerio from "cheerio";

/**
 * The links in an article the autopilot wrote, checked before it is saved.
 *
 * No automatic outbound links (client, 2026-11-05): RepGet's own blog does not
 * get clickable links to other websites from the writer or the translator -
 * official documentation included, which until then stayed when its page
 * loaded. The instructions say so (write.ts, translate.ts), and this is the
 * check behind them, because instructions alone are not enough. Anything not
 * allowed is unwrapped: its words stay, the link goes.
 *
 *  - A link to RepGet's own site, in any spelling (with or without www,
 *    relative, protocol-relative), stays only when it is one of the pages the
 *    writer was given (published English posts, the free audit, the free
 *    tools, pricing), and is written as the full https://www.repget.com
 *    address, like the blog's hand-written posts. Its #fragment stays.
 *  - A link to a place in the article itself (#fragment) stays.
 *  - Anything else - another site, mailto:, an empty or broken address - goes.
 *
 * Pictures are not links: an <img> address is never touched, and an <img>
 * inside a removed link stays.
 *
 * ONLY WHERE AN ARTICLE IS GENERATED: the writer's check (finishDraft) and the
 * translations (the autopilot's, and the editor's "Draft with AI"). Saving a
 * post (lib/admin/blog.ts, lib/blog/post-fields.ts) does not come through here,
 * so a link an administrator adds by hand - a source, a sponsored placement -
 * stays, and what is already published is not rewritten. Customer articles and
 * Partner Network placements have their own pipelines and do not use this file.
 *
 * The addresses removed are kept with the run (DraftReport.links.removed), for
 * administrators only: the page never shows them.
 */

export type LinkRules = {
  /** "https://www.repget.com" - internal links are rewritten onto it. */
  siteOrigin: string;
  /** RepGet's hosts, with and without www (lib/blog/post-fields.ts blogSiteHosts). */
  siteHosts: ReadonlySet<string>;
  /** The paths the writer was given: "/blog/local-seo-small-business", "/audit"... */
  internalPaths: ReadonlySet<string>;
};

export type RemovedLink = { href: string; text: string; reason: string };

export type LinkCheck = {
  /** The same pieces of HTML, in the same order, with the links checked. */
  html: string[];
  kept: { internal: number; fragments: number };
  removed: RemovedLink[];
};

/** "/blog/x/" and "/blog/x" are one page; "/" stays "/". */
export function pagePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

const OTHER_SITE = "a link to another website";

/** The address as a web address, or null when it is not one (mailto:, tel:, javascript:, broken). */
function webAddress(href: string, origin: string): URL | null {
  try {
    const url = new URL(href, origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** A link to a place in this article: "#how-it-works", not a bare "#". */
const isFragment = (href: string) => href.length > 1 && href.startsWith("#");

/** Checks every link in `pieces` (the body, then each FAQ answer) against what the writer was given. */
export function checkLinks(pieces: string[], rules: LinkRules): LinkCheck {
  const kept = { internal: 0, fragments: 0 };
  const removed: RemovedLink[] = [];
  const out: string[] = [];

  for (const piece of pieces) {
    const $ = cheerio.load(piece, null, false);
    for (const el of $("a").toArray()) {
      const href = ($(el).attr("href") ?? "").trim();
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const unwrap = (reason: string) => {
        removed.push({ href, text, reason });
        $(el).replaceWith($(el).contents());
      };

      if (isFragment(href)) {
        kept.fragments += 1;
        continue;
      }
      if (!href || href === "#") {
        unwrap("not a link to a page");
        continue;
      }
      const url = webAddress(href, rules.siteOrigin);
      if (!url) {
        unwrap("not a web address");
        continue;
      }
      if (!rules.siteHosts.has(url.hostname.toLowerCase())) {
        unwrap(OTHER_SITE);
        continue;
      }
      const path = pagePath(url.pathname);
      if (!rules.internalPaths.has(path)) {
        unwrap("not one of RepGet's pages");
        continue;
      }
      $(el).attr("href", `${rules.siteOrigin}${path === "/" ? "" : path}${url.hash}`);
      kept.internal += 1;
    }
    out.push($.html());
  }
  return { html: out, kept, removed };
}

type SiteRules = Pick<LinkRules, "siteOrigin" | "siteHosts">;

/**
 * The same HTML without links to other websites, for what the writer's check
 * does not see: a translation's links lead to its language's pages, which are
 * not on the writer's list, so RepGet's own are all kept here. `allowed`
 * (full addresses, or a mailto: or tel: link as written) keeps those too. HTML
 * with nothing to remove comes back as it was.
 */
export function removeExternalLinks(html: string, rules: SiteRules, allowed: ReadonlySet<string> = new Set()): { html: string; removed: RemovedLink[] } {
  if (!/<a[\s>]/i.test(html)) return { html, removed: [] };
  const $ = cheerio.load(html, null, false);
  const removed: RemovedLink[] = [];
  for (const el of $("a").toArray()) {
    const href = ($(el).attr("href") ?? "").trim();
    if (isFragment(href)) continue;
    const url = href && href !== "#" ? webAddress(href, rules.siteOrigin) : null;
    if (url && rules.siteHosts.has(url.hostname.toLowerCase())) continue;
    if (allowed.has(url ? url.href : href)) continue;
    removed.push({ href, text: $(el).text().replace(/\s+/g, " ").trim(), reason: url ? OTHER_SITE : "not a web address" });
    $(el).replaceWith($(el).contents());
  }
  return removed.length > 0 ? { html: $.html(), removed } : { html, removed };
}

/**
 * A translation of a post someone may have added links to by hand (the
 * editor's "Draft with AI"): the links to other websites the original already
 * has stay, and so do its mailto: and tel: links, and any the translator added go.
 */
export function removeAddedLinks(translated: string, originals: string[], rules: SiteRules): { html: string; removed: RemovedLink[] } {
  const allowed = new Set<string>();
  for (const original of originals) {
    const $ = cheerio.load(original, null, false);
    for (const el of $("a[href]").toArray()) {
      const href = ($(el).attr("href") ?? "").trim();
      const url = webAddress(href, rules.siteOrigin);
      if (url) allowed.add(url.href);
      else if (/^(?:mailto|tel):/i.test(href)) allowed.add(href);
    }
  }
  return removeExternalLinks(translated, rules, allowed);
}
