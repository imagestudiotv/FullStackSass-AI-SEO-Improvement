import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Deleting an article while something else is at work on it, on REAL Postgres
 * with each contender on its own connection (PGlite has one connection, so it
 * can only run them in turn). Each race runs for several rounds because which
 * side wins is up to the server; every outcome must be a consistent one.
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

import { deleteArticleAndSettleLinks } from "@/lib/articles/deletion";
import { placeManagedLink, removeManagedPlacement } from "@/lib/backlinks/managed";
import { applyCheck, recordArticlePublication } from "@/lib/backlinks/placements";
import { articles, backlinkRequests, creditLedger, networkSites, organization, placements, websites } from "@/lib/db/schema";
import { ArticleInFlightError, claimDispatch } from "@/lib/publishing/dispatch";

const available = Boolean(testPostgresUrl());
const ROUNDS = 8;
const CREDITS = 20;
const BALANCE = 100;

describe.skipIf(!available)("deleting an article, racing on real Postgres", () => {
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

  /** A fresh host and partner in the managed network, and an article in review carrying a link of 20 credits. */
  async function scene(options: { linked?: boolean } = {}) {
    const d = dbs[0];
    const hostOrg = `org_h_${randomUUID().slice(0, 8)}`;
    const benOrg = `org_b_${randomUUID().slice(0, 8)}`;
    await d.insert(organization).values([
      { id: hostOrg, name: "H", slug: hostOrg, createdAt: new Date() },
      { id: benOrg, name: "B", slug: benOrg, createdAt: new Date() },
    ]);
    const [host] = await d.insert(websites).values({ organizationId: hostOrg, url: `https://${hostOrg}.test`, domain: `${hostOrg}.test`, industry: "wedding studio", language: "English" }).returning();
    const [ben] = await d.insert(websites).values({ organizationId: benOrg, url: `https://${benOrg}.test`, domain: `${benOrg}.test`, industry: "wedding studio", language: "English" }).returning();
    await d.insert(networkSites).values([
      { websiteId: host.id, acceptingLinks: true, monthlyCap: 10 },
      { websiteId: ben.id, acceptingLinks: true, monthlyCap: 10 },
    ]);
    await d.insert(creditLedger).values({ organizationId: benOrg, type: "purchase", amount: BALANCE });
    const [article] = await d
      .insert(articles)
      .values({ websiteId: host.id, title: "T", status: "draft", reviewStatus: "pending", bodyHtml: "<p>wedding videography matters</p>" })
      .returning();
    const place = (articleVersion: number) =>
      placeManagedLink({ articleId: article.id, expectedVersion: articleVersion, beneficiaryWebsiteId: ben.id, targetUrl: `https://${ben.domain}/p/`, anchor: "wedding videography", credits: CREDITS, actorEmail: "admin@x" });
    const placed = options.linked === false ? null : await on(0, () => place(article.reviewVersion));
    const [latest] = await d.select().from(articles).where(eq(articles.id, article.id));
    return { hostOrg, benOrg, host, ben, article: latest, place, placementId: placed?.placementId ?? null };
  }

  const articleExists = async (id: string) => (await dbs[0].select({ id: articles.id }).from(articles).where(eq(articles.id, id))).length > 0;
  const placementOf = async (id: string) => (await dbs[0].select().from(placements).where(eq(placements.id, id)))[0];
  const requestsOf = (websiteId: string) => dbs[0].select().from(backlinkRequests).where(eq(backlinkRequests.websiteId, websiteId));
  const ledgerOf = (organizationId: string) => dbs[0].select().from(creditLedger).where(eq(creditLedger.organizationId, organizationId));
  const held = async (websiteId: string) =>
    (await requestsOf(websiteId)).filter((r) => ["pending", "matched"].includes(r.status)).reduce((sum, r) => sum + r.creditsReserved, 0);

  /**
   * Starts the contenders while connection 0 holds a row lock they all need, and
   * lets go only once the server shows each one waiting on it: an overlap that
   * is certain, rather than one left to timing.
   */
  async function queuedBehind<T>(lock: "article" | "placement", id: string, contenders: (() => Promise<T>)[]) {
    let results!: Promise<PromiseSettledResult<T>[]>;
    await dbs[0].transaction(async (tx) => {
      await tx.execute(lock === "article" ? sql`select id from articles where id = ${id} for update` : sql`select id from placements where id = ${id} for update`);
      results = Promise.allSettled(contenders.map((contender) => contender()));
      for (let polls = 0; ; polls++) {
        if (polls > 200) throw new Error("the contenders never queued on the lock");
        // A transaction otherwise keeps reading its first snapshot of this view.
        await tx.execute(sql`select pg_stat_clear_snapshot()`);
        const rows = await tx.execute(sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`);
        if ((rows as unknown as { n: number }[])[0].n >= contenders.length) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    });
    return results;
  }

  it("two deletions queued on the same lock: the second finds it done", async () => {
    const s = await scene();
    const results = await queuedBehind("placement", s.placementId!, [
      () => on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
      () => on(2, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
    ]);
    const answers = results.map((r) => (r.status === "fulfilled" ? r.value : null));
    expect(answers).toEqual(expect.arrayContaining([{ deleted: true, released: 1 }, { deleted: false, released: 0 }]));
    expect(await held(s.ben.id)).toBe(0);
    expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
  });

  it("a deletion and a withdrawal queued on the same lock: no deadlock, one release", async () => {
    const s = await scene();
    const [deletion] = await queuedBehind<unknown>("placement", s.placementId!, [
      () => on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
      () => on(2, () => removeManagedPlacement({ placementId: s.placementId!, expectedVersion: s.article.reviewVersion, actorEmail: "admin@x" })),
    ]);
    expect(deletion.status).toBe("fulfilled");
    expect(await articleExists(s.article.id)).toBe(false);
    expect((await placementOf(s.placementId!)).status).toBe("cancelled");
    expect(await held(s.ben.id)).toBe(0);
  });

  it("a deletion and a verdict queued on the same lock: settled once and kept", async () => {
    const s = await scene();
    await on(0, () => recordArticlePublication(s.article.id, `https://${s.host.domain}/post/`, "publish"));
    await queuedBehind<unknown>("placement", s.placementId!, [
      () => on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
      () => on(2, () => applyCheck(s.placementId!, "alive", 200)),
    ]);
    expect(await placementOf(s.placementId!)).toMatchObject({ status: "live", articleId: null });
    expect((await ledgerOf(s.benOrg)).map((row) => row.amount).sort((a, b) => a - b)).toEqual([-CREDITS, BALANCE]);
    expect((await ledgerOf(s.hostOrg)).map((row) => row.amount)).toEqual([CREDITS]);
  });

  it("a deletion and a delivery claim queued on the article's lock: exactly one goes through", async () => {
    const s = await scene();
    await dbs[0].update(articles).set({ reviewStatus: null }).where(eq(articles.id, s.article.id));
    const [deletion, claim] = await queuedBehind<unknown>("article", s.article.id, [
      () => on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
      () => on(2, () => claimDispatch({ articleId: s.article.id, websiteId: s.host.id, channel: "direct", trigger: "manual", requestedStatus: "publish" })),
    ]);
    const claimed = claim.status === "fulfilled" && (claim.value as { ok: boolean }).ok;
    expect(claimed).toBe(deletion.status === "rejected");
    expect(await articleExists(s.article.id)).toBe(claimed);
    expect(await held(s.ben.id)).toBe(claimed ? CREDITS : 0);
  });

  it("a new match queued on the article's lock with a deletion: nothing stays held", async () => {
    const s = await scene({ linked: false });
    await queuedBehind<unknown>("article", s.article.id, [
      () => on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
      () => on(2, () => s.place(s.article.reviewVersion)),
    ]);
    expect(await articleExists(s.article.id)).toBe(false);
    expect(await held(s.ben.id)).toBe(0);
    expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
  });

  it("two deletions at once: both answer, one does the work, one release", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const results = await Promise.all([
        on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
        on(2, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
      ]);
      expect(results.map((r) => r.deleted).sort()).toEqual([false, true]);
      expect(results.map((r) => r.released).sort()).toEqual([0, 1]);
      expect(await held(s.ben.id)).toBe(0);
      expect(await placementOf(s.placementId!)).toMatchObject({ status: "cancelled", articleId: null });
      expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
      expect(await ledgerOf(s.hostOrg)).toEqual([]);
    }
  });

  it("a deletion and an administrator's withdrawal: never a deadlock, and one release whichever wins", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const [deletion, withdrawal] = await Promise.allSettled([
        on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
        on(2, () => removeManagedPlacement({ placementId: s.placementId!, expectedVersion: s.article.reviewVersion, actorEmail: "admin@x" })),
      ]);
      expect(deletion.status).toBe("fulfilled");
      if (withdrawal.status === "rejected") expect(String(withdrawal.reason)).toMatch(/Placement not found|Article not found/);
      expect(await articleExists(s.article.id)).toBe(false);
      expect(await held(s.ben.id)).toBe(0);
      expect((await placementOf(s.placementId!)).status).toBe("cancelled");
      expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
    }
  });

  it("a deletion and a new match on the same article: a link placed first is released, and none is placed after", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene({ linked: false });
      const [deletion, placing] = await Promise.allSettled([
        on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
        on(2, () => s.place(s.article.reviewVersion)),
      ]);
      expect(deletion.status).toBe("fulfilled");
      if (placing.status === "rejected") expect(String(placing.reason)).toMatch(/Article not found/);
      expect(await articleExists(s.article.id)).toBe(false);
      // Whichever came first, nothing stays held against an article that is gone.
      expect(await held(s.ben.id)).toBe(0);
      for (const request of await requestsOf(s.ben.id)) expect(request).toMatchObject({ status: "cancelled", creditsReserved: 0 });
      expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
    }
  });

  it("a deletion and the article's publication being recorded: released, or left to the verifier, never both", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      await Promise.all([
        on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
        on(2, () => recordArticlePublication(s.article.id, `https://${s.host.domain}/post/`, "publish")),
      ]);
      const placement = await placementOf(s.placementId!);
      expect(placement.articleId).toBeNull();
      if (placement.status === "published") {
        // Recorded first: the link may be up, and the hold waits for the verifier.
        expect(await held(s.ben.id)).toBe(CREDITS);
      } else {
        expect(placement.status).toBe("cancelled");
        expect(placement.liveUrl).toBeNull();
        expect(await held(s.ben.id)).toBe(0);
      }
      expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
    }
  });

  it("a deletion and a delivery claim: the claim wins and the deletion is refused, or the deletion wins and nothing can be sent", async () => {
    let refused = 0;
    let deleted = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      await dbs[0].update(articles).set({ reviewStatus: null }).where(eq(articles.id, s.article.id));
      const [deletion, claim] = await Promise.allSettled([
        on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
        on(2, () => claimDispatch({ articleId: s.article.id, websiteId: s.host.id, channel: "direct", trigger: "manual", requestedStatus: "publish" })),
      ]);
      expect(claim.status).toBe("fulfilled");
      const claimed = claim.status === "fulfilled" && claim.value.ok;
      if (claimed) {
        expect(deletion.status === "rejected" && deletion.reason instanceof ArticleInFlightError).toBe(true);
        expect(await articleExists(s.article.id)).toBe(true);
        expect((await placementOf(s.placementId!)).status).toBe("drafted");
        expect(await held(s.ben.id)).toBe(CREDITS);
        refused++;
      } else {
        expect(deletion.status).toBe("fulfilled");
        expect(claim.status === "fulfilled" && !claim.value.ok && claim.value.reason).toBe("not_found");
        expect(await articleExists(s.article.id)).toBe(false);
        expect(await held(s.ben.id)).toBe(0);
        deleted++;
      }
    }
    expect(refused + deleted).toBe(ROUNDS);
  });

  it("a deletion and the verifier seeing the link: settled once, and the deletion does not undo it", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      await on(0, () => recordArticlePublication(s.article.id, `https://${s.host.domain}/post/`, "publish"));
      await Promise.all([
        on(1, () => deleteArticleAndSettleLinks(s.host.id, s.article.id)),
        on(2, () => applyCheck(s.placementId!, "alive", 200)),
      ]);
      expect(await placementOf(s.placementId!)).toMatchObject({ status: "live", articleId: null });
      expect(await articleExists(s.article.id)).toBe(false);
      const charged = (await ledgerOf(s.benOrg)).filter((row) => row.referenceId === s.placementId);
      const rewarded = (await ledgerOf(s.hostOrg)).filter((row) => row.referenceId === s.placementId);
      expect(charged.map((row) => row.amount)).toEqual([-CREDITS]);
      expect(rewarded.map((row) => row.amount)).toEqual([CREDITS]);
      expect(await held(s.ben.id)).toBe(0);
    }
  });
});
