/**
 * Turning a stored crawl failure into advice.
 *
 * audit-website.ts records `error.message.slice(0, 500)` on the crawls row and
 * the audit panel printed it. CrawlError carries a `kind` that would classify
 * this precisely, but the kind is not persisted — only the message is — so
 * this matches on the message text instead. Changing what is written would
 * mean touching the job's failure path, which is out of scope for UI work.
 *
 * The stored string is left exactly as it is for support and Sentry; only the
 * rendering changes.
 */

export type CrawlFailure = {
  summary: string;
  action: string | null;
};

const GENERIC: CrawlFailure = {
  summary: "We could not finish checking your website.",
  action: "Try again. If it keeps happening, contact support.",
};

/** First match wins, so specific patterns come before general ones. */
const PATTERNS: { match: RegExp; failure: CrawlFailure }[] = [
  {
    match: /timed out|timeout/i,
    failure: {
      summary: "Your website took too long to respond.",
      action: "Try again — this is often temporary on a busy server.",
    },
  },
  {
    match: /not a web page|not_html/i,
    failure: {
      summary: "That address did not return a web page.",
      action: "Check the address points at your site's home page.",
    },
  },
  {
    match: /too large/i,
    failure: {
      summary: "Your home page is too large for us to analyse.",
      action: null,
    },
  },
  {
    match: /invalid start url|invalid url/i,
    failure: {
      summary: "That website address could not be read.",
      action: "Check the address, including http:// or https://.",
    },
  },
  {
    /** An HTTP status the server returned, e.g. 403 or 500. */
    match: /\b(4\d{2}|5\d{2})\b|http_error|status/i,
    failure: {
      summary: "Your website refused the request.",
      action:
        "A firewall or security plugin may be blocking us. Try again, or allow our crawler.",
    },
  },
  {
    match: /unreachable|ENOTFOUND|ECONNREFUSED|DNS/i,
    failure: {
      summary: "We could not reach your website.",
      action: "Check the site is online and the address is correct.",
    },
  },
];

export function explainCrawlError(
  stored: string | null | undefined,
): CrawlFailure {
  if (!stored) return GENERIC;
  for (const { match, failure } of PATTERNS) {
    if (match.test(stored)) return failure;
  }
  return GENERIC;
}
