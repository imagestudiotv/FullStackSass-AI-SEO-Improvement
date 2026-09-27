import Anthropic from "@anthropic-ai/sdk";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import {
  acquireLease,
  classifySpendError,
  consumeReservation,
  holdReservation,
  markSpendStarted,
  paidCall,
  QuotaExhaustedError,
  releaseLease,
  releaseReservation,
  reserve,
  reserveAll,
  sweepAbandonedReservations,
  type QuotaRule,
} from "./spend-quota";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from spend_reservations; delete from operation_leases;");
});

const ctx = { operation: "test" };
const hourly = (key: string, limit: number): QuotaRule => ({
  key,
  limit,
  window: { seconds: 3600 },
});

async function stateOf(id: string) {
  const { rows } = await test.client.query<{ state: string }>(
    "select state from spend_reservations where id = $1",
    [id],
  );
  return rows[0]?.state;
}

const refused = () => new Anthropic.APIError(529, { type: "overloaded_error" }, "overloaded", new Headers());
const timedOut = () => new Anthropic.APIConnectionTimeoutError();

describe("reserve", () => {
  it("admits exactly `limit` of many simultaneous requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => reserve(hourly("k", 5), ctx)),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    const { rows } = await test.client.query("select id from spend_reservations");
    expect(rows).toHaveLength(5);
  });

  it("gives every reservation its own durable id", async () => {
    const a = await reserve(hourly("k", 5), ctx);
    const b = await reserve(hourly("k", 5), ctx);
    expect(a!.id).not.toBe(b!.id);
  });

  it("refuses everything when the limit is zero", async () => {
    expect(await reserve(hourly("k", 0), ctx)).toBeNull();
  });
});

describe("window boundaries", () => {
  it("counts a sliding window, so a burst cannot straddle the hour", async () => {
    const rule = hourly("k", 3);
    for (let i = 0; i < 3; i += 1) {
      expect(await reserve(rule, ctx, { now: new Date("2026-09-26T10:59:30Z") })).not.toBeNull();
    }
    // A fixed hourly window would reset at 11:00 and admit three more here.
    expect(await reserve(rule, ctx, { now: new Date("2026-09-26T11:00:30Z") })).toBeNull();
    expect(await reserve(rule, ctx, { now: new Date("2026-09-26T11:59:29Z") })).toBeNull();
    // An hour after the burst, capacity returns.
    expect(await reserve(rule, ctx, { now: new Date("2026-09-26T11:59:31Z") })).not.toBeNull();
  });

  it("counts a period window from its start", async () => {
    const rule: QuotaRule = { key: "p", limit: 2, window: { since: new Date("2026-09-01T00:00:00Z") } };
    await reserve(rule, ctx, { now: new Date("2026-08-31T23:59:00Z") }); // before the period
    /*
      Spent, as period quotas are: reserve() occasionally sweeps with the
      caller's `now`, and ten days later an UNSPENT reservation is rightly
      released as abandoned - which made this test fail about 2% of runs.
    */
    const first = await reserve(rule, ctx, { now: new Date("2026-09-10T00:00:00Z") });
    expect(first).not.toBeNull();
    await consumeReservation(first!.id, "paid");
    const second = await reserve(rule, ctx, { now: new Date("2026-09-20T00:00:00Z") });
    expect(second).not.toBeNull();
    await consumeReservation(second!.id, "paid");
    expect(await reserve(rule, ctx, { now: new Date("2026-09-25T00:00:00Z") })).toBeNull();
  });
});

describe("release", () => {
  it("frees only its own reservation, however many times it runs", async () => {
    const rule = hourly("k", 2);
    const a = (await reserve(rule, ctx))!;
    await reserve(rule, ctx); // b

    expect(await releaseReservation(a.id, "test")).toBe("released");
    expect(await releaseReservation(a.id, "test")).toBe("already_released");
    expect(await releaseReservation(a.id, "test")).toBe("already_released");

    // One slot came back - a's - not three.
    expect(await reserve(rule, ctx)).not.toBeNull();
    expect(await reserve(rule, ctx)).toBeNull();
  });

  it("never returns a consumed reservation", async () => {
    const rule = hourly("k", 1);
    const a = (await reserve(rule, ctx))!;
    expect(await consumeReservation(a.id, "paid")).toBe("consumed");
    expect(await releaseReservation(a.id, "job failed")).toBe("consumed");
    expect(await stateOf(a.id)).toBe("consumed");
    expect(await reserve(rule, ctx)).toBeNull();
  });

  it("is safe under simultaneous duplicate releases", async () => {
    const rule = hourly("k", 3);
    const a = (await reserve(rule, ctx))!;
    await reserve(rule, ctx);
    await reserve(rule, ctx);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => releaseReservation(a.id, "dup")),
    );
    expect(results.filter((r) => r === "released")).toHaveLength(1);
    expect(await reserve(rule, ctx)).not.toBeNull();
    expect(await reserve(rule, ctx)).toBeNull();
  });
});

describe("consume", () => {
  it("records once when a step retries", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    expect(await consumeReservation(a.id, "paid")).toBe("consumed");
    expect(await consumeReservation(a.id, "paid")).toBe("already_consumed");
  });

  it("records spend even if the reservation was swept in the meantime", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    await releaseReservation(a.id, "abandoned");
    expect(await consumeReservation(a.id, "paid")).toBe("consumed");
  });
});

describe("holdReservation", () => {
  it("re-takes capacity for a late job, or refuses it", async () => {
    const rule = hourly("k", 1);
    const a = (await reserve(rule, ctx))!;
    await releaseReservation(a.id, "dispatch_failed");

    // Capacity free again: the late job may proceed.
    expect(await holdReservation(a.id)).toBe(true);
    expect(await stateOf(a.id)).toBe("reserved");

    // Released again and taken by someone else: the late job is refused.
    await releaseReservation(a.id, "dispatch_failed");
    expect(await reserve(rule, ctx)).not.toBeNull();
    expect(await holdReservation(a.id)).toBe(false);
  });
});

describe("paidCall", () => {
  it("consumes on success", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    expect(await paidCall([a], async () => "ok")).toBe("ok");
    expect(await stateOf(a.id)).toBe("consumed");
  });

  it("leaves a provider refusal unspent", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    await expect(paidCall([a], async () => { throw refused(); })).rejects.toThrow();
    expect(classifySpendError(refused())).toBe("not_billed");
    expect(await stateOf(a.id)).toBe("reserved");
  });

  it("treats a timeout as spent", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    await expect(paidCall([a], async () => { throw timedOut(); })).rejects.toThrow();
    expect(classifySpendError(timedOut())).toBe("ambiguous");
    expect(await stateOf(a.id)).toBe("consumed");
    expect(await releaseReservation(a.id, "job failed")).toBe("consumed");
  });

  it("does not call the provider when the pre-spend check fails", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    const call = vi.fn(async () => "never");
    await expect(
      paidCall([a], call, { beforeSpend: async () => { throw new Error("cancelled"); } }),
    ).rejects.toThrow("cancelled");
    expect(call).not.toHaveBeenCalled();
    expect(await stateOf(a.id)).toBe("reserved");
  });

  it("refuses when the reservation can no longer be held", async () => {
    const rule = hourly("k", 1);
    const a = (await reserve(rule, ctx))!;
    await releaseReservation(a.id, "abandoned");
    await reserve(rule, ctx);
    const call = vi.fn(async () => "never");
    await expect(paidCall([a], call)).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(call).not.toHaveBeenCalled();
  });
});

/**
 * Failure injection around the paid call. A PL/pgSQL trigger makes one
 * specific write fail, the way a dropped connection or a crashed process
 * would leave it, and the question each time is the same: can the capacity
 * behind a call that may have been billed ever be handed back? It must not.
 */
describe("spend started before the provider is called", () => {
  async function failWrites(when: "consume" | "mark") {
    const condition =
      when === "consume"
        ? "new.state = 'consumed' and old.state <> 'consumed'"
        : "new.spend_started_at is not null and old.spend_started_at is null";
    await test.client.exec(`
      create or replace function inject_failure() returns trigger as $$
      begin
        if ${condition} then raise exception 'injected write failure'; end if;
        return new;
      end $$ language plpgsql;
      drop trigger if exists inject_failure on spend_reservations;
      create trigger inject_failure before update on spend_reservations
        for each row execute function inject_failure();`);
  }
  async function healWrites() {
    await test.client.exec("drop trigger if exists inject_failure on spend_reservations;");
  }
  async function markerOf(id: string) {
    const { rows } = await test.client.query<{ started: Date | null }>(
      "select spend_started_at as started from spend_reservations where id = $1",
      [id],
    );
    return rows[0]?.started ?? null;
  }

  it("is on disk before the call, and the call is not made if it cannot be", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    let seenDuringCall: Date | null = null;
    expect(
      await paidCall([a], async () => {
        seenDuringCall = await markerOf(a.id);
        return "ok";
      }),
    ).toBe("ok");
    expect(seenDuringCall).not.toBeNull();

    const b = (await reserve(hourly("k2", 1), ctx))!;
    const call = vi.fn(async () => "never");
    await failWrites("mark");
    try {
      await expect(paidCall([b], call)).rejects.toThrow(/spend_reservations/);
    } finally {
      await healWrites();
    }
    expect(call).not.toHaveBeenCalled();
    expect(await releaseReservation(b.id, "job failed")).toBe("released");
  });

  it("a successful call whose consume write failed is never refundable", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    await failWrites("consume");
    try {
      // The provider answered; recording that failed and was only logged.
      expect(await paidCall([a], async () => "billed")).toBe("billed");
    } finally {
      await healWrites();
    }
    expect(await stateOf(a.id)).toBe("reserved");
    expect(await markerOf(a.id)).not.toBeNull();

    // The job fails later and its onFailure releases: finalised, not freed.
    expect(await releaseReservation(a.id, "job failed")).toBe("consumed");
    expect(await stateOf(a.id)).toBe("consumed");
    expect(await reserve(hourly("k", 1), ctx)).toBeNull();
  });

  it("a process that died after starting to spend is consumed by the sweep, not released", async () => {
    const at = new Date("2026-09-26T00:00:00Z");
    const a = (await reserve(hourly("crash", 5), ctx, { now: at }))!;
    // The process marks, calls the provider, and dies before recording anything.
    expect(await markSpendStarted(a.id)).not.toBeNull();

    await sweepAbandonedReservations(new Date("2026-09-26T10:00:00Z"));

    expect(await stateOf(a.id)).toBe("consumed");
    expect(await releaseReservation(a.id, "retry gave up")).toBe("consumed");
  });

  it("a retry cannot withdraw the marker an earlier, crashed attempt left", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    expect(await markSpendStarted(a.id)).not.toBeNull(); // attempt 1 crashed mid-call
    // Attempt 2 is refused by the provider: its refusal proves nothing about
    // attempt 1, so the reservation stays unreleasable.
    await expect(paidCall([a], async () => { throw refused(); })).rejects.toThrow();
    expect(await markerOf(a.id)).not.toBeNull();
    expect(await releaseReservation(a.id, "job failed")).toBe("consumed");
  });

  it("a provable refusal on the only attempt is still returned", async () => {
    const a = (await reserve(hourly("k", 1), ctx))!;
    await expect(paidCall([a], async () => { throw refused(); })).rejects.toThrow();
    expect(await markerOf(a.id)).toBeNull();
    expect(await releaseReservation(a.id, "job failed")).toBe("released");
  });
});

describe("reserveAll", () => {
  it("takes every slot or none", async () => {
    const perVisitor = hourly("visitor", 5);
    const global = hourly("global", 1);
    expect((await reserveAll([perVisitor, global], ctx)).ok).toBe(true);
    expect(await reserveAll([perVisitor, global], ctx)).toEqual({ ok: false, rule: global });
    const { rows } = await test.client.query("select id from spend_reservations where key = 'visitor'");
    expect(rows).toHaveLength(1);
  });
});

describe("sweepAbandonedReservations", () => {
  it("releases only old reservations that were never spent", async () => {
    const old = (await reserve(hourly("a", 5), ctx, { now: new Date("2026-09-26T00:00:00Z") }))!;
    const oldSpent = (await reserve(hourly("a", 5), ctx, { now: new Date("2026-09-26T00:00:00Z") }))!;
    await consumeReservation(oldSpent.id, "paid");
    const recent = (await reserve(hourly("a", 5), ctx, { now: new Date("2026-09-26T09:00:00Z") }))!;

    await sweepAbandonedReservations(new Date("2026-09-26T10:00:00Z"));

    expect(await stateOf(old.id)).toBe("released");
    expect(await stateOf(oldSpent.id)).toBe("consumed");
    expect(await stateOf(recent.id)).toBe("reserved");
  });
});

describe("leases", () => {
  const t0 = new Date("2026-09-26T10:00:00Z");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);

  it("admits one holder at a time among simultaneous callers", async () => {
    const leases = await Promise.all(
      Array.from({ length: 10 }, () => acquireLease("page", 120, t0)),
    );
    expect(leases.filter(Boolean)).toHaveLength(1);
  });

  it("lasts its full duration, whatever the clock boundary", async () => {
    expect(await acquireLease("page", 120, at(110))).not.toBeNull(); // 10:01:50
    // A fixed 2-minute window would have reset at 10:02:00.
    expect(await acquireLease("page", 120, at(125))).toBeNull();
    expect(await acquireLease("page", 120, at(231))).not.toBeNull();
  });

  it("cannot be released by a holder whose lease was taken over", async () => {
    const first = (await acquireLease("page", 120, t0))!;
    const second = (await acquireLease("page", 120, at(121)))!; // first expired
    expect(second).not.toBeNull();

    expect(await releaseLease(first)).toBe(false);
    expect(await acquireLease("page", 120, at(122))).toBeNull(); // second still holds it
    expect(await releaseLease(second)).toBe(true);
    expect(await releaseLease(second)).toBe(false);
  });
});
