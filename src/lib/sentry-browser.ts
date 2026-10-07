import { captureException, init } from "@sentry/nextjs";

/** An error that happened before the SDK was loaded, and how it surfaced. */
export type KeptError = {
  value: unknown;
  kind: "onerror" | "onunhandledrejection";
};

/**
 * Starts Sentry in the browser. Fetched on demand by
 * src/instrumentation-client.ts, so the SDK (about 75 KB compressed) is in no
 * page's first download; see that file for when it loads.
 *
 * `kept` are the errors that happened before it was here. They are reported
 * now, as the SDK's own global handlers would have reported them (unhandled,
 * so they count against crash-free sessions and match is:unhandled alerts),
 * and tagged so an issue that only appears among them can be told apart.
 */
export function startSentry(kept: KeptError[]) {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    debug: false,
    /*
      Errors only. @sentry/nextjs adds browser tracing by default - it wraps
      fetch and XHR and watches long tasks and interactions on every page -
      even with no tracesSampleRate, so none of what it measures is sent. The
      SDK only leaves it out when built with __SENTRY_TRACING__ = false, and
      that flag would switch off server and edge tracing too.

      Given up with it: the sentry-trace / baggage headers it added to our own
      requests, which linked a browser error to the server's trace of the same
      request. Server errors and traces are recorded as before.
    */
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "BrowserTracing"),
  });

  for (const { value, kind } of kept) {
    captureException(value, {
      mechanism: { handled: false, type: `auto.browser.global_handlers.${kind}` },
      captureContext: { tags: { before_sentry_loaded: "yes" } },
    });
  }
}
