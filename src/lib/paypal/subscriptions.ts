import { payPalRequest } from "@/lib/paypal/client";

/**
 * PayPal product, plan and subscription operations.
 *
 * PayPal's model differs from Stripe's in one way that shapes everything here:
 * a subscription is approved by the CUSTOMER on PayPal's site, and only then
 * activated. So creating one gives back a URL to send them to — nothing is
 * charged until they approve, and the webhook is what tells us it happened.
 */

export type PayPalProduct = { id: string; name: string };

export async function createProduct(
  name: string,
  description: string,
): Promise<PayPalProduct> {
  return payPalRequest<PayPalProduct>("/v1/catalogs/products", {
    method: "POST",
    // Keyed on the name so re-running setup reuses the product rather than
    // creating a duplicate catalogue entry.
    idempotencyKey: `product-${name}`,
    body: JSON.stringify({
      name,
      description,
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
}

export async function listProducts(): Promise<PayPalProduct[]> {
  const data = await payPalRequest<{ products?: PayPalProduct[] }>(
    "/v1/catalogs/products?page_size=100",
  );
  return data.products ?? [];
}

export type PayPalPlan = { id: string; name: string; status: string };

/**
 * Creates a billing plan under a product.
 *
 * `total_cycles: 0` means bill forever until cancelled — PayPal's way of
 * expressing an open-ended subscription.
 */
export async function createPlan(input: {
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
}): Promise<PayPalPlan> {
  const amount = (input.priceCents / 100).toFixed(2);

  return payPalRequest<PayPalPlan>("/v1/billing/plans", {
    method: "POST",
    idempotencyKey: `plan-${input.productId}-${input.interval}-${input.priceCents}`,
    body: JSON.stringify({
      product_id: input.productId,
      name: input.name,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: input.interval === "year" ? "YEAR" : "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: amount,
              currency_code: input.currency.toUpperCase(),
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        // Applies only to a setup fee, and these plans have none.
        setup_fee_failure_action: "CANCEL",
        /*
          After three failed payments PayPal SUSPENDS the subscription. It is
          not cancelled: nothing at PayPal ends a suspended subscription, which
          is why mapStatus stores SUSPENDED as "unpaid".
        */
        payment_failure_threshold: 3,
      },
    }),
  });
}

export async function listPlans(): Promise<PayPalPlan[]> {
  const data = await payPalRequest<{ plans?: PayPalPlan[] }>(
    "/v1/billing/plans?page_size=100",
  );
  return data.plans ?? [];
}

export type PayPalSubscription = {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string; amount?: { value?: string; currency_code?: string } };
    /** Payments failed since the last one that succeeded; PayPal resets it to 0 on success. */
    failed_payments_count?: number;
    /**
     * One entry per billing cycle of the plan: on a free-articles plan the
     * free days (TRIAL) and the paid cycle (REGULAR), each with how many
     * times PayPal has run it.
     */
    cycle_executions?: {
      tenure_type?: string;
      sequence?: number;
      cycles_completed?: number;
      cycles_remaining?: number;
      total_cycles?: number;
    }[];
  };
  /** When the subscription started billing (after approval). */
  start_time?: string;
  custom_id?: string;
  plan_id?: string;
};

export type CreatedSubscription = {
  subscriptionId: string;
  /** Where to send the customer to approve it. */
  approveUrl: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * custom_id in exactly the shape createSubscription writes today:
 * "<organization>:<website uuid>:<checkout uuid>". Null for anything else -
 * one of ours in an older form, or a subscription another integration on
 * the same PayPal account made with its own custom_id ("ORDER-123"). Whether
 * the checkout it names really is ours is the caller's check
 * (paypal-events.ts).
 */
export function parseExactCustomId(value: string | null | undefined): {
  organizationId: string;
  websiteId: string;
  checkoutId: string;
} | null {
  const parts = value ? value.split(":") : [];
  if (parts.length !== 3) return null;
  const [organizationId, websiteId, checkoutId] = parts;
  if (!organizationId || !UUID_RE.test(websiteId) || !UUID_RE.test(checkoutId)) return null;
  return { organizationId, websiteId, checkoutId };
}

/**
 * Reads back what createSubscription wrote into custom_id.
 *
 * Tolerates the old form, which held only an organization id: those
 * subscriptions are still live and still send webhooks. Tolerant means it
 * reads ANY text as ids, so it is only used for a subscription already
 * known to be ours (paypal-events.ts).
 */
export function parseCustomId(value: string | null | undefined): {
  organizationId: string | null;
  websiteId: string | null;
  checkoutId: string | null;
} {
  if (!value) return { organizationId: null, websiteId: null, checkoutId: null };
  const [organizationId, websiteId, checkoutId] = value.split(":");
  return {
    organizationId: organizationId || null,
    websiteId: websiteId || null,
    checkoutId: checkoutId || null,
  };
}

/**
 * Starts a subscription and returns the approval URL.
 *
 * Nothing is charged here. The customer approves on PayPal, and the
 * BILLING.SUBSCRIPTION.ACTIVATED webhook is what grants access — never the
 * return redirect, which a customer can reach without paying.
 */
export async function createSubscription(input: {
  planId: string;
  organizationId: string;
  /** The website this pays for; each site is billed separately. */
  websiteId: string;
  /** Our billing_checkouts id: carried back on every webhook. */
  checkoutId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<CreatedSubscription> {
  const subscription = await payPalRequest<PayPalSubscription>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      /*
        PayPal replays a request with the same id instead of creating a
        second subscription, so a retried create for one checkout makes one.
      */
      idempotencyKey: `checkout:${input.checkoutId}`,
      body: JSON.stringify({
        plan_id: input.planId,
        /**
         * custom_id carries our ids through PayPal and back on every webhook.
         * Without it a subscription event arriving weeks later could not be
         * matched to a customer.
         *
         * The ids, colon separated: PayPal gives one free-text field (127
         * characters), and a subscription belongs to a website and to the
         * checkout that made it. Read back with parseCustomId, which
         * tolerates the older one- and two-id forms still carried by
         * subscriptions created before this.
         */
        custom_id: `${input.organizationId}:${input.websiteId}:${input.checkoutId}`,
        application_context: {
          brand_name: "RepGet",
          user_action: "SUBSCRIBE_NOW",
          // A software service: PayPal must not ask the buyer for a shipping address.
          shipping_preference: "NO_SHIPPING",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      }),
    },
  );

  const approve = subscription.links?.find((link) => link.rel === "approve");
  if (!approve) {
    throw new Error("PayPal did not return an approval URL");
  }

  return { subscriptionId: subscription.id, approveUrl: approve.href };
}

export async function getSubscription(
  subscriptionId: string,
): Promise<PayPalSubscription> {
  return payPalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
}

export async function cancelSubscription(
  subscriptionId: string,
  reason = "Cancelled by the customer",
): Promise<void> {
  await payPalRequest(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      idempotencyKey: `cancel:${subscriptionId}`,
      body: JSON.stringify({ reason }),
    },
  );
}

/**
 * Moves an existing subscription to another plan. PayPal answers with an
 * approval link: the buyer confirms the new price on PayPal, and the
 * BILLING.SUBSCRIPTION.UPDATED webhook records it. The subscription - and
 * its id, history and payments - stays the same one.
 */
export async function reviseSubscription(input: {
  subscriptionId: string;
  planId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ approveUrl: string | null }> {
  const revised = await payPalRequest<{ links?: { href: string; rel: string }[] }>(
    `/v1/billing/subscriptions/${encodeURIComponent(input.subscriptionId)}/revise`,
    {
      method: "POST",
      idempotencyKey: `revise:${input.subscriptionId}:${input.planId}`,
      body: JSON.stringify({
        plan_id: input.planId,
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      }),
    },
  );
  return { approveUrl: revised.links?.find((link) => link.rel === "approve")?.href ?? null };
}

/**
 * Whether a payment PayPal reports moved money. A free cycle reports none, or
 * 0; a report without an amount (older answers) is taken as a payment.
 */
export function movedMoney(payment?: { amount?: { value?: string } }): boolean {
  if (!payment) return false;
  if (payment.amount?.value === undefined) return true;
  return Number(payment.amount.value) > 0;
}

/**
 * Whether a subscription to a free-articles plan (scripts/paypal-plans.mjs)
 * is still in its free days: active, nothing failed, no paid cycle billed
 * yet, and the first charge still ahead. Stored as "trialing", as a card
 * trial is, so the free articles and everything that waits for the plan
 * follow the same rules (lib/billing/free-articles.ts).
 *
 * The paid cycle's count decides, not the free one's: PayPal counts the free
 * cycle as run from its first day.
 */
export function inFreeDays(live: PayPalSubscription, now: Date = new Date()): boolean {
  if (live.status !== "ACTIVE") return false;
  const info = live.billing_info;
  if ((info?.failed_payments_count ?? 0) > 0) return false;
  const next = info?.next_billing_time ? Date.parse(info.next_billing_time) : Number.NaN;
  if (!Number.isFinite(next) || next <= now.getTime()) return false;
  const regular = info?.cycle_executions?.find((cycle) => cycle.tenure_type === "REGULAR");
  if (regular) return (regular.cycles_completed ?? 0) === 0;
  // No cycle report: free while nothing has been paid.
  return !movedMoney(info?.last_payment);
}

/**
 * Maps PayPal's status vocabulary onto the one already stored.
 *
 * The subscriptions table and every entitlement check use Stripe's words, so
 * translating here keeps a single set of statuses in the database rather than
 * two dialects that every reader would have to know about.
 */
export function mapStatus(
  paypalStatus: string,
  billingInfo?: PayPalSubscription["billing_info"],
): string {
  switch (paypalStatus) {
    case "ACTIVE":
      /*
        PayPal keeps a subscription ACTIVE while it retries a failed payment,
        counting the failures until one succeeds. That is Stripe's past_due:
        still entitled, shown as a warning, and over either way - paid
        (the count resets) or suspended.
      */
      return (billingInfo?.failed_payments_count ?? 0) > 0 ? "past_due" : "active";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "incomplete";
    case "SUSPENDED":
      /*
        PayPal has stopped billing it - after payment_failure_threshold failed
        payments, or by hand - and nothing at PayPal ever ends a suspended
        subscription. "unpaid", which is not entitled. It used to be
        past_due, which is: a subscriber who stopped paying kept articles and
        monthly credits indefinitely.
      */
      return "unpaid";
    case "CANCELLED":
      return "canceled";
    case "EXPIRED":
      return "canceled";
    default:
      return "inactive";
  }
}
