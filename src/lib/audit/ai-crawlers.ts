/**
 * Which AI crawlers a site allows.
 *
 * The reference audit shows this prominently, and it is one of the few things
 * on that page we can answer with certainty rather than an estimate: robots.txt
 * either names a crawler or it does not.
 *
 * It matters because blocking these is usually accidental. A security plugin
 * or a copied config adds "User-agent: GPTBot / Disallow: /", and the business
 * then cannot be cited by ChatGPT at all — with nothing in their own dashboard
 * ever telling them.
 */

/** The crawlers worth reporting on, with who they belong to. */
export const AI_CRAWLERS = [
  { agent: "GPTBot", owner: "ChatGPT" },
  { agent: "OAI-SearchBot", owner: "ChatGPT Search" },
  { agent: "ClaudeBot", owner: "Claude" },
  { agent: "PerplexityBot", owner: "Perplexity" },
  { agent: "Google-Extended", owner: "Gemini" },
] as const;

export type CrawlerAccess = {
  agent: string;
  owner: string;
  /** False when robots.txt blocks this crawler from the whole site. */
  allowed: boolean;
  /** True when the rule names this crawler rather than applying to all. */
  explicit: boolean;
};

/**
 * Reads robots.txt and reports each crawler's access.
 *
 * Deliberately narrow: it answers "is this agent disallowed from /" and
 * nothing subtler. robots.txt supports wildcards and precedence rules that a
 * short function gets wrong, and a confident wrong answer here would tell a
 * business they are blocked from ChatGPT when they are not.
 *
 * With no robots.txt at all, everything is allowed — which is both correct and
 * the common case.
 */
export function parseCrawlerAccess(robotsTxt: string | null): CrawlerAccess[] {
  if (!robotsTxt) {
    return AI_CRAWLERS.map((c) => ({ ...c, allowed: true, explicit: false }));
  }

  /** Disallow paths collected per user-agent, lower-cased. */
  const rules = new Map<string, string[]>();
  let current: string[] = [];

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      const agent = value.toLowerCase();
      if (!rules.has(agent)) rules.set(agent, []);
      current = rules.get(agent)!;
      continue;
    }

    if (field === "disallow" && value) current.push(value);
  }

  const blocksRoot = (paths: string[] | undefined) =>
    Boolean(paths?.some((p) => p === "/"));

  return AI_CRAWLERS.map((crawler) => {
    const own = rules.get(crawler.agent.toLowerCase());
    // A rule naming this crawler wins over the wildcard, which is how
    // robots.txt precedence actually works for a full-site disallow.
    if (own !== undefined) {
      return { ...crawler, allowed: !blocksRoot(own), explicit: true };
    }
    return {
      ...crawler,
      allowed: !blocksRoot(rules.get("*")),
      explicit: false,
    };
  });
}

/**
 * Guesses the platform a site is built on.
 *
 * Takes any strings that might carry a fingerprint — stylesheet and script
 * URLs, the generator meta tag, image sources, a slice of raw HTML. It used to
 * take image sources ALONE, which worked for WordPress, whose uploads sit
 * under /wp-content/, and failed for almost everything else: measured against
 * real sites it found 3 of 8, missing Shopify, Squarespace, Webflow and Ghost
 * even though their names appear hundreds of times in the markup, because a
 * modern site serves its images from a generic CDN.
 *
 * Returns null rather than guessing when nothing matches. "Custom" is a real
 * answer, and a wrong platform name is an obvious error to anyone who knows
 * their own site.
 */
export function detectPlatform(signals: string[]): string | null {
  const haystack = signals.join(" ");

  /**
   * Ordered most specific first.
   *
   * Shopify before the generic checks because a Shopify store can also load
   * Next.js assets, and "Shopify" is the answer the customer would give.
   */
  const checks: [RegExp, string][] = [
    [/wp-content|wp-includes|wp-json|wp-emoji|\/wp-\w/i, "WordPress"],
    [
      /cdn\.shopify\.com|shopify\.theme|shopify-features|myshopify\.com|shopifycdn/i,
      "Shopify",
    ],
    [
      /wixstatic|wix\.com|parastorage|_partials\/wix|wix-code/i,
      "Wix",
    ],
    [
      /squarespace|static1\.squarespace|sqsp\.net|squarespace-cdn/i,
      "Squarespace",
    ],
    [
      /webflow|w-webflow|assets\.website-files|uploads-ssl\.webflow/i,
      "Webflow",
    ],
    [
      /ghost\.io|content\/themes\/casper|ghost-sdk|\/ghost\/api|gh-head/i,
      "Ghost",
    ],
    [/drupal-settings-json|\/sites\/default\/files|drupal\.js/i, "Drupal"],
    [/joomla|\/media\/jui\/|com_content/i, "Joomla"],
    [/bigcommerce|bigcommerce\.com\/s-/i, "BigCommerce"],
    [/woocommerce|wc-ajax/i, "WooCommerce"],
    /*
      Last: a framework is what the site is BUILT with rather than what it is
      published with, so anything above is the more useful answer when both
      match. Kept because "Next.js" is still better than nothing for a custom
      site with no CMS.
    */
    [/_next\/static|__NEXT_DATA__/i, "Next.js"],
  ];

  for (const [pattern, name] of checks) {
    if (pattern.test(haystack)) return name;
  }
  return null;
}
