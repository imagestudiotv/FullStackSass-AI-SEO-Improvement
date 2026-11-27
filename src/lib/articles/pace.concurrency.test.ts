import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The pace under contention, on REAL Postgres with each starter on its own
 * connection (PGlite has one, so it can only run them in turn): the 06:00 run,
 * the run a finished research wakes, and a person's press, all at once on one
 * website, start no more than the pace allows.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
// The format is read by a model call (lib/articles/format.ts): none here, a plain guide.
vi.mock("@/lib/articles/format", async (original) => ({
  ...(await original<object>()),
  classifyArticleFormat: async () => ({ format: "guide", minItems: null, basis: "keyword", results: 0 }),
}));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return { db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }) };
});
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({ ids: [] })), createFunction: vi.fn() } }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));

import { PACE_REACHED, queueArticleForCalendarItem } from "@/inngest/functions/generate-article";
import { startsLeft } from "@/lib/articles/pace";
import { articles, calendarItems, freePlanAccounts } from "@/lib/db/schema";
import type { TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const available = Boolean(testPostgresUrl());
const ROUNDS = 5;

describe.skipIf(!available)("article starts, racing on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i], fn);

  beforeAll(async () => {
    const created = await createPostgresTestDb(4);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
  }, 180_000);
  afterAll(async () => {
    await dispose?.();
  }, 180_000);

  async function site(options: { free?: boolean; articleLimit?: number } = {}) {
    const seeded = await seedWebsite({ db: dbs[0] } as unknown as TestDb, options.free ? { status: null } : { articleLimit: options.articleLimit ?? 30 });
    if (options.free) await dbs[0].insert(freePlanAccounts).values({ organizationId: seeded.orgId, websiteId: seeded.websiteId, domain: `${randomUUID()}.example` });
    const items = await dbs[0]
      .insert(calendarItems)
      .values(Array.from({ length: 6 }, (_, i) => ({ websiteId: seeded.websiteId, title: `Topic ${i}`, status: "planned", scheduledFor: new Date() })))
      .returning({ id: calendarItems.id });
    return { ...seeded, items: items.map((item) => item.id) };
  }
  const count = async (websiteId: string) => (await dbs[0].select({ id: articles.id }).from(articles).where(eq(articles.websiteId, websiteId))).length;

  it.each([
    ["Free: one a week", { free: true }, 1],
    ["30 a month: one a day", { articleLimit: 30 }, 1],
    ["Scale: two a day", { articleLimit: 60 }, 2],
  ] as const)("%s, whatever arrives at once", async (_name, options, allowed) => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const { websiteId, items } = await site(options);
      const outcomes = await Promise.all(items.slice(0, 4).map((item, i) => on(i, () => queueArticleForCalendarItem(websiteId, item, { automatic: true }))));
      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(allowed);
      for (const outcome of outcomes) if (!outcome.ok) expect(outcome.error).toBe(PACE_REACHED);
      expect(await count(websiteId)).toBe(allowed);
      expect((await startsLeft(websiteId)).left).toBe(0);
    }
  }, 120_000);

  it("a press at the same moment is never refused, and the scheduler counts it", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const { websiteId, items } = await site();
      const [press, ...automatic] = await Promise.all([
        on(0, () => queueArticleForCalendarItem(websiteId, items[0])),
        on(1, () => queueArticleForCalendarItem(websiteId, items[1], { automatic: true })),
        on(2, () => queueArticleForCalendarItem(websiteId, items[2], { automatic: true })),
      ]);
      expect(press.ok).toBe(true);
      // The scheduler's own place may have been taken before the press: at most one.
      expect(automatic.filter((outcome) => outcome.ok).length).toBeLessThanOrEqual(1);
      expect(await count(websiteId)).toBeLessThanOrEqual(2);
      expect((await on(3, () => queueArticleForCalendarItem(websiteId, items[3], { automatic: true }))).ok).toBe(false);
    }
  }, 120_000);
});
