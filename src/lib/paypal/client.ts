/**
 * PayPal REST client.
 *
 * Separate from Stripe in every respect — different objects, different auth,
 * different webhook format — so nothing here is shared with lib/stripe. What
 * IS shared is the subscriptions table: a row carries `provider` and only the
 * columns for whichever processor owns it.
 *
 * Credentials are read at call time, never at import, so the app builds and
 * runs without them and simply reports "not configured".
 */

const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";

const TIMEOUT_MS = 30_000;

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "auth" | "not_found" | "rejected" | "unknown",
    readonly status?: number,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

export type PayPalMode = "live" | "sandbox";

/** The last PAYPAL_ENV reported as invalid, so a bad value is logged once, not per request. */
let reportedEnv: string | null = null;

/**
 * PAYPAL_ENV, read strictly: exactly "live" or "sandbox". Unset means sandbox,
 * which is what local development runs on. Anything else ("Live",
 * "production", a typo) is null - PayPal is then treated as not configured,
 * and said so in the log. It used to mean sandbox silently: live credentials
 * sent to the sandbox, every checkout and every webhook failing, and the
 * button still on show.
 */
export function payPalMode(): PayPalMode | null {
  const value = process.env.PAYPAL_ENV;
  if (!value || value === "sandbox") return "sandbox";
  if (value === "live") return "live";
  if (reportedEnv !== value) {
    reportedEnv = value;
    console.error(
      `[paypal] PAYPAL_ENV is "${value}"; it must be "live" or "sandbox". PayPal is switched off until it is fixed.`,
    );
  }
  return null;
}

/**
 * Whether a PayPal checkout can complete end to end: both credentials, a
 * valid PAYPAL_ENV, and PAYPAL_WEBHOOK_ID - without it every webhook is
 * refused, so a customer would approve and pay at PayPal and never get the
 * plan. The PayPal button (actions.ts isPayPalAvailable), the checkout and
 * the webhook all read this one answer.
 */
export function isPayPalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.PAYPAL_WEBHOOK_ID &&
      payPalMode(),
  );
}

/**
 * PAYPAL_CHECKOUT=off pauses NEW PayPal checkouts - the button, a new
 * subscription, a plan change - and nothing else (review L9, 2026-10-20).
 * The webhook, the return from PayPal and the maintenance job keep working,
 * so existing PayPal subscribers are still billed, recorded and cancelled.
 * Before it, pausing PayPal meant removing the credentials, which also
 * refused every webhook for the customers already paying through it.
 */
export function payPalCheckoutPaused(): boolean {
  return process.env.PAYPAL_CHECKOUT?.trim().toLowerCase() === "off";
}

/**
 * Live only when explicitly asked for. Defaulting to sandbox means a missing
 * variable cannot accidentally take real money; an invalid one refuses
 * rather than guessing.
 */
export function apiBase(): string {
  const mode = payPalMode();
  if (!mode) throw new PayPalError('PAYPAL_ENV must be "live" or "sandbox"', "config");
  return mode === "live" ? LIVE : SANDBOX;
}

export function isLiveMode(): boolean {
  return payPalMode() === "live";
}

/** A response body as JSON, or null when there is none or it is not JSON (a gateway's HTML page). */
async function readJson(response: Response): Promise<{ body: Record<string, unknown> | null; readable: boolean }> {
  const text = await response.text();
  if (!text) return { body: null, readable: true };
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? { body: parsed as Record<string, unknown>, readable: true }
      : { body: null, readable: false };
  } catch {
    return { body: null, readable: false };
  }
}

type TokenCache = { token: string; expiresAt: number };
let cached: TokenCache | null = null;

/**
 * OAuth access token, cached until shortly before it expires.
 *
 * PayPal issues tokens valid for about nine hours and rate-limits the token
 * endpoint, so fetching one per request would be both slow and eventually
 * throttled.
 */
async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new PayPalError("PayPal is not configured", "config");
  }

  const base = apiBase();

  /*
    Every failure here is "auth": nothing but a token was asked for, so no
    subscription can have been created, and a checkout that fails at this
    point is safely marked failed rather than left to block the website.
  */
  let response: Response;
  try {
    response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  } catch (error) {
    throw new PayPalError(
      error instanceof Error ? error.message : "Could not reach PayPal",
      "auth",
    );
  }

  const data = ((await readJson(response)).body ?? {}) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new PayPalError(
      data.error_description ?? `PayPal did not issue a token (${response.status})`,
      "auth",
      response.status,
    );
  }

  // 60s early, so a token is never used in the second it expires.
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 32400) - 60) * 1000,
  };
  return cached.token;
}

export async function payPalRequest<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const token = await accessToken();
  const base = apiBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...init.headers,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        /**
         * PayPal replays a request with the same key rather than creating a
         * second subscription, which matters because a retried checkout would
         * otherwise bill the customer twice.
         */
        ...(init.idempotencyKey
          ? { "PayPal-Request-Id": init.idempotencyKey }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PayPalError("PayPal took too long to respond", "unknown");
    }
    throw new PayPalError(
      error instanceof Error ? error.message : "Request failed",
      "unknown",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    // Token may have been revoked; drop the cache so the next call re-auths.
    cached = null;
    throw new PayPalError("PayPal rejected the credentials", "auth", 401);
  }
  if (response.status === 404) {
    throw new PayPalError("Not found at PayPal", "not_found", 404);
  }

  /*
    A 5xx, or a body that is not JSON (a gateway's HTML error page), is
    "unknown": PayPal may or may not have acted on the request, so the
    caller must not treat it as refused. Parsing it used to throw a
    SyntaxError, which no caller recognised.
  */
  const { body, readable } = await readJson(response);
  if (response.status >= 500 || !readable) {
    throw new PayPalError(`PayPal returned ${response.status} with no usable answer`, "unknown", response.status);
  }

  if (!response.ok) {
    const detail =
      (body?.message as string | undefined) ??
      (body?.error_description as string | undefined) ??
      `PayPal returned ${response.status}`;
    throw new PayPalError(detail, "rejected", response.status);
  }

  return body as T;
}
