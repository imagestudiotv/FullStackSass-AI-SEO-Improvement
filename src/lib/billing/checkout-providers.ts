import type Stripe from "stripe";

import type { CancellationOps } from "@/lib/billing/cancellations";
import type { CheckoutProviderOps, StripeSessionState } from "@/lib/billing/checkouts";
import { PayPalError } from "@/lib/paypal/client";
import { cancelSubscription, getSubscription } from "@/lib/paypal/subscriptions";
import { stripe } from "@/lib/stripe/client";

/**
 * The provider calls checkouts, deletion and owed cancellations make. Kept
 * apart from the modules that decide, so those never import an SDK and tests
 * inject fakes instead.
 */

function sessionState(session: Stripe.Checkout.Session): StripeSessionState {
  if (session.status === "complete") {
    const subscription = session.subscription;
    return {
      state: "complete",
      subscriptionId:
        typeof subscription === "string" ? subscription : (subscription?.id ?? null),
    };
  }
  if (session.status === "expired") return { state: "expired" };
  return {
    state: "open",
    url: session.url ?? null,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
  };
}

function isStripeNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "resource_missing"
  );
}

export const checkoutProviderOps: CheckoutProviderOps = {
  async expireStripeCheckout(sessionId) {
    try {
      await stripe.checkout.sessions.expire(sessionId);
      return { state: "expired" };
    } catch (error) {
      /*
        Stripe refuses to expire a session that is not open. Read it back to
        learn which way it went rather than parsing the error: a network
        failure here also lands in this catch, and retrieve throwing too is
        the right answer for that (the caller leaves the checkout unsettled).
      */
      const state = sessionState(await stripe.checkout.sessions.retrieve(sessionId));
      if (state.state === "open") {
        console.error(`[checkouts] could not expire Stripe session ${sessionId}`, error);
        return { state: "open" };
      }
      return state;
    }
  },

  async stripeSessionState(sessionId) {
    return sessionState(await stripe.checkout.sessions.retrieve(sessionId));
  },

  async findStripeSession({ checkoutId, customerId, createdAt }) {
    /*
      Sessions are listed by customer from shortly before our row was
      written, and matched on client_reference_id - our checkout id, set on
      every session we create. Listing is authoritative for that customer:
      no match means no session was made.
    */
    const since = Math.floor(createdAt.getTime() / 1000) - 60;
    for await (const session of stripe.checkout.sessions.list({
      customer: customerId,
      created: { gte: since },
      limit: 100,
    })) {
      if (session.client_reference_id === checkoutId || session.metadata?.checkoutId === checkoutId) {
        return {
          sessionId: session.id,
          url: session.url ?? null,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
        };
      }
    }
    return null;
  },

  async payPalApprovalState(subscriptionId) {
    try {
      const subscription = await getSubscription(subscriptionId);
      switch (subscription.status) {
        case "APPROVAL_PENDING":
          return "pending";
        case "CANCELLED":
        case "EXPIRED":
          return "ended";
        default:
          // APPROVED, ACTIVE, SUSPENDED and anything new: a subscription the
          // buyer has agreed to, which can bill.
          return "live";
      }
    } catch (error) {
      // PayPal has no subscription by that id, so nothing can be approved.
      if (error instanceof PayPalError && error.kind === "not_found") {
        return "ended";
      }
      throw error;
    }
  },
};

/**
 * Cancels a subscription we owe a cancellation for (cancellations.ts).
 *
 * Asks first, so a repeat after a lost answer finds it already cancelled
 * rather than erroring; Stripe's cancel also carries an idempotency key.
 */
export const cancellationOps: CancellationOps = {
  async cancel(provider, providerSubscriptionId, reason) {
    if (provider === "stripe") {
      let current: Stripe.Subscription;
      try {
        current = await stripe.subscriptions.retrieve(providerSubscriptionId);
      } catch (error) {
        if (isStripeNotFound(error)) return "already_ended";
        throw error;
      }
      if (current.status === "canceled" || current.status === "incomplete_expired") {
        return "already_ended";
      }
      await stripe.subscriptions.cancel(
        providerSubscriptionId,
        {},
        { idempotencyKey: `owed-cancel:${providerSubscriptionId}` },
      );
      return "cancelled";
    }

    let status: string;
    try {
      status = (await getSubscription(providerSubscriptionId)).status;
    } catch (error) {
      if (error instanceof PayPalError && error.kind === "not_found") return "already_ended";
      throw error;
    }
    if (status === "CANCELLED" || status === "EXPIRED") return "already_ended";
    // PayPal cancels only an approved subscription; a pending one may yet be.
    if (status === "APPROVAL_PENDING") return "not_cancellable_yet";
    await cancelSubscription(providerSubscriptionId, reason);
    return "cancelled";
  },
};
