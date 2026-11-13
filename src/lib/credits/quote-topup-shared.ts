/**
 * Credits for a quote (Daniel, 2026-11-13: "When click buy credits is good to
 * having the custom credit package 1000 credits in this cases on the main top,
 * so it's already calculated how much should cost 1000 credits and purchase").
 *
 * A website project is quoted in credits (lib/website-projects). When the
 * workspace has fewer credits than the quote, "Buy credits" opens Billing with
 * the quote named, and Billing offers EXACTLY the shortfall - the quote's
 * credits less what the workspace can spend - at the price the server works
 * out. Paying for them grants the credits only; the customer still accepts the
 * quote with "Pay in credits", and the quote's price never changes here.
 *
 * Plain values and pure functions, so the server, the screens and the tests
 * share them (no database, no provider SDK).
 */

/** The inactive add-on every quote top-up is recorded under (addon_purchases.addon_id). */
export const QUOTE_CREDITS_SLUG = "credits_custom";

/** The fewest credits a top-up sells. */
export const MIN_TOPUP_CREDITS = 1;
/**
 * The most: the largest price a quote can carry (lib/website-projects/shared.ts
 * MAX_WEBSITE_PROJECT_CREDITS), so a shortfall is never above it.
 */
export const MAX_TOPUP_CREDITS = 1_000_000;
/** Card processors refuse smaller charges (Stripe: EUR 0.50). */
export const MIN_TOPUP_CENTS = 50;
/** Stripe Checkout's largest single amount (EUR 999,999.99). */
export const MAX_TOPUP_CENTS = 99_999_999;

/** The rate credits are sold at: `credits` for `priceCents`, in `currency`. */
export type CreditRate = { priceCents: number; credits: number; currency: string };

/**
 * The price of `credits` at `rate`, in cents, ROUNDED UP to the cent so a
 * top-up is never sold below the rate. At today's rate (the smallest pack, EUR
 * 79 for 100 credits) every whole credit is a whole 79 cents, so nothing is
 * rounded: 1,000 credits are EUR 790.
 *
 * Integer arithmetic: credits * cents fits a double exactly at these bounds.
 */
export function topUpPriceCents(credits: number, rate: Pick<CreditRate, "priceCents" | "credits">): number {
  if (!Number.isSafeInteger(credits) || credits <= 0) throw new Error("credits must be a positive whole number");
  if (!(rate.credits > 0) || !(rate.priceCents > 0)) throw new Error("the rate must be positive");
  const product = credits * rate.priceCents;
  return Math.floor(product / rate.credits) + (product % rate.credits === 0 ? 0 : 1);
}

/** What the workspace lacks to pay the quote; 0 when it already can. */
export function quoteShortfall(quoteCredits: number, available: number): number {
  return Math.max(quoteCredits - Math.max(available, 0), 0);
}

/**
 * Which version of a quote this is. An administrator can price a quote again
 * while it waits (lib/website-projects/admin.ts quoteWebsiteProject), and
 * each time quoted_at is set anew; a top-up started from one price must not be
 * offered for another, so its revision travels with it and is checked.
 */
export function quoteRevisionOf(quotedAt: Date | null): string | null {
  return quotedAt ? String(quotedAt.getTime()) : null;
}

/** Where "Buy credits" on a quote goes: Billing, with the quote and its revision named. */
export function quoteTopUpHref(projectId: string, revision: string): string {
  return `/billing?project=${encodeURIComponent(projectId)}&revision=${encodeURIComponent(revision)}#quote-credits`;
}

/** Back on the quote after paying: the website projects screen, scrolled to that project. */
export function quoteReturnPath(projectId: string, topUpId: string): string {
  return `/website-projects?topup=${encodeURIComponent(topUpId)}#project-${projectId}`;
}

/** Back on Billing after cancelling: the same offer is still there. */
export function quoteCancelPath(projectId: string, revision: string, outcome: "cancelled" | "failed", via?: "paypal"): string {
  return `/billing?addon=${outcome}${via ? `&via=${via}` : ""}&project=${encodeURIComponent(projectId)}&revision=${encodeURIComponent(revision)}#quote-credits`;
}

/** The anchor of one project on the website projects screen. */
export const projectAnchor = (projectId: string) => `project-${projectId}`;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The status of a top-up: open until paid (credits granted) or failed (a delayed payment that did not clear). */
export type TopUpStatus = "open" | "paid" | "failed";

/** What Billing shows at the top for a quote, worked out on the server. */
export type QuoteTopUpOffer = {
  projectId: string;
  revision: string;
  kind: "new" | "redesign";
  /** The quote's price in credits. */
  quoteCredits: number;
  /** What the workspace can spend now. */
  available: number;
  /** quoteCredits - available: what this top-up sells. */
  credits: number;
  priceCents: number;
  currency: string;
  /** The rate it was priced at, for the screen's "per credit" line. */
  rate: CreditRate;
};

/** Why no top-up is offered for a quote. */
export type QuoteTopUpRefusal =
  /** No such quote in this workspace, or not one waiting for payment. */
  | "unavailable"
  /** The quote was priced again since the link was made. */
  | "stale"
  /** The workspace already has enough credits: the quote can be paid now. */
  | "covered"
  /** No credit pack on sale to take the rate from. */
  | "no_rate"
  /** The amount is outside what a single payment can be. */
  | "out_of_bounds";

export type QuoteTopUpCheck = { ok: true; offer: QuoteTopUpOffer } | { ok: false; reason: QuoteTopUpRefusal };

export type QuoteTopUpStart =
  | { ok: true; url: string }
  | {
      ok: false;
      /** "changed": the shortfall or price differs from what was shown; the screen reloads. */
      reason: QuoteTopUpRefusal | "changed" | "provider";
      error: string;
    };
