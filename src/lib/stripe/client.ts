import Stripe from "stripe";

/**
 * API version is pinned explicitly, not left to the account default.
 *
 * Clicking "upgrade API version" in the Stripe dashboard would otherwise
 * change object shapes underneath a running deployment. "2026-08-26.dahlia"
 * is the version this SDK's types are generated against (see
 * node_modules/stripe/cjs/apiVersion.d.ts), so the wire format and the
 * TypeScript types stay in lockstep.
 *
 * Note for anyone reading subscription periods: current_period_start/end were
 * removed from the Subscription object and live on the subscription ITEM —
 * subscription.items.data[0].current_period_end. Reading them from the root is
 * a compile error under strict TypeScript, which is the only thing stopping a
 * silent `undefined` becoming an Invalid Date on a customer's billing page.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let client: Stripe | null = null;

/**
 * The Stripe SDK, created on first use.
 *
 * Constructed lazily rather than at module scope so that importing this file
 * does not require a key. `next build` evaluates every route module to collect
 * page data, so a module-scope throw fails the whole build on any machine
 * without STRIPE_SECRET_KEY — CI, a fresh clone, or a preview deploy. Deferring
 * it means only a request that actually reaches Stripe fails, and it fails with
 * the same clear message.
 */
function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
      appInfo: { name: "AI SEO Platform" },
    });
  }
  return client;
}

/** True when a key is configured; lets callers degrade instead of throwing. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Proxy so existing `stripe.checkout.sessions.create(...)` call sites keep
 * working unchanged while construction stays deferred to first property access.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, property, receiver) {
    return Reflect.get(getStripe(), property, receiver);
  },
});
