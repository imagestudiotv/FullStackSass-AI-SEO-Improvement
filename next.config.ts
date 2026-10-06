import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

import { isPreviewDeployment, PREVIEW_ROBOTS_HEADER } from "./src/lib/deployment";
import { securityHeaders } from "./src/lib/security-headers";
import { legacyHostRedirects } from "./src/lib/site-url";

const nextConfig: NextConfig = {
  reactCompiler: true,

  compiler: {
    /*
      Strips the Sentry SDK's debug logging from every bundle. Sentry's own
      bundleSizeOptimizations option sets this flag only for webpack builds,
      and this project builds with Turbopack, so it is set here instead.
      Safe because every Sentry.init in the app has debug: false.
    */
    define: {
      __SENTRY_DEBUG__: "false",
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
   * permissions policy, frame protection, and a configurable CSP. Defaults
   * to report-only; CSP_MODE=enforce is the staging/production rollout switch.
   * Dynamic routes receive the stricter nonce policy in src/proxy.ts.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders({
            production: process.env.NODE_ENV === "production",
            sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            cspMode: process.env.CSP_MODE,
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
});
