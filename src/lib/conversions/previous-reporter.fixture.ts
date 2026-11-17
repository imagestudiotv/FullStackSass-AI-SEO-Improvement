/**
 * TEST FIXTURE: the previous release's purchase reporter, copied VERBATIM from
 * 33038bef (lib/conversions/conversions.ts, reportFirstPayment) - the code a
 * rollback of PR #133 would run again. Only its imports are adjusted:
 * conversionId and gaApiSecret moved, unchanged, to ./config. Used by
 * paid-acquisitions.test.ts to prove what that code would claim after a
 * rollback. Never imported by application code.
 */
import { and, eq, sql } from "drizzle-orm";

import { billingCheckouts, plans } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { measurementId } from "@/lib/google-analytics";

import { conversionId, gaApiSecret } from "./config";
import type { CheckoutVisitor } from "./conversions";

type Send = (url: string, init: RequestInit) => Promise<Response>;

export async function previousReportFirstPayment(
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
