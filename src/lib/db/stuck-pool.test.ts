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
  end: ReturnType<typeof vi.fn>;
  answers: boolean;
  queries: number;
};

const pools = vi.hoisted(() => ({ created: [] as unknown[], firstAnswers: false, options: [] as Array<Record<string, unknown>> }));

vi.mock("postgres", () => ({
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
    pools.created.push(client);
    return client;
  },
}));

beforeEach(() => {
  vi.resetModules();
  pools.created = [];
  pools.options = [];
  pools.firstAnswers = false;
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

describe("the connection settings", () => {
  it("never pipeline queries: Supabase's transaction pooler hangs on pipelined queries", async () => {
    pools.firstAnswers = true;
    const { db } = await import("@/lib/db");
    await db.execute(sql`select 1`);
    expect(pools.options[0]).toMatchObject({ max_pipeline: 0, prepare: false });
  });
});
