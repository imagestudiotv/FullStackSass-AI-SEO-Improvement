import * as cheerio from "cheerio";
import type { AnyNode, Element, Text } from "domhandler";

import { keyWords, overlap, pathWords, wholeWord } from "@/lib/articles/link-words";
import { sanitizeHtml } from "@/lib/articles/sanitize";

/**
 * Makes every link in an article point somewhere real.
 *
 * WHAT WAS WRONG. The writer was asked to "work in about N internal links to
 * other pages on this site" without being told a single URL, so it made them
 * up: "#" placeholders, and plausible paths such as
 * /destination-wedding-photography-films that the site never had. Nothing
 * checked them afterwards, and the plugin and the CMS publishers sent the
 * stored HTML exactly as written. The contents list had the same fault: its
 * "#section" links pointed at heading ids the sanitizer had removed.
 *
 * WHAT THIS DOES. It parses the HTML (cheerio, not regular expressions) and
 * decides each anchor on evidence:
 *
 *  - "#", an empty href, a placeholder ("[link]", example.com) or an unusable
 *    scheme: the anchor is unwrapped; its words and formatting stay.
 *  - "#section": kept only when that id exists in this article. A contents
 *    entry whose target is missing is pointed at the heading with the same
 *    text, when there is one; otherwise unwrapped.
 *  - A link to the customer's own site: resolved against THEIR site (never
 *    this application's domain) and judged by a verification verdict
 *    (link-verify.ts). Confirmed missing: replaced only by a verified page
 *    that is clearly about the same thing, otherwise unwrapped. Not checkable
 *    right now: dropped from new articles; kept, and reported, in stored ones.
 *  - Anything else (citations, the backlink, social profiles, mailto: and
 *    tel:) is left exactly as it is.
 *
 * Nothing here guesses a URL from words: every destination written is one
 * that was verified. When no verified, relevant page exists, the text simply
 * stays text.
 */

/* ------------------------------------------------------------------------ */
/* The customer's site                                                      */
/* ------------------------------------------------------------------------ */

export type SiteScope = {
  /** The public origin relative links resolve against, e.g. https://imagestudio.com */
  origin: string;
  /** Hostnames that are this site: its own, and its www / non-www twin. */
  hosts: ReadonlySet<string>;
};

/**
 * The site a website row describes.
 *
 * Only the host itself and its www twin count as the site. Other subdomains
 * are not trusted automatically: shop.example.com may be a different platform,
 * a different owner, or a page that was never meant to be linked.
 */
export function siteScope(site: { url: string; domain?: string | null }): SiteScope {
  const base = new URL(site.url);
  const hosts = new Set<string>();
  const add = (raw: string) => {
    let host: string;
    try {
      host = new URL(`https://${raw.replace(/^[a-z]+:\/\//i, "")}`).hostname;
    } catch {
      return;
    }
    host = host.toLowerCase().replace(/\.$/, "");
    if (!host) return;
    hosts.add(host);
    hosts.add(host.startsWith("www.") ? host.slice(4) : `www.${host}`);
  };
  add(base.hostname);
  if (site.domain) add(site.domain);
  return { origin: base.origin, hosts };
}

export function inScope(url: string | URL, scope: SiteScope): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return scope.hosts.has(parsed.hostname.toLowerCase().replace(/\.$/, ""));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------ */
/* Verdicts (produced by link-verify.ts)                                    */
/* ------------------------------------------------------------------------ */

/**
 * ok: the page answered and is a real page on this site.
 * missing: confirmed not there - 404/410, an error page served as 200, or a
 *   redirect to the homepage.
 * rejected: answered, but not somewhere to link - a login page, a redirect
 *   off the site or to an unrelated page, a non-public address.
 * unavailable: no answer we can judge - timeout, 5xx, 429, a firewall's 403.
 *   Never treated as proof that a page is gone.
 */
export type LinkStatus = "ok" | "missing" | "rejected" | "unavailable";

export type LinkVerdict = {
  /** The URL that was checked, without its #fragment. */
  url: string;
  status: LinkStatus;
  /** Where it ended up after same-site redirects, when it answered. */
  finalUrl: string | null;
  httpStatus: number | null;
  reason: string;
  title: string | null;
  /** True when the destination is an HTML page (a PDF can be linked, not suggested). */
  isHtml: boolean;
  checkedAt: string;
};

/** A verified page that new links may point at, most relevant first. */
export type LinkTarget = { url: string; title: string; score: number };

/* ------------------------------------------------------------------------ */
/* Reading an href                                                          */
/* ------------------------------------------------------------------------ */

export type Href =
  | { kind: "placeholder" }
  | { kind: "invalid" }
  | { kind: "fragment"; id: string }
  | { kind: "special" }
  | { kind: "external"; url: string }
  | { kind: "internal"; key: string; fragment: string };

/** Hosts that only ever appear as a writer's stand-in for a real address. */
const PLACEHOLDER_HOSTS =
  /^(www\.)?(example\.(com|org|net)|your-?(domain|website|site)\.[a-z.]+|domain\.com|website\.com|site\.com)$/i;

/** hrefs that are a stand-in rather than an address. */
const PLACEHOLDER_HREF =
  /^(#!?|javascript:.*|about:blank|url|link|href|your[-_ ]?(link|url)|link[-_ ]?here|insert[-_ ]?link|todo|tbd|n\/?a)$/i;

/**
 * Classifies an href as written. Internal links resolve against `base`,
 * which is the article's own public address when known and the site's root
 * otherwise - never this application's domain.
 */
export function readHref(raw: string | undefined, scope: SiteScope, base?: string | null): Href {
  const href = (raw ?? "").trim();
  if (!href || PLACEHOLDER_HREF.test(href)) return { kind: "placeholder" };
  // Unfilled template markers: "[URL]", "{{link}}", "<link>", "%7Burl%7D".
  if (/[[\]{}<>]|%5B|%5D|%7B|%7D/i.test(href)) return { kind: "placeholder" };

  if (href.startsWith("#")) {
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // Keep it as written.
    }
    return id ? { kind: "fragment", id } : { kind: "placeholder" };
  }
  if (/^(mailto|tel):/i.test(href)) return { kind: "special" };

  let url: URL;
  try {
    url = new URL(href, base || `${scope.origin}/`);
  } catch {
    return { kind: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "invalid" };
  if (PLACEHOLDER_HOSTS.test(url.hostname)) return { kind: "placeholder" };

  if (!inScope(url, scope)) return { kind: "external", url: url.toString() };

  const fragment = url.hash;
  url.hash = "";
  return { kind: "internal", key: url.toString(), fragment };
}

/** The internal URLs an article links to, for verification before repair. */
export function internalLinkKeys(html: string, scope: SiteScope, base?: string | null): string[] {
  const $ = cheerio.load(html, null, false);
  const keys = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = readHref($(element).attr("href"), scope, base);
    if (href.kind === "internal") keys.add(href.key);
  });
  return [...keys];
}

/* ------------------------------------------------------------------------ */
/* The pass                                                                 */
/* ------------------------------------------------------------------------ */

export type LinkFinding = {
  /** The href exactly as it was written. */
  href: string;
  /** The anchor's visible text. */
  text: string;
  outcome: "kept" | "rewritten" | "replaced" | "unwrapped" | "trimmed" | "unverified";
  reason: string;
  /** The internal URL it resolved to, when it was internal. */
  url?: string;
  verdict?: LinkStatus;
  /** The new href, for rewritten and replaced links. */
  replacement?: string;
  /** The anchor before and after, for a reviewer. */
  before: string;
  after: string;
};

export type GuardOptions = {
  scope: SiteScope;
  /**
   * "generated": the writer just produced this. Anything unproven goes, and
   * automatic links may be added up to maxAutoLinks.
   *
   * "existing": stored or hand-edited content. Confirmed defects are fixed,
   * but a link that merely could not be checked right now is kept and
   * reported - a timeout is not proof that a page is gone, and a person may
   * have put that link there on purpose. Nothing is added.
   */
  mode: "generated" | "existing";
  /** Verdicts by internal URL (no fragment). See link-verify.ts. */
  verdicts: ReadonlyMap<string, LinkVerdict>;
  /** The article's own public address: never linked to, and the relative base. */
  articleUrl?: string | null;
  /** Verified pages, most relevant first: for new links and replacements. */
  targets?: LinkTarget[];
  /**
   * The website's internalLinkTarget: the most automatic internal links a
   * new article gets. 0 means none. Links a person added are never removed
   * to meet it.
   */
  maxAutoLinks?: number;
  /** hrefs left untouched whatever they are, such as a matched backlink. */
  protectedHrefs?: string[];
};

export type GuardResult = {
  html: string;
  changed: boolean;
  findings: LinkFinding[];
  inserted: LinkTarget[];
};

/** Replacement and new links need at least this much in common with the text. */
const MIN_RELEVANCE = 2;

/** Tags inside which a new link would be wrong: nested, in code, or in a heading. */
const NO_LINK_INSIDE = new Set(["a", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "script", "style"]);

/** A slug for a heading id: lowercase words joined by hyphens. */
export function headingId(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug && /^[a-z]/.test(slug) ? slug : `section-${slug || "x"}`;
}

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Same document: same URL once trailing slashes and fragments are ignored. */
function sameDocument(a: string, b: string): boolean {
  const strip = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = "";
      url.hostname = url.hostname.replace(/^www\./, "");
      url.protocol = "https:";
      return url.toString().replace(/\/+(\?|$)/, "$1");
    } catch {
      return value;
    }
  };
  return strip(a) === strip(b);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

export function guardLinks(html: string, options: GuardOptions): GuardResult {
  const { scope, mode, verdicts } = options;
  const $ = cheerio.load(html, null, false);
  const findings: LinkFinding[] = [];
  const protectedHrefs = new Set(options.protectedHrefs ?? []);
  const base = options.articleUrl && inScope(options.articleUrl, scope) ? options.articleUrl : null;
  let changed = false;

  const outer = (el: Element) => $.html(el) ?? "";
  const textOf = (el: Element) => $(el).text().replace(/\s+/g, " ").trim();

  /** Keeps the words and formatting, loses the link. */
  const unwrap = (el: Element) => {
    $(el).replaceWith($(el).contents());
    changed = true;
  };

  const record = (
    el: Element | null,
    href: string,
    text: string,
    before: string,
    finding: Omit<LinkFinding, "href" | "text" | "before" | "after">,
  ) => {
    findings.push({ href, text, before, after: el ? outer(el) : escapeHtml(text), ...finding });
  };

  /* --- Headings, for fragment links ------------------------------------- */
  const ids = new Set<string>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (id) ids.add(id);
  });
  const headings = $("h2, h3, h4, h5, h6").toArray();

  /** The heading a contents entry means, by its id's slug or its text. */
  const headingFor = (id: string, text: string): Element | null => {
    const wantText = normalizeText(text);
    for (const heading of headings) {
      const headingText = textOf(heading);
      if (headingId(headingText) === headingId(id) || normalizeText(headingText) === wantText) {
        return heading;
      }
    }
    return null;
  };

  const uniqueId = (wanted: string) => {
    let id = wanted;
    for (let n = 2; ids.has(id); n++) id = `${wanted}-${n}`;
    ids.add(id);
    return id;
  };

  /* --- Every anchor, in document order ---------------------------------- */
  const linked = new Set<string>();
  const internalKept: Element[] = [];
  const targets = options.targets ?? [];

  /**
   * A verified page clearly about what this anchor SAYS. Judged on the
   * visible words only: the broken URL's slug was invented too, and a
   * reader clicking "films" must not land on a photography page because a
   * made-up slug mentioned photography.
   */
  const replacementFor = (text: string): LinkTarget | null => {
    const wanted = keyWords(text);
    let best: { target: LinkTarget; score: number } | null = null;
    for (const target of targets) {
      if (linked.has(target.url)) continue;
      if (base && sameDocument(target.url, base)) continue;
      const have = new Set([...keyWords(target.title), ...keyWords(pathWords(target.url))]);
      const score = overlap(wanted, have);
      if (score >= MIN_RELEVANCE && (!best || score > best.score)) best = { target, score };
    }
    return best?.target ?? null;
  };

  for (const el of $("a").toArray()) {
    const hrefAttr = $(el).attr("href");
    const written = hrefAttr ?? "";
    const text = textOf(el);
    const before = outer(el);

    if (hrefAttr !== undefined && protectedHrefs.has(hrefAttr)) continue;

    const href = readHref(hrefAttr, scope, base);

    if (href.kind === "placeholder" || href.kind === "invalid") {
      unwrap(el);
      record(null, written, text, before, {
        outcome: "unwrapped",
        reason: href.kind === "placeholder" ? "placeholder link with no destination" : "not a usable address",
      });
      continue;
    }

    if (href.kind === "special" || href.kind === "external") continue;

    if (href.kind === "fragment") {
      if (ids.has(href.id)) continue;
      const heading = headingFor(href.id, text);
      if (heading) {
        const id = $(heading).attr("id") ?? uniqueId(headingId(textOf(heading)));
        $(heading).attr("id", id);
        $(el).attr("href", `#${id}`);
        changed = true;
        record(el, written, text, before, {
          outcome: "rewritten",
          reason: "section link pointed at a heading id that did not exist",
          replacement: `#${id}`,
        });
      } else {
        unwrap(el);
        record(null, written, text, before, {
          outcome: "unwrapped",
          reason: "section link with no matching heading in the article",
        });
      }
      continue;
    }

    /* Internal: the customer's own site. */
    const key = href.key;
    if (base && sameDocument(key, base)) {
      unwrap(el);
      record(null, written, text, before, { outcome: "unwrapped", reason: "links to the article itself", url: key });
      continue;
    }

    const verdict = verdicts.get(key);
    const status: LinkStatus = verdict?.status ?? "unavailable";

    if (status === "ok") {
      const destination = verdict?.finalUrl ?? key;
      if (mode === "generated" && linked.has(destination)) {
        unwrap(el);
        record(null, written, text, before, {
          outcome: "unwrapped",
          reason: "second link to the same page",
          url: key,
          verdict: status,
        });
        continue;
      }
      // A redirect's target may not have the same section, so the fragment
      // survives only when the page did not move.
      const next = destination === key ? `${destination}${href.fragment}` : destination;
      linked.add(destination);
      internalKept.push(el);
      if (next !== written) {
        $(el).attr("href", next);
        changed = true;
        record(el, written, text, before, {
          outcome: "rewritten",
          reason: destination === key ? "made absolute on the website" : `page moved: ${verdict?.reason ?? "redirect"}`,
          url: key,
          verdict: status,
          replacement: next,
        });
      } else {
        record(el, written, text, before, { outcome: "kept", reason: "verified", url: key, verdict: status });
      }
      continue;
    }

    if (status === "missing" || status === "rejected") {
      const replacement = replacementFor(text);
      if (replacement) {
        $(el).attr("href", replacement.url);
        linked.add(replacement.url);
        internalKept.push(el);
        changed = true;
        record(el, written, text, before, {
          outcome: "replaced",
          reason: `${verdict?.reason ?? status}; replaced with a verified page on the same topic`,
          url: key,
          verdict: status,
          replacement: replacement.url,
        });
      } else {
        unwrap(el);
        record(null, written, text, before, {
          outcome: "unwrapped",
          reason: verdict?.reason ?? status,
          url: key,
          verdict: status,
        });
      }
      continue;
    }

    // Unavailable, or never checked.
    if (mode === "generated") {
      unwrap(el);
      record(null, written, text, before, {
        outcome: "unwrapped",
        reason: `could not be verified (${verdict?.reason ?? "not checked"})`,
        url: key,
        verdict: status,
      });
    } else {
      linked.add(key);
      record(el, written, text, before, {
        outcome: "unverified",
        reason: `kept: could not be verified (${verdict?.reason ?? "not checked"})`,
        url: key,
        verdict: status,
      });
    }
  }

  /* --- The automatic-link limit, for new articles only ------------------- */
  const limit = Math.max(0, options.maxAutoLinks ?? 0);
  if (mode === "generated" && internalKept.length > limit) {
    for (const el of internalKept.slice(limit)) {
      const written = $(el).attr("href") ?? "";
      const text = textOf(el);
      const before = outer(el);
      unwrap(el);
      record(null, written, text, before, {
        outcome: "trimmed",
        reason: `over the website's internal link setting (${limit})`,
      });
    }
  }

  /* --- New links to verified pages -------------------------------------- */
  const inserted: LinkTarget[] = [];
  let budget = mode === "generated" ? limit - Math.min(internalKept.length, limit) : 0;
  if (budget > 0 && targets.length > 0) {
    const usedBlocks = new Set<AnyNode>();
    for (const target of targets) {
      if (budget <= 0) break;
      if (linked.has(target.url)) continue;
      if (base && sameDocument(target.url, base)) continue;
      if (insertLink($, target, usedBlocks)) {
        linked.add(target.url);
        inserted.push(target);
        budget -= 1;
        changed = true;
      }
    }
  }

  if (!changed) return { html, changed: false, findings, inserted };
  // Back through the sanitizer, so what is stored is exactly what every other
  // save path would store, and a second pass finds nothing left to do.
  return {
    html: sanitizeHtml($.html(), { siteHosts: scope.hosts }),
    changed: true,
    findings,
    inserted,
  };
}

/**
 * Links the first natural occurrence of one of the target's distinctive
 * words, inside a paragraph or list item, outside links, code and headings,
 * and at most one new link per paragraph. The words are the customer's own:
 * nothing is rewritten to make room for a link.
 */
function insertLink($: cheerio.CheerioAPI, target: LinkTarget, usedBlocks: Set<AnyNode>): boolean {
  const phrases = anchorPhrases(target.title);
  const blocks = $("p, li").toArray();

  for (const phrase of phrases) {
    const pattern = wholeWord(phrase);
    for (const block of blocks) {
      if (usedBlocks.has(block)) continue;
      const textNodes = collectText(block);
      for (const node of textNodes) {
        const match = pattern.exec(node.data);
        if (!match) continue;
        const start = match.index;
        const end = start + match[0].length;
        const html =
          escapeHtml(node.data.slice(0, start)) +
          `<a href="${escapeAttr(target.url)}">${escapeHtml(match[0])}</a>` +
          escapeHtml(node.data.slice(end));
        $(node).replaceWith(html);
        usedBlocks.add(block);
        return true;
      }
    }
  }
  return false;
}

/**
 * Anchor text to look for, best first: two consecutive title words that are
 * both distinctive ("wedding photography"), then single distinctive words,
 * longest first. A specific phrase reads as a natural link; a lone word is
 * the fallback.
 */
export function anchorPhrases(title: string): string[] {
  const distinctive = keyWords(title);
  const words = title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const pairs: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    if (distinctive.has(words[i]) && distinctive.has(words[i + 1])) pairs.push(`${words[i]} ${words[i + 1]}`);
  }
  const singles = [...distinctive].sort((a, b) => [...b].length - [...a].length);
  return [...new Set([...pairs, ...singles])];
}

/** Text nodes under a block that a link may be placed in. */
function collectText(block: Element): Text[] {
  const out: Text[] = [];
  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      out.push(node as Text);
      return;
    }
    if (node.type !== "tag") return;
    const element = node as Element;
    if (NO_LINK_INSIDE.has(element.name)) return;
    for (const child of element.children) walk(child);
  };
  for (const child of block.children) walk(child);
  return out;
}

/**
 * Links the first occurrence of `phrase` (whole words, any case) to `url`,
 * inside a paragraph or list item and outside links, code and headings - the
 * same places automatic links may go. For administrator placements
 * (lib/backlinks/managed.ts): the anchor is words already in the article, so
 * nothing is rewritten to make room for a link. `linked` is false when the
 * phrase is not there (or only inside a heading, code or another link).
 */
export function linkPhrase(
  html: string,
  phrase: string,
  url: string,
  siteHosts?: ReadonlySet<string>,
): { html: string; linked: boolean } {
  const wanted = phrase.trim().replace(/\s+/g, " ");
  if (!wanted) return { html, linked: false };
  const $ = cheerio.load(html, null, false);
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
  for (const block of $("p, li").toArray()) {
    for (const node of collectText(block)) {
      const match = pattern.exec(node.data);
      if (!match) continue;
      const start = match.index;
      const end = start + match[0].length;
      $(node).replaceWith(
        escapeHtml(node.data.slice(0, start)) +
          `<a href="${escapeAttr(url)}">${escapeHtml(match[0])}</a>` +
          escapeHtml(node.data.slice(end)),
      );
      return { html: sanitizeHtml($.html(), { siteHosts }), linked: true };
    }
  }
  return { html, linked: false };
}

/** Unwraps every link to exactly `url`, keeping its words. */
export function unlinkUrl(html: string, url: string, siteHosts?: ReadonlySet<string>): { html: string; removed: number } {
  const $ = cheerio.load(html, null, false);
  let removed = 0;
  for (const el of $("a").toArray()) {
    if ($(el).attr("href") !== url) continue;
    $(el).replaceWith($(el).contents());
    removed += 1;
  }
  return removed ? { html: sanitizeHtml($.html(), { siteHosts }), removed } : { html, removed };
}
