import { createHash } from "node:crypto";

/** Server-only Measurement Protocol credential. Never persist it in an outbox or log it. */
export function gaApiSecret(raw: string | undefined = process.env.GA4_API_SECRET): string | null {
  const secret = raw?.trim();
  return secret && /^[A-Za-z0-9_-]{8,100}$/.test(secret) ? secret : null;
}

/** Stable opaque event id, including across an acknowledgement-lost retry. */
export function conversionId(kind: string, id: string): string {
  return createHash("sha256").update(`repget:${kind}:${id}`).digest("hex").slice(0, 32);
}

/** First-party proof permitting this browser to revoke its saved checkout identities. */
export const ANALYTICS_CONSENT_COOKIE = "repget_analytics_consent";
export function validConsentKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}
