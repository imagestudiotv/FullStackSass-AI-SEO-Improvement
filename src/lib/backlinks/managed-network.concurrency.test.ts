import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The managed network's locks on REAL Postgres, each contender on its own
 * connection (PGlite has one connection, so it can only run them in turn).
 * The shared `db` is routed per async call, so each call - and its
 * transaction - runs on the connection it was given.
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

import {
  backlinkRequests,
  creditLedger,
  integrationKeys,
  networkSites,
  organization,
  articles,
  websites,
  placements,
} from "@/lib/db/schema";
import { approveArticle, placeManagedLink } from "@/lib/backlinks/managed";
import { applyCheck, recordArticlePublication } from "@/lib/backlinks/placements";
import { provisionFirstKey } from "@/lib/plugin/keys";
import { reviewHash } from "@/lib/articles/review";
import { ArticleInFlightError, claimDispatch, editArticle } from "@/lib/publishing/dispatch";

const available = Boolean(testPostgresUrl());

describe.skipIf(!available)("managed network locks on real Postgres", () => {
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

  async function scene(credits: number) {
    const d = dbs[0];
    const hostOrg = `org_h_${randomUUID().slice(0, 6)}`;
    const benOrg = `org_b_${randomUUID().slice(0, 6)}`;
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
    await d.insert(creditLedger).values({ organizationId: benOrg, type: "purchase", amount: credits });
    const post = async () =>
      (await d.insert(articles).values({ websiteId: host.id, title: "T", status: "draft", reviewStatus: "pending", bodyHtml: "<p>wedding videography matters</p>" }).returning())[0];
    return { hostOrg, benOrg, host, ben, post };
  }

  it("two administrators placing links on separate connections cannot spend one credit twice", async () => {
    const s = await scene(1);
    const [a, b] = [await s.post(), await s.post()];
    const results = await Promise.allSettled([
      on(1, () => placeManagedLink({ articleId: a.id, expectedVersion: a.reviewVersion, beneficiaryWebsiteId: s.ben.id, targetUrl: `https://${s.ben.domain}/a/`, anchor: "wedding videography", credits: 1, actorEmail: "a@x" })),
      on(2, () => placeManagedLink({ articleId: b.id, expectedVersion: b.reviewVersion, beneficiaryWebsiteId: s.ben.id, targetUrl: `https://${s.ben.domain}/b/`, anchor: "wedding videography", credits: 1, actorEmail: "b@x" })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const reserved = await dbs[0].select().from(backlinkRequests).where(eq(backlinkRequests.websiteId, s.ben.id));
    expect(reserved.reduce((sum, r) => sum + r.creditsReserved, 0)).toBe(1);
  });

  it("first-time key provisioning from two connections creates exactly one key", async () => {
    const s = await scene(0);
    const outcomes = await Promise.all([on(1, () => provisionFirstKey(s.host.id)), on(2, () => provisionFirstKey(s.host.id))]);
    expect(outcomes.map((o) => o.kind).sort()).toEqual(["created", "exists"]);
    expect(await dbs[0].select().from(integrationKeys).where(eq(integrationKeys.websiteId, s.host.id))).toHaveLength(1);
  });

  it("two approvals of the same version on two connections: one wins", async () => {
    const s = await scene(0);
    const a = await s.post();
    const results = await Promise.allSettled([
      on(1, () => approveArticle({ articleId: a.id, expectedVersion: a.reviewVersion, actorEmail: "a@x" })),
      on(2, () => approveArticle({ articleId: a.id, expectedVersion: a.reviewVersion, actorEmail: "b@x" })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  });

  it("a dispatch claim and an edit racing on separate connections never both win", async () => {
    const s = await scene(0);
    let claimsWon = 0;
    let editsWon = 0;
    for (let i = 0; i < 12; i++) {
      const [post] = await dbs[0]
        .insert(articles)
        .values({ websiteId: s.host.id, title: `T${i}`, status: "draft", bodyHtml: "<p>body</p>" })
        .returning();
      const prepared = reviewHash(post);
      const [claim, edit] = await Promise.allSettled([
        on(1, () => claimDispatch({ articleId: post.id, websiteId: s.host.id, channel: "direct", trigger: "manual", requestedStatus: "publish", expectedRevision: prepared })),
        on(2, () => editArticle(post.id, (tx) => tx.update(articles).set({ title: `Edited ${i}` }).where(eq(articles.id, post.id)))),
      ]);
      const claimed = claim.status === "fulfilled" && claim.value.ok;
      const edited = edit.status === "fulfilled";
      // Exactly one outcome: the claim sent the prepared revision and the
      // edit was refused, or the edit landed first and the claim held.
      expect(claimed !== edited).toBe(true);
      if (claimed) {
        expect(edit.status === "rejected" && edit.reason instanceof ArticleInFlightError).toBe(true);
        const [row] = await dbs[0].select().from(articles).where(eq(articles.id, post.id));
        expect(reviewHash(row)).toBe(prepared);
        claimsWon++;
      } else {
        expect(claim.status === "fulfilled" && !claim.value.ok && claim.value.reason).toBe("revision_changed");
        editsWon++;
      }
    }
    expect(claimsWon + editsWon).toBe(12);
  });

  it("two dispatch claims for one article on separate connections: exactly one", async () => {
    const s = await scene(0);
    const [post] = await dbs[0].insert(articles).values({ websiteId: s.host.id, title: "T", status: "draft", bodyHtml: "<p>b</p>" }).returning();
    const claim = () => claimDispatch({ articleId: post.id, websiteId: s.host.id, channel: "direct", trigger: "manual", requestedStatus: "publish" });
    const results = await Promise.all([on(1, claim), on(2, claim)]);
    expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
  });

  it("two verifier runs seeing the link live on separate connections settle it once", async () => {
    const s = await scene(3);
    const a = await s.post();
    const placed = await on(0, () =>
      placeManagedLink({ articleId: a.id, expectedVersion: a.reviewVersion, beneficiaryWebsiteId: s.ben.id, targetUrl: `https://${s.ben.domain}/p/`, anchor: "wedding videography", credits: 2, actorEmail: "a@x" }),
    );
    await on(0, () => recordArticlePublication(a.id, `https://${s.host.domain}/post/`, "publish"));
    await Promise.all([on(1, () => applyCheck(placed.placementId, "alive", 200)), on(2, () => applyCheck(placed.placementId, "alive", 200))]);
    const moves = await dbs[0].select().from(creditLedger).where(eq(creditLedger.referenceId, placed.placementId));
    expect(moves.map((m) => [m.organizationId, m.amount]).sort()).toEqual([[s.benOrg, -2], [s.hostOrg, 2]].sort());
    const [p] = await dbs[0].select().from(placements).where(eq(placements.id, placed.placementId));
    expect(p.status).toBe("live");
  });
});
