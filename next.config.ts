import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

import { isPreviewDeployment, PREVIEW_ROBOTS_HEADER } from "./src/lib/deployment";
import { cspIntegrations, cspMode, securityHeaders } from "./src/lib/security-headers";
import { legacyHostRedirects } from "./src/lib/site-url";

/*
  The CSP mode, fixed for this build: enforce unless CSP_MODE=report-only (a
  temporary rollback). A typo fails the build here instead of weakening the
  policy. headers() below writes it into the build; src/proxy.ts gets the
  same value through env, so the two can never disagree.
*/
const CSP_MODE = cspMode(process.env.CSP_MODE);

const nextConfig: NextConfig = {
  env: {
    REPGET_CSP_MODE: CSP_MODE,
  },

  /*
    No "X-Powered-By: Next.js" on responses rendered per request (the live
    check of 2026-10-13 found it on the tools and the audit, not on cached
    pages). It only advertises the framework to anyone probing for one.
  */
  poweredByHeader: false,

  /*
    Search engines and link previews get a page's title, description,
    canonical and Open Graph tags in the initial HTML <head> (client,
    2026-10-08). Next already waits for the metadata, instead of streaming
    it, for the bots in its own list - repeated here - but leaves out
    Googlebot, which runs JavaScript; Googlebot is added. People still get
    streamed metadata, so the app's loading screens are not held back.
    Pinterest is added too (2026-10-09): its site check and its pins read the
    head like the other link previews do.
  */
  htmlLimitedBots:
    /Googlebot|Pinterest|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  reactCompiler: true,

  compiler: {
    /*
      Strips the Sentry SDK's debug logging from every bundle. Sentry's own
      bundleSizeOptimizations option sets this flag only for webpack builds,
      and this project builds with Turbopack, so it is set here instead.
      Safe because every Sentry.init in the app has debug: false.

      A boolean, not the string "false": Next JSON-encodes each value, so
      "false" became the string literal "false" in the bundle - truthy - and
      the debug code stayed in.
    */
    define: {
      __SENTRY_DEBUG__: false,
    },
  },

  /**
   * Pages on the pre-repget.com address go to the same path on the canonical
   * one; /api stays where it is for webhooks and older plugins. The rule and
   * its reasons live beside the address in src/lib/site-url.ts.
   */
  async redirects() {
    return legacyHostRedirects();
  },

  /**
   * Security headers on every response: HSTS, nosniff, referrer policy,
   * permissions policy, frame protection, and the CSP - enforced, allowing
   * only the integrations this build has (src/lib/security-headers.ts).
   * Dynamic routes receive the stricter nonce policy in src/proxy.ts.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders({
            production: process.env.NODE_ENV === "production",
            integrations: cspIntegrations(process.env),
            cspMode: CSP_MODE,
          }),
          /*
            Preview deployments only - never production, even with VERCEL_ENV
            missing - tell search engines to stay out, on every response
            including files and images. See src/lib/deployment.ts.
          */
          ...(isPreviewDeployment() ? [PREVIEW_ROBOTS_HEADER] : []),
        ],
      },
    ];
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  widenClientFileUpload: true,

  /**
   * Without a token (local builds, previews without the secret) skip release
   * creation and source-map upload rather than attempting them and failing.
   *
   * This only affects the build-time upload step. Runtime error capture is
   * configured separately in sentry.*.config.ts and is unaffected.
   *
   * Deliberately no `errorHandler`: upload failures already warn and continue
   * (bundler-plugin-core calls them with throwByDefault=false), while options
   * validation and buildEnd errors are meant to fail the build loudly. An
   * errorHandler would silence those too.
   */
  release: { create: Boolean(sentryAuthToken) },
  sourcemaps: { disable: !sentryAuthToken },

  /*
    The browser SDK is loaded on demand and records errors only
    (src/instrumentation-client.ts). So it has no navigations to name - the
    route manifest only groups browser transactions, and was injected into
    every page's first script - and no onRouterTransitionStart to export,
    which the build would otherwise ask for on every run.
  */
  routeManifestInjection: false,
  suppressOnRouterTransitionStartWarning: true,
});
