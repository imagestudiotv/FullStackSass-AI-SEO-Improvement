"use server";

import { requireSession } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";

export type ConfirmEmailResult =
  | { ok: true }
  | { ok: false; error: "INVALID" | "EXPIRED" | "TOO_MANY" | "FAILED" };

/**
 * Confirms the SIGNED-IN person's own address with the code emailed to it,
 * before they are given the free articles (lib/billing/free-articles.ts).
 *
 * The code itself is requested from the browser through Better Auth's
 * send-verification-otp route ("email-verification"), which keeps its rate
 * limit (lib/auth/rate-limit.ts) and its hashed, three-try, ten-minute codes.
 *
 * WHY NOT BETTER AUTH'S OWN /email-otp/verify-email. That route is closed
 * (lib/auth.ts disabledPaths) because it marks an address verified for
 * whoever sends the code, with no session involved: an intruder who
 * registered someone else's address with their own password would keep that
 * password once the owner proved the mailbox. Here the address is never
 * taken from the request - it is the session's - so the only person who can
 * confirm it is one holding this account's session AND the code from its
 * mailbox. Server code may call the endpoint; only the HTTP route is closed.
 */
export async function confirmEmail(code: string): Promise<ConfirmEmailResult> {
  const session = await requireSession();
  if (session.user.emailVerified === true) return { ok: true };

  const otp = code.trim();
  if (!/^\d{6}$/.test(otp)) return { ok: false, error: "INVALID" };

  try {
    await auth.api.verifyEmailOTP({
      body: { email: session.user.email, otp },
    });
  } catch (error) {
    const reason = (error as { body?: { code?: string } } | null)?.body?.code;
    if (reason === "INVALID_OTP") return { ok: false, error: "INVALID" };
    if (reason === "OTP_EXPIRED") return { ok: false, error: "EXPIRED" };
    if (reason === "TOO_MANY_ATTEMPTS") return { ok: false, error: "TOO_MANY" };
    console.error("[auth] could not confirm an email address", error);
    return { ok: false, error: "FAILED" };
  }
  return { ok: true };
}
