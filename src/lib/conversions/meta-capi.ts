import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { metaPixelId } from "@/lib/meta-pixel";
import { siteUrl } from "@/lib/site-url";

import { conversionId } from "./config";

/**
 * Meta's Conversions API: the server's copy of the pixel's events, and the
 * events only the server sees (client's guide, 2026-11-18,
 * RepGet-Meta-Tracking-Developer-Guide.md, section 4).
 *
 *  - Only for a visitor who accepted the cookie banner, as the pixel: the
 *    identity is read from the request (metaRequestUser), or from the one a
 *    payer had when they started paying (lib/conversions/meta-purchases.ts).
 *  - Each event carries the id the browser gave the same event, so Meta
 *    counts it once (section 5); a server-only event (Purchase) a stable id,
 *    so a retry is never counted twice.
 *  - The email address and account id are hashed (SHA-256, trimmed and
 *    lowercased) before they leave; the IP address, browser, _fbp and _fbc
 *    go as they are, as Meta asks (section 4, "User data rules").
 *  - The token (META_CAPI_TOKEN) is server-only, never logged and never in
 *    an outbox; nothing here throws into the request that triggered it.
 */

export const META_GRAPH_VERSION = "v26.0";

/** The Conversions API access token, when the deployment has one. */
export function metaCapiToken(raw: string | undefined = process.env.META_CAPI_TOKEN): string | null {
  const token = raw?.trim();
  return token && /^[A-Za-z0-9]{20,1000}$/.test(token) ? token : null;
}

/** Events Manager's "Test events" code: set only while testing (section 6), then removed. */
export function metaTestEventCode(raw: string | undefined = process.env.META_TEST_EVENT_CODE): string | null {
  const code = raw?.trim();
  return code && /^TEST[A-Za-z0-9]{1,30}$/.test(code) ? code : null;
}

/** Whether server events can be sent at all. */
export function metaServerConfigured(): boolean {
  return Boolean(metaPixelId() && metaCapiToken());
}

/** SHA-256 of the trimmed, lowercased value, as Meta matches it. */
export function metaHash(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Who the event is about, in Meta's terms. Every field optional; nothing beyond these. */
export type MetaUser = {
  /** `_fbp`, as set by the pixel. */
  fbp?: string;
  /** `_fbc`, as set by the pixel after an ad click. */
  fbc?: string;
  ip?: string;
  userAgent?: string;
  /** metaHash(email) */
  em?: string;
  /** metaHash(user id) */
  externalId?: string;
};

export type MetaServerEvent = {
  name: "PageView" | "ViewContent" | "Lead" | "CompleteRegistration" | "InitiateCheckout" | "StartTrial" | "Purchase";
  id: string;
  time: Date;
  /** A clean address on this site: no query string, no record ids. */
  path: string;
  user: MetaUser;
  custom?: Record<string, string | number>;
};

/** `fb.<subdomain index>.<creation time>.<random>` */
export function validFbp(value: string | undefined | null): string | undefined {
  const v = value?.trim();
  return v && /^fb\.\d\.\d{10,16}\.\d{1,25}$/.test(v) ? v : undefined;
}

/** `fb.<subdomain index>.<creation time>.<fbclid>` */
export function validFbc(value: string | undefined | null): string | undefined {
  const v = value?.trim();
  return v && /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_-]{1,500}$/.test(v) ? v : undefined;
}

/** The visitor's address as Vercel passes it: the first of x-forwarded-for, else x-real-ip. */
export function requestIp(read: (name: string) => string | null): string | undefined {
  const forwarded = read("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || read("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : undefined;
}

/** The browser, as Meta needs it for a website event; bounded. */
export function requestUserAgent(read: (name: string) => string | null): string | undefined {
  const ua = read("user-agent")?.trim();
  return ua ? ua.slice(0, 512) : undefined;
}

/**
 * The visitor of this request in Meta's terms, or null unless the
 * deployment sends server events and they accepted the cookie banner.
 * `person` adds the signed-in account (hashed).
 */
export function metaRequestUser(
  cookie: (name: string) => string | undefined,
  header: (name: string) => string | null,
  person?: { id: string; email?: string | null } | null,
): MetaUser | null {
  if (!metaServerConfigured()) return null;
  if (parseConsent(`${CONSENT_COOKIE}=${cookie(CONSENT_COOKIE) ?? ""}`) !== "granted") return null;
  const user: MetaUser = {
    fbp: validFbp(cookie("_fbp")),
    fbc: validFbc(cookie("_fbc")),
    ip: requestIp(header),
    userAgent: requestUserAgent(header),
    em: person?.email ? metaHash(person.email) : undefined,
    externalId: person?.id ? metaHash(person.id) : undefined,
  };
  return withoutEmpty(user);
}

/** The same object without its empty fields; null when nothing identifies anyone. */
export function withoutEmpty(user: MetaUser): MetaUser | null {
  const kept = Object.fromEntries(Object.entries(user).filter(([, value]) => typeof value === "string" && value.length > 0)) as MetaUser;
  return kept.fbp || kept.fbc || kept.em || kept.externalId || (kept.ip && kept.userAgent) ? kept : null;
}

/** A stored identity, checked field by field (it comes back from jsonb). */
export function readMetaUser(value: unknown): MetaUser | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const text = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : undefined);
  const hash = (key: string) => (/^[0-9a-f]{64}$/.test(text(key) ?? "") ? text(key) : undefined);
  const ip = text("ip");
  return withoutEmpty({
    fbp: validFbp(text("fbp")),
    fbc: validFbc(text("fbc")),
    ip: ip && isIP(ip) ? ip : undefined,
    userAgent: text("userAgent")?.slice(0, 512),
    em: hash("em"),
    externalId: hash("externalId"),
  });
}

/** The same Lead id from the browser and the server: one per browser per day (lib/meta-pixel.ts leadEventId). */
export function leadEventId(fbp: string, day: string): string {
  return conversionId("lead", `${fbp}:${day}`);
}

/** The request body, exactly as Meta reads it (section 4). */
export function metaEventsBody(events: MetaServerEvent[], testCode: string | null = metaTestEventCode()) {
  const origin = siteUrl();
  return {
    data: events.map((event) => ({
      event_name: event.name,
      event_time: Math.floor(event.time.getTime() / 1000),
      event_id: event.id,
      action_source: "website",
      event_source_url: `${origin}${event.path}`,
      user_data: {
        ...(event.user.em ? { em: [event.user.em] } : {}),
        ...(event.user.externalId ? { external_id: [event.user.externalId] } : {}),
        ...(event.user.ip ? { client_ip_address: event.user.ip } : {}),
        ...(event.user.userAgent ? { client_user_agent: event.user.userAgent } : {}),
        ...(event.user.fbp ? { fbp: event.user.fbp } : {}),
        ...(event.user.fbc ? { fbc: event.user.fbc } : {}),
      },
      ...(event.custom ? { custom_data: event.custom } : {}),
    })),
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

type Send = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Sends the events in one request, bounded to five seconds. "skipped" when
 * the deployment has no pixel or token; "failed" (logged without the URL,
 * which carries the token) when Meta refused or did not answer. Never throws.
 */
export async function sendMetaEvents(
  events: MetaServerEvent[],
  send: Send = fetch,
  pixel: string | null = metaPixelId(),
): Promise<"sent" | "skipped" | "failed"> {
  const token = metaCapiToken();
  if (!pixel || !token || events.length === 0) return "skipped";
  try {
    const response = await send(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixel}/events?access_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(metaEventsBody(events)), signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) {
      console.error(`[meta] Conversions API refused ${events.map((e) => e.name).join(", ")} (http_${response.status})`);
      return "failed";
    }
    return "sent";
  } catch {
    console.error(`[meta] Conversions API did not answer for ${events.map((e) => e.name).join(", ")}`);
    return "failed";
  }
}
