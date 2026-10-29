"use server";

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import {
  CREDIT_ACTIONS,
  DAILY_FREE_KEY,
  MAX_ACTION_PRICE,
  MAX_ADDON_PRICE,
  MAX_DAILY_FREE,
  priceKey,
  readCreditSettings,
  TRIAL_DAILY_FREE_KEY,
  type CreditAction,
  type CreditSettings,
} from "@/lib/credits/prices";
import { db } from "@/lib/db";
import { addons, creditSettings, creditSpends } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Credits: what each action and each service costs, and the daily
 * credits (lib/credits/prices.ts, lib/credits/daily.ts). Every action checks
 * admin access on the server, and a change is recorded in the admin audit
 * log.
 */

/** A service sold for credits (addons.credit_price): bought outright, or a quote's "from" figure. */
export type CreditAddon = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  creditPrice: number | null;
};

export type CreditUse = {
  /** A CREDIT_ACTIONS key, or "addon:<slug>". */
  action: string;
  /** Spends in the last 30 days that were not refunded. */
  spends: number;
  credits: number;
};

export type CreditsAdmin = {
  settings: CreditSettings;
  addons: CreditAddon[];
  usage: CreditUse[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Services, not credit packs: the packs are what credits are bought with. */
const SERVICE_KINDS = ["service", "quote"];

async function serviceAddons(): Promise<CreditAddon[]> {
  return db
    .select({ id: addons.id, slug: addons.slug, name: addons.name, kind: addons.kind, creditPrice: addons.creditPrice })
    .from(addons)
    .where(and(eq(addons.isActive, true), inArray(addons.kind, SERVICE_KINDS)))
    .orderBy(asc(addons.sortOrder));
}

export async function getCreditsAdmin(): Promise<CreditsAdmin> {
  await requireAdmin();
  const [settings, services] = await Promise.all([readCreditSettings(), serviceAddons()]);
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await db
    .select({
      action: creditSpends.action,
      spends: sql<number>`count(*)::int`,
      credits: sql<number>`coalesce(sum(${creditSpends.credits}), 0)::int`,
    })
    .from(creditSpends)
    .where(and(gte(creditSpends.createdAt, since), sql`${creditSpends.refundedAt} is null`))
    .groupBy(creditSpends.action);
  const byAction = new Map(rows.map((row) => [row.action, row]));
  // Every action and every service, in that order, whether or not it was used.
  const keys = [...CREDIT_ACTIONS, ...services.map((service) => `addon:${service.slug}`)];
  return {
    settings,
    addons: services,
    usage: keys.map((action) => ({
      action,
      spends: Number(byAction.get(action)?.spends ?? 0),
      credits: Number(byAction.get(action)?.credits ?? 0),
    })),
  };
}

/** A whole number from 0 to `max`, or null. */
function wholeNumber(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isInteger(number) && number >= 0 && number <= max ? number : null;
}

/**
 * Saves the daily credits, every action's price and every service's price at
 * once. An action or service left out keeps its price. A service priced 0 is
 * not for sale.
 */
export async function saveCreditSettings(input: {
  dailyFree: number;
  /** A trial's daily credits on its first days; left out, it keeps its value. */
  trialDailyFree?: number;
  prices: Partial<Record<string, number>>;
  /** By add-on id. */
  addonPrices?: Partial<Record<string, number>>;
}): Promise<ActionResult<CreditSettings>> {
  const admin = await requireAdmin();
  const dailyFree = wholeNumber(input.dailyFree, MAX_DAILY_FREE);
  if (dailyFree === null) return { ok: false, error: `Daily credits must be a whole number from 0 to ${MAX_DAILY_FREE}` };

  const before = await readCreditSettings();
  const trialDailyFree =
    input.trialDailyFree === undefined ? before.trialDailyFree : wholeNumber(input.trialDailyFree, MAX_DAILY_FREE);
  if (trialDailyFree === null) {
    return { ok: false, error: `Trial daily credits must be a whole number from 0 to ${MAX_DAILY_FREE}` };
  }
  const prices = { ...before.prices };
  for (const [action, value] of Object.entries(input.prices ?? {})) {
    if (!(CREDIT_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: "That action no longer exists - reload the page" };
    const price = wholeNumber(value, MAX_ACTION_PRICE);
    if (price === null) return { ok: false, error: `Prices must be whole numbers from 0 to ${MAX_ACTION_PRICE} credits` };
    prices[action as CreditAction] = price;
  }

  const services = await serviceAddons();
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const addonChanges: { id: string; slug: string; from: number | null; to: number | null }[] = [];
  for (const [id, value] of Object.entries(input.addonPrices ?? {})) {
    const service = serviceById.get(id);
    if (!service) return { ok: false, error: "That service no longer exists - reload the page" };
    const price = wholeNumber(value, MAX_ADDON_PRICE);
    if (price === null) return { ok: false, error: `Service prices must be whole numbers from 0 to ${MAX_ADDON_PRICE.toLocaleString("en")} credits` };
    const to = price === 0 ? null : price;
    if (to !== service.creditPrice) addonChanges.push({ id, slug: service.slug, from: service.creditPrice, to });
  }

  const changes = [
    ...(before.dailyFree !== dailyFree ? [`daily credits ${before.dailyFree} -> ${dailyFree}`] : []),
    ...(before.trialDailyFree !== trialDailyFree
      ? [`trial daily credits ${before.trialDailyFree} -> ${trialDailyFree}`]
      : []),
    ...CREDIT_ACTIONS.filter((action) => before.prices[action] !== prices[action]).map(
      (action) => `${action} ${before.prices[action]} -> ${prices[action]}`,
    ),
    ...addonChanges.map((change) => `${change.slug} ${change.from ?? "not for sale"} -> ${change.to ?? "not for sale"}`),
  ];
  if (changes.length === 0) return { ok: true, data: before };

  const now = new Date();
  const rows = [
    { key: DAILY_FREE_KEY, value: dailyFree },
    { key: TRIAL_DAILY_FREE_KEY, value: trialDailyFree },
    ...CREDIT_ACTIONS.map((action) => ({ key: priceKey(action), value: prices[action] })),
  ];
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(creditSettings)
        .values({ ...row, updatedBy: admin.email, updatedAt: now })
        .onConflictDoUpdate({
          target: creditSettings.key,
          set: { value: row.value, updatedBy: admin.email, updatedAt: now },
        });
    }
    for (const change of addonChanges) {
      await tx.update(addons).set({ creditPrice: change.to, updatedAt: now }).where(eq(addons.id, change.id));
    }
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "credits.settings_saved",
        targetType: "credit_settings",
        summary: `Changed credit prices: ${changes.join(", ")}`,
        detail: {
          before: { dailyFree: before.dailyFree, trialDailyFree: before.trialDailyFree, prices: before.prices },
          after: { dailyFree, trialDailyFree, prices },
          addons: addonChanges,
        },
      },
      tx,
    );
  });

  revalidatePath("/admin/credits");
  // Every signed-in page shows the balance, and Billing and Credits show the prices.
  revalidatePath("/", "layout");
  return { ok: true, data: await readCreditSettings() };
}
