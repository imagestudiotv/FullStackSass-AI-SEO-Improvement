import { and, eq } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { refreshAccessToken, type TokenSet } from "@/lib/analytics/google-oauth";

/**
 * Stored Google connection for one website.
 *
 * Refresh tokens are long-lived read access to a customer's analytics, so they
 * are encrypted at rest for the same reason WordPress passwords are. Access
 * tokens are short-lived but encrypted too — there is no reason to store one
 * in the clear when the mechanism already exists.
 */

export const GOOGLE_KIND = "google_analytics";

type StoredTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
};

export type GoogleMeta = {
  /** Search Console property, e.g. "sc-domain:example.com". */
  searchConsoleSite?: string | null;
  /** GA4 property, e.g. "properties/123456789". */
  analyticsProperty?: string | null;
  email?: string | null;
};

export async function saveTokens(
  websiteId: string,
  tokens: TokenSet,
  meta: GoogleMeta = {},
): Promise<void> {
  const [existing] = await db
    .select({ id: integrations.id, credentials: integrations.credentials, meta: integrations.meta })
    .from(integrations)
    .where(
      and(eq(integrations.websiteId, websiteId), eq(integrations.kind, GOOGLE_KIND)),
    )
    .limit(1);

  const previous = (existing?.credentials as StoredTokens | null) ?? null;

  /**
   * A refresh response omits the refresh token, and Google only issues one on
   * first consent. Dropping the stored one here would silently break every
   * future import with no way to recover but re-consenting.
   */
  const refreshToken = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : (previous?.refreshToken ?? null);

  const stored: StoredTokens = {
    accessToken: encryptSecret(tokens.accessToken),
    refreshToken,
    expiresAt: tokens.expiresAt.toISOString(),
    scope: tokens.scope,
  };

  const values = {
    credentials: stored,
    status: "connected",
    verifiedAt: new Date(),
    meta: { ...((existing?.meta as GoogleMeta | null) ?? {}), ...meta },
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(integrations).set(values).where(eq(integrations.id, existing.id));
  } else {
    await db
      .insert(integrations)
      .values({ websiteId, kind: GOOGLE_KIND, ...values });
  }
}

export type GoogleConnection = {
  integrationId: string;
  accessToken: string;
  meta: GoogleMeta;
};

/**
 * Returns a usable access token, refreshing it first when it has expired.
 *
 * Callers never handle expiry themselves: a token that looks valid but is one
 * second from expiring would otherwise fail mid-import.
 */
export async function getConnection(
  websiteId: string,
): Promise<GoogleConnection | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.websiteId, websiteId), eq(integrations.kind, GOOGLE_KIND)),
    )
    .limit(1);

  if (!row) return null;
  const stored = row.credentials as StoredTokens | null;
  if (!stored) return null;

  const meta = (row.meta as GoogleMeta | null) ?? {};
  const expired = new Date(stored.expiresAt).getTime() <= Date.now();

  if (!expired) {
    return {
      integrationId: row.id,
      accessToken: decryptSecret(stored.accessToken),
      meta,
    };
  }

  if (!stored.refreshToken) {
    // Nothing to refresh with; the user must reconnect.
    await db
      .update(integrations)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(integrations.id, row.id));
    return null;
  }

  const refreshed = await refreshAccessToken(decryptSecret(stored.refreshToken));
  await saveTokens(websiteId, refreshed, meta);

  return {
    integrationId: row.id,
    accessToken: refreshed.accessToken,
    meta,
  };
}

export async function disconnect(websiteId: string): Promise<void> {
  await db
    .delete(integrations)
    .where(
      and(eq(integrations.websiteId, websiteId), eq(integrations.kind, GOOGLE_KIND)),
    );
}
