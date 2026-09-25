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

/**
 * Where the customer pressed Connect, so the callback can send them back there.
 *
 * Signed into the state with the website id, so it cannot be swapped for
 * somewhere else on the way through Google, and it only ever selects one of
 * two fixed paths - never a URL.
 */
export type ConnectOrigin = "app" | "onboarding";

export function signState(
  websiteId: string,
  origin: ConnectOrigin = "app",
): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = `${websiteId}.${nonce}.${origin}`;
  const signature = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyState(
  state: string,
): { websiteId: string; origin: ConnectOrigin } | null {
  const parts = state.split(".");
  // Three parts is a link made before the origin was added; it came from the
  // app, which is the only place Connect existed then.
  if (parts.length !== 3 && parts.length !== 4) return null;

  const signature = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return {
    websiteId: parts[0],
    origin: parts[2] === "onboarding" ? "onboarding" : "app",
  };
}

/**
 * Back to the screen Connect was pressed on.
 *
 * This used to be /websites/<id> - the Website Health page - from before the
 * Google panel moved to its own page. The customer came back from Google to a
 * screen with no Google panel, no "Google connected" message and no property
 * pickers, so a connection that had worked looked exactly like one that had
 * not. From onboarding it also dropped them out of the wizard.
 */
function back(
  target: { websiteId: string; origin: ConnectOrigin } | null,
  params: Record<string, string>,
) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const query = new URLSearchParams(params);
  let path = "/websites";
  if (target?.origin === "onboarding") {
    path = "/onboarding/google";
    query.set("site", target.websiteId);
  } else if (target) {
    path = `/websites/${target.websiteId}/google`;
  }
  return NextResponse.redirect(`${base}${path}?${query.toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const target = state ? verifyState(state) : null;

  if (!target) {
    // A tampered or missing state is not something to explain in detail.
    return back(null, { google: "invalid_request" });
  }

  if (error) {
    // The user pressed Cancel on Google's consent screen; not a failure.
    return back(target, { google: error === "access_denied" ? "cancelled" : "error" });
  }

  if (!code) {
    return back(target, { google: "error" });
  }

  const { websiteId } = target;

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
      console.error(`[google] connecting ${websiteId} failed: ${caught.message}`);
      return back(target, { google: "error" });
    }
    throw caught;
  }

  return back(target, { google: "connected" });
}
