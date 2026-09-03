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

    /**
     * Stripe's own message states which mode the object actually lives in
     * ("a similar object exists in live mode, but a test mode key was used").
     * An earlier version of this guessed instead, and guessed the wrong way
     * round when the key was live and the stored id was test — pointing at the
     * database when the key was at fault. Stripe's wording is authoritative,
     * so it is quoted rather than restated.
     */
    return (
      `Stripe rejected ${param ? `${param}` : "an object"} because it does not exist ` +
      `in the mode this deployment is using. ` +
      `The key in use is a ${mode.toUpperCase()} key (STRIPE_SECRET_KEY starts with sk_${mode}_). ` +
      `Stripe said: "${message ?? "no such object"}" — ` +
      `test and live are separate, so an id from one never works in the other. ` +
      `Either point this environment at its matching key, or re-run ` +
      `\`npm run stripe:setup${mode === "live" ? " -- --live" : ""}\` to recreate the ids for this mode. ` +
      `\`npm run doctor\` reports which side is out of step.`
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
