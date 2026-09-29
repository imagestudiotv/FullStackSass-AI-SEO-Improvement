import { NextResponse, type NextRequest } from "next/server";

import { exchangeHandshakeCode } from "@/lib/plugin/handshake";

/**
 * One-click connect, step 3: POST /api/plugin/connect/token
 *
 * Plugin 1.7.0's server exchanges the one-time code RepGet sent the admin's
 * browser back with, and the PKCE verifier that never left WordPress, for an
 * Integration Key (docs/wordpress-connect.md). The key's only journey: this
 * response body, server to server.
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

  const outcome = await exchangeHandshakeCode({ request: body.request, code: body.code, verifier: body.verifier });
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json(outcome, { headers: NO_STORE });
}
