import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Connect WordPress": a key made at the moment of the click, tidied up when
 * unused, the account named to WordPress, a revoked key told to WordPress at
 * once, and the same domain in two workspaces made visible.
 *
 * WHY. On 2026-09-29 a client's WordPress said "Connected" while holding a
 * key from a second RepGet account for the same domain; RepGet said "Never
 * used" for a key made when the setup screen opened and never seen again.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  after: [] as Array<() => unknown>,
  signalled: [] as Array<{ keyHash: string; syncUrl: string }>,
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  // Work scheduled after the response runs when the test says so.
  after: (task: () => unknown) => void state.after.push(task),
}));
vi.mock("@/lib/plugin/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plugin/sync")>()),
  nudgePluginIfDue: vi.fn(async () => "nothing-due"),
  signalRevokedKey: vi.fn(async (endpoint: { keyHash: string; syncUrl: string }) => {
    state.signalled.push(endpoint);
    return "synced";
  }),
}));

import { POST as verify } from "@/app/api/plugin/verify/route";
import { integrationKeys, member, organization, user, websiteMembers, websites } from "@/lib/db/schema";
import { sameSiteDomain } from "@/lib/websites/ownership";

import { connectWordPress, generateIntegrationKey, revokeKey } from "./actions";
import { pluginConnectionContext } from "./connection";
import {
  CONNECT_KEY_GRACE_MS,
  CONNECT_KEY_LABEL,
  createIntegrationKey,
  keyLabel,
  listIntegrationKeys,
  MANUAL_KEY_LABEL,
  MAX_PENDING_CONNECT_KEYS,
  mintConnectKey,
  revokeLeftoverKeys,
} from "./keys";

let test: TestDb;
let siteId: string;
const OWNER_ORG = "org_connect_owner";
const OTHER_ORG = "org_connect_other";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.after = [];
  state.signalled = [];
  await test.client.exec(`
    delete from integration_keys; delete from website_members; delete from websites;
    delete from "member"; delete from "user"; delete from organization;
  `);
  const now = new Date();
  await test.db.insert(organization).values([
    { id: OWNER_ORG, name: "Photo Booth Studio", slug: "owner", createdAt: now },
    { id: OTHER_ORG, name: "Test Account", slug: "other", createdAt: now },
  ]);
  await test.db.insert(user).values([
    { id: "u_owner", name: "O", email: "o@example.test", createdAt: now, updatedAt: now },
    { id: "u_viewer", name: "V", email: "v@example.test", createdAt: now, updatedAt: now },
    { id: "u_stranger", name: "S", email: "s@example.test", createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m1", organizationId: OWNER_ORG, userId: "u_owner", role: "owner", createdAt: now },
    { id: "m2", organizationId: OTHER_ORG, userId: "u_viewer", role: "owner", createdAt: now },
    { id: "m3", organizationId: OTHER_ORG, userId: "u_stranger", role: "owner", createdAt: now },
  ]);
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: OWNER_ORG, url: "https://imagestudio.test", domain: "imagestudio.test", brandName: "Image Studio" })
    .returning({ id: websites.id });
  siteId = site.id;
  await test.db.insert(websiteMembers).values({ websiteId: siteId, userId: "u_viewer", role: "viewer" });
  as("u_owner", OWNER_ORG);
});

function as(userId: string, activeOrganizationId: string) {
  state.session = { user: { id: userId }, session: { id: `s_${userId}`, activeOrganizationId } };
}

async function live() {
  const rows = await test.db.select().from(integrationKeys).where(eq(integrationKeys.websiteId, siteId));
  return rows.filter((row) => !row.revokedAt);
}

/** Makes a key this much older, on the database's clock (the one that stamps created_at). */
async function age(keyId: string, ms: number) {
  await test.db
    .update(integrationKeys)
    .set({ createdAt: sql`localtimestamp - make_interval(secs => ${ms / 1000})` })
    .where(eq(integrationKeys.id, keyId));
}

/** Marks a key used this long ago, on the database's clock (what the tidy-up compares with). */
async function usedAgo(keyId: string, ms: number, syncUrl?: string) {
  await test.db
    .update(integrationKeys)
    .set({ lastUsedAt: sql`localtimestamp - make_interval(secs => ${ms / 1000})`, ...(syncUrl ? { syncUrl } : {}) })
    .where(eq(integrationKeys.id, keyId));
}

async function runAfter() {
  const tasks = state.after;
  state.after = [];
  for (const task of tasks) await task();
}

describe("Connect WordPress", () => {
  it("makes a key at the moment of the click, for editors only", async () => {
    const result = await connectWordPress(siteId);
    expect(result).toMatchObject({ ok: true });
    const key = (result as { ok: true; data: { key: string; keyPrefix: string } }).data;
    expect(key.key.startsWith("seo_")).toBe(true);
    const rows = await live();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: CONNECT_KEY_LABEL, lastUsedAt: null });
    expect(rows[0].keyHash).toBe(createHash("sha256").update(key.key).digest("hex"));

    as("u_viewer", OTHER_ORG);
    expect(await connectWordPress(siteId)).toMatchObject({ ok: false });
    as("u_stranger", OTHER_ORG);
    await expect(connectWordPress(siteId)).rejects.toThrow();
    expect(await live()).toHaveLength(1);
  });

  it("never revokes a key an open WordPress tab may still save; refuses a press beyond the pending cap instead", async () => {
    for (let i = 0; i < MAX_PENDING_CONNECT_KEYS; i++) expect(await connectWordPress(siteId)).toMatchObject({ ok: true });
    const pending = await live();
    expect(pending).toHaveLength(MAX_PENDING_CONNECT_KEYS);

    // Another press: refused, and every waiting key still works.
    expect(await mintConnectKey(siteId)).toEqual({ ok: false, reason: "too_many_pending" });
    expect(await connectWordPress(siteId)).toMatchObject({ ok: false, error: expect.stringMatching(/already waiting/) });
    expect((await live()).map((row) => row.id).sort()).toEqual(pending.map((row) => row.id).sort());

    // Past the grace period: the next press retires all of them and makes one new key.
    for (const row of pending) await age(row.id, CONNECT_KEY_GRACE_MS + 60_000);
    expect(await connectWordPress(siteId)).toMatchObject({ ok: true });
    const rows = await live();
    expect(rows).toHaveLength(1);
    expect(pending.map((row) => row.id)).not.toContain(rows[0].id);
  });

  it("retires only the button's keys past the grace period, counting the rest toward the cap", async () => {
    const old = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(old.id, CONNECT_KEY_GRACE_MS + 60_000);
    const fresh = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(fresh.id, 60_000);
    for (let i = 0; i < 3; i++) {
      const { id } = await createIntegrationKey(siteId, `Install ${i}`);
      await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, id));
    }
    // 5 live; retiring the old one makes room for exactly one more.
    expect(await mintConnectKey(siteId)).toMatchObject({ ok: true });
    const ids = (await live()).map((row) => row.id);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain(old.id);
    expect(ids).toContain(fresh.id);
    expect(await mintConnectKey(siteId)).toEqual({ ok: false, reason: "too_many_keys" });
  });

  it("never retires a key that connected, or one a person named", async () => {
    const used = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, used.id));
    const named = await createIntegrationKey(siteId, "Staging site");
    await age(used.id, CONNECT_KEY_GRACE_MS * 3);
    await age(named.id, CONNECT_KEY_GRACE_MS * 3);

    await connectWordPress(siteId);
    await connectWordPress(siteId);
    await connectWordPress(siteId);
    const ids = (await live()).map((row) => row.id);
    expect(ids).toContain(used.id);
    expect(ids).toContain(named.id);
  });

  it("refuses beyond five live keys instead of revoking one that works", async () => {
    for (let i = 0; i < 5; i++) {
      const { id } = await createIntegrationKey(siteId, `Install ${i}`);
      await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, id));
    }
    expect(await mintConnectKey(siteId)).toEqual({ ok: false, reason: "too_many_keys" });
    expect(await connectWordPress(siteId)).toMatchObject({ ok: false });
    expect(await live()).toHaveLength(5);
  });
});

describe("once WordPress connects", () => {
  it("revokes abandoned keys past the grace period - never a young one, a used one, a named one or a hand-made one", async () => {
    const legacy = await createIntegrationKey(siteId, null); // made when the setup screen opened, never seen
    const staging = await createIntegrationKey(siteId, "Staging site");
    const byHand = await createIntegrationKey(siteId, MANUAL_KEY_LABEL);
    const olderPress = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    const used = await createIntegrationKey(siteId, null);
    await usedAgo(used.id, 60_000);
    const openTab = await createIntegrationKey(siteId, CONNECT_KEY_LABEL); // inside the grace period
    const ages: Array<[string, number]> = [
      [legacy.id, 90], [staging.id, 80], [byHand.id, 70], [olderPress.id, 60], [used.id, 50], [openTab.id, 10],
    ];
    for (const [id, minutes] of ages) await age(id, minutes * 60_000);
    const connecting = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(connecting.id, 5 * 60_000);
    const newer = await createIntegrationKey(siteId, CONNECT_KEY_LABEL); // another tab, about to be used

    // Another website's abandoned key is never touched.
    const [elsewhere] = await test.db
      .insert(websites)
      .values({ organizationId: OWNER_ORG, url: "https://other.test", domain: "other.test" })
      .returning({ id: websites.id });
    const foreign = await createIntegrationKey(elsewhere.id, null);
    await age(foreign.id, 2 * 60 * 60_000);

    expect(await revokeLeftoverKeys(siteId, connecting.id)).toBe(2);
    const ids = (await live()).map((row) => row.id).sort();
    expect(ids).toEqual([staging.id, byHand.id, used.id, openTab.id, connecting.id, newer.id].sort());
    const [foreignRow] = await test.db.select().from(integrationKeys).where(eq(integrationKeys.id, foreign.id));
    expect(foreignRow.revokedAt).toBeNull();
  });

  it("also tidies an abandoned press made AFTER the connected key, once past the grace period", async () => {
    const connected = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(connected.id, 3 * 60 * 60_000);
    await usedAgo(connected.id, 60_000);
    const laterPress = await createIntegrationKey(siteId, CONNECT_KEY_LABEL); // tab closed without saving
    await age(laterPress.id, 60 * 60_000);
    expect(await revokeLeftoverKeys(siteId, connected.id)).toBe(1);
    expect((await live()).map((row) => row.id)).toEqual([connected.id]);
  });

  it("does nothing when the key that connected has been revoked meanwhile", async () => {
    const legacy = await createIntegrationKey(siteId, null);
    await age(legacy.id, 2 * 60 * 60_000);
    const connecting = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await test.db.update(integrationKeys).set({ revokedAt: new Date() }).where(eq(integrationKeys.id, connecting.id));
    expect(await revokeLeftoverKeys(siteId, connecting.id)).toBe(0);
    expect((await live()).map((row) => row.id)).toEqual([legacy.id]);
  });

  it("never retires a used key when WordPress connects - a staging copy on the same address must not cut the live site off", async () => {
    const sync = "https://imagestudio.test/wp-admin/admin-ajax.php";
    const production = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(production.id, 3 * 60 * 60_000);
    await usedAgo(production.id, 10 * 60_000, sync);
    const stagingCopy = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await usedAgo(stagingCopy.id, 0, sync);
    expect(await revokeLeftoverKeys(siteId, stagingCopy.id)).toBe(0);
    expect((await live()).map((row) => row.id).sort()).toEqual([production.id, stagingCopy.id].sort());
  });

  it("retires a key REPLACED in its install - silent for a day while a newer key from the same address calls - so keys never pile up", async () => {
    const sync = "https://imagestudio.test/wp-admin/admin-ajax.php";
    const replaced = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(replaced.id, 3 * 24 * 60 * 60_000);
    await usedAgo(replaced.id, 2 * 24 * 60 * 60_000, sync); // stopped calling two days ago
    const stillCalling = await createIntegrationKey(siteId, null); // e.g. a staging copy on the same address
    await age(stillCalling.id, 2 * 24 * 60 * 60_000);
    await usedAgo(stillCalling.id, 30 * 60_000, sync);
    const handMade = await createIntegrationKey(siteId, MANUAL_KEY_LABEL);
    await age(handMade.id, 3 * 24 * 60 * 60_000);
    await usedAgo(handMade.id, 2 * 24 * 60 * 60_000, sync);
    const current = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(current.id, 24 * 60 * 60_000);
    await usedAgo(current.id, 60_000, sync);

    // The next press tidies up first: only the silent, replaced button key goes.
    expect(await mintConnectKey(siteId)).toMatchObject({ ok: true });
    const ids = (await live()).map((row) => row.id);
    expect(ids).not.toContain(replaced.id);
    expect(ids).toContain(stillCalling.id);
    expect(ids).toContain(handMade.id);
    expect(ids).toContain(current.id);
  });

  it("the verify call names the RepGet account to plugin 1.6, and tidies up after connecting", async () => {
    const legacy = await createIntegrationKey(siteId, null);
    await age(legacy.id, 60 * 60_000);
    const { key, id } = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);

    const call = (pluginVersion: string) =>
      verify(
        new NextRequest("https://app.test/api/plugin/verify", {
          method: "POST",
          headers: { "x-integration-key": key, "content-type": "application/json" },
          body: JSON.stringify({ siteUrl: "https://imagestudio.test", wpVersion: "6.8", pluginVersion }),
        }),
      );

    const old = await (await call("1.6.0")).json();
    expect(old.website).toMatchObject({
      id: siteId,
      domain: "imagestudio.test",
      name: "Image Studio (imagestudio.test), RepGet account “Photo Booth Studio”",
    });
    expect(old.workspace).toEqual({ name: "Photo Booth Studio" });

    const next = await (await call("1.7.0")).json();
    expect(next.website.name).toBe("Image Studio");
    expect(next.workspace).toEqual({ name: "Photo Booth Studio" });
    expect((await (await call("1.10.2")).json()).website.name).toBe("Image Studio");
    for (const legacyVersion of ["1.6.9", "0.9", "", "garbage"]) {
      expect((await (await call(legacyVersion)).json()).website.name).toContain("RepGet account");
    }

    // A long brand is shortened - never the account name, which is the point.
    await test.db.update(websites).set({ brandName: "Studio ".repeat(30) }).where(eq(websites.id, siteId));
    const long = (await (await call("1.6.0")).json()).website.name as string;
    expect(long.endsWith(", RepGet account \u201cPhoto Booth Studio\u201d")).toBe(true);
    expect(long).toContain("\u2026");

    await runAfter();
    const ids = (await live()).map((row) => row.id);
    expect(ids).toContain(id);
    expect(ids).not.toContain(legacy.id);

    // The address WordPress reports is recorded (only on the website's own domain).
    await verify(
      new NextRequest("https://app.test/api/plugin/verify", {
        method: "POST",
        headers: { "x-integration-key": key, "content-type": "application/json" },
        body: JSON.stringify({ pluginVersion: "1.6.0", syncUrl: "https://evil.test/wp-admin/admin-ajax.php" }),
      }),
    );
    const [rejected] = await test.db.select().from(integrationKeys).where(eq(integrationKeys.id, id));
    expect(rejected.syncUrl).toBeNull();
    await verify(
      new NextRequest("https://app.test/api/plugin/verify", {
        method: "POST",
        headers: { "x-integration-key": key, "content-type": "application/json" },
        body: JSON.stringify({ pluginVersion: "1.6.0", syncUrl: "https://www.imagestudio.test/wp-admin/admin-ajax.php" }),
      }),
    );
    const [recorded] = await test.db.select().from(integrationKeys).where(eq(integrationKeys.id, id));
    expect(recorded.syncUrl).toBe("https://www.imagestudio.test/wp-admin/admin-ajax.php");
  });
});

describe("revoking a key", () => {
  it("tells the WordPress site holding it at once", async () => {
    const { id, key } = await createIntegrationKey(siteId, null);
    await test.db
      .update(integrationKeys)
      .set({ lastUsedAt: new Date(), syncUrl: "https://imagestudio.test/wp-admin/admin-ajax.php" })
      .where(eq(integrationKeys.id, id));

    expect(await revokeKey(siteId, id)).toMatchObject({ ok: true });
    await runAfter();
    expect(state.signalled).toEqual([
      {
        keyHash: createHash("sha256").update(key).digest("hex"),
        syncUrl: "https://imagestudio.test/wp-admin/admin-ajax.php",
      },
    ]);
  });

  it("tells WordPress once: revoking an already-revoked key sends nothing", async () => {
    const { id } = await createIntegrationKey(siteId, null);
    await test.db
      .update(integrationKeys)
      .set({ lastUsedAt: new Date(), syncUrl: "https://imagestudio.test/wp-admin/admin-ajax.php" })
      .where(eq(integrationKeys.id, id));
    await revokeKey(siteId, id);
    await revokeKey(siteId, id);
    await runAfter();
    expect(state.signalled).toHaveLength(1);
  });

  it("does nothing more for a key WordPress never reported an address for", async () => {
    const { id } = await createIntegrationKey(siteId, null);
    await revokeKey(siteId, id);
    await runAfter();
    expect(state.signalled).toEqual([]);
  });
});

describe("which keys the card waits for (pending, decided on the database clock)", () => {
  it("a fresh button key is pending; not once a newer key connects, not past the grace period, never a hand-made key", async () => {
    const oldInstall = await createIntegrationKey(siteId, null);
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, oldInstall.id));
    await age(oldInstall.id, 3 * 60 * 60_000); // an install connected long ago, still checking in
    const first = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(first.id, 10 * 60_000);
    const byHand = await createIntegrationKey(siteId, MANUAL_KEY_LABEL);
    const stale = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(stale.id, CONNECT_KEY_GRACE_MS + 60_000);

    const pendingOf = async () =>
      Object.fromEntries((await listIntegrationKeys(siteId)).map((row) => [row.id, row.pending]));
    // The old install checking in does not end a newer key's wait.
    expect(await pendingOf()).toMatchObject({ [oldInstall.id]: false, [first.id]: true, [byHand.id]: false, [stale.id]: false });

    // A second press connects: the first is superseded.
    const second = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    expect((await pendingOf())[second.id]).toBe(true);
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, second.id));
    expect(await pendingOf()).toMatchObject({ [first.id]: false, [second.id]: false });
  });
});

describe("keys made by hand", () => {
  it("are marked as hand-made, so they are never tidied up; a person cannot type a reserved label", async () => {
    expect(keyLabel("")).toBe(MANUAL_KEY_LABEL);
    expect(keyLabel("  ")).toBe(MANUAL_KEY_LABEL);
    expect(keyLabel(CONNECT_KEY_LABEL)).toBe(MANUAL_KEY_LABEL);
    expect(keyLabel(" Staging ")).toBe("Staging");

    expect(await generateIntegrationKey(siteId, "")).toMatchObject({ ok: true });
    const [row] = await live();
    expect(row.label).toBe(MANUAL_KEY_LABEL);
  });

  it("New key follows the button's rules: expired button keys are tidied first, then the five-key cap", async () => {
    const expired = await createIntegrationKey(siteId, CONNECT_KEY_LABEL);
    await age(expired.id, CONNECT_KEY_GRACE_MS + 60_000);
    for (let i = 0; i < 4; i++) {
      const { id } = await createIntegrationKey(siteId, `Install ${i}`);
      await usedAgo(id, 60_000);
    }
    // Five live, one of them an expired button key: tidied, so New key fits.
    expect(await generateIntegrationKey(siteId, "Another install")).toMatchObject({ ok: true });
    expect((await live()).map((r) => r.id)).not.toContain(expired.id);
    expect(await generateIntegrationKey(siteId, "One too many")).toMatchObject({ ok: false, error: expect.stringMatching(/five keys|5 keys/) });
  });
});

describe("the same domain in two workspaces", () => {
  it("names the person's other workspaces that have it - never someone else's", async () => {
    const now = new Date();
    await test.db.insert(organization).values({ id: "org_mine_too", name: "My Test Account", slug: "mine-too", createdAt: now });
    await test.db.insert(member).values({ id: "m4", organizationId: "org_mine_too", userId: "u_owner", role: "owner", createdAt: now });
    await test.db.insert(websites).values([
      // The same site typed with www, in another of the owner's workspaces.
      { organizationId: "org_mine_too", url: "https://www.imagestudio.test", domain: "www.imagestudio.test" },
      // The same domain in a stranger's workspace: never mentioned.
      { organizationId: OTHER_ORG, url: "https://imagestudio.test", domain: "imagestudio.test" },
      // A subdomain is a different site.
      { organizationId: "org_mine_too", url: "https://blog.imagestudio.test", domain: "blog.imagestudio.test" },
    ]);

    expect(await pluginConnectionContext(siteId, "u_owner")).toEqual({
      domain: "imagestudio.test",
      workspaceName: "Photo Booth Studio",
      alsoIn: ["My Test Account"],
    });
    // A second sign-up often has the SAME workspace name: still listed, by workspace, not by name.
    await test.db.insert(organization).values({ id: "org_same_name", name: "Photo Booth Studio", slug: "same-name", createdAt: now });
    await test.db.insert(member).values({ id: "m5", organizationId: "org_same_name", userId: "u_owner", role: "owner", createdAt: now });
    await test.db.insert(websites).values({ organizationId: "org_same_name", url: "https://imagestudio.test", domain: "imagestudio.test" });
    expect((await pluginConnectionContext(siteId, "u_owner"))?.alsoIn).toEqual(["My Test Account", "Photo Booth Studio"]);

    // The invited viewer belongs to "Test Account" (which has the domain) but not to the owner's other workspace.
    expect((await pluginConnectionContext(siteId, "u_viewer"))?.alsoIn).toEqual(["Test Account"]);
  });

  it("compares domains as sites: www and case do not matter, subdomains do", () => {
    expect(sameSiteDomain("imagestudio.com", "WWW.ImageStudio.com")).toBe(true);
    expect(sameSiteDomain("https://imagestudio.com/", "imagestudio.com")).toBe(true);
    expect(sameSiteDomain("blog.imagestudio.com", "imagestudio.com")).toBe(false);
    expect(sameSiteDomain("", "")).toBe(false);
  });
});
