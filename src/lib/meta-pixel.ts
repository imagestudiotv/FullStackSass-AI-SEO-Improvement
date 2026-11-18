import { CAMPAIGN_PARAMS, claimConversions, cookieDomains, TAGS_WAIT_MS, type BrowserConversion } from "@/lib/google-analytics";
import { analyticsUrl } from "@/lib/site-analytics";

/**
 * The Meta (Facebook) Pixel, for the client's Facebook ads (2026-11-18):
 * page views on the public pages, and the sign-up and the start of a free
 * trial as Meta's standard events. components/consent-banner.tsx decides when
 * it runs, under the same answer as Google's tags; the banner names Meta
 * whenever the pixel is configured, and lib/consent.ts asks again anyone who
 * answered before it was.
 *
 * Stricter than Google, because the pixel cannot be told what to report:
 *
 *  - It loads only after Accept, in either consent mode. Meta has no
 *    cookieless pings to send an undecided visitor.
 *  - It reads location.href and document.referrer itself, query string and
 *    fragment included, and there is no setting to clean them. So on a page
 *    whose address (or same-site referrer) carries anything the cleaning in
 *    lib/site-analytics.ts would remove - a query parameter other than the
 *    campaign tags, a fragment, an invitation token, a record id, the admin
 *    area - nothing is sent at all (metaSafePage).
 *  - No automatic events (`autoConfig` off: Meta would otherwise report
 *    button clicks and page metadata) and no page view of its own on in-app
 *    navigation (`disablePushState`): only what this file sends.
 *  - "Automatic advanced matching" must stay OFF in Events Manager (Data
 *    sources > the pixel > Settings): it reads email addresses from forms,
 *    the sign-up form among them. docs/site-analytics.md lists it.
 *
 * Purchases happen on the server, mostly with nobody there (a trial ending),
 * so they are not sent from here; Meta's Conversions API would carry them.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** The Pixel ID (digits only), when the deployment has one. Inlined at build time. */
export function metaPixelId(raw: string | undefined = process.env.NEXT_PUBLIC_META_PIXEL_ID): string | null {
  const id = raw?.trim();
  return id && /^\d{10,20}$/.test(id) ? id : null;
}

/** Query parameters an address may carry and still reach Meta: Google's campaign tags, and Meta's own click id. */
export const META_PARAMS: readonly string[] = [...CAMPAIGN_PARAMS, "fbclid"];

/**
 * Whether this address may reach Meta exactly as it is: what
 * lib/site-analytics.ts would report for it, plus campaign tags only.
 */
export function metaSafeAddress(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  for (const name of url.searchParams.keys()) if (!META_PARAMS.includes(name)) return false;
  const cleaned = analyticsUrl(href);
  url.search = "";
  return cleaned !== null && cleaned === url.href;
}

/** The page and its referrer both safe; another site's referrer is that site's business (and usually just its origin). */
export function metaSafePage(href: string, referrer: string): boolean {
  if (!metaSafeAddress(href)) return false;
  if (!referrer) return true;
  try {
    if (new URL(referrer).origin !== new URL(href).origin) return true;
  } catch {
    return false;
  }
  return metaSafeAddress(referrer);
}

let started = false;
/** Refused on this page after the pixel had started: the next Accept grants again. */
let revoked = false;

function fbq(...args: unknown[]): void {
  window.fbq?.(...args);
}

/** What shows the visitor is there: any of these starts the download (as for Google's tags). */
const VISITOR_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * Queues the pixel's setup and downloads Meta's script: at once when `soon`
 * (the moment of Accept, a conversion), otherwise at the visitor's first
 * scroll, tap or key press, or after TAGS_WAIT_MS. Idempotent; after a
 * refusal and a later Accept, it grants consent again.
 */
export function startMetaPixel(id: string, options: { soon?: boolean } = {}): void {
  if (started) {
    if (revoked) fbq("consent", "grant");
    revoked = false;
    // A conversion while the download still waits for the visitor: now.
    if (options.soon) loadMetaScript(id);
    return;
  }
  started = true;

  // Meta's own loader, written out: calls made before the script arrives are queued and replayed.
  const queue = function fbqQueue() {
    // As in Meta's snippet: the script replays the Arguments objects themselves, and expects itself as `this`.
    // eslint-disable-next-line prefer-rest-params, prefer-spread
    if (queue.callMethod) queue.callMethod.apply(queue, arguments as unknown as unknown[]);
    // eslint-disable-next-line prefer-rest-params
    else queue.queue.push(arguments);
  } as Fbq;
  queue.push = queue;
  queue.loaded = true;
  queue.version = "2.0";
  queue.queue = [];
  queue.disablePushState = true;
  window.fbq = queue;
  window._fbq = window._fbq ?? queue;

  fbq("consent", "grant");
  fbq("set", "autoConfig", false, id);
  fbq("init", id);

  const load = () => loadMetaScript(id);
  if (options.soon) {
    load();
    return;
  }
  const begin = () => {
    window.clearTimeout(timer);
    for (const type of VISITOR_EVENTS) window.removeEventListener(type, begin);
    load();
  };
  const timer = window.setTimeout(begin, TAGS_WAIT_MS);
  for (const type of VISITOR_EVENTS) window.addEventListener(type, begin, { once: true, passive: true });
}

function loadMetaScript(id: string): void {
  if (document.querySelector("script[data-meta-pixel]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.dataset.metaPixel = id;
  document.head.appendChild(script);
}

/** The pricing page, in any language: "/pricing", "/es/pricing". */
const PRICING_PAGE = /^\/(?:[a-z]{2}\/)?pricing\/?$/;

/**
 * Counts one page view, when the page is safe to report (metaSafePage), and
 * on the pricing page ViewContent too (client's guide, section 2 row 2).
 * Returns whether it was sent.
 */
export function trackMetaPage(id: string, page: { href: string; referrer: string }, options: { soon?: boolean } = {}): boolean {
  if (!metaSafePage(page.href, page.referrer)) return false;
  startMetaPixel(id, options);
  fbq("track", "PageView");
  if (PRICING_PAGE.test(new URL(page.href).pathname)) fbq("track", "ViewContent", { content_name: "pricing" });
  return true;
}

/** A cookie's value in this document, or null. */
function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

/**
 * The same Lead id the server computes (lib/conversions/meta-capi.ts
 * leadEventId: conversionId("lead", `${fbp}:${day}`)), so the browser's and
 * the server's copies count once.
 */
async function leadEventId(fbp: string, day: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`repget:lead:${fbp}:${day}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/**
 * The free audit was asked for (client's guide, section 2 row 3): Lead, from
 * the page the form is on, for a visitor who accepted, once per browser per
 * day. The audit page sends the server's copy with the same id
 * (lib/conversions/meta-request.ts metaLeadEvent). Never throws.
 */
export async function trackMetaLead(consent: "granted" | "denied" | null, id: string | null = metaPixelId()): Promise<boolean> {
  try {
    if (consent !== "granted" || !id) return false;
    if (!metaSafePage(window.location.href, document.referrer)) return false;
    // The pixel sets _fbp on its first page view; without it, the server's copy stands alone.
    const fbp = readCookie("_fbp");
    if (!fbp) return false;
    const eventID = await leadEventId(fbp, new Date().toISOString().slice(0, 10));
    startMetaPixel(id, { soon: true });
    fbq("track", "Lead", { content_name: "free_audit" }, { eventID });
    return true;
  } catch {
    return false;
  }
}

/** After a refusal: the pixel told, and its cookies (_fbp, and _fbc from an ad click) deleted wherever they were put. */
export function forgetMetaPixel(): void {
  if (started) {
    fbq("consent", "revoke");
    revoked = true;
  }
  const domains = cookieDomains(window.location.hostname);
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${domain}`;
  }
}

/** Meta's standard event for each conversion the server reports (lib/conversions/conversions.ts). */
const META_EVENTS: Record<BrowserConversion["name"], string> = {
  sign_up: "CompleteRegistration",
  start_trial: "StartTrial",
};

const SENT_KEY = "repget_meta_conversions";

/**
 * Sends the sign-up and trial-start conversions to Meta, for a visitor who
 * accepted, from a signed-in page whose address is safe to report: on any
 * other page nothing is sent or remembered, so the next safe page in the
 * hour sends it. Each carries its conversion id as Meta's event id, which is
 * what lets a later server-side copy (Conversions API) count once.
 */
export function sendMetaConversions(
  events: BrowserConversion[],
  consent: "granted" | "denied" | null,
  id: string | null = metaPixelId(),
): string[] {
  if (consent !== "granted" || !id || events.length === 0) return [];
  if (!metaSafePage(window.location.href, document.referrer)) return [];
  const fresh = claimConversions(
    events.map((event) => event.id),
    SENT_KEY,
  );
  const due = events.filter((event) => fresh.has(event.id));
  if (due.length === 0) return [];

  startMetaPixel(id, { soon: true });
  for (const event of due) {
    fbq("track", META_EVENTS[event.name], metaParams(event), { eventID: event.id });
  }
  return due.map((event) => META_EVENTS[event.name]);
}

/** The parameters the client's guide gives each (section 2): the same on the server's copy (lib/conversions/meta-actions.ts). */
function metaParams(event: BrowserConversion): Record<string, string | number> {
  if (event.name === "sign_up") return { content_name: "signup" };
  return { value: 0, currency: "EUR", content_name: (event.params.plan ?? "trial").toLowerCase() };
}

const SERVER_SENT_KEY = "repget_meta_server_conversions";

/**
 * Which of these conversions the server should copy to Meta now
 * (lib/conversions/meta-actions.ts mirrorMetaConversions): those this browser
 * has not had copied yet, for a visitor who accepted. Not tied to the page's
 * address, because the server sends a clean one.
 */
export function claimMetaServerConversions(events: BrowserConversion[], consent: "granted" | "denied" | null, id: string | null = metaPixelId()): string[] {
  if (consent !== "granted" || !id || events.length === 0) return [];
  const fresh = claimConversions(
    events.map((event) => event.id),
    SERVER_SENT_KEY,
  );
  return events.filter((event) => fresh.has(event.id)).map((event) => event.id);
}
