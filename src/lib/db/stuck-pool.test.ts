import { readFileSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A warm function instance whose pooled connection died must recover on the
 * next query, not time out on every request until the instance is retired.
 * postgres.js is replaced by a fake: the first pool never answers (a dead
 * socket), later pools answer at once.
 */

type FakeClient = {
  (...args: unknown[]): unknown;
  options: { parsers: Record<string, unknown>; serializers: Record<string, unknown> };
  unsafe: (text: string, params?: unknown[]) => unknown;
  begin: (fn: (tx: unknown) => unknown) => Promise<unknown>;
  end: ReturnType<typeof vi.fn>;
  answers: boolean;
  queries: number;
};

const pools = vi.hoisted(() => ({
  created: [] as unknown[],
  firstAnswers: false,
  firstBeginUnsafe: false,
  options: [] as Array<Record<string, unknown>>,
}));

// The application's driver: the patched copy (src/vendor/postgres).
vi.mock("@/vendor/postgres", () => ({
  default: (_url: string, options: Record<string, unknown>) => {
    pools.options.push(options);
    const answers = pools.created.length === 0 ? pools.firstAnswers : true;
    const client = (() => undefined) as unknown as FakeClient;
    client.options = { parsers: {}, serializers: {} };
    client.answers = answers;
    client.queries = 0;
    client.end = vi.fn(async () => undefined);
    client.unsafe = () => {
      client.queries += 1;
      const query = {
        values: () => query,
        cancel: () => undefined,
        then: (onFulfilled?: (v: unknown) => unknown) =>
          client.answers ? Promise.resolve([{ ok: 1 }]).then(onFulfilled) : new Promise(() => undefined),
      };
      return query;
    };
    const first = pools.created.length === 0;
    client.begin = async (fn) => {
      // The 2026-09-28 failure: BEGIN answered, but the driver could not reserve its connection.
      if (first && pools.firstBeginUnsafe) {
        throw Object.assign(new Error("UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1"), { code: "UNSAFE_TRANSACTION" });
      }
      return fn(client);
    };
    pools.created.push(client);
    return client;
  },
}));

beforeEach(() => {
  vi.resetModules();
  pools.created = [];
  pools.options = [];
  pools.firstAnswers = false;
  pools.firstBeginUnsafe = false;
  vi.stubEnv("DATABASE_URL", "postgres://fake@127.0.0.1:1/none");
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a pool whose connection died", () => {
  it("is discarded when a query times out, and the next query opens a fresh pool that answers", async () => {
    const { db } = await import("@/lib/db");
    const stuck = db.execute(sql`select 1`);
    const failure = expect(stuck).rejects.toMatchObject({ cause: { name: "QueryTimeoutError" } });
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;

    const [first] = pools.created as FakeClient[];
    expect(first.end).toHaveBeenCalledWith({ timeout: 0 });

    // The next request: a new pool, answered at once - not another 30-second wait.
    await expect(db.execute(sql`select 1`)).resolves.toBeTruthy();
    expect(pools.created).toHaveLength(2);
    expect((pools.created[1] as FakeClient).queries).toBe(1);
  });

  it("two queries timing out together replace the pool once", async () => {
    const { db } = await import("@/lib/db");
    const timedOut = { cause: { name: "QueryTimeoutError" } };
    const a = expect(db.execute(sql`select 1`)).rejects.toMatchObject(timedOut);
    const b = expect(db.execute(sql`select 2`)).rejects.toMatchObject(timedOut);
    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.all([a, b]);
    expect((pools.created[0] as FakeClient).end).toHaveBeenCalledTimes(1);
    await db.execute(sql`select 3`);
    expect(pools.created).toHaveLength(2);
  });

  it("a healthy pool is kept", async () => {
    pools.firstAnswers = true;
    const { db } = await import("@/lib/db");
    await db.execute(sql`select 1`);
    await db.execute(sql`select 2`);
    expect(pools.created).toHaveLength(1);
    expect((pools.created[0] as FakeClient).end).not.toHaveBeenCalled();
  });
});

describe("a pool left inside a transaction", () => {
  it("is discarded when a transaction cannot reserve its connection, so no later write is lost in it", async () => {
    pools.firstAnswers = true;
    pools.firstBeginUnsafe = true;
    const { db } = await import("@/lib/db");
    await expect(db.transaction(async () => undefined)).rejects.toMatchObject({ code: "UNSAFE_TRANSACTION" });
    const [first] = pools.created as FakeClient[];
    expect(first.end).toHaveBeenCalledWith({ timeout: 0 });

    await db.execute(sql`select 1`);
    expect(pools.created).toHaveLength(2);
    expect((pools.created[1] as FakeClient).queries).toBe(1);
  });
});

describe("the patched driver copy", () => {
  it("matches the installed npm package's version, whose types and tests it relies on", () => {
    // src/vendor/postgres is postgres.js 3.4.9 with REPGET PATCH changes (README.md there).
    const root = path.resolve(__dirname, "../../..");
    const readme = readFileSync(path.join(root, "src/vendor/postgres/README.md"), "utf8");
    const vendored = /^# postgres\.js (\d+\.\d+\.\d+)/m.exec(readme)?.[1];
    const installed = JSON.parse(readFileSync(path.join(root, "node_modules/postgres/package.json"), "utf8")).version;
    expect(vendored).toBe("3.4.9");
    expect(installed).toBe(vendored);
  });
});

describe("the connection settings", () => {
  it("no prepared statements, a small pool, and max_pipeline pinned above zero (0 broke every transaction)", async () => {
    pools.firstAnswers = true;
    const { db } = await import("@/lib/db");
    await db.execute(sql`select 1`);
    // Pinned: an explicit option also beats ?max_pipeline= in the URL and PGMAX_PIPELINE.
    expect(pools.options[0]).toMatchObject({ prepare: false, max: 4, max_pipeline: 100 });
  });
});
