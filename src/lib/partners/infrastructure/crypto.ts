import { createHash, createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";

import type { Hasher, SecureRandom } from "../application/ports/directory";

export const secureRandom: SecureRandom = {
  indexes(n, max) {
    return Array.from({ length: n }, () => randomInt(0, max));
  },
  token() {
    // 32 bytes = 256 bits, URL-safe.
    return randomBytes(32).toString("base64url");
  },
  uuid() {
    return randomUUID();
  },
};

/**
 * The key for pseudonymous hashes (a visitor's network). A dedicated
 * PARTNER_TRACKING_SECRET when set; otherwise the auth secret, so no
 * deployment ever hashes with a public constant.
 */
function trackingKey(): string {
  const key = process.env.PARTNER_TRACKING_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!key) throw new Error("PARTNER_TRACKING_SECRET (or BETTER_AUTH_SECRET) is not set");
  return key;
}

export const hasher: Hasher = {
  sha256(value) {
    return createHash("sha256").update(value).digest("hex");
  },
  hmac(value) {
    return createHmac("sha256", trackingKey()).update(value).digest("hex").slice(0, 32);
  },
};
