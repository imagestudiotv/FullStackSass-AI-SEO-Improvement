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
 * THE CONTENT-SECURITY-POLICY IS REPORT-ONLY. Browsers report what it WOULD
 * block and block nothing, so a missed origin costs a report, not a broken
 * page. Enforce it (rename the header) only after it has run clean against
 * real traffic - the reports go to Sentry when a DSN is configured.
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
 *  - Images come from anywhere on HTTPS: audits show customers' own logos and
 *    preview images, and articles show stored and generated images.
 *  - Nothing else: payments (Stripe, PayPal) and Google sign-in are full-page
 *    redirects, and fonts are self-hosted by next/font.
 *
 * 'unsafe-inline' for scripts is the one compromise. Next.js writes inline
 * bootstrap scripts into every page; the strict alternative is a per-request
 * nonce, which makes every page dynamic and would undo the homepage caching
 * (app/(marketing)/page.tsx, revalidate). Styles need it for React style
 * attributes and Crisp's injected CSS.
 */
export function contentSecurityPolicy(sentryDsn: string | undefined): string {
  const crisp = "https://*.crisp.chat";
  const sentry = sentryOrigin(sentryDsn);
  const report = cspReportUri(sentryDsn);

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", crisp]],
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
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ...(report ? ([["report-uri", [report]]] as [string, string[]][]) : []),
  ];

  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

export function securityHeaders(options: {
  /** The CSP only in production: the dev server needs eval, which would flood the reports. */
  production: boolean;
  sentryDsn?: string;
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
      key: "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy(options.sentryDsn),
    });
  }

  return headers;
}
