import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Deleting a website or workspace while something else is at work on its links,
 * on REAL Postgres with each contender on its own connection (PGlite has one, so
 * it can only run them in turn). Every race runs for several rounds, because which
 * side wins is up to the server. Every outcome must be a consistent one, and a
 * deadlock is a failure here: Postgres would roll one side back, leaving nothing
 * half done, but somebody would be shown an error for no reason.
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

import { placeManagedLink, removeManagedPlacement } from "@/lib/backlinks/managed";
import { applyCheck, recordArticlePublication } from "@/lib/backlinks/placements";
import { articles, backlinkRequests, creditLedger, networkSites, organization, placements, websites } from "@/lib/db/schema";
import { deleteWebsiteIfBillingResolved, deleteWorkspaceIfBillingResolved } from "@/lib/websites/deletion";

const available = Boolean(testPostgresUrl());
const ROUNDS = 6;
const CREDITS = 20;
const BALANCE = 100;

describe.skipIf(!available)("deleting a website or workspace, racing on real Postgres", () => {
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

  type Scene = Awaited<ReturnType<typeof scene>>;
  const deleteSite = (s: Scene, i: number) => deleteWebsiteIfBillingResolved(dbs[i], { websiteId: s.host.id, organizationId: s.hostOrg });
  const deleteWorkspace = (s: Scene, i: number) => deleteWorkspaceIfBillingResolved(dbs[i], { organizationId: s.hostOrg });

  const siteExists = async (id: string) => (await dbs[0].select({ id: websites.id }).from(websites).where(eq(websites.id, id))).length > 0;
  const placementOf = async (id: string) => (await dbs[0].select().from(placements).where(eq(placements.id, id)))[0];
  const requestsOf = (websiteId: string) => dbs[0].select().from(backlinkRequests).where(eq(backlinkRequests.websiteId, websiteId));
  const ledgerOf = (organizationId: string) => dbs[0].select().from(creditLedger).where(eq(creditLedger.organizationId, organizationId));
  const held = async (websiteId: string) =>
    (await requestsOf(websiteId)).filter((r) => ["pending", "matched"].includes(r.status)).reduce((sum, r) => sum + r.creditsReserved, 0);

  /**
   * Starts the contenders while connection 0 holds a row lock they all come to
   * need, and lets go only once the server shows each one waiting: an overlap that
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

  /** Every request of the partner closed and nothing held: nothing stranded. */
  async function nothingHeld(s: Scene) {
    expect(await held(s.ben.id)).toBe(0);
    for (const request of await requestsOf(s.ben.id)) expect(request).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
  }

  const notFound = /Article not found|Website not found|Placement not found/;

  it.each([
    ["a website", deleteSite],
    ["a workspace", deleteWorkspace],
  ] as const)("%s's deletion and a new match on its article: a link placed first is released, none is placed after", async (_what, remove) => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene({ linked: false });
      const [deletion, placing] = await Promise.allSettled([
        on(1, () => remove(s, 1)),
        on(2, () => s.place(s.article.reviewVersion)),
      ]);
      expect(deletion).toMatchObject({ status: "fulfilled", value: { ok: true } });
      if (placing.status === "rejected") expect(String(placing.reason)).toMatch(notFound);
      expect(await siteExists(s.host.id)).toBe(false);
      await nothingHeld(s);
    }
  });

  it("a deletion and a new match queued on the article's lock: no deadlock, nothing stays held", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene({ linked: false });
      const [deletion, placing] = await queuedBehind<unknown>("article", s.article.id, [
        () => on(1, () => deleteSite(s, 1)),
        () => on(2, () => s.place(s.article.reviewVersion)),
      ]);
      expect(deletion).toMatchObject({ status: "fulfilled", value: { ok: true } });
      if (placing.status === "rejected") expect(String(placing.reason)).toMatch(notFound);
      await nothingHeld(s);
    }
  });

  it("a deletion and an administrator's withdrawal: never a deadlock, one release whichever wins", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const [deletion, withdrawal] = await Promise.allSettled([
        on(1, () => deleteSite(s, 1)),
        on(2, () => removeManagedPlacement({ placementId: s.placementId!, expectedVersion: s.article.reviewVersion, actorEmail: "admin@x" })),
      ]);
      expect(deletion).toMatchObject({ status: "fulfilled", value: { ok: true } });
      if (withdrawal.status === "rejected") expect(String(withdrawal.reason)).toMatch(notFound);
      expect((await placementOf(s.placementId!)).status).toBe("cancelled");
      await nothingHeld(s);
    }
  });

  it("two deletions at once: one does the work, the other finds nothing", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const results = await Promise.all([on(1, () => deleteSite(s, 1)), on(2, () => deleteSite(s, 2))]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "Website not found." });
      await nothingHeld(s);
    }
  });

  it("a website's and its workspace's deletion at once: never a deadlock, one release", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const [site, workspace] = await Promise.allSettled([on(1, () => deleteSite(s, 1)), on(2, () => deleteWorkspace(s, 2))]);
      expect(site.status).toBe("fulfilled");
      expect(workspace).toMatchObject({ status: "fulfilled", value: { ok: true } });
      await nothingHeld(s);
    }
  });

  it("the host's and the partner's websites deleted at once: never a deadlock", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      const [host, partner] = await Promise.allSettled([
        on(1, () => deleteSite(s, 1)),
        on(2, () => deleteWebsiteIfBillingResolved(dbs[2], { websiteId: s.ben.id, organizationId: s.benOrg })),
      ]);
      expect(host).toMatchObject({ status: "fulfilled", value: { ok: true } });
      expect(partner).toMatchObject({ status: "fulfilled", value: { ok: true } });
      expect(await requestsOf(s.ben.id)).toEqual([]);
      expect(await placementOf(s.placementId!)).toBeUndefined();
      expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
    }
  });

  it.each([
    ["a website", deleteSite],
    ["a workspace", deleteWorkspace],
  ] as const)("%s's deletion and the verifier seeing the link: charged once, never a deadlock, and not released as well", async (_what, remove) => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      await on(0, () => recordArticlePublication(s.article.id, `https://${s.host.domain}/post/`, "publish"));
      const [deletion, check] = await Promise.allSettled([on(1, () => remove(s, 1)), on(2, () => applyCheck(s.placementId!, "alive", 200))]);
      expect(deletion).toMatchObject({ status: "fulfilled", value: { ok: true } });
      expect(check).toMatchObject({ status: "fulfilled", value: "went_live" });
      expect(await placementOf(s.placementId!)).toMatchObject({ status: "live", articleId: null, hostWebsiteId: null });
      const charged = (await ledgerOf(s.benOrg)).filter((row) => row.referenceId === s.placementId);
      expect(charged.map((row) => row.amount)).toEqual([-CREDITS]);
      expect(await held(s.ben.id)).toBe(0);
    }
  });

  it("a workspace's deletion queued with the verifier on the placement's lock: no deadlock", async () => {
    const s = await scene();
    await on(0, () => recordArticlePublication(s.article.id, `https://${s.host.domain}/post/`, "publish"));
    const [deletion, check] = await queuedBehind<unknown>("placement", s.placementId!, [
      () => on(1, () => deleteWorkspace(s, 1)),
      () => on(2, () => applyCheck(s.placementId!, "alive", 200)),
    ]);
    expect(deletion).toMatchObject({ status: "fulfilled", value: { ok: true } });
    expect(check).toMatchObject({ status: "fulfilled", value: "went_live" });
    expect((await ledgerOf(s.benOrg)).filter((row) => row.referenceId === s.placementId).map((row) => row.amount)).toEqual([-CREDITS]);
  });

  it("a deletion and the article's publication being recorded: released, or left to the verifier, never both", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const s = await scene();
      await Promise.all([
        on(1, () => deleteSite(s, 1)),
        on(2, () => recordArticlePublication(s.article.id, `https://${s.host.domain}/post/`, "publish")),
      ]);
      const placement = await placementOf(s.placementId!);
      expect(placement.articleId).toBeNull();
      if (placement.status === "published") {
        expect(await held(s.ben.id)).toBe(CREDITS);
      } else {
        expect(placement).toMatchObject({ status: "cancelled", liveUrl: null });
        expect(await held(s.ben.id)).toBe(0);
      }
      expect((await ledgerOf(s.benOrg)).map((row) => row.amount)).toEqual([BALANCE]);
    }
  });
});
