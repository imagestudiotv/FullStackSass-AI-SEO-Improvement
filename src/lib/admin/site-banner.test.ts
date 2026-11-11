import { revalidatePath } from "next/cache";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, siteBanner } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/** Admin -> Site banner: the bar above the public site's header (client, 2026-11-11). */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => ({ email: "ops@repget.test" })) }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveSiteBanner } from "@/lib/admin/site-banner";
import { readLiveBanner } from "@/lib/promo-banner/read";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(siteBanner);
  await test.db.delete(adminAuditLog);
  guard.requireAdmin.mockClear();
  vi.mocked(revalidatePath).mockClear();
});

const inAWeek = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

describe("the site banner", () => {
  it("is not shown until an administrator saves one", async () => {
    expect(await readLiveBanner()).toBeNull();
  });

  it("is saved, recorded, shown on the public pages, and every page is rebuilt", async () => {
    const endsAt = inAWeek();
    const result = await saveSiteBanner({
      enabled: true,
      tone: "red",
      endsAt,
      copy: { en: { label: "BLACK FRIDAY", message: "Lifetime Premium 67% off" }, es: { message: "Premium de por vida -67%" } },
    });
    expect(result).toMatchObject({ ok: true, data: { enabled: true, tone: "red", updatedBy: "ops@repget.test" } });

    expect(await readLiveBanner()).toEqual({
      tone: "red",
      endsAt: new Date(endsAt).toISOString(),
      copy: expect.objectContaining({
        en: { label: "BLACK FRIDAY", message: "Lifetime Premium 67% off", linkText: "See pricing", lang: "en" },
        es: { label: "", message: "Premium de por vida -67%", linkText: "Ver precios", lang: "es" },
        fr: { label: "BLACK FRIDAY", message: "Lifetime Premium 67% off", linkText: "See pricing", lang: "en" },
      }),
    });

    const [entry] = await test.db.select().from(adminAuditLog);
    expect(entry).toMatchObject({ actorEmail: "ops@repget.test", action: "site.banner_saved", targetType: "site_banner", targetId: "top" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("turned off, leaves the public pages without it but keeps the words", async () => {
    const copy = { en: { message: "Christmas: 50% off" } };
    await saveSiteBanner({ enabled: true, tone: "green", endsAt: null, copy });
    expect(await readLiveBanner()).toMatchObject({ tone: "green", endsAt: null });

    await saveSiteBanner({ enabled: false, tone: "green", endsAt: null, copy });
    expect(await readLiveBanner()).toBeNull();
    const [row] = await test.db.select().from(siteBanner);
    expect(row.copy.en?.message).toBe("Christmas: 50% off");
  });

  it("refuses an invalid save without writing anything", async () => {
    const result = await saveSiteBanner({ enabled: true, tone: "orange", endsAt: null, copy: {} });
    expect(result).toEqual({ ok: false, error: "Write the English message before turning the banner on." });
    expect(await test.db.select().from(siteBanner)).toHaveLength(0);
    expect(await test.db.select().from(adminAuditLog)).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("checks admin access on the server first", async () => {
    guard.requireAdmin.mockRejectedValueOnce(new Error("not an admin"));
    await expect(saveSiteBanner({ enabled: true, tone: "orange", endsAt: null, copy: { en: { message: "x" } } })).rejects.toThrow("not an admin");
    expect(await test.db.select().from(siteBanner)).toHaveLength(0);
  });
});
