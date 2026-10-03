import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { audits, crawls, issues, spendReservations } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/*
  The Website health page's reads, against the real migrations: which audit
  and crawl row it shows, exact per-type counts however many rows are sent,
  the row cap, and the "requested but not started" signal taken from the
  spend reservation that startAudit records.
*/

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { ISSUE_ROW_LIMIT, loadHealthData } from "./health-data";

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
  state.db = testDb.db;
});

const NOW = new Date("2026-10-03T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

async function reserve(websiteId: string, over: Partial<typeof spendReservations.$inferInsert> = {}) {
  await testDb.db.insert(spendReservations).values({
    key: `audit:site:${websiteId}`,
    operation: "website.audit",
    state: "reserved",
    limitValue: 4,
    windowSeconds: 3600,
    countedAt: ago(2),
    ...over,
  });
}

describe("loadHealthData", () => {
  it("a site never checked: nothing at all", async () => {
    const { websiteId } = await seedWebsite(testDb);
    expect(await loadHealthData(websiteId, NOW)).toEqual({ audit: null, crawl: null, requestedAt: null });
  });

  it("reads the latest audit only, most serious rows first, with exact per-type counts", async () => {
    const { websiteId } = await seedWebsite(testDb);
    const [older] = await testDb.db
      .insert(audits)
      .values({ websiteId, score: 40, summary: { score: 40 }, createdAt: ago(600) })
      .returning({ id: audits.id });
    await testDb.db.insert(issues).values({ websiteId, auditId: older.id, type: "noindex", severity: "critical", url: "https://a.example/old" });

    const [latest] = await testDb.db
      .insert(audits)
      .values({ websiteId, score: 81, summary: { score: 81, pagesCrawled: 3 }, createdAt: ago(10) })
      .returning({ id: audits.id });
    await testDb.db.insert(issues).values([
      { websiteId, auditId: latest.id, type: "missing_lang", severity: "info", url: "https://a.example/1" },
      { websiteId, auditId: latest.id, type: "thin_content", severity: "warning", url: "https://a.example/2" },
      { websiteId, auditId: latest.id, type: "unreachable_page", severity: "critical", url: "https://a.example/x" },
      { websiteId, auditId: latest.id, type: "missing_lang", severity: "info", url: "https://a.example/2" },
    ]);

    const { audit } = await loadHealthData(websiteId, NOW);
    expect(audit).toMatchObject({ id: latest.id, score: 81, summary: { pagesCrawled: 3 }, totalRows: 4 });
    expect(audit?.rows.map((r) => r.severity)).toEqual(["critical", "warning", "info", "info"]);
    expect(audit?.rows.some((r) => r.url === "https://a.example/old")).toBe(false);
    expect([...(audit?.typeCounts ?? [])].sort((a, b) => a.type.localeCompare(b.type))).toEqual([
      { type: "missing_lang", severity: "info", count: 2 },
      { type: "thin_content", severity: "warning", count: 1 },
      { type: "unreachable_page", severity: "critical", count: 1 },
    ]);
  });

  it("caps the rows it sends, dropping the least serious, while the counts stay exact", async () => {
    const { websiteId } = await seedWebsite(testDb);
    const [audit] = await testDb.db.insert(audits).values({ websiteId, score: 0, summary: null }).returning({ id: audits.id });
    const many = Array.from({ length: ISSUE_ROW_LIMIT + 5 }, (_, i) => ({
      websiteId,
      auditId: audit.id,
      type: "unreachable_page",
      severity: "critical",
      url: `https://a.example/p${i}`,
    }));
    await testDb.db.insert(issues).values(many);
    await testDb.db.insert(issues).values({ websiteId, auditId: audit.id, type: "missing_lang", severity: "info", url: "https://a.example/" });

    const result = (await loadHealthData(websiteId, NOW)).audit;
    expect(result?.rows).toHaveLength(ISSUE_ROW_LIMIT);
    expect(result?.rows.every((r) => r.severity === "critical")).toBe(true);
    expect(result?.totalRows).toBe(ISSUE_ROW_LIMIT + 6);
    expect(result?.typeCounts.find((c) => c.type === "unreachable_page")?.count).toBe(ISSUE_ROW_LIMIT + 5);
    expect(result?.summary).toBeNull();
  });

  it("reads the newest crawl row with its start and finish times", async () => {
    const { websiteId } = await seedWebsite(testDb);
    await testDb.db.insert(crawls).values([
      { websiteId, status: "completed", pagesCrawled: 20, pagesFound: 90, startedAt: ago(300), finishedAt: ago(298) },
      { websiteId, status: "running", pagesCrawled: 4, pagesFound: 31, startedAt: ago(1) },
    ]);
    expect((await loadHealthData(websiteId, NOW)).crawl).toEqual({
      status: "running",
      pagesCrawled: 4,
      pagesFound: 31,
      error: null,
      startedAt: ago(1),
      finishedAt: null,
    });
  });

  it("a check accepted but not started is found through its open per-site reservation", async () => {
    const { websiteId } = await seedWebsite(testDb);
    await reserve(websiteId, { countedAt: ago(3) });
    expect((await loadHealthData(websiteId, NOW)).requestedAt).toEqual(ago(3));
  });

  it("a reservation that is spent, settled, too old or another site's is not a waiting check", async () => {
    const { websiteId } = await seedWebsite(testDb);
    const other = await seedWebsite(testDb);
    await reserve(websiteId, { state: "consumed", countedAt: ago(4) });
    await reserve(websiteId, { state: "released", countedAt: ago(3) });
    await reserve(websiteId, { spendStartedAt: ago(2), spendToken: randomUUID(), countedAt: ago(2) });
    await reserve(websiteId, { countedAt: ago(7 * 60) });
    await reserve(other.websiteId, { countedAt: ago(1) });
    expect((await loadHealthData(websiteId, NOW)).requestedAt).toBeNull();
  });

  it("only reads: loading the page writes nothing", async () => {
    const { websiteId } = await seedWebsite(testDb);
    await reserve(websiteId);
    const before = await testDb.db.select().from(spendReservations);
    await loadHealthData(websiteId, NOW);
    expect(await testDb.db.select().from(spendReservations)).toEqual(before);
    expect(await testDb.db.select().from(crawls).then((rows) => rows.filter((r) => r.websiteId === websiteId))).toEqual([]);
  });
});
