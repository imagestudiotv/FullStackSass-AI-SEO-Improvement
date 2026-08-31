import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetric encryption for third-party credentials at rest.
 *
 * Integration credentials are WRITE access to a customer's live website. Stored
 * in plaintext, one database leak hands an attacker the ability to publish to,
 * or deface, every customer site we are connected to. That is a materially
 * worse outcome than leaking our own data, so these columns are encrypted
 * separately from whatever the database provider does at the disk level.
 *
 * AES-256-GCM, not CBC: GCM authenticates the ciphertext, so tampering is
 * detected on decrypt rather than silently producing different plaintext.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the size GCM is specified for.
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Derives the key from CREDENTIALS_ENCRYPTION_KEY, falling back to
 * BETTER_AUTH_SECRET so an existing deployment keeps working without a new
 * variable. A dedicated key is better: rotating auth sessions should not
 * require re-encrypting every stored credential.
 */
function secret(): string {
  const value =
    process.env.CREDENTIALS_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!value) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY (or BETTER_AUTH_SECRET) must be set to store credentials",
    );
  }
  return value;
}

/**
 * Encrypts a value, returning "salt.iv.tag.ciphertext" in base64url.
 *
 * A per-record salt means two records with the same plaintext and the same
 * master secret still produce different ciphertext, and the derived key is
 * never reused across records.
 */
export function encryptSecret(plaintext: string): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = scryptSync(secret(), salt, KEY_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [salt, iv, tag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

/** Reverses encryptSecret. Throws if the value was tampered with. */
export function decryptSecret(encoded: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted value");
  }

  const [salt, iv, tag, ciphertext] = parts.map((part) =>
    Buffer.from(part, "base64url"),
  );
  const key = scryptSync(secret(), salt, KEY_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Last 4 characters, for showing which credential is stored without revealing
 * it. Short values are masked entirely rather than mostly shown.
 */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `••••${plaintext.slice(-4)}`;
}
