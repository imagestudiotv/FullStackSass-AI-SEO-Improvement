import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import {
  claimForRecovery,
  claimWebhookEvent,
  completeWebhookEvent,
  findStuckWebhookEvents,
  MAX_RECOVERY_ATTEMPTS,
  releaseWebhookEvent,
} from "./webhook-events";

/**
 * Issue 9: a webhook handler that is KILLED must not suppress every future
 * retry of that event.
 *
 * The old gate inserted the event id and treated a conflict as "already done".
 * The handler's catch deleted the row so a retry would work, which covers a
 * thrown error and not a dead process: a function timeout or OOM kill left the
 * row behind and every later delivery was acknowledged as a duplicate while the
 * work had never happened.
 */

let test: TestDb;

const NOW = new Date("2026-09-26T12:00:00Z");
/** Past the five-minute lease. */
const AFTER_LEASE = new Date("2026-09-26T12:06:00Z");
const WITHIN_LEASE = new Date("2026-09-26T12:02:00Z");

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from webhook_events");
});

const claim = (
  overrides: Partial<Parameters<typeof claimWebhookEvent>[0]> = {},
) =>
  claimWebhookEvent({
    id: "evt_1",
    provider: "stripe",
    type: "invoice.paid",
    payload: { id: "evt_1" },
    now: NOW,
    ...overrides,
  });

/** Claims and returns the token, failing the test if the claim was refused. */
async function claimed(overrides: Partial<Parameters<typeof claimWebhookEvent>[0]> = {}) {
  const result = await claim(overrides);
  if (!result.claimed) throw new Error(`not claimed: ${result.reason}`);
  return result.token;
}

/** Read straight from SQL, so the test asserts on stored state, not on types. */
async function row(id = "evt_1") {
  const { rows } = await test.client.query<{
    status: string;
    attempts: number;
    claimed_at: string | null;
    completed_at: string | null;
    last_error: string | null;
  }>(
    "select status, attempts, claimed_at, completed_at, last_error from webhook_events where id = $1",
    [id],
  );
  return rows[0];
}

describe("claimWebhookEvent", () => {
  it("claims a brand-new event and records it", async () => {
    const result = await claim();

    expect(result).toEqual({ claimed: true, attempts: 1, token: expect.any(String) });
    const stored = await row();
    expect(stored.status).toBe("processing");
    expect(stored.attempts).toBe(1);
    expect(stored.claimed_at).not.toBeNull();
  });

  it("refuses a COMPLETED event as a true duplicate", async () => {
    await completeWebhookEvent("evt_1", await claimed(), NOW);

    // Stripe can redeliver after a 200; this must be free.
    expect(await claim()).toEqual({ claimed: false, reason: "completed" });
  });

  it("refuses a claim held by a LIVE attempt", async () => {
    await claim();

    // A duplicate arriving while the first is still running.
    expect(await claim({ now: WITHIN_LEASE })).toEqual({
      claimed: false,
      reason: "in_progress",
    });
  });

  /**
   * THE BUG. A handler that dies leaves a "processing" row with nobody working
   * on it. Under the old gate every retry was answered "duplicate" for ever.
   */
  it("RECLAIMS an abandoned claim once its lease expires", async () => {
    await claim();
    // Process killed here: no complete, no release.

    const retry = await claim({ now: AFTER_LEASE });
    expect(retry).toEqual({ claimed: true, attempts: 2, token: expect.any(String) });

    const stored = await row();
    expect(stored.status).toBe("processing");
    // The attempt that died is still counted, which is how a repeatedly
    // failing event becomes visible.
    expect(stored.attempts).toBe(2);
  });

  it("counts attempts across release and re-claim", async () => {
    await releaseWebhookEvent("evt_1", await claimed(), new Error("stripe API down"));
    const second = await claim({ now: WITHIN_LEASE });

    expect(second).toEqual({ claimed: true, attempts: 2, token: expect.any(String) });
  });

  it("gives the claim to exactly ONE of many concurrent deliveries", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => claim()));

    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect(results.filter((r) => !r.claimed)).toHaveLength(11);
    // One row, one first attempt.
    expect((await row()).attempts).toBe(1);
  });

  it("keeps different event ids independent", async () => {
    expect((await claim({ id: "evt_a" })).claimed).toBe(true);
    expect((await claim({ id: "evt_b" })).claimed).toBe(true);
  });
});

describe("releaseWebhookEvent", () => {
  it("returns the event for retry and KEEPS the row", async () => {
    await releaseWebhookEvent("evt_1", await claimed(), new Error("database timeout"));

    const stored = await row();
    expect(stored.status).toBe("received");
    expect(stored.claimed_at).toBeNull();
    // The old code deleted the row, losing both of these.
    expect(stored.attempts).toBe(1);
    expect(stored.last_error).toContain("database timeout");
  });

  it("makes the event immediately claimable again, without waiting for a lease", async () => {
    await releaseWebhookEvent("evt_1", await claimed(), new Error("blip"));

    expect((await claim({ now: WITHIN_LEASE })).claimed).toBe(true);
  });

  it("truncates a long message and does not throw on a non-Error", async () => {
    await releaseWebhookEvent("evt_1", await claimed(), "x".repeat(900));

    const stored = await row();
    expect(stored.last_error).toBe("handler failed");
  });
});

describe("completeWebhookEvent", () => {
  it("marks the work finished and clears the claim", async () => {
    await completeWebhookEvent("evt_1", await claimed(), NOW);

    const stored = await row();
    expect(stored.status).toBe("completed");
    expect(stored.completed_at).not.toBeNull();
    expect(stored.claimed_at).toBeNull();
  });

  it("a completed event stays completed even after the lease would expire", async () => {
    await completeWebhookEvent("evt_1", await claimed(), NOW);

    // The stale sweep must never resurrect finished work.
    expect(await claim({ now: AFTER_LEASE })).toEqual({
      claimed: false,
      reason: "completed",
    });
  });
});

describe("findStuckWebhookEvents (read-only reconciliation)", () => {
  it("reports an abandoned claim", async () => {
    await claim({ id: "evt_dead" });

    const stuck = await findStuckWebhookEvents({ now: AFTER_LEASE });
    expect(stuck.map((s) => s.id)).toEqual(["evt_dead"]);
    expect(stuck[0].attempts).toBe(1);
  });

  it("reports an event that failed and is awaiting a retry", async () => {
    await releaseWebhookEvent("evt_failed", await claimed({ id: "evt_failed" }), new Error("boom"));

    const stuck = await findStuckWebhookEvents({ now: WITHIN_LEASE });
    expect(stuck.map((s) => s.id)).toEqual(["evt_failed"]);
    expect(stuck[0].lastError).toContain("boom");
  });

  it("ignores healthy events - completed, and claims still within their lease", async () => {
    await completeWebhookEvent("evt_done", await claimed({ id: "evt_done" }), NOW);
    await claim({ id: "evt_running" });

    expect(await findStuckWebhookEvents({ now: WITHIN_LEASE })).toEqual([]);
  });

  it("does not report a never-attempted historical row", async () => {
    // What migration 0039 leaves behind: status 'completed', attempts 0.
    await test.client.exec(
      `insert into webhook_events (id, provider, type, status, attempts)
         values ('evt_old', 'stripe', 'invoice.paid', 'completed', 0)`,
    );
    expect(await findStuckWebhookEvents({ now: AFTER_LEASE })).toEqual([]);
  });
});

describe("claim ownership", () => {
  it("a worker whose lease was taken over cannot complete the new owner's claim", async () => {
    const stale = await claimed();
    const fresh = await claimed({ now: AFTER_LEASE }); // lease expired, retry took it

    expect(await completeWebhookEvent("evt_1", stale)).toBe(false);
    expect((await row()).status).toBe("processing"); // still the new owner's

    expect(await completeWebhookEvent("evt_1", fresh)).toBe(true);
    expect((await row()).status).toBe("completed");
  });

  it("a worker whose lease was taken over cannot release the new owner's claim", async () => {
    const stale = await claimed();
    await claimed({ now: AFTER_LEASE });

    expect(await releaseWebhookEvent("evt_1", stale, new Error("late failure"))).toBe(false);
    const stored = await row();
    expect(stored.status).toBe("processing");
    expect(stored.last_error).toBeNull();
    // Nor did it make the event claimable under the running worker.
    expect(await claim({ now: new Date(AFTER_LEASE.getTime() + 1000) })).toEqual({
      claimed: false,
      reason: "in_progress",
    });
  });
});

describe("claimForRecovery", () => {
  it("recovers a crashed claim with no further delivery from the provider", async () => {
    await claimed(); // acknowledged duplicate deliveries saw 'in_progress'; the worker died

    expect(await claimForRecovery({ now: WITHIN_LEASE })).toEqual([]);
    const [recovered] = await claimForRecovery({ now: AFTER_LEASE });
    expect(recovered).toMatchObject({ id: "evt_1", payload: { id: "evt_1" }, attempts: 2 });

    expect(await completeWebhookEvent("evt_1", recovered.token, AFTER_LEASE)).toBe(true);
    expect(await claimForRecovery({ now: new Date(AFTER_LEASE.getTime() + 3600e3) })).toEqual([]);
  });

  it("retries a released event after its backoff, and gives up after the maximum", async () => {
    await releaseWebhookEvent("evt_1", await claimed(), new Error("boom"), NOW);
    expect(await claimForRecovery({ now: NOW })).toEqual([]); // 1 minute backoff
    const [again] = await claimForRecovery({ now: new Date(NOW.getTime() + 61_000) });
    expect(again.id).toBe("evt_1");

    await test.client.query(
      "update webhook_events set status = 'received', attempts = $1, next_attempt_at = null",
      [MAX_RECOVERY_ATTEMPTS],
    );
    expect(await claimForRecovery({ now: AFTER_LEASE })).toEqual([]);
    // Still reported for a person.
    expect((await findStuckWebhookEvents({ now: AFTER_LEASE })).map((e) => e.id)).toEqual(["evt_1"]);
  });

  it("hands one event to exactly one of several concurrent recovery runs", async () => {
    await claimed();
    const runs = await Promise.all(Array.from({ length: 5 }, () => claimForRecovery({ now: AFTER_LEASE })));
    expect(runs.flat()).toHaveLength(1);
  });
});
