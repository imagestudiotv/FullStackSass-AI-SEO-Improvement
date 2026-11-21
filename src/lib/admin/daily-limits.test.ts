import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, creditSettings, organization, websites } from "@/lib/db/schema";
import { dailyCapFor, dailyLimitKey } from "@/lib/publishing/daily-cap";
import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => ({ email: "ops@repget.test" })) }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { setArticlesPerDay } from "./daily-limits";

const IMAGESTUDIO = "4aec4382-f158-4deb-b7a3-b4968aac6b41";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id: orgId, name: "Agency", slug: orgId, createdAt: new Date() });
  await test.db.insert(websites).values({ id: IMAGESTUDIO, organizationId: orgId, url: "https://imagestudio.com", domain: "imagestudio.com", status: "ready" });
});
beforeEach(async () => {
  await test.db.delete(creditSettings);
  await test.db.delete(adminAuditLog);
  guard.requireAdmin.mockClear();
});

describe("setArticlesPerDay (Admin -> Websites)", () => {
  it("saves a limit the scheduler reads, and records it in the admin log", async () => {
    expect(await setArticlesPerDay(IMAGESTUDIO, 3)).toEqual({ ok: true, data: { perDay: 3 } });
    expect(await dailyCapFor(IMAGESTUDIO)).toBe(3);
    const [log] = await test.db.select().from(adminAuditLog);
    expect(log).toMatchObject({ actorEmail: "ops@repget.test", action: "website.articles_per_day_changed", targetId: IMAGESTUDIO, summary: "Articles per day for imagestudio.com: 1 a day -> 3 a day" });
  });

  it("removes the limit, even the one in force by default", async () => {
    expect(await setArticlesPerDay(IMAGESTUDIO, null)).toEqual({ ok: true, data: { perDay: null } });
    expect(await dailyCapFor(IMAGESTUDIO)).toBeNull();
    const [row] = await test.db.select().from(creditSettings).where(eq(creditSettings.key, dailyLimitKey(IMAGESTUDIO)));
    expect(row?.value).toBe(0);
  });

  it("refuses anything but a whole number from 1 to 100, and saves nothing", async () => {
    for (const bad of [0, -1, 101, 1.5, Number.NaN]) {
      expect(await setArticlesPerDay(IMAGESTUDIO, bad)).toMatchObject({ ok: false });
    }
    expect(await test.db.select().from(creditSettings)).toHaveLength(0);
    expect(await dailyCapFor(IMAGESTUDIO)).toBe(1);
  });

  it("refuses a website that does not exist", async () => {
    expect(await setArticlesPerDay(randomUUID(), 2)).toEqual({ ok: false, error: "This website no longer exists." });
  });

  it("is for administrators only", async () => {
    guard.requireAdmin.mockRejectedValueOnce(new Error("not an admin"));
    await expect(setArticlesPerDay(IMAGESTUDIO, 5)).rejects.toThrow("not an admin");
    expect(await test.db.select().from(creditSettings)).toHaveLength(0);
  });
});
