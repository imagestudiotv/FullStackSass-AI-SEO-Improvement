/**
 * Google OAuth for Search Console and Analytics.
 *
 * Separate from the Better Auth Google login on purpose. Sign-in asks only for
 * identity; this asks for read access to a customer's analytics data, which is
 * a different consent decision. Bundling them would force every new user to
 * approve analytics scopes just to create an account, and Google shows the
 * combined list on one screen — a worse conversion rate for no benefit.
 *
 * The same GOOGLE_CLIENT_ID/SECRET are reused; only the scopes and redirect
 * differ.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Read-only. We never need to modify a customer's Search Console or GA. */
export const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "denied" | "exchange" | "refresh",
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new GoogleAuthError("NEXT_PUBLIC_APP_URL is not set", "config");
  return url.replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${appUrl()}/api/integrations/google/callback`;
}

/**
 * Builds the consent URL.
 *
 * `access_type=offline` with `prompt=consent` is required to receive a refresh
 * token. Google returns one only on the FIRST authorisation unless consent is
 * forced, so a user who reconnects would otherwise get an access token that
 * expires in an hour and no way to renew it.
 */
export function authorizeUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new GoogleAuthError("GOOGLE_CLIENT_ID is not set", "config");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type TokenSet = {
  accessToken: string;
  /** Absent when Google decides one is already held; see authorizeUrl. */
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
};

async function tokenRequest(
  body: Record<string, string>,
  kind: "exchange" | "refresh",
): Promise<TokenSet> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleAuthError("Google OAuth is not configured", "config");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...body,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new GoogleAuthError(
      data.error_description ?? data.error ?? "Google rejected the request",
      kind,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    // 60s early so a token is never used in the second it expires.
    expiresAt: new Date(Date.now() + ((data.expires_in ?? 3600) - 60) * 1000),
    scope: data.scope ?? "",
  };
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  return tokenRequest(
    {
      code,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    },
    "exchange",
  );
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenSet> {
  const result = await tokenRequest(
    { refresh_token: refreshToken, grant_type: "refresh_token" },
    "refresh",
  );
  // A refresh response does not repeat the refresh token; keep the one we have.
  return { ...result, refreshToken: result.refreshToken ?? refreshToken };
}
