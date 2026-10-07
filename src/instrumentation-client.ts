import type { KeptError } from "@/lib/sentry-browser";

/**
 * Sentry in the browser: errors only, and loaded once the page is up.
 *
 * The SDK is about 75 KB compressed. Imported here directly, it was part of
 * the first script every page downloads, and PageSpeed counts every byte that
 * arrives before the first paint against the mobile LCP. On the home page it
 * was the largest piece left after the translations (2026-10-06).
 *
 * So this file only listens. An error before the SDK is here is kept (up to
 * 20) and fetches the SDK at once. Otherwise the SDK comes after the
 * visitor's first scroll, tap or key press - in the next idle moment, so its
 * start-up does not hold up the response to that tap - or 10 seconds after
 * the page has loaded, whichever is first. lib/sentry-browser.ts then starts
 * it and reports what was kept, as unhandled errors, as the SDK itself would
 * have. Errors React reports during hydration reach the window "error"
 * listener too (Next passes them to window.reportError).
 *
 * Errors only: the SDK's default browser tracing is filtered out there.
 * Server and edge tracing are unchanged (sentry.server.config.ts,
 * sentry.edge.config.ts).
 */

const MAX_KEPT = 20;
const kept: KeptError[] = [];
let starting = false;
let failures = 0;

const FIRST_INTERACTION = ["pointerdown", "keydown", "touchstart", "scroll"];

function keepError(event: ErrorEvent) {
  if (kept.length < MAX_KEPT) {
    kept.push({ value: event.error ?? event.message, kind: "onerror" });
  }
  loadSentry();
}

function keepRejection(event: PromiseRejectionEvent) {
  if (kept.length < MAX_KEPT) {
    kept.push({ value: event.reason, kind: "onunhandledrejection" });
  }
  loadSentry();
}

function loadSentry() {
  if (starting) return;
  starting = true;
  for (const type of FIRST_INTERACTION) {
    window.removeEventListener(type, loadWhenIdle, true);
  }
  import("@/lib/sentry-browser")
    .then(({ startSentry }) => {
      startSentry(kept.splice(0));
      // From here on the SDK's own handlers see every error.
      window.removeEventListener("error", keepError);
      window.removeEventListener("unhandledrejection", keepRejection);
    })
    .catch(() => {
      // A failed download (a phone going offline) must not end reporting for
      // the rest of the visit: the next error, or a timer, tries again.
      starting = false;
      if (++failures < 3) window.setTimeout(loadSentry, 30_000);
    });
}

function loadWhenIdle() {
  // Older Safari has no requestIdleCallback.
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(loadSentry, { timeout: 2000 });
  } else {
    setTimeout(loadSentry, 1);
  }
}

window.addEventListener("error", keepError);
window.addEventListener("unhandledrejection", keepRejection);
for (const type of FIRST_INTERACTION) {
  window.addEventListener(type, loadWhenIdle, {
    capture: true,
    passive: true,
    once: true,
  });
}

const loadLater = () => window.setTimeout(loadSentry, 10_000);
if (document.readyState === "complete") loadLater();
else window.addEventListener("load", loadLater, { once: true });
