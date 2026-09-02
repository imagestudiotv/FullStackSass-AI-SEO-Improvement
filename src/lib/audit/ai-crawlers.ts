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
 * Matched against ASSET URLS — image sources and internal links — rather than
 * raw HTML, because the crawler keeps visible text and links but not the
 * original markup. That is actually where the reliable fingerprints live:
 * /wp-content/uploads/... in an image src identifies WordPress far better than
 * anything in the body copy.
 *
 * Returns null rather than guessing when nothing matches. "Custom" is a real
 * answer, and a wrong platform name is an obvious error to anyone who knows
 * their own site.
 */
export function detectPlatform(assetUrls: string[]): string | null {
  const haystack = assetUrls.join(" ");
  const checks: [RegExp, string][] = [
    [/wp-content|wp-includes|wp-json/i, "WordPress"],
    [/cdn\.shopify\.com|Shopify\.theme/i, "Shopify"],
    [/ghost\.io|content\/themes\/casper|ghost-sdk/i, "Ghost"],
    [/wix\.com|wixstatic/i, "Wix"],
    [/squarespace|static1\.squarespace/i, "Squarespace"],
    [/webflow\.io|w-webflow/i, "Webflow"],
    [/_next\/static/i, "Next.js"],
    [/drupal-settings-json|\/sites\/default\/files/i, "Drupal"],
    [/joomla|\/media\/jui\//i, "Joomla"],
  ];

  for (const [pattern, name] of checks) {
    if (pattern.test(haystack)) return name;
  }
  return null;
}
