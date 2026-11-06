import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  articles,
  backlinkRequests,
  creditLedger,
  placements,
  websiteMembers,
} from "@/lib/db/schema";
import { member, user } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Deleting an article that carries a placed backlink, through the real server
 * action and permission checks: what its partner's credits do in each placement
 * state, and that nothing is half done, done twice or done for the wrong caller.
 * The same on separate connections: deletion.concurrency.test.ts.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => ({ ids: [] })), createFunction: (config: unknown, handler: unknown) => ({ config, handler }) },
}));

import { deleteArticle } from "@/lib/articles/actions";
import { getAvailable } from "@/lib/backlinks/credits";
import { removeManagedPlacement } from "@/lib/backlinks/managed";
import {
  applyCheck,
  FAILURES_BEFORE_REMOVED,
  placementsDue,
  recordArticlePublication,
  removeMissingPlacement,
} from "@/lib/backlinks/placements";
import { claimDispatch, settleDispatch } from "@/lib/publishing/dispatch";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const CREDITS = 40;
const STARTING_BALANCE = 100;

/** Signs someone in; with `invitedAs`, as a guest of `site` rather than an owner of `orgId`. */
async function signIn(orgId: string, invitedAs?: { websiteId: string; role: "editor" | "viewer" }) {
  const id = `u_${randomUUID()}`;
  await test.db.insert(user).values({ id, name: "C", email: `${id}@e.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await test.db.insert(member).values({ id: `m_${randomUUID()}`, organizationId: orgId, userId: id, role: "owner", createdAt: new Date() });
  if (invitedAs) await test.db.insert(websiteMembers).values({ websiteId: invitedAs.websiteId, userId: id, role: invitedAs.role });
  state.session = { user: { id, email: `${id}@e.test`, emailVerified: true }, session: { id: `s_${id}`, activeOrganizationId: orgId } };
}

/** A host with an article, and a partner holding credits; signed in as the host. */
async function world() {
  const host = await seedWebsite(test);
  const partner = await seedWebsite(test);
  await test.db.insert(creditLedger).values({ organizationId: partner.orgId, type: "purchase", amount: STARTING_BALANCE, idempotencyKey: `purchase:${randomUUID()}` });
  const [article] = await test.db
    .insert(articles)
    .values({ websiteId: host.websiteId, title: "Host article", status: "draft", bodyHtml: "<p>Text</p>" })
    .returning();
  await signIn(host.orgId);
  return { host, partner, article };
}

type World = Awaited<ReturnType<typeof world>>;

/** A partner's link in the article, in a stage reached directly: nothing about it has been charged. */
async function link(w: World, status: string, options: { managed?: boolean; articleId?: string; requestStatus?: string; liveUrl?: string } = {}) {
  const [request] = await test.db
    .insert(backlinkRequests)
    .values({ websiteId: w.partner.websiteId, targetUrl: `https://partner.test/${randomUUID()}`, status: options.requestStatus ?? "matched", creditsReserved: CREDITS })
    .returning();
  const [placement] = await test.db
    .insert(placements)
    .values({
      requestId: request.id,
      hostWebsiteId: w.host.websiteId,
      articleId: options.articleId ?? w.article.id,
      anchor: "anchor",
      credits: CREDITS,
      status,
      managed: options.managed ?? true,
      liveUrl: options.liveUrl ?? null,
    })
    .returning();
  return { requestId: request.id, placementId: placement.id };
}

/** A link taken through the real lifecycle to live: charged and rewarded, once. */
async function liveLink(w: World) {
  const placed = await link(w, "drafted");
  await recordArticlePublication(w.article.id, "https://host.test/post", "publish");
  expect(await applyCheck(placed.placementId, "alive", 200)).toBe("went_live");
  return placed;
}

const placementOf = async (id: string) => (await test.db.select().from(placements).where(eq(placements.id, id)))[0];
const requestOf = async (id: string) => (await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.id, id)))[0];
const articleExists = async (id: string) => (await test.db.select({ id: articles.id }).from(articles).where(eq(articles.id, id))).length > 0;
/** Every row of a workspace's ledger, ids and all: nothing edited, deleted or added. */
const ledgerOf = (organizationId: string) => test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, organizationId)).orderBy(desc(creditLedger.createdAt), desc(creditLedger.id));
/** The ledger as readable movements, newest first. */
const movements = async (organizationId: string) => (await ledgerOf(organizationId)).map((row) => [row.type, row.amount, row.idempotencyKey?.replace(/^purchase:.*/, "purchase")]);

/** Everything money-related about the link, for "no change at all". */
async function snapshot(w: World, placed: { requestId: string; placementId: string }) {
  return {
    placement: await placementOf(placed.placementId),
    request: await requestOf(placed.requestId),
    partnerLedger: await ledgerOf(w.partner.orgId),
    hostLedger: await ledgerOf(w.host.orgId),
    partner: await getAvailable(w.partner.orgId),
  };
}

describe("a link not yet on the website: the hold is released, nothing else moves", () => {
  it.each(["pending", "drafted"])("a %s placement: closed, its reservation back, and no ledger row for anyone", async (status) => {
    const w = await world();
    const placed = await link(w, status);
    const partnerBefore = await ledgerOf(w.partner.orgId);
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE, reserved: CREDITS, available: STARTING_BALANCE - CREDITS });

    expect(await deleteArticle(w.host.websiteId, w.article.id)).toEqual({ ok: true, data: null });

    expect(await articleExists(w.article.id)).toBe(false);
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled", articleId: null, liveUrl: null });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE, reserved: 0, available: STARTING_BALANCE });
    // The ledger is untouched: the credits were held, never charged.
    expect(await ledgerOf(w.partner.orgId)).toEqual(partnerBefore);
    expect(await ledgerOf(w.host.orgId)).toEqual([]);
  });

  it("the automatic network's links too, though nothing manages them", async () => {
    const w = await world();
    const placed = await link(w, "drafted", { managed: false });
    await deleteArticle(w.host.websiteId, w.article.id);
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect((await getAvailable(w.partner.orgId)).reserved).toBe(0);
  });

  it("releases only this article's links: the partner's link in another article stays held", async () => {
    const w = await world();
    const [other] = await test.db.insert(articles).values({ websiteId: w.host.websiteId, title: "Other", status: "draft" }).returning();
    await link(w, "drafted");
    const elsewhere = await link(w, "drafted", { articleId: other.id });
    await deleteArticle(w.host.websiteId, w.article.id);
    expect(await requestOf(elsewhere.requestId)).toMatchObject({ status: "matched", creditsReserved: CREDITS });
    expect(await placementOf(elsewhere.placementId)).toMatchObject({ status: "drafted", articleId: other.id });
    expect((await getAvailable(w.partner.orgId)).reserved).toBe(CREDITS);
  });

  it("every link in the article, and those in its translations, which are deleted with it", async () => {
    const w = await world();
    const [translation] = await test.db
      .insert(articles)
      .values({ websiteId: w.host.websiteId, title: "Tradotto", status: "draft", translationOf: w.article.id, languageCode: "it" })
      .returning();
    const inOriginal = [await link(w, "drafted"), await link(w, "pending")];
    const inTranslation = await link(w, "drafted", { articleId: translation.id });
    await deleteArticle(w.host.websiteId, w.article.id);
    expect(await articleExists(translation.id)).toBe(false);
    for (const placed of [...inOriginal, inTranslation]) {
      expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    }
    expect((await getAvailable(w.partner.orgId)).reserved).toBe(0);
  });

  it("a placement never seen after publishing: released, since nobody can correct the article now", async () => {
    const w = await world();
    const placed = await link(w, "unverified", { requestStatus: "pending", liveUrl: "https://host.test/post" });
    const partnerBefore = await ledgerOf(w.partner.orgId);
    await deleteArticle(w.host.websiteId, w.article.id);
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled", articleId: null });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect(await ledgerOf(w.partner.orgId)).toEqual(partnerBefore);
  });

  it("the request another placement has taken over keeps its hold", async () => {
    const w = await world();
    const [other] = await test.db.insert(articles).values({ websiteId: w.host.websiteId, title: "Other", status: "draft" }).returning();
    const placed = await link(w, "unverified", { requestStatus: "matched", liveUrl: "https://host.test/post" });
    const [newer] = await test.db
      .insert(placements)
      .values({ requestId: placed.requestId, hostWebsiteId: w.host.websiteId, articleId: other.id, credits: CREDITS, status: "drafted", managed: true })
      .returning();
    await deleteArticle(w.host.websiteId, w.article.id);
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled" });
    expect(await placementOf(newer.id)).toMatchObject({ status: "drafted" });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "matched", creditsReserved: CREDITS });
  });
});

describe("a link that may be on the website: the verifier still settles it", () => {
  it("published and later seen: charged and rewarded once, exactly as if the article were still here", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    await recordArticlePublication(w.article.id, "https://host.test/post", "publish");
    await deleteArticle(w.host.websiteId, w.article.id);

    expect(await placementOf(placed.placementId)).toMatchObject({ status: "published", articleId: null, liveUrl: "https://host.test/post" });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "matched", creditsReserved: CREDITS });
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE, reserved: CREDITS, available: STARTING_BALANCE - CREDITS });
    expect((await placementsDue(new Date(), 500)).map((row) => row.id)).toContain(placed.placementId);

    expect(await applyCheck(placed.placementId, "alive", 200)).toBe("went_live");
    expect(await movements(w.partner.orgId)).toEqual([
      ["link_received", -CREDITS, `placement:${placed.placementId}:charge`],
      ["purchase", STARTING_BALANCE, "purchase"],
    ]);
    expect(await movements(w.host.orgId)).toEqual([["link_given", CREDITS, `placement:${placed.placementId}:host_reward`]]);
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE - CREDITS, reserved: 0, available: STARTING_BALANCE - CREDITS });
  });

  it("published and never seen: the verdict releases the hold, with no ledger row, since there is no article left to fix", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    await recordArticlePublication(w.article.id, "https://host.test/post", "publish");
    await deleteArticle(w.host.websiteId, w.article.id);

    const started = Date.now();
    const verdicts = [];
    for (let i = 0; i < FAILURES_BEFORE_REMOVED; i++) verdicts.push(await applyCheck(placed.placementId, "missing", 200, new Date(started + i * 1000)));

    expect(verdicts).toEqual([null, null, "unverified"]);
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "cancelled", articleId: null });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE, reserved: 0, available: STARTING_BALANCE });
    expect(await movements(w.host.orgId)).toEqual([]);
  });

  it("an article still here keeps the rule it always had: never seen keeps the hold for a recheck", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    await recordArticlePublication(w.article.id, "https://host.test/post", "publish");
    const started = Date.now();
    for (let i = 0; i < FAILURES_BEFORE_REMOVED; i++) await applyCheck(placed.placementId, "missing", 200, new Date(started + i * 1000));
    expect(await placementOf(placed.placementId)).toMatchObject({ status: "unverified", articleId: w.article.id });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "pending", creditsReserved: CREDITS });
  });

  it("live and settled: no refund, no reversal, nothing changes but the lost article, and it is still checked", async () => {
    const w = await world();
    const placed = await liveLink(w);
    const before = await snapshot(w, placed);

    await deleteArticle(w.host.websiteId, w.article.id);

    const after = await snapshot(w, placed);
    expect(after.partnerLedger).toEqual(before.partnerLedger);
    expect(after.hostLedger).toEqual(before.hostLedger);
    expect(after.partner).toEqual({ balance: STARTING_BALANCE - CREDITS, reserved: 0, available: STARTING_BALANCE - CREDITS });
    expect(after.request).toEqual(before.request);
    expect(after.placement).toMatchObject({ status: "live", articleId: null, liveUrl: "https://host.test/post" });
    const nextDay = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect((await placementsDue(nextDay, 500)).map((row) => row.id)).toContain(placed.placementId);
  });
});

describe("a link already finished: no second movement", () => {
  it("withdrawn by an administrator before the deletion", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    await test.db.update(articles).set({ reviewStatus: "pending" }).where(eq(articles.id, w.article.id));
    await removeManagedPlacement({ placementId: placed.placementId, expectedVersion: w.article.reviewVersion, actorEmail: "admin@x.test" });
    const before = await snapshot(w, placed);

    await deleteArticle(w.host.websiteId, w.article.id);

    const after = await snapshot(w, placed);
    expect(after.request).toEqual(before.request);
    expect(after.partnerLedger).toEqual(before.partnerLedger);
    expect(after.hostLedger).toEqual(before.hostLedger);
    expect(after.placement).toMatchObject({ status: "cancelled", articleId: null });
    expect(after.placement.updatedAt).toEqual(before.placement.updatedAt);
  });

  it("settled and then removed by an administrator: the one refund and reversal stand", async () => {
    const w = await world();
    const placed = await liveLink(w);
    expect((await removeMissingPlacement(placed.placementId)).removed).toBe(true);
    const before = await snapshot(w, placed);
    expect(await movements(w.host.orgId)).toEqual(
      expect.arrayContaining([
        ["link_given", CREDITS, `placement:${placed.placementId}:host_reward`],
        ["adjustment", -CREDITS, `placement:${placed.placementId}:host_reversal`],
      ]),
    );

    await deleteArticle(w.host.websiteId, w.article.id);

    const after = await snapshot(w, placed);
    expect(after.request).toEqual(before.request);
    expect(after.partnerLedger).toEqual(before.partnerLedger);
    expect(after.hostLedger).toEqual(before.hostLedger);
    expect(after.placement).toMatchObject({ status: "removed", articleId: null });
  });
});

describe("failures and repeats", () => {
  it("a failure part way leaves everything as it was, and the retry finishes the job once", async () => {
    const w = await world();
    const links = [await link(w, "drafted"), await link(w, "drafted")];
    const before = await Promise.all(links.map((placed) => snapshot(w, placed)));
    // The delete itself fails, after every release in the transaction has run.
    await test.client.exec(`
      create function refuse_article_delete() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end $$;
      create trigger refuse_article_delete before delete on articles for each row execute function refuse_article_delete();
    `);
    try {
      await expect(deleteArticle(w.host.websiteId, w.article.id)).rejects.toThrow();
    } finally {
      await test.client.exec(`drop trigger refuse_article_delete on articles; drop function refuse_article_delete();`);
    }

    expect(await articleExists(w.article.id)).toBe(true);
    expect(await Promise.all(links.map((placed) => snapshot(w, placed)))).toEqual(before);
    expect((await getAvailable(w.partner.orgId)).reserved).toBe(2 * CREDITS);

    expect(await deleteArticle(w.host.websiteId, w.article.id)).toEqual({ ok: true, data: null });

    expect(await articleExists(w.article.id)).toBe(false);
    expect(await getAvailable(w.partner.orgId)).toEqual({ balance: STARTING_BALANCE, reserved: 0, available: STARTING_BALANCE });
    expect(await movements(w.partner.orgId)).toEqual([["purchase", STARTING_BALANCE, "purchase"]]);
  });

  it("deleting twice: the second finds nothing to do and changes nothing", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    await deleteArticle(w.host.websiteId, w.article.id);
    const before = await snapshot(w, placed);

    expect(await deleteArticle(w.host.websiteId, w.article.id)).toEqual({ ok: true, data: null });

    expect(await snapshot(w, placed)).toEqual(before);
  });

  it("while a revision is being delivered the deletion is refused and nothing changes; once it has landed, it goes through", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const claim = await claimDispatch({ articleId: w.article.id, websiteId: w.host.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish" });
    if (!claim.ok) throw new Error(claim.reason);
    const before = await snapshot(w, placed);

    const refused = await deleteArticle(w.host.websiteId, w.article.id);

    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/being delivered/);
    expect(await articleExists(w.article.id)).toBe(true);
    expect(await snapshot(w, placed)).toEqual(before);

    await settleDispatch(claim.dispatchId, { status: "failed", error: "refused" });
    expect(await deleteArticle(w.host.websiteId, w.article.id)).toEqual({ ok: true, data: null });
    expect(await articleExists(w.article.id)).toBe(false);
    expect((await getAvailable(w.partner.orgId)).reserved).toBe(0);
  });
});

describe("who may delete", () => {
  const unchanged = async (w: World, placed: { requestId: string; placementId: string }, before: Awaited<ReturnType<typeof snapshot>>) => {
    expect(await articleExists(w.article.id)).toBe(true);
    expect(await snapshot(w, placed)).toEqual(before);
    expect((await getAvailable(w.partner.orgId)).reserved).toBe(CREDITS);
  };

  it("someone from another workspace: refused as if the website did not exist", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    const stranger = await seedWebsite(test);
    await signIn(stranger.orgId);
    await expect(deleteArticle(w.host.websiteId, w.article.id)).rejects.toThrow();
    await unchanged(w, placed, before);
  });

  it("the partner whose credits are held: refused too", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    await signIn(w.partner.orgId);
    await expect(deleteArticle(w.host.websiteId, w.article.id)).rejects.toThrow();
    await unchanged(w, placed, before);
  });

  it("a viewer invited to the website: refused", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    const guest = await seedWebsite(test);
    await signIn(guest.orgId, { websiteId: w.host.websiteId, role: "viewer" });
    expect(await deleteArticle(w.host.websiteId, w.article.id)).toEqual({ ok: false, error: "You have view-only access to this website." });
    await unchanged(w, placed, before);
  });

  it("an owner naming their own website and another website's article: nothing happens", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const before = await snapshot(w, placed);
    const attacker = await seedWebsite(test);
    await signIn(attacker.orgId);
    await deleteArticle(attacker.websiteId, w.article.id);
    await unchanged(w, placed, before);
  });

  it("another website's article being delivered: not even its dispatch is touched", async () => {
    const w = await world();
    const claim = await claimDispatch({ articleId: w.article.id, websiteId: w.host.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish", now: new Date(Date.now() - 60 * 60 * 1000) });
    if (!claim.ok) throw new Error(claim.reason);
    const attacker = await seedWebsite(test);
    await signIn(attacker.orgId);
    expect(await deleteArticle(attacker.websiteId, w.article.id)).toEqual({ ok: true, data: null });
    // A stale claim is settled by anything that takes the article's edit lock: this took none.
    const [row] = await test.client.query<{ status: string }>(`select status from publication_dispatches where id = '${claim.dispatchId}'`).then((r) => r.rows);
    expect(row.status).toBe("in_flight");
  });

  it("an editor invited to the website may delete, and the release follows", async () => {
    const w = await world();
    const placed = await link(w, "drafted");
    const guest = await seedWebsite(test);
    await signIn(guest.orgId, { websiteId: w.host.websiteId, role: "editor" });
    expect(await deleteArticle(w.host.websiteId, w.article.id)).toEqual({ ok: true, data: null });
    expect(await requestOf(placed.requestId)).toMatchObject({ status: "cancelled", creditsReserved: 0 });
  });
});
