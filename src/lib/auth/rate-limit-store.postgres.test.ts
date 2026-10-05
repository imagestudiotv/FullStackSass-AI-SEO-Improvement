import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import { createAuthRateLimitStorage } from "./rate-limit-store";

describe.skipIf(!testPostgresUrl())("shared auth limit across independent PostgreSQL connections", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestDb>>;
  beforeAll(async () => { database = await createPostgresTestDb(12); }, 180_000);
  afterAll(async () => { await database?.dispose(); });

  it("admits exactly the allowance when new buckets race on separate connections", async () => {
    for (let trial = 0; trial < 3; trial++) {
      const stores = database.dbs.map((db) => createAuthRateLimitStorage(db));
      const results = await Promise.all(Array.from({ length: 36 }, (_, i) => stores[i % stores.length].consume(`race-${trial}`, { max: 10, window: 60 })));
      expect(results.filter((r) => r.allowed)).toHaveLength(10);
      expect(results.filter((r) => !r.allowed).every((r) => r.retryAfter! > 0)).toBe(true);
    }
  });

  it("survives a new server instance and isolates visitors and endpoints", async () => {
    const first = createAuthRateLimitStorage(database.dbs[0]);
    for (let i = 0; i < 3; i++) await first.consume("visitor1:otp", { max: 3, window: 60 });
    const restarted = createAuthRateLimitStorage(database.dbs[1]);
    expect((await restarted.consume("visitor1:otp", { max: 3, window: 60 })).allowed).toBe(false);
    expect((await restarted.consume("visitor2:otp", { max: 3, window: 60 })).allowed).toBe(true);
    expect((await restarted.consume("visitor1:password", { max: 10, window: 60 })).allowed).toBe(true);
  });

  it("resets an expired bucket atomically without rejected attempts extending its window", async () => {
    await database.sql`truncate auth_rate_limits`;
    const store = createAuthRateLimitStorage(database.dbs[0]);
    await store.consume("expired", { max: 3, window: 60 });
    await database.sql`update auth_rate_limits set count=3, last_request=floor(extract(epoch from clock_timestamp())*1000)-61000`;
    const results = await Promise.all(database.dbs.map((db) => createAuthRateLimitStorage(db).consume("expired", { max: 3, window: 60 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    const before = await database.sql`select last_request from auth_rate_limits`;
    expect((await store.consume("expired", { max: 3, window: 60 })).allowed).toBe(false);
    expect(await database.sql`select last_request from auth_rate_limits`).toEqual(before);
  });

  it("stores digests and removes old buckets in bounded batches", async () => {
    await database.sql`truncate auth_rate_limits`;
    await database.sql`insert into auth_rate_limits select 'old-' || n, 1, 1 from generate_series(1, 150) as n`;
    await createAuthRateLimitStorage(database.dbs[0]).consume("203.0.113.123:/sign-in", { max: 10, window: 60 });
    const stored = await database.sql`select key from auth_rate_limits`;
    expect(stored).toHaveLength(51);
    expect(stored.filter((r) => /^[a-f0-9]{64}$/.test(r.key))).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain("203.0.113.123");
  });

  it("fails closed when its table is unavailable", async () => {
    // Transaction rollback restores the table even if an assertion fails.
    await database.dbs[0].transaction(async (tx) => {
      await tx.execute(sql`drop table auth_rate_limits`);
      await expect(createAuthRateLimitStorage(tx).consume("outage", { max: 10, window: 60 })).rejects.toThrow();
      throw new Error("rollback test transaction");
    }).catch((error: Error) => { expect(error.message).toBe("rollback test transaction"); });
  });
});
