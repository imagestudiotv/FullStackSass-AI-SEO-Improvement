import { analyticsUrl } from "@/lib/site-analytics";

/**
 * Google's tags on RepGet's public pages: Google Analytics 4 (read back by
 * the admin Site analytics page, lib/admin/site-traffic.ts), and optionally
 * a Google Tag Manager container for the advertising tags (client,
 * 2026-10-09: Consent Mode v2, GTM and conversion events before any Google
 * Ads spend). components/consent-banner.tsx decides when they run.
 *
 * CONSENT MODE V2. Before anything else reaches Google, every one of its four
 * consent signals is set to "denied" (`consent default`); the visitor's
 * answer then updates all four together (`consent update`). Which visitors
 * the tags load for at all is a deployment setting, NEXT_PUBLIC_CONSENT_MODE:
 *
 *  - "basic" (the default): nothing is downloaded from Google until the
 *    visitor accepts.
 *  - "advanced": the tags also load for a visitor who has not answered yet,
 *    with every signal denied, so Google receives cookieless pings it uses
 *    to model what it cannot count. A visitor who DECLINES is silenced
 *    completely, as in basic mode: a refusal means no data.
 *
 * Then, whatever the mode:
 *
 *  - Every address is cleaned exactly as for Vercel (lib/site-analytics.ts):
 *    no fragment, no invitation code or record ID, and no query string
 *    except the campaign tags in CAMPAIGN_PARAMS (utm_*, and Google Ads'
 *    gclid & co.), which GA needs to credit a visit to an ad. GA would
 *    otherwise send location.href as it is, so page_location and
 *    page_referrer are always set by us, and pages are counted by our own
 *    page_view events (send_page_view: false).
 *  - Another site's referrer is cut to its origin.
 *  - No Google signals (cross-device data from Google accounts). Advertising
 *    storage and personalisation follow the visitor's answer.
 *  - GA's cookies live 13 months (its default is 2 years).
 *  - Off the public pages (the signed-in app, the admin area), and after a
 *    refusal, GA is silenced with Google's own opt-out flag,
 *    window["ga-disable-<ID>"], which it checks before every hit. The one
 *    exception is a conversion (sendGoogleConversions), sent from the app
 *    with a neutral title, after which GA is silenced again.
 *
 * GTM, when NEXT_PUBLIC_GTM_ID is set, is loaded IN ADDITION to GA, never
 * instead: GA keeps being sent by this file, with clean addresses, and the
 * container is for advertising tags only. A GA4 tag added inside the
 * container would count every visit twice, with raw addresses
 * (docs/site-analytics.md says so to whoever sets it up). The container sees
 * the consent signals above and our conversion events as dataLayer events
 * named like GA's (sign_up, start_trial).
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

/** The Tag Manager container (GTM-...), when the deployment has one. Inlined at build time. */
export function tagManagerId(raw: string | undefined = process.env.NEXT_PUBLIC_GTM_ID): string | null {
  const id = raw?.trim().toUpperCase();
  return id && /^GTM-[A-Z0-9]{4,12}$/.test(id) ? id : null;
}

export type ConsentMode = "basic" | "advanced";

/** "advanced" only when asked for by name; anything else is the stricter "basic". */
export function consentMode(raw: string | undefined = process.env.NEXT_PUBLIC_CONSENT_MODE): ConsentMode {
  return raw?.trim().toLowerCase() === "advanced" ? "advanced" : "basic";
}

/** The tags this deployment has. */
export type GoogleTags = { ga: string | null; gtm: string | null };

export function googleTags(): GoogleTags {
  return { ga: measurementId(), gtm: tagManagerId() };
}

/**
 * Whether Google's tags may run for a visitor: after Accept always; before
 * an answer only in advanced mode; after Decline never.
 */
export function tagsAllowed(consent: "granted" | "denied" | null, mode: ConsentMode): boolean {
  return consent === "granted" || (consent === null && mode === "advanced");
}

/** 13 months, in seconds. */
export const GA_COOKIE_MAX_AGE = 395 * 24 * 60 * 60;

/** Consent Mode v2's four signals, all following the one answer. */
export function consentSignals(granted: boolean): Record<string, "granted" | "denied"> {
  const value = granted ? "granted" : "denied";
  return { analytics_storage: value, ad_storage: value, ad_user_data: value, ad_personalization: value };
}

/**
 * Query parameters kept in a reported address: campaign tags, which say
 * which ad or link brought the visitor and nothing about them. Everything
 * else in a query string is dropped (lib/site-analytics.ts says why an
 * allow-list and not a deny-list).
 */
export const CAMPAIGN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "gad_campaignid",
  "dclid",
] as const;

/** The cleaned address plus any campaign tags the raw one carried, or null for a page never counted. */
export function reportedAddress(href: string): string | null {
  const cleaned = analyticsUrl(href);
  if (cleaned === null) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return cleaned;
  }
  const kept = new URLSearchParams();
  for (const name of CAMPAIGN_PARAMS) {
    const value = url.searchParams.get(name);
    if (value) kept.set(name, value.slice(0, 200));
  }
  const query = kept.toString();
  return query ? `${cleaned}?${query}` : cleaned;
}

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

/** Google Ads' own cookies (_gcl_au, _gcl_aw, ...), found by prefix in a `document.cookie` string. */
export function adsCookieNames(cookies: string): string[] {
  return cookies
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter((name) => name.startsWith("_gcl_"));
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

let started = false;

function gtag(...args: unknown[]): void {
  window.gtag?.(...args);
}

/**
 * Queues the tags' setup and downloads their scripts. Idempotent. Consent
 * comes first, denied, before anything that could reach Google, then the
 * visitor's answer when it is Accept. `soon` is for the moment the visitor
 * accepts (and for a conversion); otherwise the download waits until the
 * page has loaded and the browser is idle, so it never competes with it.
 */
export function startGoogleTags(tags: GoogleTags, options: { granted: boolean; soon?: boolean }): void {
  if (!tags.ga && !tags.gtm) return;
  if (started) {
    setGoogleConsent(options.granted);
    return;
  }
  started = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtagQueue() {
    // Google reads the Arguments object itself, not an array copy of it.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  gtag("consent", "default", consentSignals(false));
  if (options.granted) gtag("consent", "update", consentSignals(true));
  gtag("js", new Date());
  if (tags.ga) {
    gtag("config", tags.ga, {
      send_page_view: false,
      allow_google_signals: false,
      cookie_expires: GA_COOKIE_MAX_AGE,
    });
  }
  if (tags.gtm) window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const load = () => {
    if (tags.ga) addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tags.ga)}`, tags.ga);
    if (tags.gtm) addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(tags.gtm)}`, tags.gtm);
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

function addScript(src: string, id: string): void {
  if (document.querySelector(`script[data-ga="${id}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.dataset.ga = id;
  document.head.appendChild(script);
}

/** Tells the tags the visitor's answer: all four signals at once. */
export function setGoogleConsent(granted: boolean): void {
  gtag("consent", "update", consentSignals(granted));
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
  const location = reportedAddress(page.href);
  pauseGoogleAnalytics(id, location === null);
  if (location === null) return null;
  gtag("set", { page_location: location, page_referrer: page.referrer, page_title: page.title });
  gtag("event", "page_view");
  return location.split("?")[0];
}

/** After a refusal: the tags told, GA silenced, and GA's and Ads' cookies deleted, wherever they were put. */
export function forgetGoogleAnalytics(id: string | null): void {
  setGoogleConsent(false);
  if (id) pauseGoogleAnalytics(id, true);
  const domains = cookieDomains(window.location.hostname);
  let existing = "";
  try {
    existing = document.cookie ?? "";
  } catch {
    // Cookies blocked: there is nothing to delete.
  }
  const names = [...(id ? gaCookieNames(id) : []), ...adsCookieNames(existing)];
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${domain}`;
  }
}

/** One conversion the server says happened (lib/analytics/conversions.ts). */
export type BrowserConversion = {
  /** Opaque and stable: what makes it count once, in this browser and in Google Ads. */
  id: string;
  name: "sign_up" | "start_trial";
  params: Record<string, string>;
};

const SENT_KEY = "repget_conversions";
const SENT_KEEP = 20;

/**
 * The conversions not sent from this browser yet, recorded as sent. Empty
 * when the browser cannot remember (storage blocked): better one missed than
 * the same one counted on every page load.
 */
function claimConversions(ids: string[]): Set<string> {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const sent: string[] = raw ? (JSON.parse(raw) as unknown[]).filter((v): v is string => typeof v === "string") : [];
    const fresh = ids.filter((id) => !sent.includes(id));
    if (fresh.length === 0) return new Set();
    window.localStorage.setItem(SENT_KEY, JSON.stringify([...sent, ...fresh].slice(-SENT_KEEP)));
    return new Set(fresh);
  } catch {
    return new Set();
  }
}

/**
 * Sends conversions from a signed-in page (the sign-up, the start of the
 * free articles), for a visitor who ACCEPTED: an undecided or refusing one
 * sends nothing, in either mode, and nothing is stored about them.
 *
 * Signed-in page titles name customers' articles, so GA is told a neutral
 * title and the cleaned address before the events, and silenced again once
 * they are sent (or after 10 seconds, if Google never answers). The
 * container, when there is one, gets the same events in the dataLayer for
 * its advertising tags, with the id as the transaction id that stops Google
 * Ads counting one twice.
 */
export function sendGoogleConversions(
  events: BrowserConversion[],
  consent: "granted" | "denied" | null,
  tags: GoogleTags = googleTags(),
): string[] {
  if (consent !== "granted" || (!tags.ga && !tags.gtm) || events.length === 0) return [];
  const fresh = claimConversions(events.map((event) => event.id));
  const due = events.filter((event) => fresh.has(event.id));
  if (due.length === 0) return [];

  startGoogleTags(tags, { granted: true, soon: true });
  if (tags.ga) {
    const ga = tags.ga;
    pauseGoogleAnalytics(ga, false);
    gtag("set", {
      page_location: analyticsUrl(window.location.href) ?? `${window.location.origin}/`,
      page_referrer: "",
      page_title: "RepGet",
    });
    let waiting = due.length;
    const silence = () => pauseGoogleAnalytics(ga, true);
    const fallback = window.setTimeout(silence, 10_000);
    for (const event of due) {
      gtag("event", event.name, {
        ...event.params,
        event_callback: () => {
          waiting -= 1;
          if (waiting === 0) {
            window.clearTimeout(fallback);
            silence();
          }
        },
      });
    }
  }
  if (tags.gtm) {
    for (const event of due) window.dataLayer!.push({ event: event.name, ...event.params, transaction_id: event.id });
  }
  return due.map((event) => event.name);
}
