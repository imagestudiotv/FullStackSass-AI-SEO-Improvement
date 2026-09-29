import crypto from "node:crypto";

import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationKeys, websites } from "@/lib/db/schema";
import { CONNECT_KEY_LABEL, MANUAL_KEY_LABEL, RESERVED_KEY_LABELS } from "@/lib/plugin/connect-label";

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

/**
 * The label for a key a person made with "New key": their note, or - with no
 * note - MANUAL_KEY_LABEL, so it is never tidied up as a leftover. A note
 * that equals a reserved label is treated as no note.
 */
export function keyLabel(note: string): string {
  const trimmed = note.trim();
  return trimmed && !RESERVED_KEY_LABELS.includes(trimmed) ? trimmed : MANUAL_KEY_LABEL;
}

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
      // As given: callers choose it (a person's note goes through keyLabel first).
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
  /**
   * A "Connect WordPress" key still waiting for WordPress to use it: unused,
   * younger than the grace period, and not superseded by a NEWER key that
   * connected. On the database's clock, so the page's server render and the
   * browser agree (lib/plugin/connect-watch.ts).
   */
  pending: boolean;
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
      pending: sql<boolean>`(
        ${integrationKeys.label} = ${CONNECT_KEY_LABEL}
        and ${integrationKeys.lastUsedAt} is null
        and not (${pastGrace})
        and not exists (
          -- The outer row is named in full: drizzle may leave a column
          -- unqualified here, and inside this subquery that would mean "newer".
          select 1 from integration_keys newer
          where newer.website_id = integration_keys.website_id
            and newer.revoked_at is null
            and newer.last_used_at is not null
            and newer.created_at > integration_keys.created_at
        )
      )`,
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
): Promise<boolean> {
  const revoked = await db
    .update(integrationKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    // Scoped by website too, so an id from another tenant revokes nothing.
    .where(
      and(
        eq(integrationKeys.id, keyId),
        eq(integrationKeys.websiteId, websiteId),
        // Once: revoking again keeps the first time, and reports nothing new.
        isNull(integrationKeys.revokedAt),
      ),
    )
    .returning({ id: integrationKeys.id });
  return revoked.length > 0;
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

/* ------------------------------------------------------------------------ */
/* "Connect WordPress": a key made at the moment it is needed               */
/* ------------------------------------------------------------------------ */

/*
  WHY. Keys used to be made when the setup screen first opened and shown
  once. A customer who missed that moment - another tab, a reload, a second
  account - found a key marked "Never used" that could not be shown again,
  while their WordPress said "Connected" with some other key (2026-09-29,
  imagestudio.com). Now a key is made when the customer presses "Connect
  WordPress", and goes straight into their WordPress in the same click.

  Keys are only ever stored as hashes, so a press in a new tab makes a new
  key. The label (lib/plugin/connect-label.ts) marks the ones this button
  made, so unused ones can be tidied away without ever touching a key that
  is in use or one a person made on purpose. The screen shows labels in the
  reader's language; it never shows these strings.
*/
export { CONNECT_KEY_LABEL, MANUAL_KEY_LABEL };

/**
 * How long an unused key is left alone: a WordPress tab opened with it may
 * still be about to press Save and connect. Nothing younger is ever tidied up.
 */
export const CONNECT_KEY_GRACE_MS = 30 * 60 * 1000;

/**
 * Unused button keys younger than the grace period, at most. The screen
 * reuses its key when pressed again, so more than this means many tabs or
 * devices at once; a further press is refused rather than revoking a key an
 * open WordPress tab may be about to save.
 */
export const MAX_PENDING_CONNECT_KEYS = 3;

/** The same cap "New key" has: five live keys per website. */
export const MAX_LIVE_KEYS = 5;

export type ConnectKeyOutcome =
  | { ok: true; key: string; id: string; keyPrefix: string }
  | { ok: false; reason: "too_many_keys" | "too_many_pending" };

/** True for keys whose created_at is older than the grace period, on the DATABASE clock (see tidyKeys). */
const pastGrace = sql<boolean>`${integrationKeys.createdAt} < localtimestamp - make_interval(secs => ${CONNECT_KEY_GRACE_MS / 1000})`;

/**
 * A key counts as replaced in its WordPress install once it has been silent
 * this long while a newer key reported from the same address kept calling.
 * The plugin checks in about hourly, so an install still using its key is
 * never anywhere near this.
 */
export const REPLACED_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Tidies up this website's keys before one is made, inside the caller's
 * transaction and per-website lock. Revokes:
 *
 *  - the button's unused keys past the grace period. A younger one is never
 *    revoked: an open WordPress tab may hold it, and plugin 1.6.0 saves a key
 *    before checking it, so a revoked key saved later would replace a working
 *    one.
 *  - keys REPLACED in their WordPress install: made by the button or the old
 *    setup screen (never a person's), reported from the same check-now
 *    address as a NEWER key that has called since, and silent themselves for
 *    REPLACED_AFTER_MS. A WordPress site holds one key, so that key was
 *    replaced there - "Connect again" no longer piles keys up. Not done when
 *    WordPress connects: a staging copy of a site reports the same address,
 *    and connecting it must not cut the live site off. An install still
 *    using its key keeps calling, so it never qualifies.
 *
 * Everything is aged on the DATABASE's clock (localtimestamp): created_at is
 * stamped by it, and the app's clock and the database's session time zone
 * need not agree. Returns how many keys are left live, and how many of the
 * button's are still waiting to be used.
 */
async function tidyKeys(
  tx: Pick<typeof db, "select" | "update">,
  websiteId: string,
  now: Date,
): Promise<{ live: number; pending: number }> {
  const replaced = sql<boolean>`(
    ${integrationKeys.lastUsedAt} is not null
    and (${integrationKeys.label} is null or ${integrationKeys.label} = ${CONNECT_KEY_LABEL})
    and ${integrationKeys.syncUrl} is not null
    and ${integrationKeys.lastUsedAt} < localtimestamp - make_interval(secs => ${REPLACED_AFTER_MS / 1000})
    and exists (
      -- The outer row is named in full: an unqualified column here would mean "newer".
      select 1 from integration_keys newer
      where newer.website_id = integration_keys.website_id
        and newer.id <> integration_keys.id
        and newer.revoked_at is null
        and newer.sync_url = integration_keys.sync_url
        and newer.created_at > integration_keys.created_at
        and newer.last_used_at > integration_keys.last_used_at
    )
  )`;
  const rows = await tx
    .select({
      id: integrationKeys.id,
      label: integrationKeys.label,
      lastUsedAt: integrationKeys.lastUsedAt,
      pastGrace,
      replaced,
    })
    .from(integrationKeys)
    .where(and(eq(integrationKeys.websiteId, websiteId), isNull(integrationKeys.revokedAt)));

  const unusedButtonKeys = rows.filter((key) => key.label === CONNECT_KEY_LABEL && !key.lastUsedAt);
  const expired = unusedButtonKeys.filter((key) => key.pastGrace).map((key) => key.id);
  const superseded = rows.filter((key) => key.replaced).map((key) => key.id);

  let revoked = 0;
  if (expired.length > 0) {
    const done = await tx
      .update(integrationKeys)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          inArray(integrationKeys.id, expired),
          eq(integrationKeys.websiteId, websiteId),
          // Re-checked in the write: a key used meanwhile is never revoked.
          isNull(integrationKeys.lastUsedAt),
          isNull(integrationKeys.revokedAt),
        ),
      )
      .returning({ id: integrationKeys.id });
    revoked += done.length;
  }
  if (superseded.length > 0) {
    const done = await tx
      .update(integrationKeys)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          inArray(integrationKeys.id, superseded),
          eq(integrationKeys.websiteId, websiteId),
          isNull(integrationKeys.revokedAt),
          // Re-checked in the write: a key that called meanwhile is still in use.
          sql`${integrationKeys.lastUsedAt} < localtimestamp - make_interval(secs => ${REPLACED_AFTER_MS / 1000})`,
        ),
      )
      .returning({ id: integrationKeys.id });
    revoked += done.length;
  }

  return { live: rows.length - revoked, pending: unusedButtonKeys.length - expired.length };
}

/**
 * Makes a key for "Connect WordPress", after tidying up (tidyKeys), under
 * the per-website lock that every key change takes.
 */
export async function mintConnectKey(websiteId: string): Promise<ConnectKeyOutcome> {
  return db.transaction(async (tx) => {
    await lockWebsiteKeys(tx, websiteId);
    const { live, pending } = await tidyKeys(tx, websiteId, new Date());
    if (pending >= MAX_PENDING_CONNECT_KEYS) {
      return { ok: false as const, reason: "too_many_pending" as const };
    }
    if (live >= MAX_LIVE_KEYS) {
      return { ok: false as const, reason: "too_many_keys" as const };
    }
    const { key, id } = await createIntegrationKey(websiteId, CONNECT_KEY_LABEL, tx);
    return { ok: true as const, key, id, keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
  });
}

/**
 * Makes a key a person asked for with "New key" (for another install,
 * connected by hand), under the same lock, tidy-up and cap as the button -
 * so the two never disagree about how many keys are left. Labelled with
 * the person's note, or MANUAL_KEY_LABEL (see keyLabel): never tidied up.
 */
export async function createManualKey(
  websiteId: string,
  note: string,
): Promise<{ ok: true; key: string } | { ok: false; reason: "too_many_keys" }> {
  return db.transaction(async (tx) => {
    await lockWebsiteKeys(tx, websiteId);
    const { live } = await tidyKeys(tx, websiteId, new Date());
    if (live >= MAX_LIVE_KEYS) return { ok: false as const, reason: "too_many_keys" as const };
    const { key } = await createIntegrationKey(websiteId, keyLabel(note), tx);
    return { ok: true as const, key };
  });
}

/**
 * After WordPress connects: revokes this website's keys that never connected,
 * that no person made on purpose, and that are past the grace period - a key
 * made when the setup screen used to open (never seen again), or an old
 * "Connect WordPress" press whose tab was closed. These sat as "Never used"
 * forever, which is what confused the client.
 *
 * Never a key that has been used, never a person's key ("New key", with or
 * without a note), and never one younger than the grace period (an open
 * WordPress tab may be about to save it). Nothing happens if the key that
 * connected has itself been revoked meanwhile. Returns how many were revoked.
 */
export async function revokeLeftoverKeys(websiteId: string, connectedKeyId: string, now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    await lockWebsiteKeys(tx, websiteId);
    const [connected] = await tx
      .select({ id: integrationKeys.id })
      .from(integrationKeys)
      .where(
        and(
          eq(integrationKeys.id, connectedKeyId),
          eq(integrationKeys.websiteId, websiteId),
          isNull(integrationKeys.revokedAt),
        ),
      )
      .limit(1);
    if (!connected) return 0;

    const revoked = await tx
      .update(integrationKeys)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(integrationKeys.websiteId, websiteId),
          ne(integrationKeys.id, connectedKeyId),
          isNull(integrationKeys.revokedAt),
          isNull(integrationKeys.lastUsedAt),
          or(isNull(integrationKeys.label), eq(integrationKeys.label, CONNECT_KEY_LABEL)),
          pastGrace,
        ),
      )
      .returning({ id: integrationKeys.id });
    return revoked.length;
  });
}

/** A revoked key's check-now address and hash, so WordPress can be told at once. */
export async function revokedKeyEndpoint(
  websiteId: string,
  keyId: string,
): Promise<{ keyHash: string; syncUrl: string } | null> {
  const [row] = await db
    .select({ keyHash: integrationKeys.keyHash, syncUrl: integrationKeys.syncUrl })
    .from(integrationKeys)
    .where(and(eq(integrationKeys.id, keyId), eq(integrationKeys.websiteId, websiteId)))
    .limit(1);
  return row?.syncUrl ? { keyHash: row.keyHash, syncUrl: row.syncUrl } : null;
}
