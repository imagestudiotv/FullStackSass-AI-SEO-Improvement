import type postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Gate, guardClient, QueryTimeoutError } from "@/lib/db/deadline";

/**
 * The gate in front of postgres.js (lib/db/deadline.ts): the driver is never
 * handed more work than it has connections, so it never pipelines - without
 * max_pipeline: 0, which broke every transaction. The real driver is tested
 * in client.postgres.test.ts; here a fake records what reaches it.
 */

type Pending = { text: string; resolve: (v: unknown) => void; reject: (e: unknown) => void };

/** A stand-in for postgres.js: records how many queries it holds at once. */
function fakeDriver() {
  const state = { inFlight: 0, maxInFlight: 0, sent: [] as string[], pending: [] as Pending[] };
  function makeQuery(text: string) {
    let started: Promise<unknown> | null = null;
    const query = {
      values: () => query,
      cancel: vi.fn(),
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
        if (!started) {
          state.inFlight += 1;
          state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
          state.sent.push(text);
          started = new Promise((resolve, reject) => state.pending.push({ text, resolve, reject })).finally(() => {
            state.inFlight -= 1;
          });
        }
        return started.then(onFulfilled, onRejected);
      },
    };
    return query;
  }
  const scope = (label: string) => ({
    unsafe: (text: string) => makeQuery(`${label}${text}`),
  });
  const beginCalls: Array<{ finish: () => void; fail: (e: unknown) => void }> = [];
  const sql = {
    ...scope(""),
    begin: (fn: (tx: unknown) => Promise<unknown>) =>
      new Promise((resolve, reject) => {
        state.inFlight += 1;
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
        const done = () => (state.inFlight -= 1);
        beginCalls.push({ finish: () => undefined, fail: (e) => (done(), reject(e)) });
        Promise.resolve(fn(scope("tx:"))).then(
          (v) => (done(), resolve(v)),
          (e) => (done(), reject(e)),
        );
      }),
  };
  /** Answers the oldest pending query. */
  const answer = async (value: unknown = [{ ok: 1 }]) => {
    const next = state.pending.shift();
    next?.resolve(value);
    await flush();
    return next?.text;
  };
  return { sql: sql as unknown as postgres.Sql, state, answer, beginCalls };
}

/** Lets promise chains settle. */
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Gate", () => {
  it("admits up to its capacity, then one at a time as places are given back, in order", async () => {
    const gate = new Gate(2);
    const order: number[] = [];
    const releases: Array<() => void> = [];
    for (let i = 0; i < 5; i++) {
      void gate.acquire().then((release) => {
        order.push(i);
        releases.push(release);
      });
    }
    await flush();
    expect(order).toEqual([0, 1]);
    expect(gate.queued).toBe(3);

    releases[0]();
    releases[0](); // a second call gives nothing back twice
    await flush();
    expect(order).toEqual([0, 1, 2]);
    expect(gate.inUse).toBe(2);

    releases[1]();
    releases[2]();
    await flush();
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(gate.queued).toBe(0);
  });

  it("refuses a capacity that is not a positive whole number", () => {
    expect(() => new Gate(0)).toThrow();
    expect(() => new Gate(1.5)).toThrow();
  });
});

describe("guardClient with a gate", () => {
  it("never hands the driver more queries than the gate allows", async () => {
    const driver = fakeDriver();
    const client = guardClient(driver.sql, { gate: new Gate(3) });
    const results = Array.from({ length: 10 }, (_, i) => Promise.resolve(client.unsafe(`select ${i}`)));
    await flush();
    expect(driver.state.inFlight).toBe(3);
    for (let i = 0; i < 10; i++) await driver.answer();
    await Promise.all(results);
    expect(driver.state.maxInFlight).toBe(3);
    expect(driver.state.sent).toHaveLength(10);
  });

  it("gives the place back when a query fails", async () => {
    const driver = fakeDriver();
    const client = guardClient(driver.sql, { gate: new Gate(1) });
    const first = Promise.resolve(client.unsafe("select 1")).catch((e) => e);
    const second = Promise.resolve(client.unsafe("select 2"));
    await flush();
    driver.state.pending.shift()?.reject(new Error("boom"));
    await flush();
    expect((await first).message).toBe("boom");
    await driver.answer();
    await expect(second).resolves.toEqual([{ ok: 1 }]);
  });

  it("a query that times out while waiting for a place is never sent, and its place is not lost", async () => {
    vi.useFakeTimers();
    const driver = fakeDriver();
    const onTimeout = vi.fn();
    const client = guardClient(driver.sql, { gate: new Gate(1), deadlineMs: 1_000, onTimeout });
    const first = Promise.resolve(client.unsafe("select slow"));
    const waiting = expect(Promise.resolve(client.unsafe("select waiting"))).rejects.toBeInstanceOf(QueryTimeoutError);
    await vi.advanceTimersByTimeAsync(0);
    expect(driver.state.sent).toEqual(["select slow"]);

    // Both deadlines pass with the place still taken: the waiting query gives up unsent.
    const firstFailed = expect(first).rejects.toBeInstanceOf(QueryTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await firstFailed;
    await waiting;
    expect(onTimeout).toHaveBeenCalledTimes(2);
    // The stuck query finally answers; its place goes to the next query, not the abandoned one.
    driver.state.pending.shift()?.resolve([{ ok: 1 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(driver.state.sent).toEqual(["select slow"]);

    const third = Promise.resolve(client.unsafe("select next"));
    await vi.advanceTimersByTimeAsync(0);
    expect(driver.state.sent).toEqual(["select slow", "select next"]);
    driver.state.pending.shift()?.resolve([{ ok: 2 }]);
    await expect(third).resolves.toEqual([{ ok: 2 }]);
  });

  it("a transaction holds one place from BEGIN to COMMIT, and runs its statements one at a time", async () => {
    const driver = fakeDriver();
    const gate = new Gate(2);
    const client = guardClient(driver.sql, { gate });
    let insideMax = 0;
    const tx = client.begin(async (t: postgres.TransactionSql) => {
      const statements = [t.unsafe("a"), t.unsafe("b"), t.unsafe("c")].map((q) => Promise.resolve(q));
      await flush();
      insideMax = driver.state.sent.filter((s) => s.startsWith("tx:")).length;
      return Promise.all(statements);
    });
    await flush();
    // BEGIN holds one place; one query outside still fits, the next waits.
    expect(gate.inUse).toBe(1);
    const outside = [Promise.resolve(client.unsafe("x")), Promise.resolve(client.unsafe("y"))];
    await flush();
    expect(gate.inUse).toBe(2);
    expect(gate.queued).toBe(1);
    expect(insideMax).toBe(1); // statements inside the transaction: one at a time

    while (driver.state.pending.length) await driver.answer();
    await flush();
    while (driver.state.pending.length) await driver.answer();
    await tx;
    await Promise.all(outside);
    expect(gate.inUse).toBe(0);
  });

  it("a transaction that could not reserve its connection discards the pool", async () => {
    const onBroken = vi.fn();
    const unsafe = Object.assign(new Error("UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1"), {
      code: "UNSAFE_TRANSACTION",
    });
    const sql = { begin: vi.fn(async () => Promise.reject(unsafe)) } as unknown as postgres.Sql;
    const gate = new Gate(1);
    const client = guardClient(sql, { gate, onBroken });
    await expect(client.begin(async () => undefined)).rejects.toBe(unsafe);
    expect(onBroken).toHaveBeenCalledTimes(1);
    expect(gate.inUse).toBe(0);

    // Any other failure is the caller's, not the pool's.
    (sql.begin as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => Promise.reject(new Error("no")));
    await expect(client.begin(async () => undefined)).rejects.toThrow("no");
    expect(onBroken).toHaveBeenCalledTimes(1);
  });
});
