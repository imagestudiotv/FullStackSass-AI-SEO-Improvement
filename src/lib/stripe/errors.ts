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
     * There are TWO ways an id goes missing, and they need different fixes.
     *
     * Stripe distinguishes them for us. When the object exists in the other
     * MODE of the same account it says so explicitly ("a similar object exists
     * in live mode, but a test mode key was used"). When that sentence is
     * absent the object is not in this account at all — usually because the
     * environment holds a key for a different Stripe ACCOUNT, which has its
     * own separate test mode.
     *
     * Naming only the mode sends people to re-run stripe:setup when the real
     * fault is the key, which wastes a debugging cycle and rewrites ids that
     * were never wrong.
     */
    const stripeSaysOtherMode = /similar object exists in (live|test) mode/i.test(
      message ?? "",
    );

    const shared =
      `Stripe rejected ${param ? param : "an object"}. ` +
      `Stripe said: "${message ?? "no such object"}" ` +
      `This deployment is using a ${mode.toUpperCase()} key.`;

    if (stripeSaysOtherMode) {
      return (
        `${shared} The id belongs to the other mode of this same account, so the ` +
        `stored ids and the key disagree. Either point this environment at its ` +
        `matching key, or re-run \`npm run stripe:setup${mode === "live" ? " -- --live" : ""}\` ` +
        `to recreate the ids for this mode.`
      );
    }

    return (
      `${shared} Stripe did not report the id as belonging to the other mode, so it ` +
      `most likely belongs to a DIFFERENT Stripe account — every account has its own ` +
      `separate test mode, and ids are never shared between accounts. ` +
      `Compare the account this deployment uses (visit /api/stripe/whoami as an admin) ` +
      `with the one \`npm run doctor\` prints; if they differ, this environment has the ` +
      `wrong STRIPE_SECRET_KEY.`
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
