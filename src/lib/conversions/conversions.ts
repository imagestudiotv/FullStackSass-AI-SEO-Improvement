import { randomBytes } from "node:crypto";

import { and, eq, gt, gte, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { after } from "next/server";

import { CONSENT_COOKIE, CONSENT_MAX_AGE, parseConsent } from "@/lib/consent";
import { account, billingCheckouts, plans, user } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { measurementId, tagManagerId, type BrowserConversion } from "@/lib/google-analytics";
import { metaPixelId } from "@/lib/meta-pixel";

import { gaClientId, gaSessionCookie, gaSessionId } from "./ga-identity";
import { ANALYTICS_CONSENT_COOKIE, conversionId, validConsentKey } from "./config";
import { metaRequestUser, metaServerConfigured, sendMetaEvents, type MetaUser } from "./meta-capi";
import { revokeCheckoutConsent } from "./paid-acquisitions";

export { conversionId, gaApiSecret } from "./config";
export { reportFirstPayment } from "./paid-acquisitions";

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
 *    end and the provider charges the card. The first paid workspace payment
 *    is queued durably by the server from the payment ledger,
 *    through GA4's Measurement Protocol (reportFirstPayment), as a `purchase`
 *    for the GA identity the payer had when they started paying
 *    (rememberCheckoutVisitor). The same path covers a checkout paid at once
 *    and PayPal, so there is one source and nothing is counted twice.
 *    Google Ads must import the validated paid event from GA4 (docs/site-analytics.md).
 */

/** How long after it happens a conversion is still reported from the browser. */
export const BROWSER_WINDOW_MS = 60 * 60 * 1000;

/**
 * The conversions this person's browser should report now: their sign-up,
 * in the hour after the account was created, and the start of any free
 * articles in their workspace, in the hour after the checkout completed.
 * The browser remembers what it has sent, so a reload does not count one
 * twice. Nothing when the deployment has no Google tag and no Meta Pixel.
 */
export async function pendingConversions(
  database: Database,
  who: { userId: string; userCreatedAt: Date | string; organizationId: string | null },
  now: Date = new Date(),
): Promise<BrowserConversion[]> {
  if (!measurementId() && !tagManagerId() && !metaPixelId()) return [];
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
  /** First-party revocation proof, issued by rememberPayer after consent. Never sent to Google. */
  consentKey?: string;
  /**
   * Rollback compatibility only (paid-acquisitions.ts markSubscriptionPaid): set once the subscription
   * has a positive payment, so the previous release's reporter skips it. Not delivery or attribution
   * evidence; delivery state lives in paid_acquisitions.
   */
  purchaseSentAt?: string;
  /** "rollback_compat" when this code wrote purchaseSentAt, to tell it from the previous release's own. */
  legacyMarker?: "rollback_compat";
};

/**
 * Everything a checkout may keep: the GA identity, the payer's Meta identity
 * (lib/conversions/meta-purchases.ts), or both, under one consent proof.
 * Without GA (blocked, or not configured) there is no clientId.
 */
export type CheckoutAnalytics = Omit<CheckoutVisitor, "clientId" | "sessionId"> &
  Partial<Pick<CheckoutVisitor, "clientId" | "sessionId">> & { meta?: MetaUser };

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
export async function rememberCheckoutVisitor(database: Database, checkoutId: string, visitor: CheckoutAnalytics | null): Promise<void> {
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
 * server action), reading its cookies: the GA identity and, while Meta's
 * Conversions API is configured, the payer's Meta identity, for the
 * purchase reported when the money arrives. With `payer.plan`, Meta also
 * hears InitiateCheckout now (after the response, so the customer never
 * waits for it). Nothing without consent, without either destination, or
 * outside a request.
 */
export async function rememberPayer(
  database: Database,
  checkoutId: string,
  payer?: { userId: string; plan?: { name: string; priceCents: number; currency: string } },
): Promise<void> {
  const ga = Boolean(measurementId());
  const meta = metaServerConfigured();
  if (!ga && !meta) return;
  let jar: Awaited<ReturnType<typeof cookies>>;
  try {
    jar = await cookies();
  } catch {
    return;
  }
  const read = (name: string) => jar.get(name)?.value;
  const visitor = ga ? checkoutVisitor(read) : null;
  let metaUser: MetaUser | null = null;
  if (meta) {
    try {
      const list = await headers();
      const [person] = payer ? await database.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, payer.userId)).limit(1) : [];
      metaUser = metaRequestUser(read, (name) => list.get(name), person ?? null);
    } catch {
      metaUser = null;
    }
  }
  try {
    const existing = jar.get(ANALYTICS_CONSENT_COOKIE)?.value;
    // A resumed checkout must honor the current refusal even if the browser's
    // first-party withdrawal request has not reached the server yet.
    if (parseConsent(`${CONSENT_COOKIE}=${jar.get(CONSENT_COOKIE)?.value ?? ""}`) === "denied" && validConsentKey(existing)) {
      await revokeCheckoutConsent(database, existing);
      return;
    }
    if (!visitor && !metaUser) return;
    const key = validConsentKey(existing) ? existing : randomBytes(16).toString("hex");
    jar.set(ANALYTICS_CONSENT_COOKIE, key, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: CONSENT_MAX_AGE,
    });
    await rememberCheckoutVisitor(database, checkoutId, {
      ...(visitor ?? { capturedAt: new Date().toISOString() }),
      ...(metaUser ? { meta: metaUser } : {}),
      consentKey: key,
    });
  } catch {
    // No revocation proof means no server conversion; never stop a customer's checkout.
    console.error("[analytics] could not keep revocable checkout consent");
  }
  const plan = payer?.plan;
  if (metaUser && plan) {
    const user = metaUser;
    afterResponse(() =>
      sendMetaEvents([{
        name: "InitiateCheckout",
        id: conversionId("initiate_checkout", checkoutId),
        time: new Date(),
        path: "/pricing",
        user,
        custom: { value: plan.priceCents / 100, currency: plan.currency.toUpperCase(), content_name: plan.name.toLowerCase() },
      }]),
    );
  }
}

/** After the response when there is one (next/server after), otherwise now; never awaited by the caller. */
export function afterResponse(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}
