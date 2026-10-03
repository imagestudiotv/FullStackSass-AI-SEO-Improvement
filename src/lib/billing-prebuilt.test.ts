import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * listPlansForPrebuiltPage: the homepages are built ahead of time, so their
 * prices are read while the site builds. Without a database (CI) the build
 * must still succeed; with a database that FAILS, the error must surface so a
 * homepage with its prices missing is never published (client's launch review,
 * 2026-10-03).
 */

const state = vi.hoisted(() => ({
  configured: true,
  result: [] as unknown[] | Error,
  queried: 0,
}));

vi.mock("@/lib/db", () => {
  // select().from().where().orderBy() resolves to the rows, or rejects.
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => {
      state.queried += 1;
      return state.result instanceof Error
        ? Promise.reject(state.result)
        : Promise.resolve(state.result);
    },
  };
  return {
    db: { select: () => chain },
    isDatabaseConfigured: () => state.configured,
  };
});

import { listPlansForPrebuiltPage } from "./billing";

beforeEach(() => {
  state.configured = true;
  state.result = [];
  state.queried = 0;
});

describe("listPlansForPrebuiltPage", () => {
  it("returns the active plans when the database answers", async () => {
    state.result = [{ name: "Grow" }, { name: "Scale" }];
    await expect(listPlansForPrebuiltPage()).resolves.toEqual([
      { name: "Grow" },
      { name: "Scale" },
    ]);
  });

  it("builds without prices, and without touching a database, when none is configured", async () => {
    // CI and a fresh clone: nothing to read, and failing would break a build
    // that is never deployed.
    state.configured = false;
    await expect(listPlansForPrebuiltPage()).resolves.toEqual([]);
    expect(state.queried).toBe(0);
  });

  it("THROWS when a configured database fails, never returning empty prices", async () => {
    // A deploy fails loudly and the previous one stays live; a background
    // refresh keeps serving the last good page. Returning [] here would publish
    // a homepage with no prices instead.
    state.result = new Error("connection refused");
    await expect(listPlansForPrebuiltPage()).rejects.toThrow("connection refused");
  });
});
