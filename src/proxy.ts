import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { contentSecurityPolicy, cspHeaderName, cspIntegrations, cspMode } from "./lib/security-headers";

let warned = false;

/**
 * The CSP mode this build was made with. next.config.ts inlines it
 * (env.REPGET_CSP_MODE), and wrote the same mode into the cached pages'
 * headers, so dynamic and static pages always agree. Outside a Next build
 * (tests) it is unset and CSP_MODE is read instead.
 */
export function effectiveCspMode(built: string | undefined, runtime: string | undefined): ReturnType<typeof cspMode> {
  if (!built) return cspMode(runtime);
  const mode = cspMode(built);
  if (runtime !== undefined && runtime.trim() !== "" && runtime.trim() !== mode && !warned) {
    warned = true;
    console.error(`CSP_MODE is "${runtime.trim()}" at runtime but the build used "${mode}"; the build's mode applies. Rebuild to change it.`);
  }
  return mode;
}

/**
 * Dynamic routes only: the application and auth pages, and the public pages
 * that are rendered per request anyway and show stored or third-party
 * content - blog posts (sanitised HTML), the free tools and the audit (what a
 * crawled site returned). Prerendered/ISR pages stay cacheable on the
 * baseline policy; `npm run check:csp-routes` fails the build check if any
 * page matched here is ever prerendered.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const nonce = randomBytes(24).toString("base64");
  // Written out so Next inlines each one at build, as in the browser bundles.
  const integrations = cspIntegrations({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CRISP_WEBSITE_ID: process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID,
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
  });
  const policy = contentSecurityPolicy(integrations, nonce);
  const headers = new Headers(request.headers);
  // Never trust a nonce or CSP supplied by a caller. Next reads the request
  // policy to nonce its framework scripts, including in report-only mode.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  headers.delete("Content-Security-Policy-Report-Only");
  const response = NextResponse.next({ request: { headers } });
  const mode = effectiveCspMode(process.env.REPGET_CSP_MODE, process.env.CSP_MODE);
  // One policy per response: the baseline next.config.ts adds is replaced, not doubled.
  response.headers.delete(cspHeaderName(mode === "enforce" ? "report-only" : "enforce"));
  response.headers.set(cspHeaderName(mode), policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/websites/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/setup/:path*",
    "/onboarding/:path*",
    "/sign-in",
    "/sign-up",
    "/invite/:path*",
    "/connect/:path*",
    "/blog/:path*",
    "/:locale/blog/:path*",
    "/audit",
    "/tools/ai-crawler-checker",
    "/tools/keyword-density",
    "/tools/llm-html-checker",
    "/tools/llms-txt-generator",
    "/tools/meta-description-generator",
    "/tools/meta-tag-checker",
    "/tools/robots-checker",
    "/tools/sitemap-checker",
  ],
};
