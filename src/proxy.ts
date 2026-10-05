import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { contentSecurityPolicy, cspHeaderName } from "./lib/security-headers";

/** Only dynamic application/auth routes. Public ISR pages stay cacheable. */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const nonce = randomBytes(24).toString("base64");
  const policy = contentSecurityPolicy(process.env.NEXT_PUBLIC_SENTRY_DSN, nonce);
  const headers = new Headers(request.headers);
  // Never trust a nonce or CSP supplied by a caller. Next reads the request
  // policy to nonce its framework scripts, including in report-only mode.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  headers.delete("Content-Security-Policy-Report-Only");
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(cspHeaderName(process.env.CSP_MODE), policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/websites/:path*", "/dashboard/:path*", "/settings/:path*", "/billing/:path*", "/setup/:path*", "/onboarding/:path*", "/sign-in", "/sign-up", "/invite/:path*", "/connect/:path*"],
};
