import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The staging corrections on REAL Postgres, each contender on its own
 * connection, parked at controlled barriers:
 *
 *   - enabling the publication freeze waits for a claim that has already
 *     read "not frozen", so when enabling returns nothing more is admitted;
 *   - switching managed review on waits for a generation save that decided
 *     "not reviewed", then holds that draft;
 *   - two copies of one plugin report, racing, apply once.
 *
 * Each "without the lock" case replays the same interleaving with the lock
 * step skipped, to show the lock is what closes the race.
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

import { articles, networkSites, organization, platformControls, publicationDispatches, publishLogs, websites } from "@/lib/db/schema";
import { reviewStatusForNewDraft } from "@/lib/articles/review";
import { acknowledgePluginDispatch } from "@/lib/publishing/acknowledge";
import { REVIEW_CUTOVER_KEY, switchControl, writeControl, activateManagedReview } from "@/lib/publishing/controls";
import { claimDispatch, dispatchTestHooks } from "@/lib/publishing/dispatch";

const available = Boolean(testPostgresUrl());

/** A gate a test opens by hand, plus a signal that the parked side arrived. */
function barrier() {
  let open!: () => void;
  let arrived!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  const reached = new Promise<void>((r) => (arrived = r));
  return { open, opened, arrived, reached };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!available)("staging corrections on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i], fn);

  beforeAll(async () => {
    const created = await createPostgresTestDb(4);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
  }, 120_000);
  afterAll(async () => {
    await dispose?.();
  });
  afterEach(async () => {
    dispatchTestHooks.afterFreezeCheck = undefined;
    await dbs[0].delete(platformControls).where(sql`${platformControls.key} <> ${REVIEW_CUTOVER_KEY}`);
  });

  async function site(options: { network?: boolean } = {}) {
    const d = dbs[0];
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await d.insert(organization).values({ id: orgId, name: "O", slug: orgId, createdAt: new Date() });
    const [w] = await d
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test`, autoPublish: true, publishAs: "live", firstArticleSentAt: new Date() })
      .returning();
    if (options.network) await d.insert(networkSites).values({ websiteId: w.id, acceptingLinks: true, monthlyCap: 3 });
    return w;
  }
  async function draft(websiteId: string, fields: Partial<typeof articles.$inferInsert> = {}) {
    const [a] = await dbs[0].insert(articles).values({ websiteId, title: "T", status: "draft", bodyHtml: "<p>x</p>", ...fields }).returning();
    return a;
  }

  /* ---------------------------------------------------------------------- */

  it("enabling the freeze waits for a claim that already read 'not frozen'; nothing is admitted after it returns", async () => {
    const w = await site();
    const a = await draft(w.id);
    const b = await draft(w.id);
    const gate = barrier();
    dispatchTestHooks.afterFreezeCheck = async (articleId) => {
      if (articleId !== a.id) return;
      gate.arrived();
      await gate.opened;
    };

    const claimA = on(1, () => claimDispatch({ articleId: a.id, websiteId: w.id, channel: "direct", trigger: "manual", requestedStatus: "publish" }));
    await gate.reached;

    let freezeDone = false;
    const freeze = on(2, () =>
      dbs[2].transaction(async (tx) => {
        await switchControl(tx, "publication_freeze", true, { reason: "test", actor: "ops@test" });
      }),
    ).then(() => (freezeDone = true));

    await sleep(400);
    expect(freezeDone).toBe(false); // waiting for the open claim

    gate.open();
    await expect(claimA).resolves.toMatchObject({ ok: true });
    await freeze;
    expect(freezeDone).toBe(true);

    // Once enabling has returned, nothing more is admitted.
    await expect(on(3, () => claimDispatch({ articleId: b.id, websiteId: w.id, channel: "direct", trigger: "manual", requestedStatus: "publish" }))).resolves.toEqual({ ok: false, reason: "frozen" });
  });

  it("without the lock (the old freeze), enabling returns while an admitted claim is still open - the race the lock closes", async () => {
    const w = await site();
    const a = await draft(w.id);
    const gate = barrier();
    dispatchTestHooks.afterFreezeCheck = async (articleId) => {
      if (articleId !== a.id) return;
      gate.arrived();
      await gate.opened;
    };
    const claimA = on(1, () => claimDispatch({ articleId: a.id, websiteId: w.id, channel: "direct", trigger: "manual", requestedStatus: "publish" }));
    await gate.reached;

    // The previous build's freeze: a plain write, no lock. It commits and returns at once...
    await on(2, () => writeControl("publication_freeze", true, { reason: "test", actor: "ops@test" }, dbs[2]));
    const [control] = await dbs[0].select().from(platformControls).where(eq(platformControls.key, "publication_freeze"));
    expect(control.enabled).toBe(true);
    expect(await dbs[0].select().from(publicationDispatches).where(eq(publicationDispatches.articleId, a.id))).toHaveLength(0);
    // ...while a claim that read "not frozen" is still open: it is admitted AFTER the freeze is on.
    gate.open();
    await expect(claimA).resolves.toMatchObject({ ok: true });
    expect(await dbs[0].select().from(publicationDispatches).where(eq(publicationDispatches.articleId, a.id))).toHaveLength(1);
  });

  /* ---------------------------------------------------------------------- */

  it("switching managed review on waits for a save that decided 'not reviewed', then holds that draft", async () => {
    const w = await site({ network: true });
    const a = await draft(w.id, { status: "generating", bodyHtml: null });
    const gate = barrier();

    // The generation save, parked between deciding the review state and writing it.
    const save = on(1, () =>
      dbs[1].transaction(async (tx) => {
        const reviewStatus = await reviewStatusForNewDraft(tx, w.id);
        gate.arrived();
        await gate.opened;
        await tx.update(articles).set({ reviewStatus, status: "draft", bodyHtml: "<p>written</p>" }).where(eq(articles.id, a.id));
        return reviewStatus;
      }),
    );
    await gate.reached;

    let switched = false;
    const activation = on(2, () =>
      dbs[2].transaction((tx) => switchControl(tx, "managed_review", true, { reason: "deploy finished", actor: "ops@test" })),
    ).then((r) => {
      switched = true;
      return r;
    });
    await sleep(400);
    expect(switched).toBe(false);

    gate.open();
    await expect(save).resolves.toBeNull(); // it decided before the switch
    await expect(activation).resolves.toMatchObject({ heldForReview: 1 });
    const [after] = await dbs[0].select().from(articles).where(eq(articles.id, a.id));
    expect(after.reviewStatus).toBe("pending");

    // A save after the switch sees it on.
    const b = await draft(w.id, { status: "generating", bodyHtml: null });
    await expect(on(1, () => dbs[1].transaction((tx) => reviewStatusForNewDraft(tx, w.id)))).resolves.toBe("pending");
    expect(b).toBeTruthy();
  });

  it("without the lock, the same interleaving leaves a network draft unreviewed", async () => {
    const w = await site({ network: true });
    const a = await draft(w.id, { status: "generating", bodyHtml: null });
    const gate = barrier();
    const save = on(1, () =>
      dbs[1].transaction(async (tx) => {
        // The old save: no lock, the switch read directly.
        const [row] = (await tx.execute(sql`select exists (select 1 from platform_controls where key = 'managed_review' and enabled) as on`)) as unknown as Array<{ on: boolean }>;
        const reviewStatus = row.on ? "pending" : null;
        gate.arrived();
        await gate.opened;
        await tx.update(articles).set({ reviewStatus, status: "draft", bodyHtml: "<p>written</p>" }).where(eq(articles.id, a.id));
      }),
    );
    await gate.reached;
    // The switch and its sweep, without waiting for the save.
    await on(2, () =>
      dbs[2].transaction(async (tx) => {
        await writeControl("managed_review", true, { reason: "deploy finished", actor: "ops@test" }, tx);
        await activateManagedReview(tx);
      }),
    );
    gate.open();
    await save;
    const [after] = await dbs[0].select().from(articles).where(eq(articles.id, a.id));
    expect(after.reviewStatus).toBeNull();
  });

  it("activation holds only drafts written since the cutover, never one being delivered or already delivered", async () => {
    const w = await site({ network: true });
    const [cutover] = await dbs[0].select().from(platformControls).where(eq(platformControls.key, REVIEW_CUTOVER_KEY));
    expect(cutover).toBeTruthy();
    const old = await draft(w.id, { createdAt: new Date(cutover.updatedAt.getTime() - 60_000) });
    const fresh = await draft(w.id);
    const delivering = await draft(w.id);
    const delivered = await draft(w.id, { publishedUrl: `https://${w.domain}/x/` });
    await dbs[0].insert(publicationDispatches).values({ articleId: delivering.id, websiteId: w.id, channel: "direct", trigger: "manual", revisionHash: "h", requestedStatus: "publish" });
    await on(2, () => dbs[2].transaction((tx) => switchControl(tx, "managed_review", true, { reason: "go", actor: "ops@test" })));
    const rows = await dbs[0].select({ id: articles.id, reviewStatus: articles.reviewStatus }).from(articles).where(eq(articles.websiteId, w.id));
    const state = Object.fromEntries(rows.map((r) => [r.id, r.reviewStatus]));
    expect(state[fresh.id]).toBe("pending");
    expect(state[old.id]).toBeNull();
    expect(state[delivering.id]).toBeNull();
    expect(state[delivered.id]).toBeNull();
  });

  /* ---------------------------------------------------------------------- */

  it("two copies of one plugin report racing on separate connections apply once", async () => {
    const w = await site();
    const a = await draft(w.id);
    const claim = await on(1, () => claimDispatch({ articleId: a.id, websiteId: w.id, channel: "plugin", trigger: "plugin", protocol: "plugin_v2" }));
    if (!claim.ok) throw new Error(claim.reason);
    const report = { kind: "sent" as const, remoteId: "5", remoteUrl: `https://${w.domain}/t/`, remoteStatus: "publish" };
    const results = await Promise.all([
      on(2, () => acknowledgePluginDispatch({ websiteId: w.id, articleId: a.id, dispatchId: claim.dispatchId, report })),
      on(3, () => acknowledgePluginDispatch({ websiteId: w.id, articleId: a.id, dispatchId: claim.dispatchId, report })),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual(["applied", "duplicate"]);
    expect(await dbs[0].select().from(publishLogs).where(eq(publishLogs.articleId, a.id))).toHaveLength(1);
    const [after] = await dbs[0].select().from(articles).where(eq(articles.id, a.id));
    expect(after.status).toBe("published");
    expect(after.firstLiveAt).not.toBeNull();
  });

  it("the page identity function runs on real Postgres and matches the code", async () => {
    const { pageKey } = await import("@/lib/reporting/page-key");
    const cases: Array<[string, string | null]> = [
      ["https://EXAMPLE.com/Blog/A/?utm_source=x&b=2&a=1#top", null],
      ["http://www.example.com:443/?p=101", null],
      ["/blog/x/?lang=fr", "example.com"],
      ["https://user@example.com:8080/a//", null],
    ];
    for (const [url, host] of cases) {
      const [row] = (await dbs[0].execute(sql`select repget_page_key(${url}, ${host}) as k`)) as unknown as Array<{ k: string }>;
      expect(row.k).toBe(pageKey(url, host));
    }
  });
});
