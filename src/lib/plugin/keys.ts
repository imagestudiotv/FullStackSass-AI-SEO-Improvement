import crypto from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

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
  /** The caller's transaction, when the key must commit with something else. */
  executor: Pick<typeof db, "insert"> = db,
): Promise<{ key: string; id: string }> {
  // 32 random bytes, base64url. Far beyond guessing, and safe in a header.
  const key = `${KEY_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;

  const [row] = await executor
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
  /** The website's domain, for checking addresses the plugin reports. */
  websiteDomain: string;
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
      // For checking the address a plugin reports. See lib/plugin/sync.ts.
      websiteDomain: websites.domain,
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

/* ------------------------------------------------------------------------ */
/* First-time setup                                                         */
/* ------------------------------------------------------------------------ */

/**
 * What entering WordPress setup found or did.
 *
 * - created: this website had NEVER had a key, so one was made. The only
 *   time its plaintext exists outside the customer's clipboard.
 * - exists: an active key is already there (made by another tab, an earlier
 *   visit, or a retry whose response was lost). Never rotated automatically,
 *   and its plaintext cannot be shown again - only its prefix.
 * - revoked: every key this website had was revoked on purpose. Nothing is
 *   created automatically after that; the customer makes one by hand. That
 *   is what prevents a create -> revoke -> create loop.
 */
export type FirstKeyOutcome =
  | { kind: "created"; key: string; id: string; keyPrefix: string }
  | { kind: "exists"; id: string; keyPrefix: string; connected: boolean; createdAt: Date }
  | { kind: "revoked" };

/** Serialises key provisioning per website, across requests and tabs. */
async function lockWebsiteKeys(tx: Pick<typeof db, "execute">, websiteId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`integration-key:${websiteId}`}))`);
}

/**
 * Makes the first key for a website that has never had one.
 *
 * Under a per-website advisory lock, inside one transaction: two tabs, a
 * React development double-effect, a refresh or a retried request all
 * serialise here, and only the first finds "never had a key". The rest get
 * "exists" and create nothing.
 *
 * Never called while rendering or from a GET: the setup screen calls it as
 * a server action (a POST) once it has mounted.
 */
export async function provisionFirstKey(websiteId: string): Promise<FirstKeyOutcome> {
  return db.transaction(async (tx) => {
    await lockWebsiteKeys(tx, websiteId);
    const rows = await tx
      .select({
        id: integrationKeys.id,
        keyPrefix: integrationKeys.keyPrefix,
        lastUsedAt: integrationKeys.lastUsedAt,
        revokedAt: integrationKeys.revokedAt,
        createdAt: integrationKeys.createdAt,
      })
      .from(integrationKeys)
      .where(eq(integrationKeys.websiteId, websiteId))
      .orderBy(desc(integrationKeys.createdAt));

    const active = rows.find((row) => !row.revokedAt);
    if (active) {
      return {
        kind: "exists" as const,
        id: active.id,
        keyPrefix: active.keyPrefix,
        connected: Boolean(active.lastUsedAt),
        createdAt: active.createdAt,
      };
    }
    if (rows.length > 0) return { kind: "revoked" as const };

    const { key, id } = await createIntegrationKey(websiteId, null, tx);
    return { kind: "created" as const, key, id, keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
  });
}

/** True when this website has had a key at any time, revoked or not. */
export async function hasEverHadKey(websiteId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: integrationKeys.id })
    .from(integrationKeys)
    .where(eq(integrationKeys.websiteId, websiteId))
    .limit(1);
  return Boolean(row);
}

export type ReplaceOutcome =
  | { ok: true; key: string; id: string; keyPrefix: string }
  | { ok: false; reason: "not_found" | "connected" };

/**
 * Recovers from a lost creation response: replaces a key that WordPress
 * has never used with a new one, and returns the new plaintext.
 *
 * Only an UNUSED key. One that has connected is a working installation, and
 * revoking it would take the customer's site offline - for that, the
 * customer creates an additional key by hand instead. Same lock as
 * provisioning, so a replace cannot interleave with a first-time create.
 */
export async function replaceUnusedKey(websiteId: string, keyId: string): Promise<ReplaceOutcome> {
  return db.transaction(async (tx) => {
    await lockWebsiteKeys(tx, websiteId);
    const [row] = await tx
      .select({ id: integrationKeys.id, lastUsedAt: integrationKeys.lastUsedAt })
      .from(integrationKeys)
      .where(
        and(
          eq(integrationKeys.id, keyId),
          // Scoped: an id from another tenant finds nothing.
          eq(integrationKeys.websiteId, websiteId),
          isNull(integrationKeys.revokedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.lastUsedAt) return { ok: false as const, reason: "connected" as const };

    await tx
      .update(integrationKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(integrationKeys.id, row.id), isNull(integrationKeys.lastUsedAt)));
    const { key, id } = await createIntegrationKey(websiteId, null, tx);
    return { ok: true as const, key, id, keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
  });
}
