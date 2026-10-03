import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { member, organization, payments, plans, subscriptions, user, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The admin Users and Websites lists when a workspace pays for several sites.
 *
 * Billing is per website, so such a workspace holds one subscription row per
 * site. Both lists used to JOIN subscriptions by workspace, which repeated each
 * person (and each site) once per subscription: duplicate rows on screen, a
 * page that held fewer than 25 entries, and pages that skipped or repeated
 * people because the pager counted people but limited rows. Found in the admin
 * preview (React duplicate-key warnings on /admin/users).
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { listUsers, listWebsites } from "@/lib/admin/actions";
import { getAttention, parseActivityRange } from "@/lib/admin/dashboard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/shared";

const ADMIN = "admin@lists.test";
let test: TestDb;
const tag = randomUUID().slice(0, 6);

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
  test = await createTestDb();
  state.db = test.db;
}, 180_000);

async function plan(tier: string, name: string) {
  const [row] = await test.db
    .insert(plans)
    .values({ name, tier: `${tier}-${tag}`, priceCents: 1000, articleLimit: 10, keywordLimit: 10, siteLimit: 1, monthlyCredits: 0 })
    .returning({ id: plans.id });
  return row!.id;
}

/** A workspace holding `sites` websites, each with its own subscription. */
async function workspace(name: string, people: string[], sites: { status: string; planId: string; createdAt: Date }[]) {
  const orgId = `org_${name}_${tag}`;
  const now = new Date();
  await test.db.insert(organization).values({ id: orgId, name: `${name} ${tag}`, slug: orgId, createdAt: now });
  for (const [i, person] of people.entries()) {
    const userId = `usr_${person}_${tag}`;
    await test.db
      .insert(user)
      .values({ id: userId, name: `${person} ${tag}`, email: `${person}.${tag}@example.test`, emailVerified: true, createdAt: new Date(now.getTime() - i * 1000), updatedAt: now });
    await test.db.insert(member).values({ id: `m_${userId}_${orgId}`, organizationId: orgId, userId, role: i === 0 ? "owner" : "member", createdAt: now });
  }
  const siteIds: string[] = [];
  for (const [i, s] of sites.entries()) {
    const [site] = await test.db
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${name}-${i}-${tag}.test`, domain: `${name}-${i}-${tag}.test`, status: "ready" })
      .returning({ id: websites.id });
    siteIds.push(site!.id);
    await test.db.insert(subscriptions).values({ organizationId: orgId, websiteId: site!.id, planId: s.planId, status: s.status, createdAt: s.createdAt });
  }
  return { orgId, siteIds };
}

describe("admin lists with several subscriptions per workspace", () => {
  it("list each person once, with one workspace entry, and the live plan", async () => {
    const grow = await plan("grow", "Grow");
    const old = await plan("old", "Old plan");
    const day = 86_400_000;
    const { orgId } = await workspace("multi", ["ana", "ben"], [
      { status: "canceled", planId: old, createdAt: new Date(Date.now() - 1 * day) },
      { status: "active", planId: grow, createdAt: new Date(Date.now() - 9 * day) },
      { status: "past_due", planId: old, createdAt: new Date(Date.now() - 3 * day) },
    ]);

    const page = await listUsers(tag);
    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.email).sort()).toEqual([`ana.${tag}@example.test`, `ben.${tag}@example.test`]);
    for (const row of page.rows) {
      expect(row.organizationId).toBe(orgId);
      // The workspace's plan: active first (even though older), then newest.
      expect(row.organizationStatus).toBe("active");
      expect(row.planName).toBe("Grow");
      expect(row.websites).toHaveLength(3);
    }
  });

  it("list each website once, showing the workspace's live plan", async () => {
    const grow = await plan("grow2", "Grow");
    const { siteIds } = await workspace("sites", ["cy"], [
      { status: "active", planId: grow, createdAt: new Date() },
      { status: "canceled", planId: grow, createdAt: new Date() },
    ]);
    const page = await listWebsites(`sites-`);
    const ours = page.rows.filter((row) => siteIds.includes(row.id));
    expect(ours.map((row) => row.id).sort()).toEqual([...siteIds].sort());
    expect(ours.every((row) => row.subscriptionStatus === "active")).toBe(true);
    expect(page.total).toBe(page.rows.length);
  });

  it("page by people, not by membership rows", async () => {
    // Someone in two workspaces is still one person on one page.
    const grow = await plan("grow3", "Grow");
    await workspace("first", ["dee"], [{ status: "active", planId: grow, createdAt: new Date() }]);
    const second = `org_second_${tag}`;
    await test.db.insert(organization).values({ id: second, name: `second ${tag}`, slug: second, createdAt: new Date() });
    await test.db.insert(member).values({ id: `m_dee_second_${tag}`, organizationId: second, userId: `usr_dee_${tag}`, role: "member", createdAt: new Date() });

    const page = await listUsers(`dee.${tag}`);
    expect(page.total).toBe(1);
    const ids = new Set(page.rows.map((row) => row.id));
    expect(ids.size).toBe(1);
    // One row per membership, each workspace once.
    expect(page.rows.map((row) => row.organizationId).sort()).toEqual([`org_first_${tag}`, second].sort());
  });

  it("search % and _ literally, not as wildcards", async () => {
    const grow = await plan("grow5", "Grow");
    await workspace("lit", ["under_score", "underxscore"], [{ status: "active", planId: grow, createdAt: new Date() }]);
    const page = await listUsers(`under_score.${tag}`);
    expect(page.rows.map((row) => row.email)).toEqual([`under_score.${tag}@example.test`]);
    expect((await listUsers(`%.${tag}`)).total).toBe(0);
  });

  it("fill every page with distinct people and leave nobody out", async () => {
    const grow = await plan("grow4", "Grow");
    const crowd = Array.from({ length: ADMIN_PAGE_SIZE + 1 }, (_, i) => `crowd${String(i).padStart(2, "0")}`);
    await workspace("crowd", crowd, [
      { status: "active", planId: grow, createdAt: new Date() },
      { status: "canceled", planId: grow, createdAt: new Date() },
    ]);
    const first = await listUsers(`crowd`, 1);
    const second = await listUsers(`crowd`, 2);
    expect(first.total).toBe(crowd.length);
    const people = (rows: { email: string }[]) => [...new Set(rows.map((row) => row.email))];
    expect(people(first.rows)).toHaveLength(ADMIN_PAGE_SIZE);
    expect(people(second.rows)).toHaveLength(1);
    expect(new Set([...people(first.rows), ...people(second.rows)]).size).toBe(crowd.length);
  });
});

describe("overview", () => {
  it("counts failed payments over the window its link opens, so the item can clear", async () => {
    const orgId = `org_pay_${tag}`;
    await test.db.insert(organization).values({ id: orgId, name: `pay ${tag}`, slug: orgId, createdAt: new Date() });
    const day = 86_400_000;
    await test.db.insert(payments).values([
      { organizationId: orgId, provider: "stripe", externalId: `old_${tag}`, amountCents: 900, currency: "eur", status: "failed", paidAt: new Date(Date.now() - 40 * day) },
      { organizationId: orgId, provider: "stripe", externalId: `new_${tag}`, amountCents: 900, currency: "eur", status: "failed", paidAt: new Date(Date.now() - 2 * day) },
      { organizationId: orgId, provider: "stripe", externalId: `ok_${tag}`, amountCents: 900, currency: "eur", status: "paid", paidAt: new Date() },
    ]);
    expect((await getAttention()).failedPayments).toBe(1);
  });

  it("accepts only its own range keys from the URL", () => {
    expect(parseActivityRange("7d")).toBe("7d");
    expect(parseActivityRange(["90d", "7d"])).toBe("90d");
    for (const value of ["constructor", "toString", "__proto__", "", undefined, "365d"]) {
      expect(parseActivityRange(value)).toBe("30d");
    }
  });
});
