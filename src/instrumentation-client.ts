import * as Sentry from "@sentry/nextjs";

/**
 * Sentry in the browser: ERRORS ONLY.
 *
 * It used to trace every page view (tracesSampleRate: 1). That installs the
 * tracing integration on every visit - wrapped fetch and XHR, performance
 * observers, a span for every navigation - and it all runs on the phone's
 * main thread before the page can respond, which is exactly what PageSpeed
 * counts as blocking time on the home page. The client asked for green
 * mobile scores, and errors are what we act on from the browser.
 *
 * Without tracesSampleRate the SDK adds no tracing integration, so
 * onRouterTransitionStart (which only starts navigation spans) is not
 * exported any more. Server and edge tracing are unchanged
 * (sentry.server.config.ts, sentry.edge.config.ts).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  debug: false,
});
