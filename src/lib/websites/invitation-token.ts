import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invitation tokens.
 *
 * The token is a bearer credential — whoever holds the link becomes an editor
 * on a customer's website — so it is treated like a password, not like an id:
 *
 *  - 32 random bytes from the CSPRNG. Not crypto.randomUUID(): a UUIDv4 has
 *    122 bits of entropy and a recognisable shape, and there is no reason to
 *    spend the shape on a secret.
 *  - base64url, so it survives a URL and an email client's line-wrapping
 *    without escaping. Base64's "+" and "/" do neither.
 *  - Only the SHA-256 hash reaches the database. Read access to that table,
 *    a leaked backup or a stray log line is then not enough to accept an
 *    invitation. Unsalted and unstretched on purpose: this is a 256-bit
 *    random value, so there is no dictionary to attack and bcrypt would only
 *    make the lookup slow.
 */

export const INVITATION_TTL_DAYS = 7;

export function createInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** When a token minted now stops working. */
export function invitationExpiry(): Date {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Constant-time comparison of two hashes.
 *
 * The lookup itself is a unique-index hit on the hash, which is the fast path
 * and leaks nothing useful. This exists for the second check in the accept
 * route, where an early-exit `===` on a secret is the kind of thing that is
 * correct today and quoted in a pentest report tomorrow.
 */
export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
