import type { TransitionTable } from "./state-machine";

/**
 * A partner: an approved affiliate profile owned by exactly one RepGet user.
 *
 * Not an organization, not a role in one, and not an administrator. Partner
 * access needs no paid plan, website or customer workspace, and grants
 * nothing outside the partner portal.
 */

export type PartnerStatus = "active" | "suspended";

export const PARTNER_TRANSITIONS: TransitionTable<PartnerStatus> = {
  active: ["suspended"],
  suspended: ["active"],
};

export type PartnerProfile = {
  id: string;
  userId: string | null;
  referralCode: string;
  status: PartnerStatus;
  /** Set by an administrator: no automatic payouts while present. */
  payoutHoldReason: string | null;
};

/** May this partner be paid automatically right now? */
export function canReceiveAutomaticPayout(partner: Pick<PartnerProfile, "status" | "payoutHoldReason">): boolean {
  return partner.status === "active" && partner.payoutHoldReason === null;
}

/** Characters for referral codes: no 0/O or 1/I/L, so a code survives being read aloud. */
export const REFERRAL_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const REFERRAL_CODE_LENGTH = 10;
const REFERRAL_CODE_RE = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/**
 * Builds a referral code from random integers (one per character, each in
 * [0, alphabet length)). The randomness itself comes from the caller - a
 * cryptographic source in infrastructure - so this stays pure.
 */
export function referralCodeFrom(randomIndexes: number[]): string {
  if (randomIndexes.length !== REFERRAL_CODE_LENGTH) throw new Error("Wrong number of random indexes");
  return randomIndexes
    .map((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= REFERRAL_CODE_ALPHABET.length) {
        throw new Error("Random index out of range");
      }
      return REFERRAL_CODE_ALPHABET[index];
    })
    .join("");
}

/** Normalises a code from a URL; null when it cannot be one of ours. */
export function normaliseReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  return REFERRAL_CODE_RE.test(cleaned) ? cleaned : null;
}
