/**
 * What a failed Stripe call means for money.
 *
 *   refused - Stripe answered with a 4xx: the request was processed and
 *             rejected, nothing was created. Safe to record as failed.
 *   unknown - a timeout, a dropped connection, a 5xx, or an idempotency key
 *             still in use by another request: the operation MAY exist. Never
 *             retried blindly - reconciled first.
 *
 * A 409 (idempotency_key_in_use) is "unknown": the original request may be
 * succeeding right now.
 */

type StripeLikeError = { type?: string; code?: string; statusCode?: number; message?: string };

export type ClassifiedError =
  | { kind: "refused"; code: string | null; message: string }
  | { kind: "unknown"; message: string };

export function classifyStripeError(error: unknown): ClassifiedError {
  const e = (error ?? {}) as StripeLikeError;
  const message = (e.message ?? (error instanceof Error ? error.message : "Stripe request failed")).slice(0, 300);
  const status = typeof e.statusCode === "number" ? e.statusCode : null;
  if (e.type === "StripeConnectionError" || status === null) return { kind: "unknown", message };
  if (status === 409) return { kind: "unknown", message };
  if (status >= 400 && status < 500) return { kind: "refused", code: e.code ?? (status === 429 ? "rate_limited" : null), message };
  return { kind: "unknown", message };
}
