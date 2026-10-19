/**
 * Fraud and self-referral rules.
 *
 * Only CLEAR evidence rejects: the referred account is the partner's own
 * address, or the partner is a member of the referred organization. Weaker
 * signals - a shared IP address or browser fingerprint with one of the
 * partner's own sessions, a plus-address of the partner's mailbox - send the
 * attribution to an administrator and hold its commissions; they never reject
 * on their own, because colleagues, households and offices share networks.
 */

export type FraudSignals = {
  /** The referred user's address equals the partner's (case-insensitive). */
  sameEmail: boolean;
  /** The partner's user belongs to the referred organization. */
  partnerIsMember: boolean;
  /** The same mailbox with a different +tag, e.g. ann+2@x.com vs ann@x.com. */
  plusAddressOfPartner: boolean;
  /** The signup's IP hash matched one of the partner's recent sessions. */
  sharedNetwork: boolean;
  /** The signup's user agent hash AND IP hash matched a partner session. */
  sharedDevice: boolean;
};

export type FraudDecision =
  | { decision: "allow"; reasons: [] }
  | { decision: "review"; reasons: FraudReason[] }
  | { decision: "reject"; reasons: FraudReason[] };

export type FraudReason =
  | "self_referral_email"
  | "self_referral_member"
  | "plus_address"
  | "shared_network"
  | "shared_device";

export function evaluateFraud(signals: FraudSignals): FraudDecision {
  const reject: FraudReason[] = [];
  if (signals.sameEmail) reject.push("self_referral_email");
  if (signals.partnerIsMember) reject.push("self_referral_member");
  if (reject.length > 0) return { decision: "reject", reasons: reject };

  const review: FraudReason[] = [];
  if (signals.plusAddressOfPartner) review.push("plus_address");
  if (signals.sharedDevice) review.push("shared_device");
  else if (signals.sharedNetwork) review.push("shared_network");
  if (review.length > 0) return { decision: "review", reasons: review };
  return { decision: "allow", reasons: [] };
}

/** Lower case, trimmed. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ann+promo@x.com -> ann@x.com. Not a rejection rule; a review signal. */
export function withoutPlusTag(email: string): string {
  const normalised = normaliseEmail(email);
  const at = normalised.lastIndexOf("@");
  if (at <= 0) return normalised;
  const local = normalised.slice(0, at);
  const plus = local.indexOf("+");
  return plus > 0 ? `${local.slice(0, plus)}${normalised.slice(at)}` : normalised;
}

export function emailSignals(referredEmail: string, partnerEmail: string): Pick<FraudSignals, "sameEmail" | "plusAddressOfPartner"> {
  const sameEmail = normaliseEmail(referredEmail) === normaliseEmail(partnerEmail);
  return {
    sameEmail,
    plusAddressOfPartner: !sameEmail && withoutPlusTag(referredEmail) === withoutPlusTag(partnerEmail),
  };
}
