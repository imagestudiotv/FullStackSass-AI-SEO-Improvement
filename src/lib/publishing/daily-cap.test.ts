import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditSettings, organization, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { dailyCapFor, dailyLimitKey, DEFAULT_DAILY_LIMITS, listDailyLimits, resolveDailyLimit, utcDayStart } from "./daily-cap";

const IMAGESTUDIO = "4aec4382-f158-4deb-b7a3-b4968aac6b41";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  await test.db.delete(creditSettings);
});

async function site(id: string = randomUUID(), domain = `${id}.example`) {
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
  await test.db.insert(websites).values({ id, organizationId: orgId, url: `https://${domain}`, domain, status: "ready" });
  return id;
}
const save = (websiteId: string, value: number) => test.db.insert(creditSettings).values({ key: dailyLimitKey(websiteId), value });

describe("resolveDailyLimit", () => {
  it("keeps imagestudio.com at one a day until an administrator saves another value, with no end date", () => {
    expect(resolveDailyLimit(IMAGESTUDIO, undefined)).toBe(1);
    expect(DEFAULT_DAILY_LIMITS.find((d) => d.websiteId === IMAGESTUDIO)?.perDay).toBe(1);
  });

  it("follows a saved value, where 0 is no limit", () => {
    expect(resolveDailyLimit(IMAGESTUDIO, 3)).toBe(3);
    expect(resolveDailyLimit(IMAGESTUDIO, 0)).toBeNull();
    expect(resolveDailyLimit("other", 2)).toBe(2);
  });

  it("leaves every other website without a limit", () => {
    expect(resolveDailyLimit("dfab7d9c-7323-4cbf-b489-4a1696d7f116", undefined)).toBeNull();
  });
});

describe("dailyCapFor", () => {
  it("reads the administrator's setting for the website", async () => {
    const id = await site();
    expect(await dailyCapFor(id)).toBeNull();
    await save(id, 5);
    expect(await dailyCapFor(id)).toBe(5);
  });

  it("is one a day for imagestudio.com with nothing saved, any date - and none once 'No limit' is saved", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2027-03-01T06:00:00Z") });
    expect(await dailyCapFor(IMAGESTUDIO)).toBe(1);
    vi.useRealTimers();
    await save(IMAGESTUDIO, 0);
    expect(await dailyCapFor(IMAGESTUDIO)).toBeNull();
  });
});

describe("listDailyLimits", () => {
  it("lists every limit in force with its domain, saved or by default, and leaves out 'No limit'", async () => {
    await site(IMAGESTUDIO, "imagestudio.com");
    const a = await site(randomUUID(), "a-site.example");
    const b = await site(randomUUID(), "b-site.example");
    await save(a, 2);
    await save(b, 0);
    expect(await listDailyLimits()).toEqual([
      { websiteId: a, domain: "a-site.example", perDay: 2, saved: true },
      { websiteId: IMAGESTUDIO, domain: "imagestudio.com", perDay: 1, saved: false },
    ]);
  });

  it("skips the setting of a website that no longer exists", async () => {
    await save(randomUUID(), 4);
    expect((await listDailyLimits()).every((limit) => limit.domain)).toBe(true);
  });
});

describe("utcDayStart", () => {
  it("is midnight UTC of the same UTC day", () => {
    expect(utcDayStart(new Date("2026-11-21T14:43:41Z")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-11-21T00:00:00Z")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });
});
