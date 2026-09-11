/**
 * Turning a stored publish failure into advice.
 *
 * publish-article.ts records provider failures as `"<kind>: <message>"` (see
 * its ProviderError branch), and the UI previously printed that whole string.
 * The customer read "auth: Request failed with status code 401" — accurate,
 * unreadable, and no help in deciding what to do.
 *
 * ProviderErrorKind already exists precisely for this: its own comment says
 * "`kind` drives the message the customer sees". This reads that prefix back
 * and says what to do about it.
 *
 * No schema change and no change to what is stored: the raw string stays in
 * the database for support and Sentry, and only the rendering changes.
 */

import type { ProviderErrorKind } from "@/lib/publishing/provider";

export type PublishFailure = {
  /** One line, in the customer's terms. */
  summary: string;
  /** The single next action, when there is one they can take themselves. */
  action: string | null;
};

const KIND_COPY: Record<ProviderErrorKind, PublishFailure> = {
  auth: {
    summary: "WordPress refused the username or application password.",
    action: "Reconnect with a new application password.",
  },
  permission: {
    summary:
      "The connected WordPress account is not allowed to publish posts.",
    action: "Use an account with the Editor or Administrator role.",
  },
  not_found: {
    summary: "The WordPress address could not be found.",
    action: "Check the site address, including http:// or https://.",
  },
  unreachable: {
    summary: "Your website did not respond.",
    action:
      "This is usually temporary. Try again, or check the site is online.",
  },
  api_disabled: {
    summary:
      "WordPress is online but its publishing API is switched off — often a security plugin.",
    action: "Re-enable the WordPress REST API, then test the connection.",
  },
  unsupported: {
    summary: "This website does something we cannot publish to yet.",
    action: null,
  },
  unknown: {
    summary: "Publishing did not finish.",
    action: "Try again. If it keeps happening, contact support.",
  },
};

const KINDS = Object.keys(KIND_COPY) as ProviderErrorKind[];

/**
 * Reads the stored string and explains it.
 *
 * Falls back to a plain message for anything without a recognised prefix —
 * failures recorded before this existed, and non-provider errors, which are
 * stored as a bare message. The raw text is never shown either way: it is
 * written for a log and routinely quotes a provider's response body.
 */
export function explainPublishError(
  stored: string | null | undefined,
): PublishFailure {
  if (!stored) return KIND_COPY.unknown;

  const separator = stored.indexOf(":");
  if (separator > 0) {
    const prefix = stored.slice(0, separator).trim();
    const kind = KINDS.find((candidate) => candidate === prefix);
    if (kind) return KIND_COPY[kind];
  }

  return KIND_COPY.unknown;
}
