/**
 * How many pages each check reads. Here rather than beside the crawls so the
 * pages that sell the difference can quote it without importing a background
 * job, and cannot come to disagree with what the crawl does.
 */

/** A website check from inside an account (inngest/functions/audit-website.ts). */
export const ACCOUNT_AUDIT_MAX_PAGES = 25;

/** The free public check, far smaller: it runs with no account (public-audit.ts). */
export const PUBLIC_AUDIT_MAX_PAGES = 5;
