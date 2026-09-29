import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * First-time WordPress setup: a key ready on arrival, exactly once, only for
 * an editor, and never again after the customer revokes their keys.
 * Through the real server actions, with a real session check.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Revoking tells WordPress after the response (lib/plugin/actions.ts): not needed here.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

import { integrationKeys, member, organization, user, websiteMembers, websites } from "@/lib/db/schema";

import { replaceUnusedIntegrationKey, revokeKey, startWordPressSetup } from "./actions";
import { hasEverHadKey, provisionFirstKey } from "./keys";

let test: TestDb;
let siteId: string;
const OWNER_ORG = "org_setup_owner";
const OTHER_ORG = "org_setup_other";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from integration_keys; delete from website_members; delete from websites;
    delete from "member"; delete from "user"; delete from organization;
  `);
  const now = new Date();
  await test.db.insert(organization).values([
    { id: OWNER_ORG, name: "Owner", slug: "owner", createdAt: now },
    { id: OTHER_ORG, name: "Other", slug: "other", createdAt: now },
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
    .values({ organizationId: OWNER_ORG, url: "https://studio.test", domain: "studio.test" })
    .returning({ id: websites.id });
  siteId = site.id;
  await test.db.insert(websiteMembers).values({ websiteId: siteId, userId: "u_viewer", role: "viewer" });
  as("u_owner", OWNER_ORG);
});

function as(userId: string, activeOrganizationId: string) {
  state.session = { user: { id: userId }, session: { id: `s_${userId}`, activeOrganizationId } };
}

async function keyRows() {
  return test.db.select().from(integrationKeys).where(eq(integrationKeys.websiteId, siteId));
}

describe("first entry into WordPress setup", () => {
  it("prepares one key, returns it once, and stores only its hash", async () => {
    const result = await startWordPressSetup(siteId);
    expect(result).toMatchObject({ ok: true, data: { state: "created" } });
    const key = (result as { data: { key: string } }).data.key;
    expect(key).toMatch(/^seo_[A-Za-z0-9_-]{43}$/);

    const rows = await keyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(createHash("sha256").update(key).digest("hex"));
    // The plaintext is in no column.
    expect(JSON.stringify(rows)).not.toContain(key);
    expect(rows[0].keyPrefix).toBe(key.slice(0, 12));
  });

  it("repeated, retried and concurrent entries create exactly one key", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => startWordPressSetup(siteId)));
    const states = results.map((r) => (r.ok ? r.data.state : "error"));
    expect(states.filter((s) => s === "created")).toHaveLength(1);
    expect(states.filter((s) => s === "exists")).toHaveLength(7);
    expect(await keyRows()).toHaveLength(1);
    // A later visit (refresh, second tab) finds it and creates nothing.
    expect(await startWordPressSetup(siteId)).toMatchObject({ ok: true, data: { state: "exists", connected: false } });
    expect(await keyRows()).toHaveLength(1);
  });

  it("an existing key is shown masked, never rotated, and its plaintext is not recoverable", async () => {
    await startWordPressSetup(siteId);
    const [before] = await keyRows();
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, before.id));

    const again = await startWordPressSetup(siteId);
    expect(again).toEqual({ ok: true, data: { state: "exists", keyPrefix: before.keyPrefix, connected: true } });
    const [after] = await keyRows();
    expect(after.keyHash).toBe(before.keyHash);
    expect(after.revokedAt).toBeNull();
  });

  it("after the customer revokes their keys, nothing is created again automatically", async () => {
    await startWordPressSetup(siteId);
    const [row] = await keyRows();
    await revokeKey(siteId, row.id);

    expect(await startWordPressSetup(siteId)).toEqual({ ok: true, data: { state: "revoked" } });
    expect(await startWordPressSetup(siteId)).toEqual({ ok: true, data: { state: "revoked" } });
    expect((await keyRows()).filter((k) => !k.revokedAt)).toHaveLength(0);
    expect(await hasEverHadKey(siteId)).toBe(true);
  });
});

describe("a lost creation response", () => {
  it("is recovered by replacing the unused key: one new key, shown once, the old one revoked", async () => {
    await startWordPressSetup(siteId); // the response that never arrived
    const [lost] = await keyRows();

    const replaced = await replaceUnusedIntegrationKey(siteId, lost.id);
    expect(replaced).toMatchObject({ ok: true });
    const rows = await keyRows();
    expect(rows).toHaveLength(2);
    expect(rows.find((k) => k.id === lost.id)?.revokedAt).not.toBeNull();
    expect(rows.filter((k) => !k.revokedAt)).toHaveLength(1);
  });

  it("never replaces a key WordPress is connected with", async () => {
    await startWordPressSetup(siteId);
    const [connected] = await keyRows();
    await test.db.update(integrationKeys).set({ lastUsedAt: new Date() }).where(eq(integrationKeys.id, connected.id));

    expect(await replaceUnusedIntegrationKey(siteId, connected.id)).toMatchObject({ ok: false, error: /connected/ });
    const rows = await keyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeNull();
  });
});

describe("who may set up", () => {
  it("a viewer on the website gets an error and no key", async () => {
    as("u_viewer", OTHER_ORG);
    expect(await startWordPressSetup(siteId)).toMatchObject({ ok: false });
    expect(await keyRows()).toHaveLength(0);
  });

  it("someone with no access to the website gets nothing", async () => {
    as("u_stranger", OTHER_ORG);
    await expect(startWordPressSetup(siteId)).rejects.toThrow();
    expect(await keyRows()).toHaveLength(0);
  });

  it("nobody signed in gets nothing", async () => {
    state.session = null;
    await expect(startWordPressSetup(siteId)).rejects.toThrow();
    expect(await keyRows()).toHaveLength(0);
  });

  it("a key id from another website is never replaced", async () => {
    const [other] = await test.db
      .insert(websites)
      .values({ organizationId: OTHER_ORG, url: "https://other.test", domain: "other.test" })
      .returning({ id: websites.id });
    const outcome = await provisionFirstKey(other.id);
    expect(outcome.kind).toBe("created");
    const foreignId = (outcome as { id: string }).id;
    expect(await replaceUnusedIntegrationKey(siteId, foreignId)).toMatchObject({ ok: false, error: "Key not found" });
  });
});
