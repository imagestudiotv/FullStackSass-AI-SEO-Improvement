/**
 * Expected outcomes of partner use cases.
 *
 * Use cases return these instead of throwing for anything a caller should
 * handle: they are part of the contract, not errors. Unexpected failures
 * (the database is down) still throw. Nothing here carries a provider secret
 * or a raw internal error; `detail` is for logs and administrators.
 */

export type FailureReason =
  | "ineligible"
  | "already_processed"
  | "review_required"
  | "onboarding_incomplete"
  | "funds_unavailable"
  | "provider_outcome_unknown"
  | "not_found"
  | "forbidden"
  | "disabled"
  | "invalid"
  | "conflict"
  | "rate_limited";

export type Failure = { ok: false; reason: FailureReason; detail?: string };
export type Success<T> = { ok: true; value: T };
export type Result<T> = Success<T> | Failure;

export function ok<T>(value: T): Success<T> {
  return { ok: true, value };
}

export function fail(reason: FailureReason, detail?: string): Failure {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}
