import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The two-step flow's races on REAL Postgres, each contender on its own
 * connection: pressing Publish in two tabs at once, an approval against an
 * edit of the same article, and switching the flow on against a generation
 * save that has already decided.
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

import { articles, organization, platformControls, websites } from "@/lib/db/schema";
import { checkReleasable, reviewHash, reviewStatusForNewDraft, afterCustomerEdit } from "@/lib/articles/review";
import { approveArticle } from "@/lib/backlinks/managed";
import { switchControl, writeControl } from "@/lib/publishing/controls";
import { claimDispatch, lockForEdit, settleDispatch } from "@/lib/publishing/dispatch";

const available = Boolean(testPostgresUrl());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!available)("the two-step flow on real Postgres", () => {
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
    await dbs[0].delete(platformControls).where(eq(platformControls.key, "two_step_articles"));
  });

  async function draft(fields: Partial<typeof articles.$inferInsert> = {}) {
    const d = dbs[0];
    await writeControl("two_step_articles", true, { reason: "test", actor: "test" }, d);
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await d.insert(organization).values({ id: orgId, name: "O", slug: orgId, createdAt: new Date() });
    const [w] = await d.insert(websites).values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` }).returning();
    const [a] = await d.insert(articles).values({ websiteId: w.id, title: "T", bodyHtml: "<p>Text</p>", status: "draft", reviewStatus: "pending", ...fields }).returning();
    return { website: w, article: a };
  }
  const read = async (id: string) => (await dbs[0].select().from(articles).where(eq(articles.id, id)))[0];
  const approve = async (id: string) => {
    const row = await read(id);
    return approveArticle({ articleId: id, expectedVersion: row.reviewVersion, expectedHash: reviewHash(row), actorEmail: "team@repget.test" });
  };

  it("two Publish presses at once: exactly one claim goes out, and the other is refused", async () => {
    const { website, article } = await draft();
    await approve(article.id);
    const press = (i: number) =>
      on(i, () => claimDispatch({ articleId: article.id, websiteId: website.id, channel: "direct", trigger: "manual", requestedStatus: "publish" }));
    const results = await Promise.all([press(1), press(2), press(3)]);
    const won = results.filter((claim) => claim.ok);
    expect(won).toHaveLength(1);
    expect(results.filter((claim) => !claim.ok).map((claim) => (claim as { reason: string }).reason)).toEqual(["in_flight", "in_flight"]);

    if (!won[0].ok) throw new Error("unreachable");
    await settleDispatch(won[0].dispatchId, { status: "sent", remoteId: "1", remoteUrl: "https://x.test/1", remoteStatus: "publish" }, dbs[0]);
    await expect(press(1)).resolves.toEqual({ ok: false, reason: "already_sent" });
  });

  it("an edit and an approval at once: the approval covers only text its reviewer saw", async () => {
    const { article } = await draft();
    const row = await read(article.id);
    const hash = reviewHash(row);
    // The customer's save can't land on a pending article; the team's can. Here: a save landing first.
    const results = await Promise.allSettled([
      on(1, () => dbs[1].transaction(async (tx) => {
        await lockForEdit(tx, article.id);
        await tx.update(articles).set({ bodyHtml: "<p>Changed</p>" }).where(eq(articles.id, article.id));
        await sleep(100);
      })),
      (async () => {
        await sleep(30);
        return on(2, () => approveArticle({ articleId: article.id, expectedVersion: row.reviewVersion, expectedHash: hash, actorEmail: "team@repget.test" }));
      })(),
    ]);
    expect(results[1].status).toBe("rejected");
    expect(await checkReleasable(article.id)).toEqual({ ok: false, reason: "pending_review" });
  });

  it("a customer's edit during delivery of the approved revision is refused; right after, it goes back to the team", async () => {
    const { website, article } = await draft();
    await approve(article.id);
    const claim = await on(1, () => claimDispatch({ articleId: article.id, websiteId: website.id, channel: "direct", trigger: "manual", requestedStatus: "publish" }));
    if (!claim.ok) throw new Error(claim.reason);
    await expect(
      on(2, () => dbs[2].transaction((tx) => lockForEdit(tx, article.id))),
    ).rejects.toThrow(/being delivered/);
    await settleDispatch(claim.dispatchId, { status: "sent", remoteId: "1", remoteUrl: "https://x.test/1", remoteStatus: "publish" }, dbs[0]);
    await on(2, () => dbs[2].transaction(async (tx) => {
      await lockForEdit(tx, article.id);
      await tx.update(articles).set({ bodyHtml: "<p>Later</p>" }).where(eq(articles.id, article.id));
      await afterCustomerEdit(article.id, tx);
    }));
    expect((await read(article.id)).reviewStatus).toBe("pending");
  });

  it("switching on waits for a generation save that decided 'not reviewed', then sorts that draft too", async () => {
    await writeControl("two_step_articles", false, { reason: "test", actor: "test" }, dbs[0]);
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "O", slug: orgId, createdAt: new Date() });
    const [w] = await dbs[0].insert(websites).values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test`, autoPublish: true }).returning();
    const [a] = await dbs[0].insert(articles).values({ websiteId: w.id, title: "T", status: "generating" }).returning();

    let decided!: () => void;
    const reached = new Promise<void>((r) => (decided = r));
    let finish!: () => void;
    const hold = new Promise<void>((r) => (finish = r));
    const save = on(1, () => dbs[1].transaction(async (tx) => {
      const status = await reviewStatusForNewDraft(tx, w.id);
      decided();
      await hold;
      await tx.update(articles).set({ reviewStatus: status, bodyHtml: "<p>Written</p>", status: "draft" }).where(eq(articles.id, a.id));
    }));
    await reached;
    let switched = false;
    const turnOn = on(2, () => dbs[2].transaction(async (tx) => {
      await switchControl(tx, "two_step_articles", true, { reason: "test", actor: "test" });
      switched = true;
    }));
    await sleep(150);
    expect(switched).toBe(false);
    finish();
    await Promise.all([save, turnOn]);
    expect((await read(a.id)).reviewStatus).toBe("pending");
  });
});
