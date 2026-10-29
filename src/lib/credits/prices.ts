import "server-only";

import { db } from "@/lib/db";
import { creditSettings } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * What credits buy (client, 2026-10-26).
 *
 * The client wants one credit balance spent across RepGet - "buying one
 * backlink - x credits, buying x service - x credits" - so a low plan can
 * start a customer, and credits sell everything beyond it. The workspace's
 * balance is the ledger in lib/backlinks/credits.ts; this module says what
 * each action costs, and lib/credits/spend.ts charges it.
 *
 * Prices are an administrator's setting (Admin -> Credits), not code: the
 * client decides the numbers, and changing one must not need a deploy. Every
 * price defaults to 0, so an action costs nothing until a price is set - the
 * features can ship before the numbers are agreed.
 *
 * Backlinks are not in this list. A link's credits are set per placement by
 * the administrator who places it (lib/backlinks/managed.ts, 10 to 100), and
 * are charged only once the link is seen live, which is a different shape
 * from "pay, then it happens". Services bought with credits carry their own
 * price (addons.credit_price, lib/addons/actions.ts).
 */

/**
 * Actions a price can be set for. Add a key here when a feature starts
 * charging, and give it a name in `app.credits.actions` (every language) and
 * in ACTION_NOTES below.
 */
export const CREDIT_ACTIONS = ["audit_rerun"] as const;
export type CreditAction = (typeof CREDIT_ACTIONS)[number];

export function isCreditAction(value: string): value is CreditAction {
  return (CREDIT_ACTIONS as readonly string[]).includes(value);
}

/** What the administrator sees for each action. English: the admin area is. */
export const ACTION_ADMIN: Record<CreditAction, { label: string; help: string }> = {
  audit_rerun: {
    label: "Run the website check again",
    help: "Website Health -> Check again. The first check of a website is always free.",
  },
};

/** The ledger note for a spend, for support; the customer sees the translated name. */
export const ACTION_NOTES: Record<CreditAction, string> = {
  audit_rerun: "Website check run again",
};

/** Limits on what an administrator can set, so a typo cannot price an action at 100,000. */
export const MAX_ACTION_PRICE = 1000;
export const MAX_DAILY_FREE = 100;
/** A service's price in credits (addons.credit_price). */
export const MAX_ADDON_PRICE = 100_000;

export const DAILY_FREE_KEY = "daily_free";
/**
 * Daily credits during the free-articles trial (client, 2026-10-27: 15 a day,
 * so a trial can try what credits buy), on its first TRIAL_CREDIT_DAYS days
 * only - "the 4th day the free credit is not given" (lib/credits/daily.ts).
 */
export const TRIAL_DAILY_FREE_KEY = "trial_daily_free";
export const TRIAL_CREDIT_DAYS = 3;
export const priceKey = (action: CreditAction) => `price:${action}`;

export type CreditSettings = {
  /** Credits a paying workspace is given on each UTC day it uses RepGet (lib/credits/daily.ts). 0 = off. */
  dailyFree: number;
  /** Credits a trial is given on each of its first TRIAL_CREDIT_DAYS days it uses RepGet. 0 = off. */
  trialDailyFree: number;
  prices: Record<CreditAction, number>;
  /** The latest change, for the admin page. */
  updatedAt: Date | null;
  updatedBy: string | null;
};

/**
 * The settings in force. Missing rows are the defaults (0); a row for an
 * action that no longer exists is ignored.
 */
export async function readCreditSettings(executor: Executor = db): Promise<CreditSettings> {
  const rows = await executor.select().from(creditSettings);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const prices = Object.fromEntries(
    CREDIT_ACTIONS.map((action) => [action, values.get(priceKey(action)) ?? 0]),
  ) as Record<CreditAction, number>;
  const latest = rows.reduce<(typeof rows)[number] | null>(
    (newest, row) => (!newest || row.updatedAt > newest.updatedAt ? row : newest),
    null,
  );
  return {
    dailyFree: values.get(DAILY_FREE_KEY) ?? 0,
    trialDailyFree: values.get(TRIAL_DAILY_FREE_KEY) ?? 0,
    prices,
    updatedAt: latest?.updatedAt ?? null,
    updatedBy: latest?.updatedBy ?? null,
  };
}
