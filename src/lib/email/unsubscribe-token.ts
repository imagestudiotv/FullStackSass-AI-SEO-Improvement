import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The token in every non-essential email's unsubscribe link: who it is for,
 * signed, so the link turns their tips and reports off without signing in.
 *
 * WHY NO SIGN-IN. A person who wants an email to stop wants it from the
 * inbox, on whatever device they read it; sending them to a sign-in page
 * first is how a reader ends up pressing "report spam" instead - which hurts
 * every customer's deliverability, not just theirs. Gmail and Yahoo also
 * require one-click unsubscribe for mail like this (List-Unsubscribe-Post).
 *
 * WHY SIGNED. The link carries a user id, and an id alone would let anybody
 * switch off anybody's emails by guessing. HMAC-SHA256 under the server's
 * BETTER_AUTH_SECRET (already required, and never sent to a browser), with a
 * purpose prefix so this signature can never be mistaken for one the auth
 * library makes with the same key.
 *
 * NO EXPIRY, deliberately: an email read a year later must still be able to
 * stop the next one. What the token can do is small - turn one person's
 * non-essential emails off or back on - and the same is a click in Settings.
 */

const PURPOSE = "repget:email-unsubscribe:v1";

function secret(): string | null {
  return process.env.BETTER_AUTH_SECRET || null;
}

function signature(userId: string, key: string): Buffer {
  return createHmac("sha256", key).update(`${PURPOSE}:${userId}`).digest();
}

/** The token for one person; null when the server has no secret to sign with. */
export function unsubscribeToken(userId: string, key: string | null = secret()): string | null {
  if (!key) return null;
  return `${Buffer.from(userId, "utf8").toString("base64url")}.${signature(userId, key).toString("base64url")}`;
}

/**
 * The user id a token was made for, or null for anything forged, altered or
 * malformed. Compared in constant time, so the signature cannot be found a
 * byte at a time from response times.
 */
export function verifyUnsubscribeToken(token: string | null | undefined, key: string | null = secret()): string | null {
  if (!key || !token || token.length > 512) return null;
  const [encodedId, encodedSignature, extra] = token.split(".");
  if (!encodedId || !encodedSignature || extra !== undefined) return null;
  const userId = Buffer.from(encodedId, "base64url").toString("utf8");
  if (!userId || Buffer.from(userId, "utf8").toString("base64url") !== encodedId) return null;
  const given = Buffer.from(encodedSignature, "base64url");
  const expected = signature(userId, key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}
