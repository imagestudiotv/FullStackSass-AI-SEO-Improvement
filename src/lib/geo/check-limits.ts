import type { QuotaRule } from "@/lib/billing/spend-quota";

/**
 * How often one website's AI visibility is checked, at most.
 *
 * A check is now every question put to every assistant several times, with
 * web search - a few hundred paid calls for a Grow website - so the cost of
 * a website is bounded by a cap per WEEK, not only per hour: the Monday run
 * and the customer's "Check now" presses together, at most
 * GEO_WEEKLY_CHECKS_PER_WEBSITE (default 3) in any seven days. The hourly
 * limits in lib/geo/actions.ts still stop a burst of presses.
 */
export const DEFAULT_WEEKLY_CHECKS = 3;

export function weeklyChecks(env: Record<string, string | undefined> = process.env): number {
  const value = Number.parseInt(env.GEO_WEEKLY_CHECKS_PER_WEBSITE ?? "", 10);
  return Number.isFinite(value) && value >= 1 ? Math.min(value, 14) : DEFAULT_WEEKLY_CHECKS;
}

/** The spend-ledger rule both the button (runGeoCheck) and the weekly run reserve under. */
export function weeklyCheckRule(websiteId: string): QuotaRule {
  return { key: `geo-check:week:${websiteId}`, limit: weeklyChecks(), window: { seconds: 7 * 24 * 60 * 60 } };
}
