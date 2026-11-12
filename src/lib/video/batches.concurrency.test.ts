import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The free idea allowance on REAL Postgres through postgres-js, the
 * production driver, with requests racing on separate connections (client,
 * 2026-11-12: 20 daily ideas plus three free extra batches of 10, repeated
 * requests limited). Skipped unless TEST_POSTGRES_URL names a disposable
 * server (src/test/postgres.ts).
 *
 * Every moment is passed in; nothing compares a database-default timestamp.
 */

const state = vi.hoisted(() => ({ db: null as unknown, pick: null as (() => unknown) | null }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get((state.pick ? state.pick() : state.db) as object, p) }) }));

import { organization, usageEvents, videoIdeaBatches, videoIdeas, websites } from "@/lib/db/schema";

import {
  claimBatch,
  EXTRA_REQUEST_GAP_MS,
  ideaAllowance,
  releaseBatch,
  reserveExtraBatch,
  reserveRewrite,
  REWRITES_PER_DAY,
  utcDay,
} from "./batches";
import { EXTRA_BATCHES_PER_DAY } from "./formats";

const available = Boolean(testPostgresUrl());
const T0 = new Date("2026-11-12T09:00:00.000Z");
const later = (ms: number) => new Date(T0.getTime() + ms);

describe.skipIf(!available)("the free idea allowance on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const created = await createPostgresTestDb(4);
    dbs = created.dbs as unknown as Db[];
    state.db = dbs[0];
    dispose = created.dispose;
    // Each query of a race on the next connection, so the transactions really overlap.
    let next = 0;
    state.pick = () => dbs[next++ % dbs.length];
  }, 400_000);

  afterAll(async () => {
    state.pick = null;
    await dispose?.();
  }, 300_000);

  async function website() {
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
    const [site] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` })
      .returning({ id: websites.id });
    return { orgId, websiteId: site.id };
  }

  /** A batch written: done, with `created` ideas. */
  async function finish(batchId: string, created: number, at: Date) {
    await dbs[0].update(videoIdeaBatches).set({ status: "done", created, updatedAt: at, finishedAt: at }).where(eq(videoIdeaBatches.id, batchId));
  }

  it("never gives more than three extra batches a day, however many requests race", async () => {
    const { websiteId } = await website();
    const granted: number[] = [];
    for (let round = 0; round < EXTRA_BATCHES_PER_DAY + 1; round++) {
      const at = later(round * (EXTRA_REQUEST_GAP_MS + 1000));
      const results = await Promise.all(Array.from({ length: 8 }, () => reserveExtraBatch(websiteId, "mixed", {}, at)));
      const ok = results.filter((result) => result.ok);
      if (round < EXTRA_BATCHES_PER_DAY) {
        // One wins; the others are told a batch is being written.
        expect(ok).toHaveLength(1);
        expect(results.filter((result) => !result.ok).every((result) => !result.ok && result.error === "busy")).toBe(true);
        const batch = ok[0].ok ? ok[0].batch : null;
        granted.push(batch!.slot);
        await finish(batch!.id, 10, at);
      } else {
        expect(ok).toHaveLength(0);
        expect(results.every((result) => !result.ok && result.error === "extra_used_up")).toBe(true);
      }
    }
    expect(granted).toEqual([1, 2, 3]);
    const rows = await dbs[0].select().from(videoIdeaBatches).where(eq(videoIdeaBatches.websiteId, websiteId));
    expect(rows.map((row) => row.slot).sort()).toEqual([1, 2, 3]);
    expect(await ideaAllowance(websiteId, later(10 * 60_000))).toMatchObject({ extraUsed: 3, extraLeft: 0, busy: false });
  });

  it("asks again too soon: refused with the time to come back", async () => {
    const { websiteId } = await website();
    const first = await reserveExtraBatch(websiteId, "viral", {}, T0);
    expect(first.ok).toBe(true);
    await finish(first.ok ? first.batch.id : "", 10, later(5_000));
    const soon = await reserveExtraBatch(websiteId, "viral", {}, later(6_000));
    expect(soon).toEqual({ ok: false, error: "too_soon", nextAllowedAt: later(EXTRA_REQUEST_GAP_MS) });
    expect((await reserveExtraBatch(websiteId, "viral", {}, later(EXTRA_REQUEST_GAP_MS))).ok).toBe(true);
  });

  it("returns the first batch for a request sent again with its key, never a second slot", async () => {
    const { websiteId } = await website();
    const results = await Promise.all(Array.from({ length: 6 }, () => reserveExtraBatch(websiteId, "website", { requestKey: "click-1" }, T0)));
    expect(results.every((result) => result.ok)).toBe(true);
    const ids = new Set(results.map((result) => (result.ok ? result.batch.id : null)));
    expect(ids.size).toBe(1);
    expect(results.filter((result) => result.ok && !result.reused)).toHaveLength(1);
    // Even after it was written, and long after: the same batch.
    await finish([...ids][0]!, 10, later(30_000));
    const again = await reserveExtraBatch(websiteId, "website", { requestKey: "click-1" }, later(60 * 60_000));
    expect(again.ok && again.batch.id).toBe([...ids][0]);
    expect(await dbs[0].select().from(videoIdeaBatches).where(eq(videoIdeaBatches.websiteId, websiteId))).toHaveLength(1);
  });

  it("lets a batch that failed with no idea be asked for again once, in its own slot", async () => {
    const { websiteId } = await website();
    const first = await reserveExtraBatch(websiteId, "mixed", {}, T0);
    const batchId = first.ok ? first.batch.id : "";
    // The job's try and its retry both fail.
    expect(await claimBatch(batchId, later(1_000))).not.toBeNull();
    await releaseBatch(batchId, "model error", false, later(2_000));
    expect(await claimBatch(batchId, later(3_000), { retry: true })).not.toBeNull();
    await releaseBatch(batchId, "model error", true, later(4_000));
    let [row] = await dbs[0].select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, batchId));
    expect(row).toMatchObject({ status: "failed", attempts: 2, created: 0 });
    // Nothing was written: it does not count as used yet.
    expect((await ideaAllowance(websiteId, later(30_000))).extraLeft).toBe(3);

    const again = await reserveExtraBatch(websiteId, "mixed", {}, later(30_000));
    expect(again.ok && again.batch.id).toBe(batchId);
    expect(await claimBatch(batchId, later(31_000))).not.toBeNull();
    await releaseBatch(batchId, "model error", true, later(32_000));
    [row] = await dbs[0].select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, batchId));
    expect(row).toMatchObject({ status: "failed", attempts: 3, slot: 1 });
    // Its one second chance is used: the next request takes a new slot, and that slot is used.
    expect((await ideaAllowance(websiteId, later(60_000))).extraLeft).toBe(2);
    const next = await reserveExtraBatch(websiteId, "mixed", {}, later(60_000));
    expect(next.ok && next.batch.slot).toBe(2);
    // A batch never gets attempts back.
    await dbs[0].update(videoIdeaBatches).set({ status: "reserved" }).where(eq(videoIdeaBatches.id, batchId));
    await dbs[0].update(videoIdeaBatches).set({ attempts: 4 }).where(eq(videoIdeaBatches.id, batchId));
    expect(await claimBatch(batchId, later(90_000))).toBeNull();
  });

  it("counts only the day's own batch towards its twenty", async () => {
    const { websiteId } = await website();
    const day = utcDay(T0);
    const base = { websiteId, day, style: "bold", language: "en", script: {}, caption: "c" };
    // Five of the day's ideas from before batches.
    await dbs[0].insert(videoIdeas).values(Array.from({ length: 5 }, (_, i) => ({ ...base, title: `daily ${i}` })));
    const extra = await reserveExtraBatch(websiteId, "viral", {}, T0);
    const batchId = extra.ok ? extra.batch.id : "";
    await dbs[0].insert(videoIdeas).values(Array.from({ length: 10 }, (_, i) => ({ ...base, title: `extra ${i}`, batchId })));
    await finish(batchId, 10, later(1_000));
    expect(await ideaAllowance(websiteId, later(60_000))).toMatchObject({ dailyWritten: 5, extraUsed: 1, extraLeft: 2 });
  });

  it("never gives more than the day's free rewrites, however many race", async () => {
    const { websiteId, orgId } = await website();
    const results = await Promise.all(Array.from({ length: REWRITES_PER_DAY + 5 }, () => reserveRewrite(websiteId, orgId, randomUUID(), T0)));
    expect(results.filter(Boolean)).toHaveLength(REWRITES_PER_DAY);
    const rows = await dbs[0].select().from(usageEvents).where(and(eq(usageEvents.websiteId, websiteId), eq(usageEvents.kind, "video_rewrite")));
    expect(rows).toHaveLength(REWRITES_PER_DAY);
    // The next UTC day starts afresh.
    expect(await reserveRewrite(websiteId, orgId, randomUUID(), later(24 * 60 * 60_000))).toBe(true);
  });
});
