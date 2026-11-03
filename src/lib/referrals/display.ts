import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { ReferralRow } from "@/lib/referrals/shared";

/**
 * How a referral is described on screen, shared by the Earn Credits page
 * (a server component) and the referral card (a client one). Plain
 * functions, outside any "use client" module, so the server can call them.
 */

/** getReferralSummary() lists at most this many referrals (its totals cover all of them). */
export const REFERRALS_LISTED = 50;

/** "Name · joined 3 Oct 2026 · Credits added 9 Oct 2026", from what is stored. */
export function referralLine(
  row: ReferralRow,
  t: Messages["app"]["referral"],
  day: (at: Date) => string,
): string {
  const joined = day(row.createdAt);
  const base =
    row.referredDomain && row.referredName
      ? format(t.joinedWithName, { name: row.referredName, date: joined })
      : row.referredDomain
        ? format(t.joined, { date: joined })
        : format(t.noWebsiteJoined, { date: joined });
  return row.status === "rewarded" && row.rewardedAt
    ? `${base} · ${format(t.rewardedOn, { date: day(row.rewardedAt) })}`
    : base;
}
