import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client.
 *
 * Constructed lazily for the same reason as the Stripe client: `next build`
 * evaluates every route module to collect page data, so a module-scope throw
 * fails the whole build on any machine without a key.
 */

/**
 * Model roles, named by job rather than used as bare ids at call sites, so
 * changing a model is one edit here.
 *
 *  - EXTRACTION: short, structured, high volume. Haiku is the right cost point.
 *  - GENERATION: the article itself, which IS the product. At roughly $0.08 per
 *    article Sonnet is under 3% of revenue on every plan, so quality wins.
 *  - BLOG: RepGet's own blog, written by the blog autopilot (lib/blog/autopilot):
 *    the article and its topics. Claude Sonnet 5 since 2026-10-18 (client:
 *    Sonnet 5 instead of Opus 5.5, for the cost - half the price per token).
 *    About $0.50 to write an article.
 *  - BLOG_TRANSLATION: the blog autopilot's translations. Claude Haiku 5.5
 *    since 2026-10-20 (client: the article cost $1.60, of which $0.73 was the
 *    four translations on Sonnet 5; Haiku 5.5 is a twentieth of the price per
 *    token). Each translation is a draft a native speaker reviews before it
 *    is published.
 *  - ARTICLE_TRANSLATION: a customer's live article in the website's other
 *    languages (lib/articles/translate-article.ts). Claude Haiku 5.5, as the
 *    blog's: about $0.01-0.03 an article and language.
 */
export const MODELS = {
  EXTRACTION: "claude-haiku-4-5",
  GENERATION: "claude-sonnet-5",
  BLOG: "claude-sonnet-5",
  BLOG_TRANSLATION: "claude-haiku-5-5",
  ARTICLE_TRANSLATION: "claude-haiku-5-5",
} as const;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** True when a key is configured; lets callers degrade instead of throwing. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Proxy so call sites read normally while construction stays deferred. */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});
