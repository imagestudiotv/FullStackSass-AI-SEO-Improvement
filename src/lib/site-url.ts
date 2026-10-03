/**
 * The canonical public address of this deployment.
 *
 * WHY THIS IS CENTRAL: the same fallback was written out in five places —
 * layout.tsx, robots.ts, sitemap.ts, the marketing page and the settings page
 * — and every one of them read `https://seovision.io`, which is a live,
 * unrelated company's website rather than a domain we own.
 *
 * That was not cosmetic. robots.ts and sitemap.ts hand this value to search
 * engines as the site's own address, layout.tsx makes it the metadataBase
 * behind every canonical and Open Graph URL, and the marketing page embeds it
 * in JSON-LD. Whenever NEXT_PUBLIC_APP_URL was unset — a preview build, a
 * misconfigured environment — the app published a competitor's domain as its
 * own identity.
 *
 * One copy means the next correction is one edit. Five copies is how the
 * wrong value survived in four of them after the fifth was noticed.
 */

/**
 * The fallback, used only when NEXT_PUBLIC_APP_URL is unset or local.
 *
 * The brand domain now that it answers (repget.com redirects to www). It was
 * the Vercel deployment's own address until DNS pointed here; that address
 * still serves the app - see LEGACY_HOSTS.
 */
const FALLBACK = "https://www.repget.com";

/**
 * The production address from before repget.com: the deployment still
 * answers on it, and WordPress plugin 1.7.0 calls it (its built-in default),
 * as do the payment providers' webhooks. API calls there are fine; a PERSON
 * sent there is not - their RepGet sign-in lives on the brand domain, so they
 * were asked to sign in again on an address they did not recognise (client,
 * 2026-10-01). Pages a browser is sent to redirect away (legacyRedirect).
 */
const LEGACY_HOSTS = new Set(["full-stack-sass-ai-seo-improvement.vercel.app"]);

/**
 * No trailing slash, so callers can concatenate a path without doubling it.
 *
 * A localhost value is rejected rather than returned: these URLs end up in
 * sitemaps, structured data and links a customer may share, and a developer
 * machine's address is useless in all three.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return configured && !configured.includes("localhost") ? configured : FALLBACK;
}

/**
 * Where to send a browser that asked for `path` on `host`: the same path on
 * the canonical address when `host` is the pre-repget.com one, else null.
 * Only that exact host - a preview deployment or a staging domain is left
 * alone, so it keeps working against its own database.
 */
export type HostRedirect = {
  source: string;
  has: { type: "host"; value: string }[];
  destination: string;
  permanent: boolean;
};

/**
 * next.config redirects that move every PAGE on the pre-repget.com address to
 * the same path on the canonical one (client's launch review, 2026-10-03:
 * "every host/protocol redirects to https://www.repget.com/").
 *
 * The old address still served the whole site, so search engines could index
 * it as a second copy, and a customer could sign in there under a domain they
 * did not recognise. legacyRedirect (below) only covered /connect/wordpress.
 *
 * /api IS LEFT ALONE. Machines still call the old address and must keep
 * reaching it: Stripe and PayPal webhooks, Inngest, Google's OAuth callback,
 * Better Auth, and WordPress plugins before 1.7.1 for every /api/plugin/*
 * call. Pages a browser opens - including the plugin's /connect/wordpress
 * and its /repget-connector.json update check, which WordPress follows across
 * a redirect - are redirected. Query strings are carried over by Next.
 *
 * Permanent (308), which also keeps the request method. Never a redirect to
 * the host itself, whatever NEXT_PUBLIC_APP_URL says.
 */
export function legacyHostRedirects(): HostRedirect[] {
  const target = siteUrl();
  const targetHost = new URL(target).hostname;
  return [...LEGACY_HOSTS]
    .filter((host) => host !== targetHost)
    .map((host) => ({
      // Everything except /api and /api/...: the lookahead keeps both out.
      source: "/:path((?!api(?:/|$)).*)",
      // A has-value is a regular expression; the dots must be literal.
      has: [{ type: "host", value: host.replace(/\./g, "\\.") }],
      destination: `${target}/:path`,
      permanent: true,
    }));
}

export function legacyRedirect(host: string | null | undefined, path: string): string | null {
  const name = host?.trim().toLowerCase().replace(/:\d+$/, "");
  if (!name || !LEGACY_HOSTS.has(name)) return null;
  const target = siteUrl();
  // Never a redirect to itself, whatever NEXT_PUBLIC_APP_URL says.
  if (new URL(target).hostname === name) return null;
  return `${target}${path.startsWith("/") ? path : `/${path}`}`;
}
