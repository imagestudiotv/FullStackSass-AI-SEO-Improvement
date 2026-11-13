import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { addons } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { CreditRate } from "./quote-topup-shared";

/**
 * The rate one credit is sold at outside a pack: the SMALLEST credit pack on
 * sale, its price for its credits (EUR 79 for 100 today, so 79 cents a
 * credit). The owner chose it for partners paid in credits (2026-11-07,
 * lib/partners/application/use-cases/partner-credits.ts), and a quote's
 * top-up uses the same rule (lib/credits/quote-topup.ts): no bulk discount is
 * invented, and the bigger packs keep their own better value per credit.
 *
 * Read from the add-ons table each time, so a pack's new price is the new
 * rate without a deploy. Active credit packs with a price and credits only;
 * the quote top-up's own add-on is inactive and grants 0, so it is never
 * taken for a pack. Null when no pack is on sale.
 */
export async function smallestCreditPack(executor: Executor): Promise<CreditRate | null> {
  const [pack] = await executor
    .select({ priceCents: addons.priceCents, credits: addons.creditsGranted, currency: addons.currency })
    .from(addons)
    .where(and(eq(addons.kind, "credits"), eq(addons.isActive, true), sql`${addons.creditsGranted} > 0 and ${addons.priceCents} > 0`))
    .orderBy(asc(addons.creditsGranted), asc(addons.priceCents))
    .limit(1);
  return pack ? { priceCents: pack.priceCents, credits: pack.credits, currency: pack.currency.toLowerCase() } : null;
}
