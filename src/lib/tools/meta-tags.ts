import * as cheerio from "cheerio";

import { InvalidUrlError, isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";
import { SNIPPET_LIMITS } from "@/lib/tools/snippet";

/**
 * Meta tag checker.
 *
 * Reads the tags Google and the social networks actually use, and says which
 * are missing. Deliberately separate from the crawler's PageSnapshot, which
 * keeps only what the audit scores — Open Graph and Twitter tags never reach
 * it, and they are the ones that decide what a shared link looks like.
 *
 * A missing og:image is invisible until someone posts your link and it comes
 * out as a grey box, by which point the post is already up.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;

export type TagStatus = "good" | "warn" | "missing";

export type MetaTag = {
  label: string;
  /** The attribute name, so someone can search their theme for it. */
  name: string;
  value: string | null;
  status: TagStatus;
  /** What to do, when there is something to do. */
  note: string | null;
};

export type MetaTagGroup = {
  heading: string;
  tags: MetaTag[];
};

export type MetaTagResult = {
  domain: string;
  finalUrl: string;
  groups: MetaTagGroup[];
  counts: { good: number; warn: number; missing: number };
};

export type MetaTagOutcome =
  | { ok: true; result: MetaTagResult }
  | { ok: false; error: string };

/** Judges a tag by presence and, where it matters, length. */
function judge(
  value: string | null,
  options: { min?: number; max?: number; missingNote: string },
): { status: TagStatus; note: string | null } {
  if (!value) return { status: "missing", note: options.missingNote };

  const length = value.length;
  if (options.max !== undefined && length > options.max) {
    return {
      status: "warn",
      note: `${length} characters — will be cut short at about ${options.max}.`,
    };
  }
  if (options.min !== undefined && length < options.min) {
    return {
      status: "warn",
      note: `Only ${length} characters. There is room to say more.`,
    };
  }
  return { status: "good", note: null };
}

export async function checkMetaTags(input: string): Promise<MetaTagOutcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidUrlError
          ? error.message
          : "Enter a valid website address",
    };
  }

  if (!isPublicWebsiteUrl(normalized.url)) {
    return { ok: false, error: "That address is not publicly reachable." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let html: string;
  let finalUrl: string;
  try {
    const response = await fetch(normalized.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SEOVisionBot/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `That page returned ${response.status} instead of loading.`,
      };
    }
    const buffer = await response.arrayBuffer();
    html = new TextDecoder().decode(buffer.slice(0, MAX_BYTES));
    finalUrl = response.url || normalized.url;
  } catch {
    return {
      ok: false,
      error: "We could not reach that page. Check the address and try again.",
    };
  } finally {
    clearTimeout(timer);
  }

  const $ = cheerio.load(html);
  const clean = (value: string | undefined): string | null => {
    const trimmed = value?.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed : null;
  };

  const meta = (selector: string) => clean($(selector).attr("content"));

  const title = clean($("title").first().text());
  const description = meta('meta[name="description"]');
  const canonical = clean($('link[rel="canonical"]').attr("href"));
  const robots = meta('meta[name="robots"]');
  const viewport = meta('meta[name="viewport"]');
  const lang = clean($("html").attr("lang"));

  const ogTitle = meta('meta[property="og:title"]');
  const ogDescription = meta('meta[property="og:description"]');
  const ogImage = meta('meta[property="og:image"]');
  const ogType = meta('meta[property="og:type"]');
  const ogUrl = meta('meta[property="og:url"]');

  const twitterCard = meta('meta[name="twitter:card"]');
  const twitterTitle = meta('meta[name="twitter:title"]');
  const twitterImage = meta('meta[name="twitter:image"]');

  const groups: MetaTagGroup[] = [
    {
      heading: "Search engines",
      tags: [
        {
          label: "Page title",
          name: "<title>",
          value: title,
          ...judge(title, {
            min: SNIPPET_LIMITS.titleMin,
            max: SNIPPET_LIMITS.titleMax,
            missingNote:
              "Add a title. It is the headline people see in search results.",
          }),
        },
        {
          label: "Meta description",
          name: 'meta name="description"',
          value: description,
          ...judge(description, {
            min: SNIPPET_LIMITS.metaMin,
            max: SNIPPET_LIMITS.metaMax,
            missingNote:
              "Without one, Google picks a sentence from the page — often the wrong one.",
          }),
        },
        {
          label: "Canonical URL",
          name: 'link rel="canonical"',
          value: canonical,
          ...judge(canonical, {
            missingNote:
              "Tells search engines which address is the real one when a page is reachable more than one way.",
          }),
        },
        {
          label: "Language",
          name: "<html lang>",
          value: lang,
          ...judge(lang, {
            missingNote:
              "Helps search engines serve your pages to the right people.",
          }),
        },
        {
          /**
           * Reported, never judged. "noindex" is correct on a staging site and
           * catastrophic on a live one, and we cannot tell which this is.
           */
          label: "Robots directive",
          name: 'meta name="robots"',
          value: robots,
          status: /noindex/i.test(robots ?? "") ? "warn" : "good",
          note: /noindex/i.test(robots ?? "")
            ? "This page asks search engines not to index it. Deliberate on a staging site; serious on a live one."
            : null,
        },
        {
          label: "Viewport",
          name: 'meta name="viewport"',
          value: viewport,
          ...judge(viewport, {
            missingNote:
              "Without it the page renders at desktop width on phones, which Google treats as not mobile friendly.",
          }),
        },
      ],
    },
    {
      heading: "Sharing (Open Graph)",
      tags: [
        {
          label: "og:title",
          name: 'meta property="og:title"',
          value: ogTitle,
          ...judge(ogTitle, {
            missingNote: "Falls back to the page title when shared.",
          }),
        },
        {
          label: "og:description",
          name: 'meta property="og:description"',
          value: ogDescription,
          ...judge(ogDescription, {
            missingNote: "Falls back to the meta description when shared.",
          }),
        },
        {
          label: "og:image",
          name: 'meta property="og:image"',
          value: ogImage,
          ...judge(ogImage, {
            missingNote:
              "Without this your link shares as a grey box. The single highest-impact tag here.",
          }),
        },
        {
          label: "og:type",
          name: 'meta property="og:type"',
          value: ogType,
          ...judge(ogType, { missingNote: 'Usually "website" or "article".' }),
        },
        {
          label: "og:url",
          name: 'meta property="og:url"',
          value: ogUrl,
          ...judge(ogUrl, {
            missingNote: "The canonical address for the shared link.",
          }),
        },
      ],
    },
    {
      heading: "Sharing (X / Twitter)",
      tags: [
        {
          label: "twitter:card",
          name: 'meta name="twitter:card"',
          value: twitterCard,
          ...judge(twitterCard, {
            missingNote:
              'Set "summary_large_image" for a full-width preview instead of a thumbnail.',
          }),
        },
        {
          label: "twitter:title",
          name: 'meta name="twitter:title"',
          value: twitterTitle,
          ...judge(twitterTitle, { missingNote: "Falls back to og:title." }),
        },
        {
          label: "twitter:image",
          name: 'meta name="twitter:image"',
          value: twitterImage,
          ...judge(twitterImage, { missingNote: "Falls back to og:image." }),
        },
      ],
    },
  ];

  const all = groups.flatMap((group) => group.tags);

  return {
    ok: true,
    result: {
      domain: normalized.domain,
      finalUrl,
      groups,
      counts: {
        good: all.filter((t) => t.status === "good").length,
        warn: all.filter((t) => t.status === "warn").length,
        missing: all.filter((t) => t.status === "missing").length,
      },
    },
  };
}
