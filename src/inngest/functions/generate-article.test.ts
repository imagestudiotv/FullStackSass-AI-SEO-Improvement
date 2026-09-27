import { readFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

// The queue and every paid provider are mocked; nothing leaves the process.
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
const providers = vi.hoisted(() => ({
  generateOutline: vi.fn(),
  generateBody: vi.fn(),
  sanitizeHtml: (html: string) => html,
  countWords: () => 0,
}));
vi.mock("@/lib/articles/generate", () => providers);
vi.mock("@/lib/images/generate", () => ({
  isImageGenerationConfigured: () => false,
  generateArticleImage: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));

import { deliverJobs, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { checkLimit } from "@/lib/usage";

import {
  generateArticle,
  queueArticleForCalendarItem,
  requeueArticle,
  REWRITES_PER_WEBSITE_PER_DAY,
} from "./generate-article";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from job_outbox");
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: ["evt"] });
  providers.generateOutline.mockReset();
  providers.generateBody.mockReset();
});

/** Drives delivery past its last attempt, as the outbox cron would. */
async function giveUpDelivery() {
  await test.client.query("update job_outbox set attempts = $1 where status = 'pending'", [
    MAX_DELIVERY_ATTEMPTS - 1,
  ]);
  await deliverJobs(test.db, { now: new Date(Date.now() + 24 * 3600 * 1000) });
}

async function seedArticle(websiteId: string, calendarItemId: string, status = "draft") {
  const [row] = await test.db
    .insert(articles)
    .values({ websiteId, calendarItemId, title: "Existing", status, bodyHtml: "<p>hi</p>" })
    .returning({ id: articles.id });
  return row.id;
}

async function statusOf(articleId: string) {
  const [row] = await test.db
    .select({ status: articles.status })
    .from(articles)
    .where(eq(articles.id, articleId));
  return row?.status;
}

async function reservationStates(key: string) {
  const { rows } = await test.client.query<{ state: string }>(
    "select state from spend_reservations where key = $1 order by created_at",
    [key],
  );
  return rows.map((r) => r.state);
}

async function cancel(websiteId: string) {
  await test.client.query("update subscriptions set status = 'canceled' where website_id = $1", [websiteId]);
}

describe("regenerating an existing article", () => {
  it.each(["canceled", "unpaid", "incomplete_expired"])(
    "is refused when the subscription is %s",
    async (status) => {
      const { websiteId } = await seedWebsite(test, { status });
      const itemId = await seedCalendarItem(test, websiteId);
      const articleId = await seedArticle(websiteId, itemId);

      const outcome = await queueArticleForCalendarItem(websiteId, itemId);

      expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/no active plan/) });
      expect(inngestMock.send).not.toHaveBeenCalled();
      expect(await statusOf(articleId)).toBe("draft");
    },
  );

  it("queues once for a paying customer, billed to the website's owner", async () => {
    const { orgId, websiteId } = await seedWebsite(test, { status: "past_due" });
    const itemId = await seedCalendarItem(test, websiteId);
    const articleId = await seedArticle(websiteId, itemId, "failed");

    expect(await queueArticleForCalendarItem(websiteId, itemId)).toEqual({ ok: true, articleId });
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
    const event = inngestMock.send.mock.calls[0][0];
    expect(event.data).toMatchObject({
      articleId,
      websiteId,
      organizationId: orgId,
      reservations: [{ key: `article-rewrite:${websiteId}` }],
    });
    // Idempotency key, so a retried send cannot start the work twice.
    expect(event.id).toBe(`article-generate:${event.data.reservations[0].id}`);
  });

  it("queues exactly one job for simultaneous presses", async () => {
    const { websiteId } = await seedWebsite(test);
    const itemId = await seedCalendarItem(test, websiteId);
    await seedArticle(websiteId, itemId);

    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => queueArticleForCalendarItem(websiteId, itemId)),
    );

    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
    const states = await reservationStates(`article-rewrite:${websiteId}`);
    expect(states.filter((s) => s === "reserved")).toHaveLength(1);
  });

  it("stops after the daily rewrite allowance", async () => {
    const { websiteId } = await seedWebsite(test);
    const itemId = await seedCalendarItem(test, websiteId);
    const articleId = await seedArticle(websiteId, itemId);

    for (let i = 0; i < REWRITES_PER_WEBSITE_PER_DAY; i += 1) {
      await test.db.update(articles).set({ status: "draft" }).where(eq(articles.id, articleId));
      expect((await requeueArticle({ websiteId, articleId, status: "queued" })).ok).toBe(true);
    }
    await test.db.update(articles).set({ status: "draft" }).where(eq(articles.id, articleId));

    expect(await requeueArticle({ websiteId, articleId, status: "queued" })).toEqual({
      ok: false,
      error: expect.stringMatching(/Try again later/),
    });
  });

  it("keeps a rewrite queued while the queue is down; a draft goes back only if delivery is given up", async () => {
    const { websiteId } = await seedWebsite(test);
    const itemId = await seedCalendarItem(test, websiteId);
    const articleId = await seedArticle(websiteId, itemId);
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    expect((await requeueArticle({ websiteId, articleId, status: "queued" })).ok).toBe(true);
    expect(await statusOf(articleId)).toBe("queued");
    expect(await reservationStates(`article-rewrite:${websiteId}`)).toEqual(["reserved"]);

    await giveUpDelivery();
    expect(await statusOf(articleId)).toBe("draft");
    expect(await reservationStates(`article-rewrite:${websiteId}`)).toEqual(["released"]);
  });

  it("delivers once the queue recovers, without a second job for a lost acknowledgement", async () => {
    const { websiteId } = await seedWebsite(test);
    const articleId = await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    // Inngest accepted it, but the answer never reached us.
    const accepted = new Set<string>();
    inngestMock.send.mockImplementation(async (event: { id: string }) => {
      const duplicate = accepted.has(event.id);
      accepted.add(event.id);
      if (!duplicate && accepted.size === 1) throw new Error("socket hang up");
      return { ids: [event.id] };
    });

    expect((await requeueArticle({ websiteId, articleId, status: "queued" })).ok).toBe(true);
    await deliverJobs(test.db, { now: new Date(Date.now() + 3600 * 1000) });

    // Retried with the SAME event id, which Inngest de-duplicates.
    const ids = inngestMock.send.mock.calls.map((call) => call[0].id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
    const { rows } = await test.client.query<{ status: string }>("select status from job_outbox");
    expect(rows).toEqual([{ status: "sent" }]);
  });

  it("cannot reach another tenant's article", async () => {
    const mine = await seedWebsite(test);
    const theirs = await seedWebsite(test);
    const theirArticle = await seedArticle(theirs.websiteId, await seedCalendarItem(test, theirs.websiteId));

    expect(
      await requeueArticle({ websiteId: mine.websiteId, articleId: theirArticle, status: "queued" }),
    ).toEqual({ ok: false, error: "Article not found" });
    expect(await statusOf(theirArticle)).toBe("draft");
  });
});

describe("the monthly allowance", () => {
  it("never exceeds the limit under simultaneous requests", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    const items = await Promise.all(Array.from({ length: 6 }, () => seedCalendarItem(test, websiteId)));

    const outcomes = await Promise.all(items.map((id) => queueArticleForCalendarItem(websiteId, id)));

    expect(outcomes.filter((o) => o.ok)).toHaveLength(2);
    expect(await test.db.select().from(articles).where(eq(articles.websiteId, websiteId))).toHaveLength(2);
  });

  it("creates one row for one calendar item however many presses arrive", async () => {
    const { websiteId } = await seedWebsite(test);
    const itemId = await seedCalendarItem(test, websiteId);

    await Promise.all(Array.from({ length: 5 }, () => queueArticleForCalendarItem(websiteId, itemId)));

    expect(await test.db.select().from(articles).where(eq(articles.calendarItemId, itemId))).toHaveLength(1);
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
  });

  it("is not handed back by deleting the article (generate, delete, repeat)", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 1 });
    const first = await seedCalendarItem(test, websiteId);
    const created = await queueArticleForCalendarItem(websiteId, first);
    expect(created.ok).toBe(true);

    await test.db.delete(articles).where(eq(articles.websiteId, websiteId));

    expect((await queueArticleForCalendarItem(websiteId, first)).ok).toBe(false);
    const second = await seedCalendarItem(test, websiteId);
    expect(await queueArticleForCalendarItem(websiteId, second)).toEqual({
      ok: false,
      error: expect.stringMatching(/all been used/),
    });
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
  });

  it("still counts articles written before the ledger existed", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    // Two rows from before rollout: no ledger entries behind them.
    await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    await seedArticle(websiteId, await seedCalendarItem(test, websiteId));

    expect(await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId))).toEqual({
      ok: false,
      error: expect.stringMatching(/all been used/),
    });
  });

  it("keeps historical consumption durable: limit 3, two legacy, one new, delete the new", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 3 });
    // Two articles from before the ledger: rows only, no reservations.
    await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    expect((await checkLimit(websiteId, "articles")).used).toBe(2);

    const created = await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId));
    if (!created.ok) throw new Error(created.error);
    expect((await checkLimit(websiteId, "articles")).used).toBe(3);

    // The old max(ledger, rows) counted max(1, 2) = 2 here and allowed a fourth.
    await test.db.delete(articles).where(eq(articles.id, created.articleId));
    expect((await checkLimit(websiteId, "articles")).used).toBe(3);
    expect(await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId))).toEqual({
      ok: false,
      error: expect.stringMatching(/all been used/),
    });

    // Deleting the legacy ones changes nothing either: they are ledger now.
    await test.db.delete(articles).where(eq(articles.websiteId, websiteId));
    expect((await checkLimit(websiteId, "articles")).used).toBe(3);
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
  });

  it("migration 0041 records the baseline once and never double-counts ledger articles", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 5 });
    await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    const baseline = readFileSync(
      path.resolve(__dirname, "../../../drizzle/0041_article_allowance_baseline.sql"),
      "utf8",
    );
    await test.client.exec(baseline); // the migration: the legacy article becomes ledger

    const created = await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId));
    if (!created.ok) throw new Error(created.error);
    // Re-run as a post-deploy reconciliation: the new article is already covered.
    await test.client.exec(baseline);

    const { rows } = await test.client.query<{ operation: string; n: number }>(
      `select operation, count(*)::int as n from spend_reservations
       where key = $1 group by operation order by operation`,
      [`articles:${websiteId}`],
    );
    expect(rows).toEqual([
      { operation: "article.generate", n: 1 },
      { operation: "article.legacy", n: 1 },
    ]);
    expect((await checkLimit(websiteId, "articles")).used).toBe(2);
  });

  /*
    The cutover gap (migration 0042): an article the OLD code creates - a row
    with no reservation - and deletes before the new code reserves for that
    site used to give its slot back. The trigger makes it ledger on insert.
  */
  it("counts an article old code created and deleted before any new reservation", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    const oldCodeArticle = await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    await test.db.delete(articles).where(eq(articles.id, oldCodeArticle));

    expect((await checkLimit(websiteId, "articles")).used).toBe(1);
    const { rows } = await test.client.query<{ operation: string; subject_id: string }>(
      "select operation, subject_id from spend_reservations where key = $1",
      [`articles:${websiteId}`],
    );
    expect(rows).toEqual([{ operation: "article.legacy", subject_id: oldCodeArticle }]);
  });

  it("does not re-count an article whose job was never delivered and whose slot was returned", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    const first = await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId));
    if (!first.ok) throw new Error(first.error);
    await giveUpDelivery();
    expect(await statusOf(first.articleId)).toBe("failed");
    expect((await checkLimit(websiteId, "articles")).used).toBe(0);

    // The next reservation runs the baseline: the failed article stays uncounted.
    inngestMock.send.mockResolvedValue({ ids: [] });
    expect((await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId))).ok).toBe(true);
    expect((await checkLimit(websiteId, "articles")).used).toBe(1);
    expect((await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId))).ok).toBe(true);
  });

  it("is refused for a cancelled plan", async () => {
    const { websiteId } = await seedWebsite(test, { status: "canceled" });
    expect((await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId))).ok).toBe(false);
    expect(await test.db.select().from(articles).where(eq(articles.websiteId, websiteId))).toHaveLength(0);
  });

  it("records the article, its slot and its job together, and survives a queue outage", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 1 });
    const itemId = await seedCalendarItem(test, websiteId);
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    expect((await queueArticleForCalendarItem(websiteId, itemId)).ok).toBe(true);
    const [row] = await test.db.select().from(articles).where(eq(articles.calendarItemId, itemId));
    expect(row.status).toBe("queued");
    expect(await reservationStates(`articles:${websiteId}`)).toEqual(["reserved"]);
    const { rows } = await test.client.query<{ status: string; data: { articleId: string } }>(
      "select status, data from job_outbox",
    );
    expect(rows).toEqual([{ status: "pending", data: expect.objectContaining({ articleId: row.id }) }]);

    // The queue recovers: the cron delivers it.
    inngestMock.send.mockResolvedValue({ ids: [] });
    const delivered = await deliverJobs(test.db, { now: new Date(Date.now() + 3600 * 1000) });
    expect(delivered.sent).toHaveLength(1);
  });

  it("marks the article failed and returns the slot when delivery is given up", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 1 });
    const itemId = await seedCalendarItem(test, websiteId);
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    await queueArticleForCalendarItem(websiteId, itemId);
    await giveUpDelivery();

    const [row] = await test.db.select().from(articles).where(eq(articles.calendarItemId, itemId));
    expect(row.status).toBe("failed");
    expect(await reservationStates(`articles:${websiteId}`)).toEqual(["released"]);
  });
});

describe("the generation job", () => {
  type Fn = {
    config: { onFailure: (ctx: unknown) => Promise<void> };
    handler: (ctx: unknown) => Promise<unknown>;
  };
  const job = generateArticle as unknown as Fn;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  /** Inngest-style memoisation: a completed step replays its stored result. */
  function memoisedStep() {
    const done = new Map<string, unknown>();
    return {
      run: async (id: string, fn: () => unknown) => {
        if (done.has(id)) return done.get(id);
        const result = await fn();
        done.set(id, result);
        return result;
      },
    };
  }

  const OUTLINE = { sections: [{ heading: "A" }], metaDescription: "m" };

  async function queued(articleLimit = 30) {
    const { orgId, websiteId } = await seedWebsite(test, { articleLimit });
    const itemId = await seedCalendarItem(test, websiteId);
    const outcome = await queueArticleForCalendarItem(websiteId, itemId);
    if (!outcome.ok) throw new Error(outcome.error);
    const data = inngestMock.send.mock.calls.at(-1)![0].data;
    return { orgId, websiteId, articleId: outcome.articleId, data };
  }

  it("keeps the allowance consumed when a paid step succeeded and a later one failed", async () => {
    const { websiteId, data } = await queued();
    providers.generateOutline.mockResolvedValue(OUTLINE);
    providers.generateBody.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());

    await expect(job.handler({ event: { data }, step: memoisedStep(), logger })).rejects.toThrow();
    await job.config.onFailure({ event: { data: { event: { data } } }, error: new Error("body failed"), logger });

    expect(await reservationStates(`articles:${websiteId}`)).toEqual(["consumed"]);
  });

  it("returns the allowance when the job failed before spending anything", async () => {
    const { websiteId, data } = await queued();
    providers.generateOutline.mockRejectedValue(
      new Anthropic.APIError(529, { type: "overloaded_error" }, "overloaded", new Headers()),
    );

    await expect(job.handler({ event: { data }, step: memoisedStep(), logger })).rejects.toThrow();
    await job.config.onFailure({ event: { data: { event: { data } } }, error: new Error("overloaded"), logger });

    expect(await reservationStates(`articles:${websiteId}`)).toEqual(["released"]);
  });

  it("re-checks entitlement on a retry whose earlier steps are cached", async () => {
    const { websiteId, data } = await queued();
    const step = memoisedStep();
    providers.generateOutline.mockResolvedValue(OUTLINE);
    providers.generateBody.mockRejectedValueOnce(
      new Anthropic.APIError(500, { type: "api_error" }, "boom", new Headers()),
    );

    // First attempt: brief and outline complete (and are cached), body fails.
    await expect(job.handler({ event: { data }, step, logger })).rejects.toThrow();
    expect(providers.generateOutline).toHaveBeenCalledTimes(1);

    // The customer cancels; Inngest retries with the cached steps.
    await cancel(websiteId);
    await expect(job.handler({ event: { data }, step, logger })).rejects.toThrow(
      /subscription is not active/,
    );

    // build-brief's cached "yes" did not carry the retry into a paid call.
    expect(providers.generateOutline).toHaveBeenCalledTimes(1);
    expect(providers.generateBody).toHaveBeenCalledTimes(1);
  });

  it("refuses to spend when the plan was cancelled after queueing", async () => {
    const { websiteId, data } = await queued();
    await cancel(websiteId);

    await expect(job.handler({ event: { data }, step: memoisedStep(), logger })).rejects.toThrow(
      /subscription is not active/,
    );
    expect(providers.generateOutline).not.toHaveBeenCalled();
  });

  it("refuses a late duplicate delivery once the allowance is gone", async () => {
    const { websiteId, data } = await queued(1);
    // The dispatch was given up on and its slot released...
    await test.client.query(
      "update spend_reservations set state = 'released' where key = $1",
      [`articles:${websiteId}`],
    );
    // ...and the slot has since been used by other work.
    await test.client.query(
      `insert into spend_reservations (key, operation, state, limit_value, counted_at)
       values ($1, 'article.generate', 'consumed', 1, now())`,
      [`articles:${websiteId}`],
    );

    await expect(job.handler({ event: { data }, step: memoisedStep(), logger })).rejects.toThrow(
      /allowance/,
    );
    expect(providers.generateOutline).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------------ */
/* After cutover: which baseline statement may run again, and repairs        */
/* ------------------------------------------------------------------------ */

describe("article baseline reconciliation after cutover", () => {
  /** A file from scripts/cutover, with psql :'name' variables filled in. */
  function cutoverSql(name: string, vars: Record<string, string> = {}) {
    let text = readFileSync(path.resolve(__dirname, "../../../scripts/cutover", name), "utf8");
    for (const [key, value] of Object.entries(vars)) {
      text = text.replaceAll(`:'${key}'`, `'${value.replace(/'/g, "''")}'`);
    }
    return text;
  }
  const migration = (file: string) =>
    readFileSync(path.resolve(__dirname, "../../../drizzle", file), "utf8").replace(
      /--> statement-breakpoint/g,
      "",
    );
  const used = async (websiteId: string) => (await checkLimit(websiteId, "articles")).used;

  /** An article whose job was never delivered: its slot correctly returned. */
  async function returnedSlot() {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    const queued = await queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId));
    if (!queued.ok) throw new Error(queued.error);
    await giveUpDelivery();
    expect(await reservationStates(`articles:${websiteId}`)).toEqual(["released"]);
    expect(await used(websiteId)).toBe(0);
    return { websiteId, articleId: queued.articleId };
  }
  const findingsFor = async (report: "baselineDoubleCounts" | "uncountedDeletedArticles", websiteId: string) =>
    (await runReconciliation(test.db, report)).filter(
      (row) => row.key === `articles:${websiteId}` || row.website_id === websiteId,
    );

  it("the corrected backfill (the only rerunnable statement) keeps a returned slot returned", async () => {
    const { websiteId } = await returnedSlot();
    await test.client.exec(cutoverSql("article-baseline-backfill.sql"));
    await test.client.exec(cutoverSql("article-baseline-backfill.sql"));
    expect(await used(websiteId)).toBe(0);
    expect(await findingsFor("baselineDoubleCounts", websiteId)).toEqual([]);
  });

  it("re-running 0041 re-consumes that slot; the report finds it and the reviewed repair returns it", async () => {
    const { websiteId, articleId } = await returnedSlot();
    // What the runbook used to allow: re-running the migration files.
    await test.client.exec(migration("0041_article_allowance_baseline.sql"));
    await test.client.exec(migration("0042_article_baseline_trigger.sql"));
    expect(await used(websiteId)).toBe(1);

    const [finding] = await findingsFor("baselineDoubleCounts", websiteId);
    expect(finding).toMatchObject({ article_id: articleId, own_reservation_states: ["released"] });

    const repaired = await test.client.query(
      cutoverSql("repair-baseline-double-count.sql", {
        reservation_id: finding.legacy_reservation_id as string,
      }),
    );
    expect(repaired.rows).toHaveLength(1);
    expect(await used(websiteId)).toBe(0);
    expect(await findingsFor("baselineDoubleCounts", websiteId)).toEqual([]);
  });

  it("the double-count repair leaves a genuine legacy row alone", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    const oldCodeArticle = await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
    const { rows } = await test.client.query<{ id: string }>(
      "select id from spend_reservations where subject_id = $1",
      [oldCodeArticle],
    );
    const repaired = await test.client.query(
      cutoverSql("repair-baseline-double-count.sql", { reservation_id: rows[0].id }),
    );
    expect(repaired.rows).toEqual([]);
    expect(await used(websiteId)).toBe(1);
  });

  it("the backfill refuses to run without 0042's trigger", async () => {
    await test.client.exec("alter table articles disable trigger articles_allowance_baseline");
    try {
      await expect(test.client.exec(cutoverSql("article-baseline-backfill.sql"))).rejects.toThrow(
        /apply 0042 first/,
      );
    } finally {
      await test.client.exec("alter table articles enable trigger articles_allowance_baseline");
    }
  });

  it("finds an article generated and deleted inside a migration window, and the reviewed repair counts it", async () => {
    const { orgId, websiteId } = await seedWebsite(test, { articleLimit: 2 });
    // The window: no trigger yet, old code writes and deletes an article.
    await test.client.exec("alter table articles disable trigger articles_allowance_baseline");
    let slipped: string;
    try {
      slipped = await seedArticle(websiteId, await seedCalendarItem(test, websiteId));
      await test.client.query(
        `insert into usage_events (organization_id, website_id, kind, metadata)
         values ($1, $2, 'llm', jsonb_build_object('purpose', 'article_outline', 'articleId', $3::text))`,
        [orgId, websiteId, slipped],
      );
      await test.db.delete(articles).where(eq(articles.id, slipped));
    } finally {
      await test.client.exec("alter table articles enable trigger articles_allowance_baseline");
    }
    expect(await used(websiteId)).toBe(0);
    // Both baseline checks are blind to it: that is why they prove nothing here.
    expect(
      (await runReconciliation(test.db, "articleBaselineGaps")).filter((r) => r.website_id === websiteId),
    ).toEqual([]);

    const [finding] = await findingsFor("uncountedDeletedArticles", websiteId);
    expect(finding).toMatchObject({ article_id: slipped });
    const repair = cutoverSql("repair-uncounted-article.sql", { article_id: slipped });
    expect((await test.client.query(repair)).rows).toHaveLength(1);
    expect((await test.client.query(repair)).rows).toEqual([]); // guarded: once only
    expect(await used(websiteId)).toBe(1);
    expect(await findingsFor("uncountedDeletedArticles", websiteId)).toEqual([]);
  });
});
