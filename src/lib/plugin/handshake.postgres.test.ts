import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * One-click connect on REAL Postgres, each contender on its own connection:
 * the races PGlite (one connection) cannot produce.
 *
 *   - two exchanges of one code make one key;
 *   - a double-clicked approval makes one code;
 *   - requests arriving together cannot overrun the limits on open requests;
 *   - two first checks of a moved site's new key retire the old key once.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return {
    db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }),
  };
});

import {
  integrationKeys,
  member,
  organization,
  pluginConnectRequests,
  session as sessions,
  user,
  websites,
} from "@/lib/db/schema";

import {
  approveHandshake,
  exchangeHandshakeCode,
  handshakeTestHooks,
  loadForViewer,
  MAX_OPEN_TOTAL,
  retirePresentedKey,
  startHandshake,
} from "./handshake";
import { createIntegrationKey } from "./keys";

const available = Boolean(testPostgresUrl());
const HOST = "imagestudio.example";
const CALLER = "203.0.113.7";
const viewer = { sessionId: "s_pg_owner", userId: "u_pg_owner" };

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

const startInput = (challenge = pkce().challenge) => ({
  siteUrl: `https://${HOST}`,
  returnUrl: `https://${HOST}/wp-admin/admin.php?page=repget`,
  state: randomBytes(24).toString("base64url"),
  challenge,
  pluginVersion: "1.7.0",
  link: undefined,
});

describe.skipIf(!available)("one-click connect on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  let siteA: string;
  let siteB: string;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i], fn);

  beforeAll(async () => {
    const created = await createPostgresTestDb(4);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
    const now = new Date();
    await dbs[0].insert(organization).values([
      { id: "org_pg_a", name: "Photo Booth Studio", slug: "pg-a", createdAt: now },
      { id: "org_pg_b", name: "Second Account", slug: "pg-b", createdAt: now },
    ]);
    await dbs[0].insert(user).values({ id: viewer.userId, name: "O", email: "o@mail.example", createdAt: now, updatedAt: now });
    await dbs[0].insert(member).values([
      { id: "pgm1", organizationId: "org_pg_a", userId: viewer.userId, role: "owner", createdAt: now },
      { id: "pgm2", organizationId: "org_pg_b", userId: viewer.userId, role: "owner", createdAt: now },
    ]);
    await dbs[0].insert(sessions).values({
      id: viewer.sessionId,
      token: "t_pg_owner",
      userId: viewer.userId,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: now,
      updatedAt: now,
    });
    const rows = await dbs[0]
      .insert(websites)
      .values([
        { organizationId: "org_pg_a", url: `https://${HOST}`, domain: HOST },
        { organizationId: "org_pg_b", url: `https://${HOST}`, domain: HOST },
      ])
      .returning({ id: websites.id });
    [siteA, siteB] = rows.map((row) => row.id);
  }, 120_000);
  afterAll(async () => {
    await dispose?.();
  });
  beforeEach(async () => {
    await dbs[0].delete(pluginConnectRequests);
    await dbs[0].delete(integrationKeys);
  });

  async function approvedRequest(websiteId: string, presentedKey: string | null = null) {
    const { verifier, challenge } = pkce();
    const started = await startHandshake(startInput(challenge), presentedKey, CALLER);
    if (!started.ok) throw new Error(started.error);
    await loadForViewer(started.id, viewer);
    const outcome = await approveHandshake({ id: started.id, websiteId, ...viewer });
    if (!outcome.ok) throw new Error(outcome.reason);
    return { id: started.id, verifier, code: new URL(outcome.redirectTo).searchParams.get("code")! };
  }

  it("two exchanges of one code make exactly one key", async () => {
    for (let round = 0; round < 5; round++) {
      await dbs[0].delete(integrationKeys);
      const { id, code, verifier } = await approvedRequest(siteA);
      const results = await Promise.all([1, 2, 3].map((i) => on(i, () => exchangeHandshakeCode({ request: id, code, verifier }))));
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const keys = await dbs[0].select().from(integrationKeys).where(eq(integrationKeys.websiteId, siteA));
      expect(keys).toHaveLength(1);
    }
  });

  it("a double-clicked approval makes one code", async () => {
    const started = await startHandshake(startInput(), null, CALLER);
    if (!started.ok) throw new Error(started.error);
    await loadForViewer(started.id, viewer);
    const results = await Promise.all(
      [1, 2, 3].map((i) => on(i, () => approveHandshake({ id: started.id, websiteId: siteA, ...viewer }))),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it("requests arriving together cannot overrun the limit on open requests", async () => {
    // One short of the limit, every one with a live code: only the newcomers can give way to each other.
    await dbs[0].execute(sql.raw(`
      insert into plugin_connect_requests (id, origin, site_host, site_url, return_url, plugin_state, code_challenge, caller_hash, expires_at, approved_at, code_hash, code_expires_at)
      select 'filler' || g, 'wordpress', 'h' || g || '.example', 'https://h' || g || '.example/', 'https://h' || g || '.example/wp-admin/admin.php?page=repget',
             repeat('s', 20), repeat('c', 43), 'caller' || g, localtimestamp + interval '10 minutes', localtimestamp, 'x', localtimestamp + interval '4 minutes'
      from generate_series(1, ${MAX_OPEN_TOTAL - 1}) g`));
    const results = await Promise.all(
      ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"].map((caller, i) => on(i, () => startHandshake(startInput(), null, caller))),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(4);
    const [open] = await dbs[0]
      .select({ n: sql<number>`count(*)::int` })
      .from(pluginConnectRequests)
      .where(sql`${pluginConnectRequests.consumedAt} is null and ${pluginConnectRequests.expiresAt} > localtimestamp`);
    expect(open.n).toBe(MAX_OPEN_TOTAL);
  });

  it("a request approved while start is making room is not dropped", async () => {
    await dbs[0].execute(sql.raw(`
      insert into plugin_connect_requests (id, origin, site_host, site_url, return_url, plugin_state, code_challenge, caller_hash, created_at, expires_at)
      select 'filler' || g, 'wordpress', 'h' || g || '.example', 'https://h' || g || '.example/', 'https://h' || g || '.example/wp-admin/admin.php?page=repget',
             repeat('s', 20), repeat('c', 43), 'caller' || g, localtimestamp - make_interval(secs => ${MAX_OPEN_TOTAL} - g), localtimestamp + interval '10 minutes'
      from generate_series(1, ${MAX_OPEN_TOTAL}) g`));
    let chosen: string[] = [];
    handshakeTestHooks.afterRoomChosen = async (ids) => {
      chosen = ids;
      // Meanwhile, on another connection, an editor approves the oldest one.
      await dbs[1].execute(sql.raw(`
        update plugin_connect_requests
        set approved_at = localtimestamp, code_hash = 'x', code_expires_at = localtimestamp + interval '5 minutes'
        where id = '${ids[0]}'`));
    };
    try {
      await on(0, () => startHandshake(startInput(), null, CALLER));
    } finally {
      handshakeTestHooks.afterRoomChosen = undefined;
    }
    expect(chosen).toEqual(["filler1"]);
    const [kept] = await dbs[0].select({ id: pluginConnectRequests.id }).from(pluginConnectRequests).where(eq(pluginConnectRequests.id, "filler1"));
    expect(kept?.id).toBe("filler1");
  });

  it("the same caller's requests arriving together cannot overrun its limit", async () => {
    for (let i = 0; i < 28; i++) await startHandshake(startInput(), null, CALLER);
    const results = await Promise.all([0, 1, 2, 3].map((i) => on(i, () => startHandshake(startInput(), null, CALLER))));
    expect(results.filter((result) => result.ok)).toHaveLength(2);
  });

  it("two first checks of a moved site's new key retire the old key once", async () => {
    const old = await createIntegrationKey(siteA);
    const { id, code, verifier } = await approvedRequest(siteB, old.key);
    const exchanged = await exchangeHandshakeCode({ request: id, code, verifier });
    if (!exchanged.ok) throw new Error(exchanged.error);
    const [issued] = await dbs[0]
      .select({ id: pluginConnectRequests.issuedKeyId })
      .from(pluginConnectRequests)
      .where(eq(pluginConnectRequests.id, id));
    const results = await Promise.all([1, 2, 3].map((i) => on(i, () => retirePresentedKey(issued.id!))));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)).toMatchObject({ keyId: old.id, websiteId: siteA, organizationId: "org_pg_a", movedToOrganizationId: "org_pg_b" });
    const [oldKey] = await dbs[0].select().from(integrationKeys).where(eq(integrationKeys.id, old.id));
    expect(oldKey.revokedAt).not.toBeNull();
  });
});
