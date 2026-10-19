import "server-only";

import { clientAddress } from "@/lib/visitor-key";

import { captureSignupEligibility, type SignupCapture } from "../application/use-cases/attribute-new-customer";
import { partnerDeps } from "../server";
import { PARTNER_COOKIE, parseTrackingToken } from "./tracking-cookie";

/**
 * Called by Better Auth's user-create hook (lib/auth.ts) for EVERY new
 * account - email sign-up, one-time-code sign-up and Google - after the
 * signup workspace has been created. It runs on the server, inside the
 * request that created the account, which is the only moment the partner
 * cookie and the "this account is new" fact are both known.
 *
 * Never throws: an account must never fail to be created because the
 * partner program could not record something. A failure is logged loudly
 * (the account is then simply not attributable).
 */

type HookContext = {
  path?: string;
  headers?: HeadersInit | Headers;
  request?: Request;
  getCookie?: (key: string) => string | null;
} | null;

function signupMethod(path: string | undefined): SignupCapture["method"] {
  if (!path) return "unknown";
  if (path.startsWith("/sign-up/email")) return "email";
  if (path.startsWith("/sign-in/email-otp")) return "otp";
  if (path.startsWith("/callback/")) return "google";
  return "unknown";
}

function readCookie(context: HookContext, headers: Headers): string | null {
  const direct = context?.getCookie?.(PARTNER_COOKIE);
  if (direct) return direct;
  const header = headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === PARTNER_COOKIE) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function capturePartnerSignup(
  user: { id: string; email: string; createdAt?: Date | string | null },
  context: HookContext,
): Promise<void> {
  try {
    const headers = new Headers((context?.headers as HeadersInit | undefined) ?? context?.request?.headers ?? undefined);
    const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
    const result = await captureSignupEligibility(partnerDeps(), {
      userId: user.id,
      email: user.email,
      createdAt,
      method: signupMethod(context?.path),
      trackingToken: parseTrackingToken(readCookie(context, headers)),
      ipAddress: clientAddress(headers),
      userAgent: headers.get("user-agent"),
    });
    if (!result.ok && result.reason !== "already_processed") {
      console.warn("[partners] signup eligibility not recorded", { reason: result.reason });
    }
  } catch (error) {
    console.error("[partners] signup eligibility failed; this account cannot be attributed", error);
  }
}
