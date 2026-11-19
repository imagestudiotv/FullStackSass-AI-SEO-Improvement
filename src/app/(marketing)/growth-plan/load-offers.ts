import { listPlans } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import type { Locale } from "@/lib/i18n/config";
import { isPayPalAvailable } from "@/lib/paypal/actions";

import { growthPlanOffers, type GrowthPlanOffer } from "./plan-offers";

/**
 * The growth plan's plans, read on the server for the page (page.tsx and
 * [locale]/growth-plan/page.tsx). Kept out of growth-plan-page.tsx so that
 * stays free of the database.
 *
 * The launch price is the one /pricing shows a visitor (REPGET_OFFER_ENABLED);
 * the plan step works out the account's own offer at checkout as always.
 *
 * A database that fails costs the visitor the plan cards, never the page: the
 * last step then offers the trial and /pricing as the page did before.
 */
export async function loadGrowthPlanOffers(locale: Locale): Promise<GrowthPlanOffer[]> {
  try {
    const [rows, paypal] = await Promise.all([listPlans(), isPayPalAvailable()]);
    return growthPlanOffers(rows, locale, repgetOfferEnabled(), paypal);
  } catch (error) {
    console.error("[growth-plan] plans unavailable", error);
    return [];
  }
}
