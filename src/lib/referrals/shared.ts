/**
 * Types shared between the referral actions and the settings UI.
 *
 * Separate from actions.ts because that file carries "use server", where every
 * export must be an async function.
 */

export type ReferralRow = {
  id: string;
  /** "pending" | "rewarded" | "rejected". */
  status: string;
  rewardCredits: number | null;
  createdAt: Date;
  rewardedAt: Date | null;
  /** Workspace name of the referred customer. Never an email. */
  referredName: string | null;
};

export type ReferralSummary = {
  code: string;
  /** Credits earned to date. */
  earned: number;
  /** Referred workspaces that have not yet paid. */
  pending: number;
  referrals: ReferralRow[];
};
