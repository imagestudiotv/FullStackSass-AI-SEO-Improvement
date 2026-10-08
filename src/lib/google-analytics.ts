import { analyticsUrl } from "@/lib/site-analytics";

/**
 * Google Analytics 4 on RepGet's public pages, for the admin Site analytics
 * page (lib/admin/site-traffic.ts reads it back).
 *
 * Unlike Vercel Web Analytics (components/site-analytics.tsx), GA sets
 * cookies, so NOTHING here runs until the visitor accepts the banner
 * (components/consent-banner.tsx): Google's script is not even downloaded
 * before that. Then:
 *
 *  - Every address is cleaned exactly as for Vercel (lib/site-analytics.ts):
 *    no query string, no fragment, no invitation code or record ID. GA would
 *    otherwise send location.href as it is, so page_location and
 *    page_referrer are always set by us, and pages are counted by our own
 *    page_view events (send_page_view: false).
 *  - Another site's referrer is cut to its origin: enough for "where did
 *    they come from", and nothing of that site's address beyond it.
 *  - Advertising is off: no Google signals, no ad personalisation, ads
 *    consent denied. RepGet runs no ads; analytics is the only purpose.
 *  - GA's cookies live 13 months (its default is 2 years).
 *  - Off the public pages (the signed-in app, the admin area), and after a
 *    refusal, GA is silenced with Google's own opt-out flag,
 *    window["ga-disable-<ID>"], which it checks before every hit.
 *
 * ONE SETTING MUST BE OFF IN GOOGLE ANALYTICS ITSELF: Admin > Data streams >
 * the web stream > Enhanced measurement > Page views > "Page changes based
 * on browser history events". Left on, GA sends its own page_view with the
 * raw address (query string included) on every in-app navigation, and code
 * cannot switch it off. docs/site-analytics.md lists it with the rest.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** The Measurement ID (G-...), when the deployment has a real one. Inlined at build time. */
export function measurementId(raw: string | undefined = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID): string | null {
  const id = raw?.trim().toUpperCase();
  return id && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** 13 months, in seconds. */
export const GA_COOKIE_MAX_AGE = 395 * 24 * 60 * 60;

/**
 * The referrer to report: a page of ours cleaned like any other (or nothing,
 * for a page that is never counted), another site by its origin alone.
 */
export function cleanReferrer(referrer: string, origin: string): string {
  if (!referrer) return "";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  if (url.origin === origin) return analyticsUrl(url.href) ?? "";
  return `${url.origin}/`;
}

/** The cookies GA sets for a measurement ID: _ga, and _ga_<ID without "G-">. */
export function gaCookieNames(id: string): string[] {
  return ["_ga", `_ga_${id.replace(/^G-/, "")}`];
}

/**
 * Every Domain a cookie for this host can sit on: GA's "auto" setting puts
 * them on the widest one it can (".repget.com" from www.repget.com).
 */
export function cookieDomains(hostname: string): string[] {
  const parts = hostname.split(".");
  if (parts.length < 2 || /^[\d.]+$/.test(hostname)) return [];
  return parts.slice(0, -1).map((_, i) => parts.slice(i).join("."));
}

let started: string | null = null;

function gtag(...args: unknown[]): void {
  window.gtag?.(...args);
}

/**
 * Queues GA's setup and downloads its script. Idempotent. `soon` is for the
 * moment the visitor accepts; otherwise the download waits until the page
 * has loaded and the browser is idle, so it never competes with the page.
 */
export function startGoogleAnalytics(id: string, options: { soon?: boolean } = {}): void {
  if (started === id) return;
  started = id;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtagQueue() {
    // GA reads the Arguments object itself, not an array copy of it.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("js", new Date());
  gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: GA_COOKIE_MAX_AGE,
  });

  const load = () => {
    if (document.querySelector(`script[data-ga="${id}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    script.dataset.ga = id;
    document.head.appendChild(script);
  };
  if (options.soon) {
    load();
    return;
  }
  // Older Safari has no requestIdleCallback.
  const idle = () =>
    typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(load, { timeout: 4000 }) : window.setTimeout(load, 1500);
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

/** Silences GA (or lets it speak again) without unloading it. */
export function pauseGoogleAnalytics(id: string, paused: boolean): void {
  (window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = paused;
}

/**
 * Counts one page view, and returns the cleaned address it reported. Null
 * for a page that is never counted (lib/site-analytics.ts): GA then stays
 * silent until the next page that is.
 */
export function trackGooglePage(id: string, page: { href: string; referrer: string; title: string }): string | null {
  const location = analyticsUrl(page.href);
  pauseGoogleAnalytics(id, location === null);
  if (location === null) return null;
  gtag("set", { page_location: location, page_referrer: page.referrer, page_title: page.title });
  gtag("event", "page_view");
  return location;
}

/** After a refusal: GA silenced and its cookies deleted, wherever it put them. */
export function forgetGoogleAnalytics(id: string): void {
  pauseGoogleAnalytics(id, true);
  const domains = cookieDomains(window.location.hostname);
  for (const name of gaCookieNames(id)) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${domain}`;
  }
}
