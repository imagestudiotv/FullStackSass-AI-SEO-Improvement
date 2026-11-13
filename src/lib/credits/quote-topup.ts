import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { walletOf } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { addons, creditTopups, websiteProjects } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import { QUOTE_CREDITS_COPY } from "@/lib/i18n/quote-credits";
import { isWebsiteProjectKind } from "@/lib/website-projects/shared";

import { smallestCreditPack } from "./pack-rate";
import {
  MAX_TOPUP_CENTS,
  MAX_TOPUP_CREDITS,
  MIN_TOPUP_CENTS,
  MIN_TOPUP_CREDITS,
  QUOTE_CREDITS_SLUG,
  quoteCancelPath,
  quoteReturnPath,
  quoteRevisionOf,
  quoteShortfall,
  topUpPriceCents,
  UUID_PATTERN,
  type QuoteTopUpCheck,
  type QuoteTopUpStart,
  type TopUpStatus,
} from "./quote-topup-shared";

/**
 * Credits for a quote (lib/credits/quote-topup-shared.ts says why).
 *
 * EVERYTHING IS DECIDED HERE, ON THE SERVER, FROM THE DATABASE. The browser
 * names a quote and its revision and says which amount it was shown; the quote
 * is read in the caller's own workspace, the shortfall from the workspace's
 * wallet, and the price from the smallest credit pack's rate. A shown amount
 * that differs is refused ("changed") rather than charged.
 *
 * THE CREDITS ARE A CREDIT PACK'S, AND GRANTED THE SAME WAY. A credit_topups
 * row is written first with the credits and amount; the payment names only
 * that row (Stripe metadata; the PayPal order's reference). The Stripe
 * webhook (checkout.session.completed when paid, async_payment_succeeded
 * later for a delayed method) and the PayPal capture paths call the pack's
 * fulfilAddonPurchase, which grants the row's credits exactly once and marks
 * it paid (lib/addons/fulfil.ts). A cancelled or failed payment grants
 * nothing.
 *
 * THE QUOTE IS NEVER TOUCHED: not its price, not its status. The customer
 * comes back to it and accepts it with "Accept and pay" (lib/website-projects/
 * actions.ts payWebsiteProject).
 */

/** Checks a quote for a top-up and prices the shortfall. Reads only. */
export async function checkQuoteTopUp(
  database: Database,
  input: { organizationId: string; projectId: string; revision: string },
): Promise<QuoteTopUpCheck> {
  if (!UUID_PATTERN.test(input.projectId) || !/^\d{1,16}$/.test(input.revision)) return { ok: false, reason: "unavailable" };

  const [project] = await database
    .select({
      id: websiteProjects.id,
      kind: websiteProjects.kind,
      status: websiteProjects.status,
      creditCost: websiteProjects.creditCost,
      quotedAt: websiteProjects.quotedAt,
    })
    .from(websiteProjects)
    .where(and(eq(websiteProjects.id, input.projectId), eq(websiteProjects.organizationId, input.organizationId)))
    .limit(1);
  // Not in this workspace, not priced yet, already paid, delivered or declined: nothing to buy credits for.
  if (!project || !isWebsiteProjectKind(project.kind) || project.status !== "quoted" || !project.creditCost || project.creditCost <= 0) {
    return { ok: false, reason: "unavailable" };
  }
  const revision = quoteRevisionOf(project.quotedAt);
  if (!revision || revision !== input.revision) return { ok: false, reason: "stale" };

  const wallet = await walletOf(database, input.organizationId);
  const credits = quoteShortfall(project.creditCost, wallet.available);
  if (credits <= 0) return { ok: false, reason: "covered" };

  const rate = await smallestCreditPack(database);
  if (!rate) return { ok: false, reason: "no_rate" };
  if (credits < MIN_TOPUP_CREDITS || credits > MAX_TOPUP_CREDITS) return { ok: false, reason: "out_of_bounds" };
  const priceCents = topUpPriceCents(credits, rate);
  if (priceCents < MIN_TOPUP_CENTS || priceCents > MAX_TOPUP_CENTS) return { ok: false, reason: "out_of_bounds" };

  return {
    ok: true,
    offer: {
      projectId: project.id,
      revision,
      kind: project.kind,
      quoteCredits: project.creditCost,
      available: wallet.available,
      credits,
      priceCents,
      currency: rate.currency,
      rate,
    },
  };
}

/** What starting a payment needs from outside: the providers, as narrow functions (so tests need no network). */
export type TopUpProviders = {
  appUrl: string;
  stripe: {
    createSession: (params: {
      customerId: string;
      amountCents: number;
      currency: string;
      name: string;
      description: string;
      successUrl: string;
      cancelUrl: string;
      metadata: Record<string, string>;
      idempotencyKey: string;
    }) => Promise<{ id: string; url: string | null }>;
    customerFor: (organizationId: string) => Promise<string>;
  };
  paypal: {
    startOrder: (params: {
      organizationId: string;
      referenceId: string;
      amountCents: number;
      currency: string;
      description: string;
      userId: string;
      returnUrl: (rowId: string) => string;
      cancelUrl: (rowId: string) => string;
    }) => Promise<{ kind: "started"; url: string } | { kind: "error"; error: string }>;
  };
};

/**
 * Starts paying for a quote's shortfall: checks it again, records the top-up,
 * and opens the provider's payment page. Returns the page to send the
 * customer to, or why not, in the reader's language.
 */
export async function startQuoteTopUp(
  database: Database,
  input: {
    organizationId: string;
    userId: string;
    projectId: string;
    revision: string;
    /** What the screen showed: compared, never charged. */
    expectedCredits: number;
    expectedPriceCents: number;
    provider: "stripe" | "paypal";
    locale: Locale;
  },
  providers: TopUpProviders,
): Promise<QuoteTopUpStart> {
  const copy = QUOTE_CREDITS_COPY[input.locale];
  const checked = await checkQuoteTopUp(database, input);
  if (!checked.ok) return { ok: false, reason: checked.reason, error: copy.refusal[checked.reason] };
  const offer = checked.offer;
  if (offer.credits !== input.expectedCredits || offer.priceCents !== input.expectedPriceCents) {
    return { ok: false, reason: "changed", error: copy.refusal.changed };
  }

  // Recorded under its own inactive add-on (drizzle-drafts/nov13/billing.sql); without it the grant would have nowhere to go.
  const [addon] = await database.select({ id: addons.id }).from(addons).where(eq(addons.slug, QUOTE_CREDITS_SLUG)).limit(1);
  if (!addon) return { ok: false, reason: "no_rate", error: copy.refusal.no_rate };

  const [topUp] = await database
    .insert(creditTopups)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      websiteProjectId: offer.projectId,
      quoteRevision: offer.revision,
      quoteCredits: offer.quoteCredits,
      availableCredits: offer.available,
      credits: offer.credits,
      amountCents: offer.priceCents,
      currency: offer.currency,
      rateCents: offer.rate.priceCents,
      rateCredits: offer.rate.credits,
      provider: input.provider,
    })
    .returning({ id: creditTopups.id });

  const base = providers.appUrl.replace(/\/+$/, "");
  const name = format(copy.lineItem, { credits: formatNumber(offer.credits, input.locale) });

  if (input.provider === "paypal") {
    const started = await providers.paypal.startOrder({
      organizationId: input.organizationId,
      // The top-up, not a pack: fulfilCreditPack reads its credits from it (lib/paypal/orders.ts).
      referenceId: topUp.id,
      amountCents: offer.priceCents,
      currency: offer.currency,
      description: name,
      userId: input.userId,
      returnUrl: (rowId) => `${base}/api/paypal/orders/return?row=${rowId}&outcome=success`,
      cancelUrl: (rowId) => `${base}/api/paypal/orders/return?row=${rowId}&outcome=cancelled`,
    });
    return started.kind === "started" ? { ok: true, url: started.url } : { ok: false, reason: "provider", error: started.error };
  }

  const customerId = await providers.stripe.customerFor(input.organizationId);
  const session = await providers.stripe.createSession({
    customerId,
    amountCents: offer.priceCents,
    currency: offer.currency,
    name,
    description: copy.lineItemDescription,
    // Back to the quote once paid; its page says whether the credits are confirmed yet.
    successUrl: `${base}${quoteReturnPath(offer.projectId, topUp.id)}`,
    // Not paid: back to the same offer on Billing.
    cancelUrl: `${base}${quoteCancelPath(offer.projectId, offer.revision, "cancelled")}`,
    metadata: {
      organizationId: input.organizationId,
      addonId: addon.id,
      topupId: topUp.id,
      websiteProjectId: offer.projectId,
      quoteRevision: offer.revision,
      credits: String(offer.credits),
    },
    // One session per top-up row, however the request is retried.
    idempotencyKey: `credit-topup:${topUp.id}`,
  });
  if (!session.url) return { ok: false, reason: "provider", error: copy.checkoutFailed };
  await database.update(creditTopups).set({ stripeSessionId: session.id, updatedAt: new Date() }).where(eq(creditTopups.id, topUp.id));
  return { ok: true, url: session.url };
}

/** A top-up as the quote's page reports it, in the caller's workspace only. */
export async function topUpForReturn(
  organizationId: string,
  topUpId: string,
  database: Database = db,
): Promise<{ id: string; status: TopUpStatus; credits: number; websiteProjectId: string | null } | null> {
  if (!UUID_PATTERN.test(topUpId)) return null;
  const [row] = await database
    .select({ id: creditTopups.id, status: creditTopups.status, credits: creditTopups.credits, websiteProjectId: creditTopups.websiteProjectId })
    .from(creditTopups)
    .where(and(eq(creditTopups.id, topUpId), eq(creditTopups.organizationId, organizationId)))
    .orderBy(desc(creditTopups.createdAt))
    .limit(1);
  return row ? { ...row, status: row.status as TopUpStatus } : null;
}
