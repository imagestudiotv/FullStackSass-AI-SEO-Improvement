/**
 * Security headers for every response, applied by next.config.ts (client's
 * launch review, 2026-10-03: "Implement/test CSP, HSTS and remaining security
 * headers"). The site sent none.
 *
 * NO IMPORTS, deliberately: next.config.ts loads this module directly, before
 * the app's path aliases exist. Keep it that way.
 *
 * WHAT IS LEFT OUT, AND WHY - each is a decision with consequences that are
 * hard to undo, so it belongs to the owner rather than to a default:
 *
 *  - HSTS `includeSubDomains` / `preload`: preload lists are slow to leave, and
 *    includeSubDomains forces HTTPS on every subdomain, including any that do
 *    not have it yet.
 *  - Cross-Origin-Opener/Embedder-Policy: can break OAuth and payment pop-ups.
 *
 * CSP_MODE=enforce enables blocking for a verified staging/production build.
 * Default report-only preserves the staged rollout. src/proxy.ts replaces
 * the baseline with a per-request nonce policy on dynamic private/auth pages;
 * cached public pages retain the baseline without becoming dynamic.
 */

export type Header = { key: string; value: string };

/**
 * Where violation reports go: Sentry's security endpoint for the project in
 * the DSN, or nowhere (the browser console only) without one.
 *
 * DSN: https://<publicKey>@<host>/<projectId>. The public key is not a secret -
 * it ships in the browser bundle as NEXT_PUBLIC_SENTRY_DSN already.
 */
export function cspReportUri(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!url.username || !projectId) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}

/** The Sentry ingest origin the browser SDK posts errors to, if configured. */
function sentryOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * The allow-list, from what the browser actually loads (audited 2026-10-03):
 *
 *  - Crisp, the live chat (components/live-chat.tsx): its script, styles,
 *    fonts, images, sounds and frames come from *.crisp.chat, and it talks
 *    over wss://*.relay.crisp.chat.
 *  - Sentry's browser SDK posts errors to the DSN's host.
 *  - Vercel Web Analytics (components/site-analytics.tsx) needs NO entry,
 *    deliberately. On Vercel its script is /_vercel/insights/script.js and
 *    it posts to /_vercel/insights/{view,event,session}: same origin, so
 *    script-src and connect-src 'self' already cover both. On the nonce
 *    pages, where 'strict-dynamic' sets 'self' aside, the script still runs
 *    because the (nonced) app bundle inserts it - exactly the case
 *    strict-dynamic exists for. Its other host, va.vercel-scripts.com, is
 *    used only by `next dev`, which gets no CSP; allowing it here would only
 *    widen the production policy.
 *  - Images come from anywhere on HTTPS: audits show customers' own logos and
 *    preview images, and articles show stored and generated images.
 *  - Nothing else: payments (Stripe, PayPal) and Google sign-in are full-page
 *    redirects, and fonts are self-hosted by next/font.
 *
 * Cached public pages retain inline bootstrap scripts. Already-dynamic app
 * and auth pages use a fresh nonce through proxy.ts and disallow arbitrary
 * inline scripts. Styles still need unsafe-inline for React and Crisp CSS.
 */
export function contentSecurityPolicy(sentryDsn: string | undefined, nonce?: string): string {
  if (nonce !== undefined && !/^[A-Za-z0-9+/=_-]{22,128}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }
  const crisp = "https://*.crisp.chat";
  const sentry = sentryOrigin(sentryDsn);
  const report = cspReportUri(sentryDsn);

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", nonce ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", crisp] : ["'self'", "'unsafe-inline'", crisp]],
    ["script-src-attr", ["'none'"]],
    ["style-src", ["'self'", "'unsafe-inline'", crisp]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:", crisp]],
    ["connect-src", ["'self'", crisp, "wss://*.relay.crisp.chat", ...(sentry ? [sentry] : [])]],
    ["media-src", ["'self'", crisp]],
    ["frame-src", ["'self'", crisp]],
    ["worker-src", ["'self'", "blob:"]],
    // Nobody else may frame RepGet (click-jacking); X-Frame-Options below
    // says the same to browsers that predate CSP.
    ["frame-ancestors", ["'self'"]],
    ["form-action", ["'self'"]],
    ["base-uri", ["'none'"]],
    ["object-src", ["'none'"]],
    ...(report ? ([["report-uri", [report]]] as [string, string[]][]) : []),
  ];

  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

/** Invalid deployment configuration must not silently disable enforcement. */
export function cspHeaderName(mode: string | undefined): string {
  if (!mode || mode === "report-only") return "Content-Security-Policy-Report-Only";
  if (mode === "enforce") return "Content-Security-Policy";
  throw new Error("CSP_MODE must be report-only or enforce");
}

export function securityHeaders(options: {
  /** The CSP only in production: the dev server needs eval, which would flood the reports. */
  production: boolean;
  sentryDsn?: string;
  cspMode?: string;
}): Header[] {
  const headers: Header[] = [
    // Two years of HTTPS-only. See the note above on includeSubDomains/preload.
    { key: "Strict-Transport-Security", value: "max-age=63072000" },
    // Never guess a file's type from its content.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Other sites see our origin, never a full address with its path/query.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // No page here needs these; refusing them limits what injected code could do.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    // Click-jacking: only RepGet may frame RepGet. Nothing frames it today -
    // the WordPress plugin connects with a full-page redirect.
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ];

  if (options.production) {
    headers.push({
      key: cspHeaderName(options.cspMode),
      value: contentSecurityPolicy(options.sentryDsn),
    });
  }

  return headers;
}
