/**
 * /.well-known/security.txt (RFC 9116): how to report a security problem to
 * RepGet, for researchers who find one (client's launch review, 2026-10-03).
 *
 * Served by app/.well-known/security.txt/route.ts.
 */

/** Where security reports go - the owner's choice (2026-10-03). */
export const SECURITY_CONTACT = "mailto:support@repget.com";

/**
 * How far ahead Expires points.
 *
 * RFC 9116 requires Expires and recommends it be under a year away, so a
 * stale file is not trusted for ever. The route refreshes daily, so the date
 * rolls forward on its own and never lapses, while 180 days keeps it well
 * inside the recommendation.
 */
const EXPIRES_IN_DAYS = 180;

export function buildSecurityTxt(siteUrl: string, now: Date = new Date()): string {
  const site = siteUrl.replace(/\/+$/, "");
  const expires = new Date(now.getTime() + EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  // Whole seconds, RFC 3339 / ISO 8601 in UTC, as the RFC's own examples write it.
  expires.setUTCMilliseconds(0);

  return [
    "# RepGet security contact. Please report vulnerabilities privately",
    "# to the address below rather than publicly; we will reply.",
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${site}/.well-known/security.txt`,
    "",
  ].join("\n");
}
