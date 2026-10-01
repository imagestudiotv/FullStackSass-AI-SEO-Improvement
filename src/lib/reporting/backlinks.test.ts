import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  backlinkRequests,
  creditLedger,
  domainMetrics,
  linkChecks,
  networkSites,
  placements,
  valuationPolicies,
  websites,
} from "@/lib/db/schema";
import { organization } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The shared reporting layer (lib/reporting/backlinks.ts) on a disposable
 * database: direction, event dates, lifecycle and ledger semantics, paging,
 * privacy and the estimate policy.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const inngestMock = vi.hoisted(() => ({ send: vi.fn(async () => ({ ids: ["evt"] })) }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/providers/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providers/dataforseo")>()),
  isDataForSeoConfigured: () => true,
}));

import {
  backlinkIssues,
  backlinkMetrics,
  linkDetail,
  listLinks,
  parseListQuery,
  receivedHistory,
  resolveWindow,
  workspaceCredits,
} from "@/lib/reporting/backlinks";
import { applyCheck, placementsDue, recordArticlePublication, removeMissingPlacement } from "@/lib/backlinks/placements";
import { requestRecheck, requestRecoveryChecks } from "@/lib/reporting/recheck";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  await test.db.delete(valuationPolicies);
});

const DAY = 86_400_000;

async function org(name: string) {
  const id = `org_${name}_${randomUUID().slice(0, 6)}`;
  await test.db.insert(organization).values({ id, name, slug: id, createdAt: new Date() });
  return id;
}
async function site(orgId: string, domain: string) {
  const [row] = await test.db.insert(websites).values({ organizationId: orgId, url: `https://${domain}`, domain, status: "ready" }).returning();
  await test.db.insert(networkSites).values({ websiteId: row.id, acceptingLinks: true, monthlyCap: 10 });
  return row;
}

/** A world: our customer (ours), and partners hosting links to it. */
async function world() {
  const ourOrg = await org("ours");
  const ours = await site(ourOrg, `ours-${randomUUID().slice(0, 6)}.test`);
  const partnerOrg = await org("partner");
  const partnerA = await site(partnerOrg, `a-${randomUUID().slice(0, 6)}.test`);
  const partnerB = await site(partnerOrg, `b-${randomUUID().slice(0, 6)}.test`);
  await test.db.insert(creditLedger).values({ organizationId: ourOrg, type: "purchase", amount: 20 });
  return { ourOrg, ours, partnerOrg, partnerA, partnerB, subject: { websiteId: ours.id, orgId: ourOrg } };
}

/** A placement from host -> beneficiary, taken through the REAL lifecycle to `to`. */
async function link(
  host: { id: string; domain: string },
  beneficiary: { id: string; domain: string },
  to: "drafted" | "published" | "live" | "removed" | "unverified" | "cancelled",
  options: { anchor?: string; title?: string; credits?: number; managed?: boolean } = {},
) {
  const [request] = await test.db
    .insert(backlinkRequests)
    .values({ websiteId: beneficiary.id, targetUrl: `https://${beneficiary.domain}/page-${randomUUID().slice(0, 4)}/`, status: "matched", creditsReserved: options.credits ?? 1 })
    .returning();
  const [article] = await test.db
    .insert(articles)
    .values({ websiteId: host.id, title: options.title ?? "Host article", status: "draft", bodyHtml: "<p>x</p>" })
    .returning();
  const [placement] = await test.db
    .insert(placements)
    .values({ requestId: request.id, hostWebsiteId: host.id, articleId: article.id, status: "drafted", credits: options.credits ?? 1, anchor: options.anchor ?? "wedding films", managed: options.managed ?? true })
    .returning();
  if (to === "drafted") return placement.id;
  if (to === "cancelled") {
    await test.db.update(placements).set({ status: "cancelled" }).where(eq(placements.id, placement.id));
    await test.db.update(backlinkRequests).set({ status: "cancelled", creditsReserved: 0 }).where(eq(backlinkRequests.id, request.id));
    return placement.id;
  }
  await recordArticlePublication(article.id, `https://${host.domain}/post-${placement.id.slice(0, 4)}/`, "publish");
  if (to === "published") return placement.id;
  if (to === "unverified") {
    for (let i = 0; i < 4; i++) await applyCheck(placement.id, "missing", 200);
    return placement.id;
  }
  await applyCheck(placement.id, "alive", 200, new Date(), { rel: "noopener nofollow" });
  if (to === "removed") {
    // Missing by itself moves nothing; an administrator removes it.
    for (let i = 0; i < 4; i++) await applyCheck(placement.id, "missing", 200);
    await removeMissingPlacement(placement.id);
  }
  return placement.id;
}

const q = (overrides: Record<string, string> = {}) => parseListQuery(overrides);

describe("direction", () => {
  it("received = placements whose REQUEST belongs to the site; given = placements it hosts", async () => {
    const w = await world();
    const received = await link(w.partnerA, w.ours, "live");
    const given = await link(w.ours, w.partnerB, "live");
    const inbound = await listLinks("received", w.subject, q());
    const outbound = await listLinks("given", w.subject, q());
    expect(inbound.rows.map((r) => r.id)).toEqual([received]);
    expect(inbound.rows[0].counterpartDomain).toBe(w.partnerA.domain);
    expect(outbound.rows.map((r) => r.id)).toEqual([given]);
    expect(outbound.rows[0].counterpartDomain).toBe(w.partnerB.domain);
    const metrics = await backlinkMetrics({ ...w.subject, domain: w.ours.domain }, resolveWindow("30d"));
    expect(metrics.received.verified).toBe(1);
    expect(metrics.given.verified).toBe(1);
  });
});

describe("lifecycle, tabs and ledger meaning", () => {
  it("maps every state; Pending groups two with distinct labels; Refunded needs a real refund", async () => {
    const w = await world();
    const ids = {
      drafted: await link(w.partnerA, w.ours, "drafted"),
      published: await link(w.partnerA, w.ours, "published"),
      live: await link(w.partnerB, w.ours, "live"),
      removed: await link(w.partnerA, w.ours, "removed"),
      unverified: await link(w.partnerB, w.ours, "unverified"),
      cancelled: await link(w.partnerA, w.ours, "cancelled"),
    };
    const unknown = await link(w.partnerA, w.ours, "drafted");
    await test.db.update(placements).set({ status: "something_new" }).where(eq(placements.id, unknown));

    const all = await listLinks("received", w.subject, q());
    const byId = new Map(all.rows.map((r) => [r.id, r]));
    expect(byId.get(ids.drafted)).toMatchObject({ lifecycle: "awaiting_publication", creditState: "reserved", eventKind: "placed" });
    expect(byId.get(ids.published)).toMatchObject({ lifecycle: "awaiting_verification", creditState: "reserved", eventKind: "published" });
    expect(byId.get(ids.live)).toMatchObject({ lifecycle: "verified", creditState: "settled", eventKind: "verified" });
    expect(byId.get(ids.removed)).toMatchObject({ lifecycle: "removed", creditState: "refunded", eventKind: "removed" });
    expect(byId.get(ids.unverified)).toMatchObject({ lifecycle: "not_found", creditState: "none" });
    expect(byId.get(ids.cancelled)).toMatchObject({ lifecycle: "withdrawn", creditState: "none" });
    expect(byId.get(unknown)).toMatchObject({ lifecycle: "unknown" });

    expect(all.tabCounts).toEqual({ all: 7, verified: 1, pending: 2, refunded: 1 });
    expect((await listLinks("received", w.subject, q({ tab: "refunded" }))).rows.map((r) => r.id)).toEqual([ids.removed]);
    expect((await listLinks("received", w.subject, q({ tab: "pending" }))).rows.map((r) => r.id).sort()).toEqual([ids.drafted, ids.published].sort());
    expect((await listLinks("received", w.subject, q({ issue: "not_found" }))).rows.map((r) => r.id)).toEqual([ids.unverified]);
  });

  it("the partner's unpublished draft is private: no title or anchor, and not searchable", async () => {
    const w = await world();
    await link(w.partnerA, w.ours, "drafted", { anchor: "secret phrase", title: "Unannounced launch" });
    const [row] = (await listLinks("received", w.subject, q())).rows;
    expect(row).toMatchObject({ anchor: null, articleTitle: null, liveUrl: null });
    expect((await listLinks("received", w.subject, q({ q: "secret" }))).total).toBe(0);
    expect((await listLinks("received", w.subject, q({ q: "Unannounced" }))).total).toBe(0);
    // Once published it is public, and searchable.
    const published = await link(w.partnerB, w.ours, "published", { anchor: "public phrase" });
    expect((await listLinks("received", w.subject, q({ q: "public phrase" }))).rows.map((r) => r.id)).toEqual([published]);
  });
});

describe("paging and sorting", () => {
  it("server-side pages with totals; ties broken by id; bounded page sizes", async () => {
    const w = await world();
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push(await link(i % 2 ? w.partnerA : w.partnerB, w.ours, "drafted", { credits: 2 }));
    const p1 = await listLinks("received", w.subject, q({ size: "10", sort: "credits", dir: "asc" }));
    const p2 = await listLinks("received", w.subject, q({ size: "10", sort: "credits", dir: "asc", page: "2" }));
    expect(p1).toMatchObject({ total: 12, page: 1, pageCount: 2 });
    expect(p1.rows).toHaveLength(10);
    expect(p2.rows).toHaveLength(2);
    const seen = [...p1.rows, ...p2.rows].map((r) => r.id);
    expect(new Set(seen).size).toBe(12);
    // All credits equal: the id orders them, identically on every load.
    expect(seen).toEqual([...ids].sort());
    // A page past the end clamps; an unsupported size falls back.
    expect((await listLinks("received", w.subject, q({ size: "10", page: "99" }))).page).toBe(2);
    expect(parseListQuery({ size: "5000" }).pageSize).toBe(25);
  });
});

describe("dates and history come from recorded events", () => {
  it("uses live_at, falls back to the first alive check for older rows, and never guesses", async () => {
    const w = await world();
    const recorded = await link(w.partnerA, w.ours, "live");
    const legacy = await link(w.partnerB, w.ours, "live");
    const firstCheck = new Date(Date.now() - 20 * DAY);
    await test.db.update(placements).set({ liveAt: null }).where(eq(placements.id, legacy));
    await test.db.update(linkChecks).set({ checkedAt: firstCheck }).where(eq(linkChecks.placementId, legacy));
    const undated = await link(w.partnerA, w.ours, "live");
    await test.db.update(placements).set({ liveAt: null }).where(eq(placements.id, undated));
    await test.db.delete(linkChecks).where(eq(linkChecks.placementId, undated));
    await test.db.delete(creditLedger).where(eq(creditLedger.referenceId, undated));

    const detail = (id: string) => linkDetail("received", w.subject, id);
    expect(await detail(recorded)).toMatchObject({ firstVerifiedSource: "recorded" });
    expect(await detail(legacy)).toMatchObject({ firstVerifiedSource: "first_check", firstVerifiedAt: firstCheck });
    expect(await detail(undated)).toMatchObject({ firstVerifiedSource: null, firstVerifiedAt: null, lifecycle: "verified" });

    const history = await receivedHistory(w.subject, resolveWindow("30d"));
    expect(history.undated).toBe(1);
    expect(history.points.at(-1)).toMatchObject({ active: 2, cumulative: 2 });
  });

  it("the active series falls when a link is removed; the cumulative series does not", async () => {
    const w = await world();
    const a = await link(w.partnerA, w.ours, "live");
    await link(w.partnerB, w.ours, "live");
    await test.db.update(placements).set({ liveAt: new Date(Date.now() - 10 * DAY) }).where(eq(placements.id, a));
    for (let i = 0; i < 4; i++) await applyCheck(a, "missing", 200);
    // Removed by an administrator (nothing is removed automatically).
    await removeMissingPlacement(a);
    await test.db.update(placements).set({ removedAt: new Date(Date.now() - 3 * DAY) }).where(eq(placements.id, a));

    const { points } = await receivedHistory(w.subject, resolveWindow("30d"));
    const at = (daysAgo: number) => points[points.length - 1 - daysAgo];
    expect(at(5)).toMatchObject({ active: 1, cumulative: 1 });
    expect(at(0)).toMatchObject({ active: 1, cumulative: 2 });
    expect(points.every((p, i) => i === 0 || p.cumulative >= points[i - 1].cumulative)).toBe(true);
  });

  it("first verifications in the window count removed links too; the verified count is current", async () => {
    const w = await world();
    await link(w.partnerA, w.ours, "removed");
    await link(w.partnerB, w.ours, "live");
    const m = await backlinkMetrics({ ...w.subject, domain: w.ours.domain }, resolveWindow("7d"));
    expect(m.received).toMatchObject({ verified: 1, firstVerifiedInWindow: 2, removed: 1, refunded: 1, referringDomains: 1 });
  });
});

describe("privacy and scope", () => {
  it("a link's credit history shows only this workspace's entries, and other websites' links are not found", async () => {
    const w = await world();
    const id = await link(w.partnerA, w.ours, "live");
    const mine = await linkDetail("received", w.subject, id);
    expect(mine?.credits_history.map((c) => [c.type, c.amount])).toEqual([["link_received", -1]]);
    // The host sees its own reward, not our charge.
    const host = await linkDetail("given", { websiteId: w.partnerA.id, orgId: w.partnerOrg }, id);
    expect(host?.credits_history.map((c) => [c.type, c.amount])).toEqual([["link_given", 1]]);
    // A website that is neither side gets nothing.
    const stranger = await world();
    expect(await linkDetail("received", stranger.subject, id)).toBeNull();
  });

  it("credits are the workspace's: the same figures for every website in it", async () => {
    const w = await world();
    const second = await site(w.ourOrg, `second-${randomUUID().slice(0, 6)}.test`);
    await link(w.partnerA, w.ours, "live", { credits: 3 });
    await link(w.partnerB, second, "drafted", { credits: 2 });
    const credits = await workspaceCredits(w.ourOrg);
    expect(credits).toMatchObject({ scope: "workspace", balance: 17, reserved: 2, available: 15, spent: 3 });
  });

  it("the verification banner counts affected ARTICLES, only confirmed misses, and changes fingerprint on new issues", async () => {
    const w = await world();
    const before = await backlinkIssues(w.subject);
    expect(before.hostedArticlesMissingLink).toBe(0);
    await link(w.ours, w.partnerA, "published"); // awaiting a check: not an issue
    await link(w.ours, w.partnerA, "unverified");
    const after = await backlinkIssues(w.subject);
    expect(after.hostedArticlesMissingLink).toBe(1);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });
});

describe("estimated value", () => {
  it("is null until a policy exists; then per verified link by source band, never for pending links", async () => {
    const w = await world();
    await link(w.partnerA, w.ours, "live");
    await link(w.partnerB, w.ours, "live");
    await link(w.partnerA, w.ours, "published");
    const subject = { ...w.subject, domain: w.ours.domain };
    expect((await backlinkMetrics(subject, resolveWindow("30d"))).portfolioValue).toBeNull();

    await test.db.insert(domainMetrics).values({ domain: w.partnerA.domain, provider: "dataforseo", metric: "backlinks_rank", scaleMax: 100, value: 45, status: "ok", observedAt: new Date() });
    await test.db.insert(valuationPolicies).values({
      version: 1,
      currency: "EUR",
      clickValueMode: "none",
      backlinkRates: [{ minRank: 0, value: 50 }, { minRank: 40, value: 120 }, { minRank: null, value: 20 }],
      sources: "Test rates for the reporting suite",
      effectiveFrom: new Date(Date.now() - DAY),
    });
    const m = await backlinkMetrics(subject, resolveWindow("30d"));
    // A (rank 45) -> 120; B (unknown rank) -> the unknown band, 20.
    expect(m.portfolioValue).toBe(140);
    expect(m.policy?.currency).toBe("EUR");
    const rows = (await listLinks("received", w.subject, q({ sort: "value", dir: "desc" }))).rows;
    expect(rows.map((r) => r.value)).toEqual([120, 20, null]);
    expect(rows[0].authority).toMatchObject({ status: "ok", value: 45, scaleMax: 100 });
    expect(rows[1].authority).toMatchObject({ status: "collecting", value: null });
  });
});

describe("re-checks and credit recovery", () => {
  it("a click only queues a check: no credit moves until the verifier sees the link, and repeats are refused", async () => {
    const w = await world();
    const id = await link(w.partnerA, w.ours, "published");
    const balance = async () => (await workspaceCredits(w.ourOrg)).balance;
    const before = await balance();
    const t0 = new Date();
    expect(await requestRecheck("received", w.ours.id, id, t0)).toEqual({ ok: true, revived: false });
    expect(await balance()).toBe(before);
    expect(await requestRecheck("received", w.ours.id, id, new Date(t0.getTime() + 1000))).toEqual({ ok: false, reason: "queued" });
    // The verifier picks it first, even though it was checked recently.
    const due = await placementsDue(new Date(0), 10);
    expect(due.map((d) => d.id)).toContain(id);
    await applyCheck(id, "alive", 200);
    expect(await balance()).toBe(before - 1);
    // Checked since the request: now the cooldown applies.
    expect(await requestRecheck("received", w.ours.id, id, new Date(t0.getTime() + 2000))).toEqual({ ok: false, reason: "not_checkable" });
  });

  it("only the side that owns the link may ask, and only for its own links", async () => {
    const w = await world();
    const id = await link(w.partnerA, w.ours, "published");
    expect(await requestRecheck("given", w.ours.id, id)).toEqual({ ok: false, reason: "not_found" });
    const stranger = await world();
    expect(await requestRecheck("received", stranger.ours.id, id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("a host that restored a missing link recovers its credits - once, through verification", async () => {
    const w = await world();
    const id = await link(w.ours, w.partnerA, "unverified", { credits: 2 });
    const earned = async () => (await workspaceCredits(w.ourOrg)).earned;
    expect(await earned()).toBe(0);
    expect(await requestRecoveryChecks(w.ours.id)).toEqual({ requested: 1, skipped: 0 });
    // Back to awaiting verification, request open again - nothing earned yet.
    expect((await linkDetail("given", w.subject, id))?.lifecycle).toBe("awaiting_verification");
    expect(await earned()).toBe(0);
    await applyCheck(id, "alive", 200);
    await applyCheck(id, "alive", 200);
    expect(await earned()).toBe(2);
    expect(await requestRecoveryChecks(w.ours.id)).toEqual({ requested: 0, skipped: 0 });
  });

  it("a link whose request was given another placement cannot be revived", async () => {
    const w = await world();
    const id = await link(w.ours, w.partnerA, "unverified");
    const [p] = await test.db.select().from(placements).where(eq(placements.id, id));
    await test.db.insert(placements).values({ requestId: p.requestId, hostWebsiteId: w.partnerB.id, status: "drafted", credits: 1 });
    expect(await requestRecheck("given", w.ours.id, id)).toEqual({ ok: false, reason: "superseded" });
  });
});
