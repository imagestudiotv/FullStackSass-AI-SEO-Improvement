/**
 * Site-wide contact and identity details.
 *
 * These appear in legal pages, which are a compliance surface: a placeholder
 * address on a privacy policy is not merely untidy, it means a data-subject
 * request has nowhere to go. They were hardcoded in six places across four
 * pages, so any change had to be made six times and drift was inevitable.
 *
 * Reading from env means going live is a variable change, not a code change,
 * and the fallback is deliberately an obviously-wrong placeholder rather than
 * a plausible-looking address — a wrong address that looks real would ship
 * unnoticed, whereas this one is caught by `npm run doctor`.
 */

/** Support address shown on legal and contact pages. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";

/** Trading name used in legal copy. */
export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME ?? "SEOVision";

/** True while the support address is still the placeholder. */
export function hasRealSupportEmail(): boolean {
  return !SUPPORT_EMAIL.endsWith("@example.com");
}
