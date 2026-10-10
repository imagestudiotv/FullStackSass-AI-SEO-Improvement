import { createHash } from "node:crypto";

import { and, eq, gt, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { account, billingCheckouts, plans } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { measurementId, tagManagerId, type BrowserConversion } from "@/lib/google-analytics";

import { gaClientId, gaSessionCookie, gaSessionId } from "./ga-identity";

/**
 * The three conversions the client wants measured before any Google Ads
 * spend (2026-10-09): a sign-up, the start of the free articles, and a paid
 * subscription.
 *
 *  - SIGN-UP and FREE ARTICLES happen with the customer in front of a
 *    signed-in page, so the browser reports them (pendingConversions here
 *    decides which are due, components/conversion-events.tsx sends them,
 *    lib/google-analytics.ts says how). Only for a visitor who accepted the
 *    cookie banner; the page asks the server for nothing else.
 *  - A PAID SUBSCRIPTION mostly happens with nobody there: the free articles
 *    end and Stripe charges the card 30 days later. So the FIRST real payment
 *    of a subscription is reported by the server, from the payment webhook,
 *    through GA4's Measurement Protocol (reportFirstPayment), as a `purchase`
 *    for the GA identity the payer had when they started paying
 *    (rememberCheckoutVisitor). The same path covers a checkout paid at once
 *    and PayPal, so there is one source and nothing is counted twice.
 *    Google Ads imports these from GA4 (docs/site-analytics.md).
 */

/** How long after it happens a conversion is still reported from the browser. */
export const BROWSER_WINDOW_MS = 60 * 60 * 1000;

/** The Measurement Protocol secret (GA4 > Data streams > the stream > Measurement Protocol API secrets). Server only. */
export function gaApiSecret(raw: string | undefined = process.env.GA4_API_SECRET): string | null {
  const secret = raw?.trim();
  return secret && /^[A-Za-z0-9_-]{8,100}$/.test(secret) ? secret : null;
}

/**
 * A conversion's id for Google: stable, so it is counted once, and opaque,
 * so none of our record ids leave as they are.
 */
export function conversionId(kind: string, id: string): string {
  return createHash("sha256").update(`repget:${kind}:${id}`).digest("hex").slice(0, 32);
}

/**
 * The conversions this person's browser should report now: their sign-up,
 * in the hour after the account was created, and the start of any free
 * articles in their workspace, in the hour after the checkout completed.
 * The browser remembers what it has sent, so a reload does not count one
 * twice. Nothing when the deployment has no Google tag.
 */
export async function pendingConversions(
  database: Database,
  who: { userId: string; userCreatedAt: Date | string; organizationId: string | null },
  now: Date = new Date(),
): Promise<BrowserConversion[]> {
  if (!measurementId() && !tagManagerId()) return [];
  const since = new Date(now.getTime() - BROWSER_WINDOW_MS);
  const events: BrowserConversion[] = [];

  if (new Date(who.userCreatedAt) >= since) {
    const accounts = await database
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, who.userId));
    const method = accounts.some((row) => row.providerId === "google") ? "google" : "email";
    events.push({ id: conversionId("sign_up", who.userId), name: "sign_up", params: { method } });
  }

  if (who.organizationId) {
    const trials = await database
      .select({ id: billingCheckouts.id, plan: plans.name })
      .from(billingCheckouts)
      .leftJoin(plans, eq(plans.id, billingCheckouts.planId))
      .where(
        and(
          eq(billingCheckouts.organizationId, who.organizationId),
          eq(billingCheckouts.status, "completed"),
          gt(billingCheckouts.trialDays, 0),
          gte(billingCheckouts.updatedAt, since),
        ),
      );
    for (const trial of trials) {
      events.push({ id: conversionId("start_trial", trial.id), name: "start_trial", params: trial.plan ? { plan: trial.plan } : {} });
    }
  }
  return events;
}

/** What is kept on a checkout (billing_checkouts.analytics). */
export type CheckoutVisitor = {
  clientId: string;
  sessionId: string | null;
  capturedAt: string;
  purchaseSentAt?: string;
};

/**
 * The payer's GA identity, from the cookies of the request that starts a
 * checkout, or null unless they accepted the cookie banner and GA has
 * identified their browser.
 */
export function checkoutVisitor(read: (name: string) => string | undefined, now: Date = new Date()): CheckoutVisitor | null {
  const id = measurementId();
  if (!id) return null;
  if (parseConsent(`${CONSENT_COOKIE}=${read(CONSENT_COOKIE) ?? ""}`) !== "granted") return null;
  const clientId = gaClientId(read("_ga"));
  if (!clientId) return null;
  return { clientId, sessionId: gaSessionId(read(gaSessionCookie(id))), capturedAt: now.toISOString() };
}

/**
 * Keeps the payer's GA identity on their new checkout, for the purchase
 * reported when the money arrives. Never fails the checkout.
 */
export async function rememberCheckoutVisitor(database: Database, checkoutId: string, visitor: CheckoutVisitor | null): Promise<void> {
  if (!visitor) return;
  try {
    await database
      .update(billingCheckouts)
      // updated_at is what dates a completed checkout for pendingConversions; left as it is.
      .set({ analytics: visitor, updatedAt: sql`${billingCheckouts.updatedAt}` })
      .where(eq(billingCheckouts.id, checkoutId));
  } catch (error) {
    console.error("[analytics] could not keep the payer's GA identity", error);
  }
}

/**
 * rememberCheckoutVisitor for the request that is starting the checkout (a
 * server action), reading its cookies. Nothing without GA, or outside a
 * request.
 */
export async function rememberPayer(database: Database, checkoutId: string): Promise<void> {
  if (!measurementId()) return;
  let jar: Awaited<ReturnType<typeof cookies>>;
  try {
    jar = await cookies();
  } catch {
    return;
  }
  await rememberCheckoutVisitor(database, checkoutId, checkoutVisitor((name) => jar.get(name)?.value));
}

type Send = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Reports a subscription's FIRST real payment to GA4 as a `purchase`, once.
 *
 * Called by the Stripe and PayPal payment webhooks for every payment; it
 * does something only when the payment is for money, GA4_API_SECRET is set,
 * and the subscription's checkout kept the payer's GA identity (they had
 * accepted the cookie banner). The checkout row is CLAIMED before sending
 * (purchaseSentAt), so a replayed webhook or a renewal never reports again.
 * A failure is logged, never thrown: the payment is recorded either way.
 */
export async function reportFirstPayment(
  database: Database,
  payment: {
    provider: "stripe" | "paypal";
    providerSubscriptionId: string;
    externalId: string;
    amountCents: number;
    currency: string;
    paidAt?: Date | null;
  },
  send: Send = fetch,
  now: Date = new Date(),
): Promise<"sent" | "skipped" | "failed"> {
  const id = measurementId();
  const secret = gaApiSecret();
  if (!id || !secret || payment.amountCents <= 0) return "skipped";

  try {
    const claimed = await database
      .update(billingCheckouts)
      .set({
        analytics: sql`${billingCheckouts.analytics} || jsonb_build_object('purchaseSentAt', ${now.toISOString()}::text)`,
        updatedAt: sql`${billingCheckouts.updatedAt}`,
      })
      .where(
        and(
          eq(billingCheckouts.provider, payment.provider),
          eq(billingCheckouts.providerSubscriptionId, payment.providerSubscriptionId),
          sql`${billingCheckouts.analytics}->>'clientId' is not null`,
          sql`${billingCheckouts.analytics}->>'purchaseSentAt' is null`,
        ),
      )
      .returning({ analytics: billingCheckouts.analytics, planId: billingCheckouts.planId });
    const row = claimed[0];
    if (!row) return "skipped";
    const visitor = row.analytics as CheckoutVisitor;

    const [plan] = row.planId
      ? await database.select({ name: plans.name }).from(plans).where(eq(plans.id, row.planId)).limit(1)
      : [];
    const value = Math.round(payment.amountCents) / 100;
    // The visit it came from, only when the money came with it (a checkout paid at once).
    const sameVisit = visitor.sessionId && now.getTime() - new Date(visitor.capturedAt).getTime() < 30 * 60 * 1000;
    const paidAt = payment.paidAt && now.getTime() - payment.paidAt.getTime() < 72 * 60 * 60 * 1000 ? payment.paidAt : null;

    const body = {
      client_id: visitor.clientId,
      ...(paidAt ? { timestamp_micros: paidAt.getTime() * 1000 } : {}),
      consent: { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: conversionId("purchase", `${payment.provider}:${payment.externalId}`),
            value,
            currency: payment.currency.toUpperCase(),
            payment_type: payment.provider,
            ...(sameVisit ? { session_id: visitor.sessionId } : {}),
            engagement_time_msec: 1,
            items: [{ item_id: row.planId ?? "plan", item_name: plan?.name ?? "Subscription", price: value, quantity: 1 }],
          },
        },
      ],
    };
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`;
    const response = await send(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`[analytics] GA4 refused the purchase for ${payment.provider} ${payment.externalId}: HTTP ${response.status}`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error(`[analytics] could not report the purchase for ${payment.provider} ${payment.externalId}`, error);
    return "failed";
  }
}
