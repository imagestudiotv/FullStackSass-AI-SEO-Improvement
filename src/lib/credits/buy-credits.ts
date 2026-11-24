import type { AddonRow } from "@/lib/addons/shared";

/**
 * Where "Buy credits" goes, everywhere: the credit packs' own page, so the
 * packs are the first thing on screen (Daniel, 2026-11-24). It was
 * /billing#addons, under the websites and the plans; that address still ends
 * here (billing/billing-client.tsx).
 *
 * No server import: client components link here too.
 */
export const BUY_CREDITS_PATH = "/credits/buy";

/** The services bought with credits, further down the same page. */
export const ADDON_SERVICES_HREF = `${BUY_CREDITS_PATH}#services`;

/** The small top-up pack's add-on (scripts/seed-addons.mjs): one line under the packs, not a card. */
export const TOP_UP_PACK_SLUG = "credits_topup_50";

export type PackView = {
  addon: AddonRow;
  /** Per credit, in cents, as the checkout price divides. */
  perCreditCents: number;
  /** Whole percent less per credit than the smallest pack; 0 when it is not less. */
  savePercent: number;
  /** The lowest price per credit of the cards (never said of a lone pack). */
  lowest: boolean;
  /** The middle one of three. */
  featured: boolean;
};

/**
 * The packs as cards, smallest first, and the small top-up apart. Every figure
 * is the add-on rows' own: the saving is against the smallest CARD, so adding
 * the top-up (dearer per credit) never inflates it. A pack nobody can pay for
 * yet stays listed as unavailable, but the top-up is simply absent.
 */
export function packViews(addons: AddonRow[]): { cards: PackView[]; topUp: AddonRow | null } {
  const packs = addons
    .filter((addon) => addon.kind === "credits" && addon.creditsGranted > 0 && addon.priceCents > 0)
    .sort((a, b) => a.creditsGranted - b.creditsGranted);
  const topUp = packs.find((addon) => addon.slug === TOP_UP_PACK_SLUG) ?? null;
  const cards = packs.filter((addon) => addon.slug !== TOP_UP_PACK_SLUG);
  const unit = (addon: AddonRow) => addon.priceCents / addon.creditsGranted;
  const base = cards[0] ? unit(cards[0]) : 0;
  const best = Math.min(...cards.map(unit));

  return {
    cards: cards.map((addon, index) => ({
      addon,
      perCreditCents: Math.round(unit(addon)),
      savePercent: index > 0 && unit(addon) < base ? Math.round((1 - unit(addon) / base) * 100) : 0,
      lowest: unit(addon) === best && best < base,
      featured: cards.length === 3 && index === 1,
    })),
    topUp: topUp?.purchasable ? topUp : null,
  };
}
