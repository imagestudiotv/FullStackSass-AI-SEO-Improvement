import "server-only";

import * as cheerio from "cheerio";

import { safeFetch } from "@/lib/net/safe-fetch";

/**
 * The links in an article the autopilot wrote, checked before it is saved.
 * A link the writer made up must never reach a reader, so anything not
 * proven is unwrapped - its words stay, the link goes:
 *
 *  - A link to RepGet's own site stays only when it is one of the pages the
 *    writer was given (published English posts, the free audit, the free
 *    tools, pricing), and is written as the full https://www.repget.com
 *    address, like the blog's hand-written posts.
 *  - A link to another site stays only when it is official documentation
 *    (SOURCE_HOSTS: Google's, Bing's, the web standards'...) and the page
 *    actually answers. Never another blog or a competitor.
 *  - Anything else (mailto:, a #fragment, a broken address) is unwrapped.
 */

/** Official documentation the writer may cite. Matched exactly, host by host. */
export const SOURCE_HOSTS = new Set([
  "developers.google.com",
  "support.google.com",
  "search.google.com",
  "blog.google",
  "www.bing.com",
  "schema.org",
  "developer.mozilla.org",
  "web.dev",
  "www.w3.org",
  "llmstxt.org",
  "platform.openai.com",
  "help.openai.com",
]);

/** External links checked per article; one past this is unwrapped unchecked. */
const MAX_EXTERNAL_CHECKS = 15;
const CHECK_TIMEOUT_MS = 10_000;

export type LinkRules = {
  /** "https://www.repget.com" - internal links are rewritten onto it. */
  siteOrigin: string;
  /** RepGet's hosts, with and without www (lib/blog/post-fields.ts blogSiteHosts). */
  siteHosts: ReadonlySet<string>;
  /** The paths the writer was given: "/blog/local-seo-small-business", "/audit"... */
  internalPaths: ReadonlySet<string>;
  /** True when the page answers; replaced in tests. */
  pageAnswers?: (url: string) => Promise<boolean>;
};

export type RemovedLink = { href: string; text: string; reason: string };

export type LinkCheck = {
  /** The same pieces of HTML, in the same order, with the links checked. */
  html: string[];
  kept: { internal: number; external: number };
  removed: RemovedLink[];
};

/** A GET that ends in a 2xx, redirects followed, through the SSRF-safe layer. */
export async function pageAnswers(url: string): Promise<boolean> {
  try {
    const response = await safeFetch(url, {
      redirect: "follow",
      maxBytes: 256 * 1024,
      overflow: "truncate",
      timeoutMs: CHECK_TIMEOUT_MS,
      headers: { "user-agent": "Mozilla/5.0 (compatible; RepGetLinkCheck/1.0; +https://repget.com)", accept: "text/html" },
    });
    // Read to the end (bounded above): cancelling a safeFetch body part way can throw outside any handler.
    await response.arrayBuffer().catch(() => undefined);
    return response.ok;
  } catch {
    return false;
  }
}

/** "/blog/x/" and "/blog/x" are one page; "/" stays "/". */
export function pagePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

/** Checks every link in `pieces` (the body, then each FAQ answer), sharing one budget of network checks. */
export async function checkLinks(pieces: string[], rules: LinkRules): Promise<LinkCheck> {
  const answers = rules.pageAnswers ?? pageAnswers;
  const verdicts = new Map<string, Promise<boolean>>();
  const kept = { internal: 0, external: 0 };
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

      if (!href || href.startsWith("#")) {
        unwrap("not a link to a page");
        continue;
      }
      let url: URL;
      try {
        url = new URL(href, rules.siteOrigin);
      } catch {
        unwrap("not a web address");
        continue;
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        unwrap("not a web address");
        continue;
      }

      if (rules.siteHosts.has(url.hostname.toLowerCase())) {
        const path = pagePath(url.pathname);
        if (!rules.internalPaths.has(path)) {
          unwrap("not one of RepGet's pages");
          continue;
        }
        $(el).attr("href", `${rules.siteOrigin}${path === "/" ? "" : path}`);
        kept.internal += 1;
        continue;
      }

      if (url.protocol !== "https:" || !SOURCE_HOSTS.has(url.hostname.toLowerCase())) {
        unwrap("not official documentation");
        continue;
      }
      url.hash = "";
      const key = url.toString();
      if (!verdicts.has(key)) {
        if (verdicts.size >= MAX_EXTERNAL_CHECKS) {
          unwrap("too many links to check");
          continue;
        }
        verdicts.set(key, answers(key));
      }
      if (await verdicts.get(key)) {
        kept.external += 1;
      } else {
        unwrap("the page did not answer");
      }
    }
    out.push($.html());
  }
  return { html: out, kept, removed };
}
