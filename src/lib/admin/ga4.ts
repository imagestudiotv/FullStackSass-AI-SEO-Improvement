import "server-only";

import { createPrivateKey, createSign } from "node:crypto";

/**
 * Google Analytics 4 for RepGet's OWN website, read by the admin Site
 * analytics page (app/admin/analytics).
 *
 * Not the customers' Google connection (lib/analytics/*). That one is OAuth
 * per website, consented to by each customer, with tokens stored encrypted in
 * the database. This one reads a single property the owner controls, as a
 * Google Cloud SERVICE ACCOUNT that the owner adds as a Viewer on that
 * property. That suits a server reading one fixed property: no consent
 * screen, no refresh token that a password change or six idle months can
 * revoke, and nothing in the database - the key lives in the deployment's
 * environment beside every other secret.
 *
 * Configuration (server-only - never NEXT_PUBLIC_):
 *  - GA4_PROPERTY_ID: the property's number, from GA Admin > Property
 *    details ("123456789"; "properties/123456789" is accepted too). NOT the
 *    Measurement ID (G-...), which identifies the tag, not the property.
 *  - GA4_SERVICE_ACCOUNT_KEY: the service account's JSON key exactly as
 *    Google downloads it, or that file base64-encoded.
 *
 * Read-only: the token is asked for analytics.readonly and nothing else.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

/** An admin page waits on this, so it gives up well before a serverless timeout. */
const TIMEOUT_MS = 15_000;

/** batchRunReports takes at most five reports per call. */
const BATCH_LIMIT = 5;

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export const PROPERTY_VAR = "GA4_PROPERTY_ID";
export const KEY_VAR = "GA4_SERVICE_ACCOUNT_KEY";

export type Ga4Config = {
  /** Digits only, e.g. "123456789". */
  propertyId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * What the environment holds. `propertyId` and `clientEmail` are reported
 * whenever they could be read, even when something else is wrong, so the
 * setup screen can name the property and the address to grant access to.
 * The private key itself is never part of any result.
 */
export type Ga4Setup =
  | { state: "ready"; config: Ga4Config }
  | { state: "missing"; missing: string[]; propertyId: string | null; clientEmail: string | null }
  | { state: "invalid"; variable: string; reason: string; propertyId: string | null; clientEmail: string | null };

function parseProperty(raw: string | undefined): { value: string | null; error: string | null } {
  const value = raw?.trim() ?? "";
  if (!value) return { value: null, error: null };
  if (/^G-/i.test(value)) {
    return {
      value: null,
      error:
        "This is a Measurement ID (G-...), which identifies the tag. The admin page needs the property's number: GA Admin > Property settings > Property details > Property ID.",
    };
  }
  const digits = value.replace(/^properties\//i, "");
  if (!/^\d{4,20}$/.test(digits)) {
    return { value: null, error: "Expected the property's number, e.g. 123456789 (GA Admin > Property details)." };
  }
  return { value: digits, error: null };
}

type KeyFile = { type?: unknown; client_email?: unknown; private_key?: unknown };

function parseKey(raw: string | undefined): {
  key: { clientEmail: string; privateKey: string } | null;
  clientEmail: string | null;
  error: string | null;
} {
  const value = raw?.trim() ?? "";
  if (!value) return { key: null, clientEmail: null, error: null };

  // Pasted as the file, or as the file in base64 (some dashboards mangle newlines).
  let file: KeyFile;
  try {
    const json = value.startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8");
    file = JSON.parse(json) as KeyFile;
  } catch {
    return {
      key: null,
      clientEmail: null,
      error: "Not a JSON key. Paste the whole downloaded .json file (or the file base64-encoded).",
    };
  }
  if (!file || typeof file !== "object") {
    return { key: null, clientEmail: null, error: "Not a JSON key." };
  }

  const clientEmail = typeof file.client_email === "string" && file.client_email.includes("@") ? file.client_email : null;
  if (file.type !== undefined && file.type !== "service_account") {
    return {
      key: null,
      clientEmail,
      error: `This JSON is a "${String(file.type)}" credential. Create a key for a service account (IAM & Admin > Service accounts > Keys).`,
    };
  }
  if (!clientEmail) {
    return { key: null, clientEmail: null, error: "The key has no client_email. Download a new JSON key for the service account." };
  }
  if (typeof file.private_key !== "string" || !file.private_key.includes("PRIVATE KEY")) {
    return { key: null, clientEmail, error: "The key has no private_key. Download a new JSON key for the service account." };
  }

  // A key copied through a shell or a .env file can arrive with its line
  // breaks escaped twice ("\\n"); PEM needs real ones.
  const privateKey = file.private_key.replace(/\\n/g, "\n");
  try {
    createPrivateKey(privateKey);
  } catch {
    return { key: null, clientEmail, error: "The private_key in the JSON is damaged. Download a new JSON key." };
  }
  return { key: { clientEmail, privateKey }, clientEmail, error: null };
}

export function readGa4Setup(env: Record<string, string | undefined> = process.env): Ga4Setup {
  const property = parseProperty(env[PROPERTY_VAR]);
  const key = parseKey(env[KEY_VAR]);
  const found = { propertyId: property.value, clientEmail: key.clientEmail };

  if (property.error) return { state: "invalid", variable: PROPERTY_VAR, reason: property.error, ...found };
  if (key.error) return { state: "invalid", variable: KEY_VAR, reason: key.error, ...found };

  const missing = [...(property.value ? [] : [PROPERTY_VAR]), ...(key.key ? [] : [KEY_VAR])];
  if (missing.length > 0 || !property.value || !key.key) return { state: "missing", missing, ...found };

  return { state: "ready", config: { propertyId: property.value, ...key.key } };
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * What went wrong, in terms of what the owner does about it:
 *  - auth: Google refused the key itself (deleted, disabled, or wrong).
 *  - api_disabled: the Google Analytics Data API is off in the key's Cloud project.
 *  - no_access: the service account is not a user on this property.
 *  - not_found: no such property.
 *  - invalid_request / rate_limited / unavailable: the rest.
 */
export type Ga4ErrorKind = "auth" | "api_disabled" | "no_access" | "not_found" | "invalid_request" | "rate_limited" | "unavailable";

export class Ga4Error extends Error {
  constructor(
    message: string,
    readonly kind: Ga4ErrorKind,
    readonly status?: number,
    /** Google's own "enable this API" link, when it sent one. */
    readonly enableUrl?: string,
  ) {
    super(message);
    this.name = "Ga4Error";
  }
}

type GoogleErrorBody = {
  error?: {
    message?: string;
    status?: string;
    details?: { reason?: string; metadata?: { activationUrl?: string } }[];
  };
};

/** Only a Google console address is ever offered as a link. */
function consoleUrl(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && (url.hostname === "console.developers.google.com" || url.hostname === "console.cloud.google.com")
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Turns a failed Data API response into a Ga4Error. Exported for tests. */
export function dataApiError(status: number, body: GoogleErrorBody | null): Ga4Error {
  const message = body?.error?.message?.trim() || `HTTP ${status}`;
  const details = body?.error?.details ?? [];
  const disabled =
    details.some((detail) => detail.reason === "SERVICE_DISABLED" || detail.reason === "API_DISABLED") ||
    /has not been used in project|is disabled/i.test(message);

  if (disabled) {
    const fromDetails = details.map((detail) => detail.metadata?.activationUrl).find(Boolean);
    const fromMessage = message.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/\S+/)?.[0]?.replace(/[.,)]+$/, "");
    return new Ga4Error(message, "api_disabled", status, consoleUrl(fromDetails) ?? consoleUrl(fromMessage));
  }
  if (status === 401) return new Ga4Error(message, "auth", status);
  if (status === 403) return new Ga4Error(message, "no_access", status);
  if (status === 404) return new Ga4Error(message, "not_found", status);
  if (status === 429) return new Ga4Error(message, "rate_limited", status);
  if (status === 400) return new Ga4Error(message, "invalid_request", status);
  return new Ga4Error(message, "unavailable", status);
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Ga4Error("Google took too long to answer", "unavailable");
    }
    throw new Ga4Error(error instanceof Error ? error.message : "Request failed", "unavailable");
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Access token (service account, JWT bearer grant)                    */
/* ------------------------------------------------------------------ */

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** The signed assertion Google trades for an access token. Exported for tests. */
export function signedAssertion(config: Pick<Ga4Config, "clientEmail" | "privateKey">, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: config.clientEmail, scope: SCOPE, aud: TOKEN_ENDPOINT, iat: nowSeconds, exp: nowSeconds + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(config.privateKey);
  return `${header}.${claims}.${base64url(signature)}`;
}

/**
 * One token per key, reused until a minute before it expires. Kept in the
 * process only: a warm serverless instance skips the extra round trip, a cold
 * one asks again, and nothing is written anywhere.
 */
const tokens = new Map<string, { token: string; expiresAt: number }>();
/** The page's reports start together; on a cold start they share one token request. */
const pending = new Map<string, Promise<string>>();

function accessToken(config: Ga4Config): Promise<string> {
  const cached = tokens.get(config.clientEmail);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.token);

  let request = pending.get(config.clientEmail);
  if (!request) {
    request = requestToken(config).finally(() => pending.delete(config.clientEmail));
    pending.set(config.clientEmail, request);
  }
  return request;
}

async function requestToken(config: Ga4Config): Promise<string> {
  const response = await timedFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedAssertion(config, Math.floor(Date.now() / 1000)),
    }),
  });

  let data: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    // Not JSON; the status says enough.
  }
  if (!response.ok || !data.access_token) {
    // invalid_grant here means the key itself: deleted, disabled, or for another account.
    const detail = data.error_description ?? data.error ?? `HTTP ${response.status}`;
    throw new Ga4Error(`Google refused the service account key: ${detail}`, response.status >= 500 ? "unavailable" : "auth", response.status);
  }

  tokens.set(config.clientEmail, {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
  });
  return data.access_token;
}

/** For tests: forget every cached token. */
export function clearGa4TokenCache(): void {
  tokens.clear();
  pending.clear();
}

async function dataApi<T>(config: Ga4Config, method: string, body: unknown): Promise<T> {
  const url = `${DATA_API}/properties/${config.propertyId}:${method}`;
  // One retry on 401: a cached token can be revoked before it expires.
  for (let attempt = 0; ; attempt++) {
    const response = await timedFetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${await accessToken(config)}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return (await response.json()) as T;

    let error: GoogleErrorBody | null = null;
    try {
      error = (await response.json()) as GoogleErrorBody;
    } catch {
      // Not JSON.
    }
    if (response.status === 401 && attempt === 0) {
      tokens.delete(config.clientEmail);
      continue;
    }
    throw dataApiError(response.status, error);
  }
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

/**
 * A report, in the few shapes the admin page uses. Dates are GA's own
 * ("yesterday", "30daysAgo", "2026-10-01"), read in the PROPERTY's time zone.
 * `orderBy` sorts a metric high to low, or a dimension in its natural order.
 */
export type Ga4ReportRequest = {
  dateRanges: { startDate: string; endDate: string; name?: string }[];
  dimensions?: string[];
  metrics: string[];
  orderBy?: { metric: string } | { dimension: string };
  limit?: number;
};

export type Ga4Row = {
  /** By dimension name. With several date ranges, `dateRange` holds the range's name. */
  dimensions: Record<string, string>;
  /** By metric name. */
  metrics: Record<string, number>;
};

export type Ga4Report = {
  rows: Ga4Row[];
  /** The property's reporting time zone (IANA), when Google sent it. */
  timeZone: string | null;
  /** Google withheld some rows to protect individual visitors. */
  thresholded: boolean;
};

type ApiReport = {
  dimensionHeaders?: { name?: string }[];
  metricHeaders?: { name?: string }[];
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  metadata?: { timeZone?: string; subjectToThresholding?: boolean };
};

function toApiRequest(request: Ga4ReportRequest) {
  const orderBys = request.orderBy
    ? "metric" in request.orderBy
      ? [{ metric: { metricName: request.orderBy.metric }, desc: true }]
      : [{ dimension: { dimensionName: request.orderBy.dimension } }]
    : undefined;
  return {
    dateRanges: request.dateRanges,
    dimensions: (request.dimensions ?? []).map((name) => ({ name })),
    metrics: request.metrics.map((name) => ({ name })),
    ...(orderBys ? { orderBys } : {}),
    ...(request.limit ? { limit: String(request.limit) } : {}),
  };
}

/** Reads a response by its header names, so column order never matters. Exported for tests. */
export function parseReport(report: ApiReport): Ga4Report {
  const dimensionNames = (report.dimensionHeaders ?? []).map((header) => header.name ?? "");
  const metricNames = (report.metricHeaders ?? []).map((header) => header.name ?? "");
  const rows = (report.rows ?? []).map((row) => ({
    dimensions: Object.fromEntries(dimensionNames.map((name, i) => [name, row.dimensionValues?.[i]?.value ?? ""])),
    metrics: Object.fromEntries(
      metricNames.map((name, i) => {
        const value = Number(row.metricValues?.[i]?.value ?? 0);
        return [name, Number.isFinite(value) ? value : 0];
      }),
    ),
  }));
  return {
    rows,
    timeZone: report.metadata?.timeZone ?? null,
    thresholded: report.metadata?.subjectToThresholding === true,
  };
}

/** Runs reports in as few calls as Google allows (five per batch), in order. */
export async function runGa4Reports(config: Ga4Config, requests: Ga4ReportRequest[]): Promise<Ga4Report[]> {
  const batches: Ga4ReportRequest[][] = [];
  for (let i = 0; i < requests.length; i += BATCH_LIMIT) batches.push(requests.slice(i, i + BATCH_LIMIT));

  const answers = await Promise.all(
    batches.map((batch) =>
      dataApi<{ reports?: ApiReport[] }>(config, "batchRunReports", { requests: batch.map(toApiRequest) }),
    ),
  );
  return answers.flatMap((answer, i) => {
    const reports = answer.reports ?? [];
    // One answer per request, or the caller would read one report as another.
    if (reports.length !== batches[i].length) {
      throw new Ga4Error(`Google returned ${reports.length} reports for ${batches[i].length} requests`, "unavailable");
    }
    return reports.map(parseReport);
  });
}

/** Visitors in roughly the last 30 minutes (GA's realtime window). */
export async function runGa4Realtime(config: Ga4Config, metrics: string[]): Promise<Ga4Report> {
  const answer = await dataApi<ApiReport>(config, "runRealtimeReport", {
    metrics: metrics.map((name) => ({ name })),
  });
  return parseReport(answer);
}
