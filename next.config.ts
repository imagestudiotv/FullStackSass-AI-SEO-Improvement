import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
