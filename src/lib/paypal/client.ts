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

export function isPayPalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  );
}

/**
 * Live only when explicitly asked for. Defaulting to sandbox means a missing
 * variable cannot accidentally take real money.
 */
export function apiBase(): string {
  return process.env.PAYPAL_ENV === "live" ? LIVE : SANDBOX;
}

export function isLiveMode(): boolean {
  return process.env.PAYPAL_ENV === "live";
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

  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new PayPalError(
      data.error_description ?? "PayPal rejected the credentials",
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
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

  const text = await response.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;

  if (!response.ok) {
    const detail =
      (body?.message as string | undefined) ??
      (body?.error_description as string | undefined) ??
      `PayPal returned ${response.status}`;
    throw new PayPalError(detail, "rejected", response.status);
  }

  return body as T;
}
