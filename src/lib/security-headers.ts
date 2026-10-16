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
 * THE CSP IS ENFORCED in production builds (security review, 2026-10-12).
 * CSP_MODE=report-only is a temporary rollback switch only; any other value
 * fails the build, so a typo can never silently turn enforcement off. The
 * mode is fixed when the app is BUILT: next.config.ts writes these headers
 * into the build and hands the same mode to src/proxy.ts (env
 * REPGET_CSP_MODE), so static and dynamic pages always agree. Changing it
 * takes a new build (on Vercel, a redeploy).
 *
 * Two policies:
 *  - Dynamic pages (src/proxy.ts's matcher): the app and auth pages, and the
 *    public pages rendered per request that show stored or third-party
 *    content (blog, free tools, audit). A fresh nonce per request and
 *    'strict-dynamic' - no inline script runs without the nonce. A nonce
 *    supplied by the caller is never used. `npm run check:csp-routes` keeps
 *    prerendered pages out of that matcher.
 *  - Everything else, including the cached (prerendered/ISR) public pages:
 *    the baseline below. A cached page cannot carry a per-request nonce, and
 *    Next's inline bootstrap scripts differ per build and page, so script-src
 *    keeps 'unsafe-inline' there. That baseline is NOT a strict policy: it
 *    still limits WHERE scripts, frames and connections may come from, and
 *    blocks eval, plugins, foreign <base> and form targets and framing by
 *    other sites, but it does not stop an injected inline script. The
 *    defences against that on public pages are the rendering itself (React
 *    escaping, sanitised stored HTML - lib/html).
 * style-src keeps 'unsafe-inline' on both: React style attributes, and the
 * chat's customised colours (Crisp says so in its CSP guide).
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

/** Whether the deployment has a Tag Manager container, and so Google Ads tags. */
export function hasTagManager(raw: string | undefined = process.env.NEXT_PUBLIC_GTM_ID): boolean {
  return /^GTM-[A-Z0-9]{4,12}$/i.test(raw?.trim() ?? "");
}

/**
 * The third parties this deployment actually uses. The policy allows only
 * these: a host for an integration that is not configured is never listed.
 * All come from NEXT_PUBLIC_* variables, which are fixed at build time - the
 * same values the browser code was built with.
 */
export type CspIntegrations = {
  /** NEXT_PUBLIC_SENTRY_DSN: browser errors, and CSP violation reports. */
  sentryDsn?: string;
  /** NEXT_PUBLIC_CRISP_WEBSITE_ID: the live chat (components/live-chat.tsx). */
  crisp: boolean;
  /** NEXT_PUBLIC_GA4_MEASUREMENT_ID or NEXT_PUBLIC_GTM_ID: Google's tag (lib/google-analytics.ts). */
  googleTag: boolean;
  /** NEXT_PUBLIC_GTM_ID: the container's Google Ads tags (client, 2026-10-09). */
  ads: boolean;
};

/** Mirrors measurementId()/tagManagerId() in lib/google-analytics.ts, which loads the tags (no imports here). */
export function cspIntegrations(env: Record<string, string | undefined>): CspIntegrations {
  const ga = /^G-[A-Z0-9]{4,20}$/i.test(env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ?? "");
  const ads = hasTagManager(env.NEXT_PUBLIC_GTM_ID);
  return {
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined,
    crisp: Boolean(env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim()),
    googleTag: ga || ads,
    ads,
  };
}

/** Every integration on: for tests and for checking the widest policy. */
export const ALL_INTEGRATIONS = (sentryDsn?: string): CspIntegrations => ({ sentryDsn, crisp: true, googleTag: true, ads: true });

/**
 * The allow-list, from what the browser actually loads (audited 2026-10-03,
 * narrowed to the vendors' published lists 2026-10-12):
 *
 *  - Crisp, the live chat (components/live-chat.tsx; Crisp's "Crisp Domain
 *    Names" list): script, styles, fonts and sounds from client.crisp.chat;
 *    the messaging socket wss://client.relay.crisp.chat (and its rare
 *    fallback client.relay.rescue.crisp.chat); file uploads to
 *    storage.crisp.chat; its workers run from blob: (worker-src). Images,
 *    including its data: avatars, are covered by img-src. No frames: the
 *    wait game and helpdesk articles are not used.
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
 *    preview images, and articles show stored and generated images. (This
 *    also covers the walkthrough video's poster, from i.ytimg.com, and the
 *    pixels Google's tags send.) Images cannot run code.
 *  - The homepage walkthrough video: a frame from YouTube's privacy-enhanced
 *    host, www.youtube-nocookie.com, and only that host - the player is
 *    created after a press on play (app/(marketing)/walkthrough-player.tsx).
 *    Its own scripts run inside that frame, under YouTube's policy, so
 *    nothing else here needs widening.
 *  - Google Analytics (lib/google-analytics.ts), on public pages and only
 *    after a visitor accepts the cookie banner: gtag.js (and gtm.js) from
 *    www.googletagmanager.com, and hits to *.google-analytics.com and
 *    *.analytics.google.com - regional hosts (region1...), so Google's own
 *    CSP guide lists them with a wildcard; they are connect-src only, never
 *    script. On the nonce pages the script is inserted by the nonced bundle,
 *    which 'strict-dynamic' allows; the host stays listed for browsers
 *    without it.
 *  - Google Ads, ONLY when the deployment has a Tag Manager container
 *    (NEXT_PUBLIC_GTM_ID; client, 2026-10-09), from Google's CSP guide: the
 *    container's Ads tags load from www.googleadservices.com,
 *    googleads.g.doubleclick.net and www.google.com, send conversions to
 *    www.google.com, *.g.doubleclick.net, ad.doubleclick.net and
 *    pagead2.googlesyndication.com, and frame td.doubleclick.net and
 *    www.googletagmanager.com; GTM's preview (Tag Assistant) needs
 *    tagassistant.google.com. Without a container none of these is allowed.
 *  - Nothing else. Payments (Stripe Checkout, PayPal), Google sign-in and
 *    the Google Analytics connection are full-page navigations started by
 *    script (window.location), which CSP does not restrict; no payment or
 *    Google script runs on our pages. Fonts are self-hosted by next/font.
 *    Forms post only to this site (form-action 'self'): every form here is a
 *    server action or a same-site route.
 */
/**
 * The night mode script (lib/theme.ts THEME_SCRIPT), allowed by its hash on
 * the nonce pages. It runs inline in <head> before the first paint, where no
 * nonce can reach a static root layout. Written out rather than computed:
 * this module imports nothing (see the top). security-headers.test.ts
 * recomputes it from the script, so changing one without the other fails.
 *
 * Only on the nonce policy. The cached pages' policy keeps 'unsafe-inline',
 * and a hash there would switch 'unsafe-inline' off for every other inline
 * script on those pages.
 */
export const THEME_SCRIPT_HASH = "'sha256-nj7s1qe9iqUW2pzhF6thy8NIIuqyBMAOo+kkJ6bWvmQ='";

export function contentSecurityPolicy(integrations: CspIntegrations, nonce?: string): string {
  if (nonce !== undefined && !/^[A-Za-z0-9+/=_-]{22,128}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }
  const { crisp, googleTag, ads } = integrations;
  const crispScript = crisp ? ["https://client.crisp.chat"] : [];
  const crispConnect = crisp
    ? ["https://client.crisp.chat", "https://storage.crisp.chat", "https://client.relay.crisp.chat", "wss://client.relay.crisp.chat", "wss://client.relay.rescue.crisp.chat"]
    : [];
  const youtube = "https://www.youtube-nocookie.com";
  const tagHost = "https://www.googletagmanager.com";
  const gaScript = googleTag ? [tagHost] : [];
  const gaConnect = googleTag ? ["https://*.google-analytics.com", "https://*.analytics.google.com", tagHost] : [];
  const assistant = "https://tagassistant.google.com";
  const adsScript = ads ? ["https://www.googleadservices.com", "https://googleads.g.doubleclick.net", "https://www.google.com", assistant] : [];
  const adsConnect = ads
    ? ["https://www.google.com", "https://*.g.doubleclick.net", "https://ad.doubleclick.net", "https://pagead2.googlesyndication.com", "https://www.googleadservices.com", assistant]
    : [];
  const adsFrame = ads ? ["https://td.doubleclick.net", tagHost, assistant] : [];
  const sentry = sentryOrigin(integrations.sentryDsn);
  const report = cspReportUri(integrations.sentryDsn);

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      nonce
        ? ["'self'", `'nonce-${nonce}'`, THEME_SCRIPT_HASH, "'strict-dynamic'", ...crispScript, ...gaScript, ...adsScript]
        : ["'self'", "'unsafe-inline'", ...crispScript, ...gaScript, ...adsScript],
    ],
    ["script-src-attr", ["'none'"]],
    ["style-src", ["'self'", "'unsafe-inline'", ...crispScript]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:", ...crispScript]],
    ["connect-src", ["'self'", ...crispConnect, ...gaConnect, ...adsConnect, ...(sentry ? [sentry] : [])]],
    ["media-src", ["'self'", ...crispScript]],
    ["frame-src", ["'self'", youtube, ...adsFrame]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
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

export type CspMode = "enforce" | "report-only";

/**
 * CSP_MODE as configured: unset (or empty) means enforce. Anything other than
 * the two names is a configuration error, never a silent downgrade.
 */
export function cspMode(raw: string | undefined): CspMode {
  const mode = raw?.trim() ?? "";
  if (mode === "" || mode === "enforce") return "enforce";
  if (mode === "report-only") return "report-only";
  throw new Error('CSP_MODE must be "enforce" (the default) or "report-only"');
}

export function cspHeaderName(mode: string | undefined): string {
  return cspMode(mode) === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

export function securityHeaders(options: {
  /** The CSP only in production: the dev server needs eval, which would flood the reports. */
  production: boolean;
  integrations: CspIntegrations;
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
      value: contentSecurityPolicy(options.integrations),
    });
  }

  return headers;
}
