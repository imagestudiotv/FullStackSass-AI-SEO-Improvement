import { calendarMonth } from "@/lib/billing/entitlement-period";

/**
 * Why an account's automatic posting is paused, and whether it starts again
 * by itself (Daniel, 2026-11-24: customers are not shown these any more, so
 * the Resume button they pressed is gone).
 *
 *  - "quota": OUR posting provider ran out (its monthly post limit, the X
 *    balance). The platform never saw the post, so trying again cannot get
 *    an account banned. Resumed by RepGet (lib/social/recover.ts).
 *  - "platform": anything else - a spam filter, a duplicate, a suspended
 *    account, revoked access, or a reason nobody has read yet. NEVER resumed
 *    by itself: repeating a refused post is what gets accounts banned. The
 *    customer turns it on again in Account settings.
 *
 * Deliberately strict: a reason is "quota" only when it reads like the
 * provider's own words, and not when it also says something about the
 * account. Platforms have "daily limits" too - those are theirs, not ours.
 * The reason itself (social_accounts.paused_reason) is for administrators
 * only and is never sent to a customer's browser.
 *
 * Pure: no database.
 */

export type PauseKind = "quota" | "platform";

const QUOTA = [
  // bundle.social POST /post/ failed (403): Monthly post limit reached. Limit for this month is 20 posts.
  /\bmonthly post limit reached\b/i,
  /\blimit for this month is \d+ posts?\b/i,
  // Not enough credits to publish this X post. Add funds to your balance and try again.
  /\bnot enough credits to publish this x post\b/i,
  /\badd funds to your balance\b/i,
];

/** Words about the account itself: whatever else the text says, a person looks first. */
const ACCOUNT = /\b(?:spam|suspend|banned|bans?\b|revoked|blocked|restricted|violat|policy|duplicate|unauthori[sz]ed|expired|disconnected|permission|reconnect)/i;

export function pauseKind(reason: string | null | undefined): PauseKind {
  const text = reason ?? "";
  if (ACCOUNT.test(text)) return "platform";
  return QUOTA.some((pattern) => pattern.test(text)) ? "quota" : "platform";
}

/** After this, one post is tried again: the provider's plan or balance may have been topped up meanwhile. */
export const QUOTA_RETRY_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a paused account is tried again, or null when it waits for a person:
 * three days later, or the first of the next (UTC) month if that is sooner -
 * the provider's limit is per month.
 */
export function resumesAt(reason: string | null | undefined, pausedAt: Date): Date | null {
  if (pauseKind(reason) !== "quota") return null;
  const later = pausedAt.getTime() + QUOTA_RETRY_DAYS * DAY_MS;
  return new Date(Math.min(later, calendarMonth(pausedAt).end.getTime()));
}
