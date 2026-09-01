import crypto from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationKeys, websites } from "@/lib/db/schema";

/**
 * Integration Keys for the WordPress plugin.
 *
 * A key identifies one website to us. The plugin sends it on every request; we
 * hash it, look it up, and know which workspace is calling.
 *
 * Only the hash is stored. The key is displayed once at creation and never
 * again — not shown, not recoverable, not emailed. If our database leaks, the
 * keys in it are useless, which is the only reason to hash a credential rather
 * than encrypt it: we never need to read it back.
 *
 * This module is imported by both server actions and a public API route, so it
 * carries no "use server" directive.
 */

/** Prefixed so a leaked key is recognisable in a log or a support ticket. */
const KEY_PREFIX = "seo_";

/** Characters shown to the customer so two keys can be told apart. */
const DISPLAY_PREFIX_LENGTH = 12;

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key.trim()).digest("hex");
}

/**
 * Creates a key for a website.
 *
 * Returns the plaintext ONCE. The caller must show it immediately; there is no
 * second chance, and that is deliberate rather than an oversight.
 */
export async function createIntegrationKey(
  websiteId: string,
  label?: string | null,
): Promise<{ key: string; id: string }> {
  // 32 random bytes, base64url. Far beyond guessing, and safe in a header.
  const key = `${KEY_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;

  const [row] = await db
    .insert(integrationKeys)
    .values({
      websiteId,
      keyHash: hashKey(key),
      keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
      label: label?.trim() || null,
    })
    .returning({ id: integrationKeys.id });

  return { key, id: row.id };
}

export type ResolvedKey = {
  keyId: string;
  websiteId: string;
  organizationId: string;
};

/**
 * Resolves a key from a request.
 *
 * Returns null for anything unusable — unknown, revoked, malformed — rather
 * than distinguishing between them. Telling a caller that a key exists but is
 * revoked confirms the key is real, which is information an attacker holding a
 * guessed key should not get.
 *
 * Records last use, so a customer can see whether the plugin ever called.
 */
export async function resolveIntegrationKey(
  key: string | null | undefined,
): Promise<ResolvedKey | null> {
  if (!key) return null;

  const trimmed = key.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) return null;

  const [row] = await db
    .select({
      keyId: integrationKeys.id,
      websiteId: integrationKeys.websiteId,
      organizationId: websites.organizationId,
    })
    .from(integrationKeys)
    .innerJoin(websites, eq(integrationKeys.websiteId, websites.id))
    .where(
      and(
        eq(integrationKeys.keyHash, hashKey(trimmed)),
        // A revoked key is dead immediately, not at some expiry.
        isNull(integrationKeys.revokedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  /**
   * Not awaited. Recording usage must never delay or fail the request it is
   * recording — a plugin publishing an article should not error because a
   * timestamp write was slow.
   */
  void db
    .update(integrationKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(integrationKeys.id, row.keyId))
    .catch(() => {});

  return row;
}

/** Records what the plugin reported about the site it runs on. */
export async function recordSiteInfo(
  keyId: string,
  siteInfo: string,
): Promise<void> {
  await db
    .update(integrationKeys)
    .set({ siteInfo: siteInfo.slice(0, 200), updatedAt: new Date() })
    .where(eq(integrationKeys.id, keyId));
}

export type IntegrationKeyView = {
  id: string;
  keyPrefix: string;
  label: string | null;
  lastUsedAt: Date | null;
  siteInfo: string | null;
  createdAt: Date;
};

/** Keys for a website. Revoked ones are excluded; they are history, not state. */
export async function listIntegrationKeys(
  websiteId: string,
): Promise<IntegrationKeyView[]> {
  return db
    .select({
      id: integrationKeys.id,
      keyPrefix: integrationKeys.keyPrefix,
      label: integrationKeys.label,
      lastUsedAt: integrationKeys.lastUsedAt,
      siteInfo: integrationKeys.siteInfo,
      createdAt: integrationKeys.createdAt,
    })
    .from(integrationKeys)
    .where(
      and(
        eq(integrationKeys.websiteId, websiteId),
        isNull(integrationKeys.revokedAt),
      ),
    )
    .orderBy(desc(integrationKeys.createdAt));
}

/**
 * Revokes a key.
 *
 * Marked rather than deleted, so "which key was that, and when did it stop
 * working" has an answer later.
 */
export async function revokeIntegrationKey(
  websiteId: string,
  keyId: string,
): Promise<void> {
  await db
    .update(integrationKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    // Scoped by website too, so an id from another tenant revokes nothing.
    .where(
      and(
        eq(integrationKeys.id, keyId),
        eq(integrationKeys.websiteId, websiteId),
      ),
    );
}
