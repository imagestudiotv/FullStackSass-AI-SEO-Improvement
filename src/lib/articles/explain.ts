/**
 * Turning a stored generation failure into something a customer can read.
 *
 * generate-article.ts records `error.message.slice(0, 500)`, and the editor
 * printed it verbatim. Most of what can land there is not written for a
 * customer:
 *
 *  - our own internal checks, e.g. "ANTHROPIC_API_KEY is not set", which tells
 *    a paying customer about our configuration and gives them nothing to do
 *  - raw Anthropic SDK errors, since messages.create() is not wrapped — rate
 *    limits, billing failures and request ids all reach the column intact
 *
 * This classifies by matching the stored text, which means the write path,
 * the schema and the retry behaviour are all untouched: the original string
 * stays in the database for support and Sentry, and only the rendering
 * changes.
 *
 * Deliberately conservative. Anything unrecognised falls back to the generic
 * message rather than guessing, because a confident wrong explanation is
 * worse than an honest vague one.
 */

export type GenerationFailure = {
  summary: string;
  /** The next action, when the customer can actually take one. */
  action: string | null;
};

const GENERIC: GenerationFailure = {
  summary: "Writing this article did not finish.",
  action: "Try again. If it keeps happening, contact support.",
};

/**
 * Ordered: the first match wins, so put specific patterns before general ones.
 * Matching is case-insensitive on the stored message.
 */
const PATTERNS: { match: RegExp; failure: GenerationFailure }[] = [
  {
    /**
     * Our own configuration, not the customer's problem. They must not be
     * told to check an API key they do not own.
     */
    match: /api[_ ]key|not set|credentials/i,
    failure: {
      summary: "Writing is temporarily unavailable.",
      action: "This is on our side. We are looking into it.",
    },
  },
  {
    match: /rate limit|429|overloaded|capacity/i,
    failure: {
      summary: "The writing service was busy.",
      action: "Try again in a few minutes.",
    },
  },
  {
    match: /timeout|timed out|ETIMEDOUT|ECONNRESET/i,
    failure: {
      summary: "Writing took too long and stopped.",
      action: "Try again — this is usually temporary.",
    },
  },
  {
    /** The model refused, or produced something unusable. */
    match: /declined|truncated|no outline|not valid json|no sections/i,
    failure: {
      summary: "We could not build a usable article from this topic.",
      action:
        "Try again, or edit the topic and target keyword to be more specific.",
    },
  },
  {
    match: /limit reached|quota|plan/i,
    failure: {
      summary: "This workspace has used all of its articles for the month.",
      action: "Upgrade your plan to write more.",
    },
  },
];

export function explainGenerationError(
  stored: string | null | undefined,
): GenerationFailure {
  if (!stored) return GENERIC;

  for (const { match, failure } of PATTERNS) {
    if (match.test(stored)) return failure;
  }
  return GENERIC;
}
