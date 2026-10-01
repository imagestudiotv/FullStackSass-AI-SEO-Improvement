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
 * URLs, the generator meta tag, image sources, internal link URLs. It used to
 * take image sources ALONE, which worked for WordPress, whose uploads sit
 * under /wp-content/, and failed for almost everything else: measured against
 * real sites it found 3 of 8, missing Shopify, Squarespace, Webflow and Ghost
 * even though their names appear hundreds of times in the markup, because a
 * modern site serves its images from a generic CDN.
 *
 * Returns null rather than guessing when nothing matches. "Custom" is a real
 * answer, and a wrong platform name is an obvious error to anyone who knows
 * their own site.
 *
 * A BARE PRODUCT NAME IS NOT A FINGERPRINT — the lesson this function learned
 * the hard way. `/webflow/` matched ANY string containing those letters, and
 * two of the three callers pass `internalUrls`, every internal link on the
 * page. So RepGet's own marketing site, which links to
 * /docs/integrations/webflow from its "works with" grid, reported ITSELF as
 * built on Webflow. The same held for any agency listing the platforms it
 * builds on, any blog post about Shopify, any footer saying "WordPress
 * hosting".
 *
 * So a pattern must match something only the platform itself emits: an asset
 * HOST it serves from, or a path prefix its own runtime uses. A word that a
 * site could plausibly write about must never be enough on its own.
 */
export function detectPlatform(
  signals: string[],
  /**
   * The page's <meta name="generator"> content, passed ON ITS OWN. Only this
   * value is read as a self-declaration: the other signals include relative
   * image paths and class attributes, where a first word such as "shopify"
   * (an <img src="shopify/logo.png">) says nothing about the site itself.
   */
  generator: string | null = null,
): string | null {
  const haystack = signals.join(" ");

  /**
   * The generator meta tag, read first and trusted above everything else.
   *
   * It is the one signal a site publishes ABOUT ITSELF rather than one we
   * infer, so it cannot be tripped by what the page happens to link to. Most
   * CMSs set it; those that do not fall through to the fingerprints below.
   */
  const declared = generatorPlatform(generator, CMS_GENERATORS);
  if (declared) return declared;

  /**
   * Ordered most specific first.
   *
   * Shopify before the generic checks because a Shopify store can also load
   * Next.js assets, and "Shopify" is the answer the customer would give.
   *
   * EVERY PATTERN IS ANCHORED to a host or a runtime path. Where a product
   * name appears it is qualified — "\.webflow\.io", not "webflow" — so a link
   * TO the platform's docs, or a sentence about it, cannot match.
   */
  const checks: [RegExp, string][] = [
    /*
      wp-content/ and wp-includes/ are where WordPress serves its own assets,
      and the trailing slash is what keeps "/docs/integrations/wordpress" out.
      wp-json/ is the REST API root.
    */
    [/wp-content\/|wp-includes\/|wp-json\/|wp-emoji-release/i, "WordPress"],
    [
      /cdn\.shopify\.com|shopify\.theme|shopify-features|myshopify\.com|shopifycdn/i,
      "Shopify",
    ],
    [/wixstatic\.com|parastorage\.com|\.wixsite\.com|_partials\/wix/i, "Wix"],
    [
      /static1\.squarespace\.com|squarespace-cdn\.com|\.sqsp\.net|squarespace\.com\/universal/i,
      "Squarespace",
    ],
    /*
      Webflow's asset hosts and its free subdomain. The bare word is gone: it
      is what made this product report itself as a Webflow site.
    */
    [
      /assets\.website-files\.com|assets-global\.website-files\.com|uploads-ssl\.webflow\.com|cdn\.prod\.website-files\.com|\.webflow\.io/i,
      "Webflow",
    ],
    [/\/ghost\/api\/|content\/themes\/casper|ghost-sdk|\.ghost\.io/i, "Ghost"],
    [/drupal-settings-json|\/sites\/default\/files\/|drupal\.js/i, "Drupal"],
    /*
      Joomla 3 (/media/jui/), 1.5-2.5 (mootools), non-SEF URLs, and Joomla 4/5:
      its core scripts, its web components and its site template folder. And
      the body class every Joomla template prints ("site com_content
      view-featured ..."), as a whole space-separated word: a URL never has a
      space before it, so a link or a post about Joomla cannot match - which
      keeps a Joomla site with its generator hidden and its assets combined
      from coming back as "Custom".
    */
    [
      /\/media\/jui\/|option=com_content|\/media\/system\/js\/mootools|\/media\/system\/js\/core|\/media\/vendor\/joomla-custom-elements\/|\/media\/templates\/site\/|(?:^|\s)com_content(?=\s|$)/i,
      "Joomla",
    ],
    [/bigcommerce\.com\/s-|cdn\d+\.bigcommerce\.com/i, "BigCommerce"],
    /*
      WooCommerce runs ON WordPress, so its assets live under plugins/ — which
      also means the WordPress check above usually wins first. Kept for a store
      whose theme loads Woo's scripts from a CDN.
    */
    [/plugins\/woocommerce\/|wc-ajax=|woocommerce\/assets\//i, "WooCommerce"],
  ];

  for (const [pattern, name] of checks) {
    if (pattern.test(haystack)) return name;
  }

  /*
    Last: a framework is what the site is BUILT with rather than what it is
    published with, so any CMS above is the more useful answer when both
    match - a Gatsby front end on WordPress or Shopify is "WordPress" or
    "Shopify" to its owner, even though Gatsby names itself in the generator.
    A framework's own generator still beats our Next.js guess.
  */
  const framework = generatorPlatform(generator, FRAMEWORK_GENERATORS);
  if (framework) return framework;
  // Kept because "Next.js" is still better than nothing for a custom site with no CMS.
  if (/\/_next\/static|__NEXT_DATA__/i.test(haystack)) return "Next.js";
  return null;
}

/**
 * Generator values we recognise, mapped to how the product spells itself.
 *
 * Only ever matched against the first word of the generator meta tag, so these
 * are whitelists of self-declarations rather than a substring search. Maps,
 * not objects: a crawled word such as "constructor" or "__proto__" must not
 * find an inherited property and come back as a function or an object.
 *
 * Two of them: a CMS that declares itself is trusted above everything, while
 * a FRAMEWORK that does (Gatsby prints its generator by default) is only the
 * answer when no CMS fingerprint matched - see detectPlatform.
 */
const CMS_GENERATORS = new Map<string, string>([
  ["wordpress", "WordPress"],
  ["webflow", "Webflow"],
  ["shopify", "Shopify"],
  ["squarespace", "Squarespace"],
  ["drupal", "Drupal"],
  ["joomla", "Joomla"],
  ["ghost", "Ghost"],
  ["wix", "Wix"],
]);

const FRAMEWORK_GENERATORS = new Map<string, string>([
  ["hugo", "Hugo"],
  ["jekyll", "Jekyll"],
  ["gatsby", "Gatsby"],
]);

/**
 * The platform a generator meta tag declares, or null.
 *
 * The leading run of letters and digits only, so the punctuation real
 * generators carry does not hide the name: "Joomla! - Open Source Content
 * Management" -> "joomla", "Wix.com Website Builder" -> "wix",
 * "WordPress 6.7.1" -> "wordpress".
 */
function generatorPlatform(generator: string | null | undefined, known: Map<string, string>): string | null {
  const first = /^[a-z][a-z0-9]*/.exec((generator ?? "").trim().toLowerCase())?.[0];
  return (first && known.get(first)) ?? null;
}
