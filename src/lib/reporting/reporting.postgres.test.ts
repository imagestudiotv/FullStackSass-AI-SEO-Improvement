import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The reporting and dashboard queries on REAL Postgres through postgres-js,
 * the production driver. PGlite accepts things postgres-js does not (a JS
 * Date as a raw-template parameter, for one - which broke every backlinks
 * page in a browser check while the PGlite suite was green), so every query
 * path runs here too: each sort key, the date filters, history, detail,
 * credits and the dashboard.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({ ids: ["x"] })) } }));

import { getDashboardOverview } from "@/lib/dashboard/overview";
import { applyCheck, recordArticlePublication } from "@/lib/backlinks/placements";
import {
  backlinkIssues,
  backlinkMetrics,
  creditActivity,
  linkDetail,
  listLinks,
  parseListQuery,
  receivedHistory,
  resolveWindow,
  SORTS,
  workspaceCredits,
} from "@/lib/reporting/backlinks";
import { requestRecheck } from "@/lib/reporting/recheck";

const available = Boolean(testPostgresUrl());

describe.skipIf(!available)("reporting on real Postgres (postgres-js)", () => {
  let dispose: () => Promise<void>;
  let subject: { websiteId: string; orgId: string; domain: string };
  let live: string;

  beforeAll(async () => {
    const created = await createPostgresTestDb(1);
    state.db = created.dbs[0];
    dispose = created.dispose;
    const d = created.dbs[0] as typeof import("@/lib/db").db;
    const s = await import("@/lib/db/schema");
    const ours = `org_${randomUUID().slice(0, 6)}`;
    const theirs = `org_${randomUUID().slice(0, 6)}`;
    await d.insert(s.organization).values([
      { id: ours, name: "O", slug: ours, createdAt: new Date() },
      { id: theirs, name: "T", slug: theirs, createdAt: new Date() },
    ]);
    const [site] = await d.insert(s.websites).values({ organizationId: ours, url: "https://ours.test", domain: "ours.test" }).returning();
    const [host] = await d.insert(s.websites).values({ organizationId: theirs, url: "https://host.test", domain: "host.test" }).returning();
    await d.insert(s.networkSites).values([{ websiteId: site.id }, { websiteId: host.id }]);
    await d.insert(s.creditLedger).values({ organizationId: ours, type: "purchase", amount: 10 });
    await d.insert(s.domainMetrics).values({ domain: "host.test", provider: "dataforseo", metric: "backlinks_rank", scaleMax: 100, value: 35, status: "ok", observedAt: new Date() });
    await d.insert(s.valuationPolicies).values({ version: 1, currency: "USD", clickValueMode: "fixed", fixedClickRate: "1.50", backlinkRates: [{ minRank: 0, value: 30 }], sources: "Real-Postgres smoke test", effectiveFrom: new Date(Date.now() - 86_400_000) });
    for (const kind of ["live", "published", "drafted"] as const) {
      const [req] = await d.insert(s.backlinkRequests).values({ websiteId: site.id, targetUrl: `https://ours.test/${kind}/`, status: "matched", creditsReserved: 1 }).returning();
      const [art] = await d.insert(s.articles).values({ websiteId: host.id, title: `Host ${kind}`, status: "draft", bodyHtml: "<p>x</p>" }).returning();
      const [p] = await d.insert(s.placements).values({ requestId: req.id, hostWebsiteId: host.id, articleId: art.id, status: "drafted", credits: 1, anchor: "a phrase" }).returning();
      if (kind !== "drafted") await recordArticlePublication(art.id, `https://host.test/${kind}/`, "publish");
      if (kind === "live") {
        await applyCheck(p.id, "alive", 200, new Date(), { rel: "noopener nofollow" });
        live = p.id;
      }
    }
    const [mine] = await d.insert(s.articles).values({ websiteId: site.id, title: "Mine", slug: "mine", status: "published", bodyHtml: "<p>x</p>", publishedUrl: "https://ours.test/mine/" }).returning();
    await d.insert(s.publishLogs).values({ articleId: mine.id, status: "published", remoteId: "1" });
    await d.insert(s.gscPageMetrics).values({ websiteId: site.id, date: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10), pageUrl: "https://ours.test/mine", clicks: 4, impressions: 40 });
    subject = { websiteId: site.id, orgId: ours, domain: site.domain };
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  it("lists with every sort key, both directions, and the date filters", async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const sort of SORTS) {
      for (const dir of ["asc", "desc"]) {
        const page = await listLinks("received", subject, parseListQuery({ sort, dir, from: "2020-01-01", to: today }));
        expect(page.total).toBe(3);
      }
    }
    const verified = await listLinks("received", subject, parseListQuery({ tab: "verified" }));
    expect(verified.rows[0]).toMatchObject({ lifecycle: "verified", value: 30, creditState: "settled" });
    // A UTC timestamp round-trips exactly (no local-zone shift).
    expect(Math.abs(verified.rows[0].eventAt!.getTime() - Date.now())).toBeLessThan(5 * 60_000);
  });

  it("detail, metrics, history, issues, credits and recheck", async () => {
    const detail = await linkDetail("received", subject, live);
    expect(detail).toMatchObject({ rel: "noopener nofollow", firstVerifiedSource: "recorded" });
    const metrics = await backlinkMetrics(subject, resolveWindow("30d"));
    expect(metrics.received).toMatchObject({ verified: 1, firstVerifiedInWindow: 1, awaitingPublication: 1, awaitingVerification: 1 });
    expect(metrics.portfolioValue).toBe(30);
    const history = await receivedHistory(subject, resolveWindow("7d"));
    expect(history.points).toHaveLength(7);
    expect(history.points.at(-1)).toMatchObject({ active: 1, cumulative: 1 });
    expect(await backlinkIssues(subject)).toMatchObject({ hostedArticlesMissingLink: 0 });
    expect(await workspaceCredits(subject.orgId)).toMatchObject({ balance: 9, reserved: 2, spent: 1 });
    expect((await creditActivity(subject.orgId, { page: 1, pageSize: 25 })).total).toBe(2);
    const pending = (await listLinks("received", subject, parseListQuery({ tab: "pending" }))).rows.find((r) => r.lifecycle === "awaiting_verification")!;
    expect(await requestRecheck("received", subject.websiteId, pending.id)).toEqual({ ok: true, revived: false });
  });

  it("the dashboard loads every section", async () => {
    for (const range of ["7d", "30d", "90d", "365d"]) {
      const o = await getDashboardOverview({ websiteId: subject.websiteId, ownerOrgId: subject.orgId, showCredits: true, range });
      expect(o).not.toBeNull();
      for (const section of [o!.backlinks, o!.history, o!.todaysArticle, o!.wins, o!.bestArticles, o!.achievements, o!.search]) {
        expect(section.ok ? "ok" : section.error).toBe("ok");
      }
      if (o!.achievements.ok) expect(o!.achievements.data.clicks).toBe(4);
    }
  });
});
