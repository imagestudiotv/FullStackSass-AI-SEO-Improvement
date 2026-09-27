import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-guard";
import { saveTokens } from "@/lib/analytics/connection";
import { exchangeCode, GoogleAuthError } from "@/lib/analytics/google-oauth";
import {
  consumeOAuthState,
  type ConnectOrigin,
} from "@/lib/analytics/oauth-state";
import { requireEditor } from "@/lib/websites/require-editor";
import { WebsiteNotFoundError } from "@/lib/tenant";

/**
 * Google OAuth callback.
 *
 * WHAT CHANGED AND WHY. The state used to be an HMAC over
 * "<websiteId>.<nonce>.<origin>" with a Math.random() nonce, no expiry and no
 * record of use, and the handler then called requireWebsite - READ access -
 * before storing tokens. So:
 *
 *   - a captured callback URL could be replayed for ever;
 *   - anybody holding it could complete a connection someone else started;
 *   - somebody downgraded from editor to viewer while on Google's consent
 *     screen could still attach a Google account to that website.
 *
 * Now the state is a random single-use row (lib/analytics/oauth-state.ts) bound
 * to the initiating user, session and website, and CURRENT editor access is
 * re-checked before any token is written.
 *
 * ORDER MATTERS HERE. State is consumed first, then permissions are checked,
 * then the code is exchanged. Consuming first means a replay is refused before
 * it can reach Google; checking permissions before the exchange means a
 * demoted user never causes a token to be minted at all.
 */

export const dynamic = "force-dynamic";

/**
 * Back to the screen Connect was pressed on.
 *
 * `origin` selects one of two fixed paths and is never a URL, so this cannot
 * become an open redirect however the callback is called. It is read from the
 * consumed state row rather than from the query string, so it cannot be
 * swapped on the way through Google either.
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

  /**
   * A session is required before the state is even looked at: the state is
   * bound to the session that created it, so an unauthenticated callback can
   * never match one. Nothing is consumed on this path.
   */
  const session = await getSession();
  if (!session) {
    return back(null, { google: "invalid_request" });
  }

  if (!state) {
    return back(null, { google: "invalid_request" });
  }

  /**
   * CANCELLED IS HANDLED BEFORE CONSUMING.
   *
   * Google sends error=access_denied when the customer presses Cancel. Burning
   * the state there would mean a customer who cancels and immediately presses
   * Connect again is fine (a new state is issued), but a customer who cancels
   * and uses the back button is not. The state is left to expire on its own
   * instead, and the error is reported without redeeming anything.
   *
   * The website id is not known at this point - it lives in the unconsumed row
   * - so this returns to the generic websites list rather than disclosing which
   * site a state refers to before proving who is asking.
   */
  if (error) {
    return back(null, {
      google: error === "access_denied" ? "cancelled" : "error",
    });
  }

  if (!code) {
    return back(null, { google: "error" });
  }

  /**
   * Single-use redemption, bound to this user and session. Unknown, expired,
   * already-used and someone-else's states are all refused identically - see
   * consumeOAuthState for why they are not distinguished.
   */
  const consumed = await consumeOAuthState({
    state,
    provider: "google",
    userId: session.user.id,
    sessionId: session.session.id,
  });

  if (!consumed.ok) {
    return back(null, { google: "invalid_request" });
  }

  const { websiteId, origin, codeVerifier } = consumed.state;
  const target = { websiteId, origin };

  /**
   * CURRENT permission, not the permission held when Connect was pressed.
   *
   * requireEditor, not requireWebsite: storing a Google token is a write, and
   * a viewer must not be able to complete one. Someone downgraded from editor
   * to viewer while on the consent screen is refused here - which is the
   * window the old code left open.
   */
  try {
    const guard = await requireEditor(websiteId);
    if (!guard.ok) {
      return back(target, { google: "forbidden" });
    }
  } catch (caught) {
    /*
      The website was deleted, or this person is no longer in the workspace that
      owns it. Reported without the website id, since the target may no longer
      be theirs to know about.
    */
    if (caught instanceof WebsiteNotFoundError) {
      return back(null, { google: "forbidden" });
    }
    throw caught;
  }

  try {
    /*
      The verifier proves this exchange belongs to the authorization this server
      started. It never went through the browser.
    */
    const tokens = await exchangeCode(code, codeVerifier);
    await saveTokens(websiteId, tokens);
  } catch (caught) {
    if (caught instanceof GoogleAuthError) {
      // The message, never the code or any token.
      console.error(`[google] connecting ${websiteId} failed: ${caught.message}`);
      return back(target, { google: "error" });
    }
    throw caught;
  }

  return back(target, { google: "connected" });
}
