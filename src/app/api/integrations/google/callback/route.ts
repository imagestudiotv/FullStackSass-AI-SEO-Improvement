import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { saveTokens } from "@/lib/analytics/connection";
import { exchangeCode, GoogleAuthError } from "@/lib/analytics/google-oauth";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";

/**
 * Google OAuth callback.
 *
 * The `state` parameter is signed, not merely random. It carries the website
 * id the tokens belong to, and without a signature an attacker could craft a
 * callback naming someone else's website and attach their own Google account
 * to it. The membership check still runs afterwards, so this is defence in
 * depth rather than the only guard.
 */

export const dynamic = "force-dynamic";

function stateSecret(): string {
  const value =
    process.env.CREDENTIALS_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("No secret available to sign OAuth state");
  return value;
}

export function signState(websiteId: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = `${websiteId}.${nonce}`;
  const signature = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;

  const [websiteId, nonce, signature] = parts;
  const expected = createHmac("sha256", stateSecret())
    .update(`${websiteId}.${nonce}`)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return websiteId;
}

function back(websiteId: string | null, params: Record<string, string>) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const path = websiteId ? `/websites/${websiteId}` : "/websites";
  const query = new URLSearchParams(params).toString();
  return NextResponse.redirect(`${base}${path}?${query}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const websiteId = state ? verifyState(state) : null;

  if (!websiteId) {
    // A tampered or missing state is not something to explain in detail.
    return back(null, { google: "invalid_request" });
  }

  if (error) {
    // The user pressed Cancel on Google's consent screen; not a failure.
    return back(websiteId, { google: error === "access_denied" ? "cancelled" : "error" });
  }

  if (!code) {
    return back(websiteId, { google: "error" });
  }

  try {
    /**
     * Membership is re-checked here even though state is signed: the signature
     * proves the link came from us, not that THIS session may connect that
     * website. A shared or forwarded callback URL must not work.
     */
    await requireWebsite(websiteId);
  } catch (caught) {
    if (caught instanceof WebsiteNotFoundError) {
      return back(null, { google: "forbidden" });
    }
    throw caught;
  }

  try {
    const tokens = await exchangeCode(code);
    await saveTokens(websiteId, tokens);
  } catch (caught) {
    if (caught instanceof GoogleAuthError) {
      return back(websiteId, { google: "error" });
    }
    throw caught;
  }

  return back(websiteId, { google: "connected" });
}
