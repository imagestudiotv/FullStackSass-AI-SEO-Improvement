import { NextResponse, type NextRequest } from "next/server";

import { startHandshake } from "@/lib/plugin/handshake";

/**
 * One-click connect, step 1: POST /api/plugin/connect/start
 *
 * Called by plugin 1.7.0's server when an admin presses "Connect to RepGet"
 * (docs/wordpress-connect.md). Registers the site's address, where to come
 * back to, its state and PKCE challenge, and answers with the RepGet page
 * the admin's browser goes to. Nothing here grants anything.
 *
 * No CORS headers: only servers call this, never a browser.
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Expected a JSON body." }, { status: 400, headers: NO_STORE });
  }

  const outcome = await startHandshake(
    {
      siteUrl: body.siteUrl,
      returnUrl: body.returnUrl,
      state: body.state,
      challenge: body.challenge,
      pluginVersion: body.pluginVersion,
      link: body.link,
    },
    // The key this site holds now, if any: recorded so moving the site to
    // another account can retire it later. A bad one is ignored - answering
    // 401 would make the plugin say its key was rejected.
    request.headers.get("x-integration-key"),
    // The WordPress server that called: open requests are limited per caller.
    // Set by the platform (Vercel), not by the caller.
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  );
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status, headers: NO_STORE });
  }
  /*
    On the address the plugin called - which is its repget_endpoint(), the
    only prefix it accepts for this page - rather than NEXT_PUBLIC_APP_URL:
    a custom domain there, or a staging plugin pointed at staging, would
    otherwise make every connect fail with "an unexpected address".
  */
  const authorizeUrl = `${request.nextUrl.origin}/connect/wordpress?request=${encodeURIComponent(outcome.id)}`;
  return NextResponse.json({ ok: true, authorizeUrl }, { headers: NO_STORE });
}
