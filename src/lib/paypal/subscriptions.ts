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
        // Cancel after three failed attempts rather than retrying forever.
        setup_fee_failure_action: "CANCEL",
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
    last_payment?: { time?: string };
  };
  custom_id?: string;
  plan_id?: string;
};

export type CreatedSubscription = {
  subscriptionId: string;
  /** Where to send the customer to approve it. */
  approveUrl: string;
};

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
  returnUrl: string;
  cancelUrl: string;
}): Promise<CreatedSubscription> {
  const subscription = await payPalRequest<PayPalSubscription>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        plan_id: input.planId,
        /**
         * custom_id carries our organization id through PayPal and back on
         * every webhook. Without it a subscription event arriving weeks later
         * could not be matched to a customer.
         */
        custom_id: input.organizationId,
        application_context: {
          brand_name: "AI SEO Platform",
          user_action: "SUBSCRIBE_NOW",
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
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

/**
 * Maps PayPal's status vocabulary onto the one already stored.
 *
 * The subscriptions table and every entitlement check use Stripe's words, so
 * translating here keeps a single set of statuses in the database rather than
 * two dialects that every reader would have to know about.
 */
export function mapStatus(paypalStatus: string): string {
  switch (paypalStatus) {
    case "ACTIVE":
      return "active";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "incomplete";
    case "SUSPENDED":
      // Suspended means payment is failing but the subscription still exists,
      // which is what Stripe calls past_due.
      return "past_due";
    case "CANCELLED":
      return "canceled";
    case "EXPIRED":
      return "canceled";
    default:
      return "inactive";
  }
}
