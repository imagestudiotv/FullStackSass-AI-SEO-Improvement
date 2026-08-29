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
 */
export const MODELS = {
  EXTRACTION: "claude-haiku-4-5",
  GENERATION: "claude-sonnet-5",
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
