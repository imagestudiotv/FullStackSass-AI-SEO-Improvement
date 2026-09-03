import { STRIPE_API_VERSION } from "@/lib/stripe/client";

/**
 * Turning a Stripe failure into something a person can act on.
 *
 * Without this, an error thrown inside a server action escapes to the client
 * as an unhandled rejection. In a production build React strips the message
 * and reports error #441 ("An error occurred in the Server Components render"),
 * so the browser console shows a 500 and a number — and the actual cause, which
 * Stripe stated plainly, is thrown away.
 *
 * Every message here is safe to show: they describe our own misconfiguration,
 * never customer or card data.
 */

/** The shape of a Stripe SDK error, without importing the class. */
type StripeLikeError = {
  type?: string;
  code?: string;
  message?: string;
  param?: string;
  statusCode?: number;
};

function asStripeError(error: unknown): StripeLikeError | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as StripeLikeError;
  // Stripe errors always carry a `type` beginning "Stripe" or an API type
  // such as "invalid_request_error".
  return typeof candidate.type === "string" ? candidate : null;
}

/** True when the key in use is a test/sandbox key. */
export function usingTestKey(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_test_");
}

/**
 * A readable message for a failed Stripe call.
 *
 * The mode mismatch gets its own message because it is by far the most common
 * cause during setup and the most confusing: Stripe reports it as a plain
 * "No such price", which reads as though the price was deleted rather than as
 * "you are asking the wrong account". Test and live are entirely separate
 * datasets — an object created in one is invisible to the other.
 */
export function stripeErrorMessage(error: unknown): string {
  const stripeError = asStripeError(error);

  if (!stripeError) {
    return error instanceof Error && error.message
      ? error.message
      : "Something went wrong starting checkout. Please try again.";
  }

  const { code, message, param } = stripeError;

  if (code === "resource_missing") {
    const mode = usingTestKey() ? "test" : "live";
    const other = usingTestKey() ? "live" : "test";
    return (
      `Stripe could not find ${param ? `the ${param}` : "that object"} in ${mode} mode. ` +
      `It was most likely created in ${other} mode — test and live are separate, ` +
      `so IDs from one never work in the other. ` +
      `Re-run \`npm run stripe:setup\`${mode === "live" ? " -- --live" : ""} with the ${mode} key to recreate it.`
    );
  }

  if (code === "api_key_expired" || stripeError.type === "StripeAuthenticationError") {
    return "The Stripe API key is invalid or has been revoked. Check STRIPE_SECRET_KEY.";
  }

  if (stripeError.type === "StripeConnectionError") {
    return "Could not reach Stripe. Check your connection and try again.";
  }

  if (code === "parameter_unknown" || code === "parameter_invalid_empty") {
    return (
      `Stripe rejected a parameter${param ? ` (${param})` : ""}. ` +
      `This usually means the pinned API version (${STRIPE_API_VERSION}) no longer matches the SDK.`
    );
  }

  return message ?? "Stripe rejected the request. Please try again.";
}
