import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Deleting a website or workspace while one of its articles is being claimed for
 * delivery, on REAL Postgres with each side on its own connection. A deadlock is
 * a failure here: Postgres would roll one side back, and somebody would be shown
 * an error for no reason. See "LOCK ORDER" in lib/websites/deletion.ts.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return {
    db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }),
  };
});
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { articles, organization, publicationDispatches, websites } from "@/lib/db/schema";
import { claimDispatch, dispatchTestHooks, settleDispatch } from "@/lib/publishing/dispatch";
import { deleteWebsiteIfBillingResolved, deleteWorkspaceIfBillingResolved } from "@/lib/websites/deletion";

const available = Boolean(testPostgresUrl());
const ROUNDS = 6;

describe.skipIf(!available)("deleting a website or workspace while a delivery is being claimed, on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i], fn);

  beforeAll(async () => {
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  afterEach(() => {
    dispatchTestHooks.afterFreezeCheck = undefined;
  });

  async function scene() {
    const d = dbs[0];
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await d.insert(organization).values({ id: orgId, name: "O", slug: orgId, createdAt: new Date() });
    const [site] = await d.insert(websites).values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` }).returning();
    const [article] = await d.insert(articles).values({ websiteId: site.id, title: "T", status: "draft", bodyHtml: "<p>Words.</p>" }).returning();
    const claim = (i: number) => on(i, () => claimDispatch({ articleId: article.id, websiteId: site.id, channel: "direct", trigger: "manual" }));
    return { orgId, site, article, claim };
  }
  type Scene = Awaited<ReturnType<typeof scene>>;

  const deletions = [
    ["a website", (s: Scene, i: number) => deleteWebsiteIfBillingResolved(dbs[i], { websiteId: s.site.id, organizationId: s.orgId })],
    ["a workspace", (s: Scene, i: number) => deleteWorkspaceIfBillingResolved(dbs[i], { organizationId: s.orgId })],
  ] as const;

  const siteExists = async (id: string) => (await dbs[0].select({ id: websites.id }).from(websites).where(eq(websites.id, id))).length > 0;
  const dispatchesOf = (articleId: string) => dbs[0].select().from(publicationDispatches).where(eq(publicationDispatches.articleId, articleId));

  /** What a side died of, so a deadlock reads as 40P01 and not only as "rejected". */
  const diedOf = (settled: PromiseSettledResult<unknown>) => {
    if (settled.status === "fulfilled") return null;
    const reason = settled.reason as { code?: string; cause?: { code?: string } };
    return reason.cause?.code ?? reason.code ?? String(settled.reason);
  };

  /** Waits until the server shows somebody waiting on a row lock in this database. */
  async function someoneWaitsOnALock() {
    for (let polls = 0; polls < 200; polls++) {
      const rows = await dbs[0].execute(sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`);
      if ((rows as unknown as { n: number }[])[0].n > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("the deletion never queued on a lock");
  }

  it.each(deletions)("%s's deletion arriving while a claim holds the article: no deadlock, and the delivery keeps its record", async (_what, remove) => {
    const s = await scene();
    let parked!: () => void;
    let resume!: () => void;
    const claimParked = new Promise<void>((resolve) => (parked = resolve));
    const claimResumes = new Promise<void>((resolve) => (resume = resolve));
    dispatchTestHooks.afterFreezeCheck = async () => {
      parked();
      await claimResumes;
    };

    const claiming = s.claim(1);
    await claimParked;
    const deleting = on(2, () => remove(s, 2));
    await someoneWaitsOnALock();
    resume();

    const [claim, deletion] = await Promise.allSettled([claiming, deleting]);
    expect([diedOf(claim), diedOf(deletion)]).toEqual([null, null]);
    expect(claim).toMatchObject({ status: "fulfilled", value: { ok: true } });
    expect(deletion).toMatchObject({ status: "fulfilled", value: { ok: false, error: expect.stringMatching(/being delivered/) } });
    expect(await siteExists(s.site.id)).toBe(true);
    expect(await dispatchesOf(s.article.id)).toMatchObject([{ status: "in_flight" }]);
  });

  it.each(deletions)("%s's deletion and a claim, left to race: never a deadlock, and never a delivery with no record", async (_what, remove) => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const [claim, deletion] = await Promise.allSettled([s.claim(1), on(2, () => remove(s, 2))]);
      expect([diedOf(claim), diedOf(deletion)]).toEqual([null, null]);
      const claimed = claim.status === "fulfilled" && claim.value.ok;
      if (claimed) {
        expect(deletion).toMatchObject({ value: { ok: false, error: expect.stringMatching(/being delivered/) } });
        expect(await dispatchesOf(s.article.id)).toMatchObject([{ status: "in_flight" }]);
      } else {
        expect(claim).toMatchObject({ value: { ok: false, reason: "not_found" } });
        expect(deletion).toMatchObject({ value: { ok: true } });
        expect(await siteExists(s.site.id)).toBe(false);
      }
    }
  });

  it("the delivery finished: the deletion goes through", async () => {
    const s = await scene();
    const claim = await s.claim(1);
    if (!claim.ok) throw new Error(claim.reason);
    expect(await settleDispatch(claim.dispatchId, { status: "sent", remoteId: "7", remoteUrl: "https://x.test/p", remoteStatus: "publish" }, dbs[1])).toBe(true);
    await expect(deletions[0][1](s, 2)).resolves.toEqual({ ok: true });
    expect(await siteExists(s.site.id)).toBe(false);
  });
});
