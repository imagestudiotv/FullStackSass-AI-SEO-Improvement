/**
 * Site-wide contact and identity details.
 *
 * These appear in legal pages, which are a compliance surface: a placeholder
 * address on a privacy policy is not merely untidy, it means a data-subject
 * request has nowhere to go. They were hardcoded in six places across four
 * pages, so any change had to be made six times and drift was inevitable.
 *
 * NEXT_PUBLIC_SUPPORT_EMAIL still overrides it, but the default is RepGet's
 * real, monitored inbox (client, 2026-10-09). It used to be the placeholder
 * support@example.com, which every environment without the variable - a
 * preview, a staging copy, a fresh deploy - showed on its contact and legal
 * pages. A placeholder put back by hand is still caught: hasRealSupportEmail()
 * below and `npm run doctor`.
 */

/** Support address shown on legal and contact pages. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@repget.com";

/** Trading name used in legal copy. */
export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME ?? "RepGet";

/** False only while the address is a placeholder (an @example.com one set by hand). */
export function hasRealSupportEmail(): boolean {
  return !SUPPORT_EMAIL.endsWith("@example.com");
}
