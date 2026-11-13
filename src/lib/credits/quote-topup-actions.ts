"use server";

import { db } from "@/lib/db";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { QUOTE_CREDITS_COPY } from "@/lib/i18n/quote-credits";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

import { startQuoteTopUp, type TopUpProviders } from "./quote-topup";
import type { QuoteTopUpStart } from "./quote-topup-shared";

/**
 * "Buy {n} credits" on the quote's card at the top of Billing
 * (lib/credits/quote-topup.ts). The workspace is the session's; the browser
 * sends the quote, its revision, the amount it showed and the provider -
 * never a price that is charged.
 */
export async function buyQuoteCredits(input: {
  projectId: string;
  revision: string;
  expectedCredits: number;
  expectedPriceCents: number;
  provider: "stripe" | "paypal";
}): Promise<QuoteTopUpStart> {
  const { orgId, userId } = await requireOrg();
  const { t, locale } = await getAppMessages(userId);
  const copy = QUOTE_CREDITS_COPY[locale];

  // Credits are the reader's own workspace's; someone here only for another's website has none to buy.
  if (await hasOnlySharedWork()) return { ok: false, reason: "unavailable", error: t.app.credits.guestOnly };

  const provider = input?.provider === "paypal" ? "paypal" : input?.provider === "stripe" ? "stripe" : null;
  if (!provider || typeof input.projectId !== "string" || typeof input.revision !== "string") {
    return { ok: false, reason: "unavailable", error: copy.refusal.unavailable };
  }
  if (!Number.isSafeInteger(input.expectedCredits) || !Number.isSafeInteger(input.expectedPriceCents)) {
    return { ok: false, reason: "changed", error: copy.refusal.changed };
  }

  if (provider === "stripe" && !isStripeConfigured()) return { ok: false, reason: "provider", error: copy.refusal.provider };
  if (provider === "paypal") {
    const { isPayPalConfigured, payPalCheckoutPaused } = await import("@/lib/paypal/client");
    if (!isPayPalConfigured() || payPalCheckoutPaused()) return { ok: false, reason: "provider", error: copy.refusal.provider };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");

  const providers: TopUpProviders = {
    appUrl,
    stripe: {
      customerFor: getOrCreateCustomer,
      async createSession(params) {
        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            customer: params.customerId,
            /*
              A one-off amount (price_data), not a catalogue price: a quote's
              shortfall is any number of credits, and a Stripe price per quote
              would fill the catalogue with products nobody buys twice.
            */
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: params.currency,
                  unit_amount: params.amountCents,
                  product_data: { name: params.name, description: params.description },
                },
              },
            ],
            /*
              No promotion code box: the amount is exactly the quote's
              shortfall at the pack rate, and the grant is checked against it
              (lib/addons/fulfil.ts).
            */
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata,
            payment_intent_data: { metadata: params.metadata },
          },
          { idempotencyKey: params.idempotencyKey },
        );
        return { id: session.id, url: session.url };
      },
    },
    paypal: {
      async startOrder(params) {
        const { startOrder } = await import("@/lib/paypal/orders");
        // Purpose "addon_credits": a pack's capture, settle and sweep paths, unchanged.
        const started = await startOrder({ purpose: "addon_credits", ...params });
        return started.kind === "started" ? { kind: "started", url: started.url } : { kind: "error", error: started.error };
      },
    },
  };

  try {
    return await startQuoteTopUp(
      db,
      { organizationId: orgId, userId, projectId: input.projectId, revision: input.revision, expectedCredits: input.expectedCredits, expectedPriceCents: input.expectedPriceCents, provider, locale },
      providers,
    );
  } catch (error) {
    // As buyAddon: an error escaping a server action reaches the browser without the provider's explanation.
    console.error("[credits] quote top-up could not start", error);
    return { ok: false, reason: "provider", error: copy.checkoutFailed };
  }
}
