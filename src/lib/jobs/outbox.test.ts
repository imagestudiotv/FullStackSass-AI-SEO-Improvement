import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { eq } from "drizzle-orm";

import { articles, jobOutbox, spendReservations, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";

/**
 * Issue 16: jobs are recorded with the change that needs them and delivered
 * until Inngest takes them - through outages, lost acknowledgements, crashes
 * after commit and concurrent workers.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const inngestMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

import {
  RECONCILIATION_QUERIES,
  runReconciliation,
  type ReconciliationReport,
} from "@/lib/billing/reconciliation";
import { deliverJobs, enqueueJob, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from job_outbox");
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
});

const later = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000);

async function outbox() {
  const { rows } = await test.client.query<{ event_id: string; status: string; attempts: number }>(
    "select event_id, status, attempts from job_outbox order by created_at",
  );
  return rows;
}

describe("the job outbox", () => {
  it("delivers a job whose process died right after the commit", async () => {
    await test.db.transaction(async (tx) => {
      await enqueueJob(tx, { id: "evt-crash", name: "website/audit.requested", data: { websiteId: "w" } });
    });
    // ...and the process is gone before it could send. Nothing else happens
    // until the cron runs.
    expect(inngestMock.send).not.toHaveBeenCalled();

    const result = await deliverJobs(test.db);
    expect(result.sent).toEqual(["evt-crash"]);
    expect(inngestMock.send).toHaveBeenCalledWith({
      id: "evt-crash",
      name: "website/audit.requested",
      data: { websiteId: "w" },
    });
  });

  it("records nothing when the business transaction rolls back", async () => {
    await expect(
      test.db.transaction(async (tx) => {
        await enqueueJob(tx, { id: "evt-rolled-back", name: "x", data: {} });
        throw new Error("the business write failed");
      }),
    ).rejects.toThrow();
    expect(await outbox()).toEqual([]);
  });

  it("sends each job once when workers overlap", async () => {
    for (let i = 0; i < 5; i += 1) {
      await enqueueJob(test.db, { id: `evt-${i}`, name: "x", data: {} });
    }
    inngestMock.send.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ids: [] };
    });

    await Promise.all(Array.from({ length: 4 }, () => deliverJobs(test.db)));

    expect(inngestMock.send).toHaveBeenCalledTimes(5);
    expect((await outbox()).every((row) => row.status === "sent")).toBe(true);
  });

  it("backs off between attempts and does not retry early", async () => {
    await enqueueJob(test.db, { id: "evt-down", name: "x", data: {} });
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    await deliverJobs(test.db);
    await deliverJobs(test.db); // immediately again: not due yet
    expect(inngestMock.send).toHaveBeenCalledTimes(1);

    await deliverJobs(test.db, { now: later(1) });
    expect(inngestMock.send).toHaveBeenCalledTimes(2);

    inngestMock.send.mockResolvedValue({ ids: [] });
    await deliverJobs(test.db, { now: later(10) });
    expect(await outbox()).toEqual([{ event_id: "evt-down", status: "sent", attempts: 3 }]);
  });

  it("gives up after the last attempt and says so", async () => {
    await enqueueJob(test.db, { id: "evt-never", name: "x", data: {} });
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    await test.client.query("update job_outbox set attempts = $1", [MAX_DELIVERY_ATTEMPTS - 1]);

    const result = await deliverJobs(test.db);
    expect(result.failed).toEqual(["evt-never"]);
    expect((await runReconciliation(test.db, "undeliveredJobs")).map((r) => r.event_id)).toEqual([
      "evt-never",
    ]);
  });
});

describe("read-only reconciliation reports", () => {
  it("every report is a valid SELECT against the migrated schema", async () => {
    for (const report of Object.keys(RECONCILIATION_QUERIES) as ReconciliationReport[]) {
      await expect(runReconciliation(test.db, report)).resolves.toBeInstanceOf(Array);
    }
  });

  it("reports the baseline trigger present, and an article that escaped it", async () => {
    expect(await runReconciliation(test.db, "articleBaselineTriggerMissing")).toEqual([]);
    const { websiteId } = await seedWebsite(test);
    const insert = () =>
      test.db
        .insert(articles)
        .values({ websiteId, title: "Old code article", status: "draft" })
        .returning({ id: articles.id });

    const [covered] = await insert(); // the trigger records it
    await test.client.exec("alter table articles disable trigger articles_allowance_baseline");
    let escaped: { id: string };
    try {
      [escaped] = await insert(); // as if written before 0042 existed
    } finally {
      await test.client.exec("alter table articles enable trigger articles_allowance_baseline");
    }
    const gaps = (await runReconciliation(test.db, "articleBaselineGaps")).map((r) => r.article_id);
    expect(gaps).toContain(escaped.id);
    expect(gaps).not.toContain(covered.id);
  });

  it("finds work stranded before the outbox existed", async () => {
    const { websiteId } = await seedWebsite(test);
    const [stuck] = await test.db
      .insert(articles)
      .values({
        websiteId,
        calendarItemId: await seedCalendarItem(test, websiteId),
        title: "Stuck",
        status: "queued",
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000),
      })
      .returning({ id: articles.id });

    const rows = await runReconciliation(test.db, "strandedWork");
    expect(rows.map((r) => r.id)).toContain(stuck.id);
  });

  it("reports two live subscriptions for one website, including a detached duplicate", async () => {
    const { orgId, websiteId } = await seedWebsite(test);
    await test.db
      .update(subscriptions)
      .set({ stripeSubscriptionId: "sub_first" });
    await test.db.insert(subscriptions).values({
      organizationId: orgId,
      websiteId: null,
      claimedWebsiteId: websiteId,
      provider: "paypal",
      paypalSubscriptionId: "I-SECOND",
      status: "active",
    });

    const rows = await runReconciliation(test.db, "duplicateLiveSubscriptions");
    const mine = rows.find((r) => r.website_id === websiteId);
    expect(mine).toMatchObject({ live_subscriptions: 2 });
  });
});

/* ------------------------------------------------------------------------ */
/* Terminal outcomes: ownership-checked, and cleanup committed with them     */
/* ------------------------------------------------------------------------ */

describe("giving up on a job", () => {
  const t0 = new Date("2026-09-26T12:00:00Z");
  const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

  /** A website waiting on its analysis job, on its last delivery attempt. */
  async function lastAttempt(options: { spendStarted?: boolean; eventId?: string } = {}) {
    const { orgId, websiteId } = await seedWebsite(test);
    await test.db.update(websites).set({ status: "pending" }).where(eq(websites.id, websiteId));
    const [reservation] = await test.db
      .insert(spendReservations)
      .values({
        key: `analysis:org:${orgId}`,
        operation: "website.analyze",
        organizationId: orgId,
        state: "reserved",
        limitValue: 10,
        windowSeconds: 3600,
        spendStartedAt: options.spendStarted ? t0 : null,
      })
      .returning({ id: spendReservations.id, key: spendReservations.key });
    const eventId = options.eventId ?? `website-analyze:${reservation.id}`;
    await test.db.insert(jobOutbox).values({
      eventId,
      name: "website/analyze.requested",
      data: { websiteId, organizationId: orgId, reservations: [reservation] },
      attempts: MAX_DELIVERY_ATTEMPTS - 1,
      nextAttemptAt: t0,
      createdAt: at(-60),
    });
    return { websiteId, reservationId: reservation.id, eventId };
  }

  async function snapshot(websiteId: string, reservationId: string, eventId: string) {
    const [site] = await test.db.select({ status: websites.status }).from(websites).where(eq(websites.id, websiteId));
    const [reservation] = await test.db
      .select({ state: spendReservations.state })
      .from(spendReservations)
      .where(eq(spendReservations.id, reservationId));
    const [job] = await test.db.select({ status: jobOutbox.status }).from(jobOutbox).where(eq(jobOutbox.eventId, eventId));
    return { website: site.status, reservation: reservation.state, outbox: job.status };
  }

  it("a worker that outlived its lease cannot fail a job another worker delivered", async () => {
    const { websiteId, reservationId, eventId } = await lastAttempt();
    // Worker A's send hangs; it will fail after worker B has succeeded.
    let failA!: (error: Error) => void;
    inngestMock.send
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { failA = reject; }))
      .mockResolvedValueOnce({ ids: [eventId] });

    const workerA = deliverJobs(test.db, { now: t0 });
    await vi.waitFor(() => expect(inngestMock.send).toHaveBeenCalledTimes(1));

    // A's lease (60s) has run out; B takes the row over and delivers it.
    const workerB = await deliverJobs(test.db, { now: at(120) });
    expect(workerB.sent).toEqual([eventId]);

    failA(new Error("socket timeout"));
    const resultA = await workerA;
    expect(resultA).toMatchObject({ lost: [eventId], failed: [], retrying: [] });

    expect(await snapshot(websiteId, reservationId, eventId)).toEqual({
      website: "pending",
      reservation: "reserved",
      outbox: "sent",
    });
  });

  it("rolls the failed state back with a cleanup that errored, and finishes both later", async () => {
    const { websiteId, reservationId, eventId } = await lastAttempt();
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    await test.client.exec(`
      create or replace function inject_cleanup_failure() returns trigger as $$
      begin raise exception 'injected cleanup failure'; end $$ language plpgsql;
      create trigger inject_cleanup_failure before update on websites
        for each row execute function inject_cleanup_failure();`);
    let first: Awaited<ReturnType<typeof deliverJobs>>;
    try {
      first = await deliverJobs(test.db, { now: t0 });
    } finally {
      await test.client.exec("drop trigger if exists inject_cleanup_failure on websites;");
    }
    expect(first).toMatchObject({ unrecorded: [eventId], failed: [] });
    // Nothing half-done: not "failed" with the website still waiting.
    expect(await snapshot(websiteId, reservationId, eventId)).toEqual({
      website: "pending",
      reservation: "reserved",
      outbox: "pending",
    });

    // A later run (after the dead claim expires) retries, and gives up properly.
    const later = await deliverJobs(test.db, { now: at(120) });
    expect(later.failed).toEqual([eventId]);
    expect(await snapshot(websiteId, reservationId, eventId)).toEqual({
      website: "failed",
      reservation: "released",
      outbox: "failed",
    });
  });

  it("never frees a reservation whose paid call had started", async () => {
    const { websiteId, reservationId, eventId } = await lastAttempt({ spendStarted: true });
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    expect((await deliverJobs(test.db, { now: t0 })).failed).toEqual([eventId]);
    expect(await snapshot(websiteId, reservationId, eventId)).toMatchObject({ reservation: "consumed" });
  });

  it("leaves the website to a newer attempt that is still on its way", async () => {
    const { websiteId, reservationId, eventId } = await lastAttempt();
    // The customer pressed retry: a newer analysis job for the same site.
    await test.db.insert(jobOutbox).values({
      eventId: "website-analyze:newer",
      name: "website/analyze.requested",
      data: { websiteId },
      status: "pending",
      nextAttemptAt: at(3600),
      createdAt: t0,
    });
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    expect((await deliverJobs(test.db, { now: t0 })).failed).toEqual([eventId]);
    // Its own reservation is released; the website belongs to the newer job.
    expect(await snapshot(websiteId, reservationId, eventId)).toEqual({
      website: "pending",
      reservation: "released",
      outbox: "failed",
    });
  });
});
