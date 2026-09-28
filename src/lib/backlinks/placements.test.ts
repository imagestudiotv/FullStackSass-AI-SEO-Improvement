import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  backlinkRequests,
  creditLedger,
  organization,
  placements,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Issue 11: a backlink is charged only once it is SEEN live, refunded
 * exactly once when it is gone, and never on a host's outage.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const linkMock = vi.hoisted(() => ({ checkLinks: vi.fn() }));
vi.mock("@/lib/backlinks/verify", () => linkMock);
vi.mock("@/inngest/client", () => ({
  inngest: { createFunction: (config: unknown, handler: unknown) => ({ config, handler }) },
}));

import {
  applyCheck,
  classifyCheck,
  discoverPublishedPlacements,
  FAILURES_BEFORE_REMOVED,
  markPlacementDrafted,
  placementsDue,
  recordArticlePublication,
} from "@/lib/backlinks/placements";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { verifyBacklinks } from "@/inngest/functions/verify-backlinks";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  linkMock.checkLinks.mockReset();
});

/** Every target on every page: seen, or not. */
function everyLink(alive: boolean) {
  return async (_page: string, targets: string[]) =>
    targets.map(() => ({ alive, httpStatus: 200, error: null }));
}

type Job = {
  config: { concurrency?: unknown; triggers: unknown[] };
  handler: (ctx: unknown) => Promise<{ checked: number; wentLive: number }>;
};

async function runJob() {
  const job = verifyBacklinks as unknown as Job;
  const steps: string[] = [];
  const outcome = await job.handler({
    step: {
      run: (id: string, fn: () => unknown) => {
        steps.push(id);
        return fn();
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { outcome, steps };
}

async function org() {
  const id = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id, name: "W", slug: id, createdAt: new Date() });
  return id;
}

async function site(organizationId: string) {
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId, url: `https://${randomUUID()}.test`, domain: `${randomUUID()}.test` })
    .returning({ id: websites.id });
  return row.id;
}

/** A requester's matched request, hosted on another workspace's site with an article. */
async function scenario() {
  const requesterOrg = await org();
  const hostOrg = await org();
  const requesterSite = await site(requesterOrg);
  const hostSite = await site(hostOrg);
  const [request] = await test.db
    .insert(backlinkRequests)
    .values({ websiteId: requesterSite, targetUrl: "https://requester.test/page", status: "matched", creditsReserved: 5 })
    .returning({ id: backlinkRequests.id });
  const [placement] = await test.db
    .insert(placements)
    .values({ requestId: request.id, hostWebsiteId: hostSite, credits: 5, status: "pending" })
    .returning({ id: placements.id });
  const [article] = await test.db
    .insert(articles)
    .values({ websiteId: hostSite, title: "Host article", status: "draft" })
    .returning({ id: articles.id });
  return { requesterOrg, hostOrg, requestId: request.id, placementId: placement.id, articleId: article.id };
}

async function balance(organizationId: string) {
  const rows = await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, organizationId));
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

async function placementRow(id: string) {
  const [row] = await test.db.select().from(placements).where(eq(placements.id, id));
  return row;
}

async function requestStatus(id: string) {
  const [row] = await test.db.select({ status: backlinkRequests.status }).from(backlinkRequests).where(eq(backlinkRequests.id, id));
  return row.status;
}

describe("before the link is live", () => {
  it("moves no credits when the link is only in a generated draft", async () => {
    const s = await scenario();
    expect(await markPlacementDrafted(s.placementId, s.articleId)).toBe(true);
    expect((await placementRow(s.placementId)).status).toBe("drafted");
    expect(await balance(s.requesterOrg)).toBe(0);
    expect(await balance(s.hostOrg)).toBe(0);
    expect(await requestStatus(s.requestId)).toBe("matched");
  });

  it("does nothing for a failed publish or a CMS draft", async () => {
    const s = await scenario();
    await markPlacementDrafted(s.placementId, s.articleId);
    expect(await recordArticlePublication(s.articleId, null, "publish")).toBe(0);
    expect(await recordArticlePublication(s.articleId, "https://host.test/p", "draft")).toBe(0);
    expect((await placementRow(s.placementId)).status).toBe("drafted");
  });

  it("records the real URL when the article is published, still without charging", async () => {
    const s = await scenario();
    await markPlacementDrafted(s.placementId, s.articleId);
    expect(await recordArticlePublication(s.articleId, "https://host.test/post", "publish")).toBe(1);
    expect(await placementRow(s.placementId)).toMatchObject({ status: "published", liveUrl: "https://host.test/post" });
    expect(await balance(s.requesterOrg)).toBe(0);
  });
});

async function published() {
  const s = await scenario();
  await markPlacementDrafted(s.placementId, s.articleId);
  await recordArticlePublication(s.articleId, "https://host.test/post", "publish");
  return s;
}

describe("verification", () => {
  it("charges the requester and pays the host once the link is seen", async () => {
    const s = await published();
    expect(await applyCheck(s.placementId, "alive", 200)).toBe("went_live");
    expect((await placementRow(s.placementId)).status).toBe("live");
    expect(await requestStatus(s.requestId)).toBe("live");
    expect(await balance(s.requesterOrg)).toBe(-5);
    expect(await balance(s.hostOrg)).toBe(5);
  });

  it("charges once when concurrent or retried checks all see it", async () => {
    const s = await published();
    await Promise.all(Array.from({ length: 5 }, () => applyCheck(s.placementId, "alive", 200)));
    await applyCheck(s.placementId, "alive", 200);
    expect(await balance(s.requesterOrg)).toBe(-5);
    expect(await balance(s.hostOrg)).toBe(5);
  });

  it("never charges a published link that is never seen, and re-matches the request", async () => {
    const s = await published();
    for (let i = 0; i < FAILURES_BEFORE_REMOVED; i += 1) {
      await applyCheck(s.placementId, "missing", 200);
    }
    expect((await placementRow(s.placementId)).status).toBe("unverified");
    expect(await requestStatus(s.requestId)).toBe("pending");
    expect(await balance(s.requesterOrg)).toBe(0);
    expect(await balance(s.hostOrg)).toBe(0);
  });

  it("does not refund on a host outage, however long", async () => {
    const s = await published();
    await applyCheck(s.placementId, "alive", 200);
    for (let i = 0; i < 6; i += 1) await applyCheck(s.placementId, "error", null);
    await applyCheck(s.placementId, "missing", 200);
    await applyCheck(s.placementId, "error", 503);
    await applyCheck(s.placementId, "missing", 200);
    // Two definite misses, with outages between: not yet removed.
    expect((await placementRow(s.placementId)).status).toBe("live");
    expect(await balance(s.requesterOrg)).toBe(-5);
  });

  it("refunds a removed link exactly once, and reverses the host's reward", async () => {
    const s = await published();
    await applyCheck(s.placementId, "alive", 200);
    for (let i = 0; i < FAILURES_BEFORE_REMOVED; i += 1) {
      await applyCheck(s.placementId, "missing", 404);
    }
    expect((await placementRow(s.placementId)).status).toBe("removed");
    // A retried run changes nothing more.
    await Promise.all(Array.from({ length: 3 }, () => applyCheck(s.placementId, "missing", 404)));
    expect(await balance(s.requesterOrg)).toBe(0);
    expect(await balance(s.hostOrg)).toBe(0);
    expect(await requestStatus(s.requestId)).toBe("pending");
  });

  it("classifies what the fetch saw", () => {
    expect(classifyCheck({ alive: true, httpStatus: 200, error: null })).toBe("alive");
    expect(classifyCheck({ alive: false, httpStatus: 200, error: null })).toBe("missing");
    expect(classifyCheck({ alive: false, httpStatus: 410, error: null })).toBe("missing");
    expect(classifyCheck({ alive: false, httpStatus: 503, error: null })).toBe("error");
    expect(classifyCheck({ alive: false, httpStatus: null, error: "timeout" })).toBe("error");
  });

  it("follows a republished article to its new URL", async () => {
    const s = await published();
    await applyCheck(s.placementId, "alive", 200);
    await recordArticlePublication(s.articleId, "https://host.test/moved", "publish");
    expect(await placementRow(s.placementId)).toMatchObject({ status: "live", liveUrl: "https://host.test/moved" });
  });
});

describe("the verification job and legacy placements", () => {
  it("checks published placements as well as live ones", async () => {
    const s = await published();
    linkMock.checkLinks.mockImplementation(everyLink(true));
    const { outcome } = await runJob();
    expect(outcome.wentLive).toBeGreaterThanOrEqual(1);
    expect((await placementRow(s.placementId)).status).toBe("live");
    expect(linkMock.checkLinks).toHaveBeenCalledWith(
      "https://host.test/post",
      expect.arrayContaining(["https://requester.test/page"]),
    );
  });

  it("fetches a page once for all the links on it, and judges each link on its own", async () => {
    // Two links in one article - the managed network allows up to 15.
    const first = await scenario();
    const second = await scenario();
    await test.db
      .update(backlinkRequests)
      .set({ targetUrl: "https://requester.test/other" })
      .where(eq(backlinkRequests.id, second.requestId));
    await markPlacementDrafted(first.placementId, first.articleId);
    await markPlacementDrafted(second.placementId, first.articleId);
    const page = `https://host.test/${randomUUID()}`;
    expect(await recordArticlePublication(first.articleId, page, "publish")).toBe(2);

    // The first link is on the page; the second is not.
    linkMock.checkLinks.mockImplementation(async (_page: string, targets: string[]) =>
      targets.map((t) => ({ alive: t === "https://requester.test/page", httpStatus: 200, error: null })),
    );
    const { steps } = await runJob();

    const fetches = linkMock.checkLinks.mock.calls.filter(([url]) => url === page);
    expect(fetches).toHaveLength(1);
    expect([...fetches[0][1]].sort()).toEqual(["https://requester.test/other", "https://requester.test/page"]);
    // One step for the page, named after its first placement.
    expect(steps.filter((id) => id === `check-page-${first.placementId}` || id === `check-page-${second.placementId}`)).toHaveLength(1);

    expect((await placementRow(first.placementId)).status).toBe("live");
    expect(await balance(first.requesterOrg)).toBe(-5);
    // One miss is not a removal, and nothing was charged for the unseen link.
    expect((await placementRow(second.placementId)).status).toBe("published");
    expect(await balance(second.requesterOrg)).toBe(0);
  });

  it("runs one at a time, every six hours", () => {
    const job = verifyBacklinks as unknown as Job;
    // Overlapping runs would fetch every page twice and count each miss twice toward removal.
    expect(job.config.concurrency).toEqual({ limit: 1 });
    expect(job.config.triggers).toContainEqual({ cron: "0 */6 * * *" });
  });

  it("checks asked-for rechecks first, then links never checked, then the longest unchecked", async () => {
    const stale = await published();
    const neverChecked = await published();
    const asked = await published();
    await test.db
      .update(placements)
      .set({ lastVerifiedAt: new Date(Date.now() - 10 * 86_400_000) })
      .where(eq(placements.id, stale.placementId));
    await test.db
      .update(placements)
      .set({ lastVerifiedAt: new Date(Date.now() - 3_600_000), recheckRequestedAt: new Date() })
      .where(eq(placements.id, asked.placementId));

    const due = await placementsDue(new Date(Date.now() - 24 * 3_600_000), 10_000);
    const mine = [asked.placementId, neverChecked.placementId, stale.placementId];
    // A link never checked has not been charged yet; it must not wait behind re-checks.
    expect(due.map((d) => d.id).filter((id) => mine.includes(id))).toEqual(mine);
  });

  it("gives an old-model live placement its article's URL so it can be verified", async () => {
    const s = await scenario();
    await test.db.update(placements).set({ status: "live", articleId: s.articleId }).where(eq(placements.id, s.placementId));
    await test.db.update(articles).set({ status: "published", publishedUrl: "https://host.test/old" }).where(eq(articles.id, s.articleId));

    await discoverPublishedPlacements();
    expect((await placementRow(s.placementId)).liveUrl).toBe("https://host.test/old");
  });

  it("reports a placement charged under the old model whose article never went live", async () => {
    const s = await scenario();
    await test.db.update(placements).set({ status: "live", articleId: s.articleId }).where(eq(placements.id, s.placementId));
    await test.db.insert(creditLedger).values({
      organizationId: s.requesterOrg,
      type: "link_received",
      amount: -5,
      referenceId: s.placementId,
    });

    const rows = await runReconciliation(test.db, "inconsistentPlacements");
    expect(rows.map((r) => r.placement_id)).toContain(s.placementId);
  });
});
