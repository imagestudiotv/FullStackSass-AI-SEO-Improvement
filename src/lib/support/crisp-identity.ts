import "server-only";

import { createHmac } from "node:crypto";

/**
 * Crisp identity verification (docs.crisp.chat/guides/chatbox-sdks/web-sdk/identity-verification/,
 * Crisp Mini and up): the email is sent with HMAC-SHA256(email, secret) in
 * hex, so Crisp marks the conversation as verified and nobody can chat as
 * somebody else by typing their address into the widget.
 *
 * CRISP_IDENTITY_SECRET is the secret shown in Crisp under Settings ->
 * Workspace Settings -> Advanced configuration -> Identity Verification.
 * Server-only; never NEXT_PUBLIC. Unset: null, and the email goes unsigned as
 * it always did - turning verification on in Crisp BEFORE setting this would
 * mark every in-app conversation "Unverified", so set this first.
 */
export function crispEmailSignature(email: string, secret: string | undefined = process.env.CRISP_IDENTITY_SECRET): string | null {
  const key = secret?.trim();
  if (!key || !email) return null;
  return createHmac("sha256", key).update(email).digest("hex");
}
