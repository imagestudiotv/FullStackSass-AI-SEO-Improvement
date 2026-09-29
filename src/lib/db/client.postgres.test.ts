import { randomBytes } from "node:crypto";
import net from "node:net";

import { sql } from "drizzle-orm";
import unpatchedPostgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CONNECTION_OPTIONS, openDatabase, POOL_SIZE } from "@/lib/db";
import { guardClient, QueryTimeoutError } from "@/lib/db/deadline";
import { testPostgresUrl } from "@/test/postgres";
import postgres from "@/vendor/postgres";

/**
 * The application's database client - the patched driver
 * (src/vendor/postgres), its settings and its deadlines - against a REAL
 * Postgres server, watched on the wire by a proxy.
 *
 * WHY. Supabase's transaction pooler loses pipelined queries, and the first
 * two attempts to stop postgres.js pipelining failed in production:
 * max_pipeline: 0 broke every transaction (UNSAFE_TRANSACTION, 2026-09-28),
 * and a gate in front of the driver still pipelined whenever a connection
 * expired, dropped or was refused. Neither was visible to the other tests,
 * which run on PGlite or on a fake driver. These run the real thing, in each
 * of the situations that went wrong.
 */

const adminUrl = testPostgresUrl();

/**
 * A TCP proxy in front of Postgres that follows the protocol per connection.
 * Every Sync ('S') or simple Query ('Q') the client sends - and the startup
 * message - is answered by exactly one ReadyForQuery ('Z'); a query that
 * postgres.js describes first is sent as Parse/Describe/Flush ('H') and
 * continued with Bind. A client message that starts a NEW query while an
 * answer is still owed, or while a described query awaits its Bind, is
 * pipelining.
 */
class WireWatch {
  pipelined = 0;
  /** Client messages parsed after startup: proves the stream was understood. */
  messages = 0;
  connections = 0;
  /** Set if the stream could not be followed (TLS). Tests assert it stays null. */
  broken: string | null = null;
  private silent = false;
  private server: net.Server;
  private readonly pairs = new Set<{ client: net.Socket; upstream: net.Socket }>();

  constructor(target: { host: string; port: number }) {
    this.server = net.createServer((client) => {
      this.connections += 1;
      const upstream = net.connect(target.port, target.host);
      const pair = { client, upstream };
      this.pairs.add(pair);
      let owed = 0;
      let described = false; // Parse/Describe/Flush sent, Bind not yet
      let started = false;
      let sslReplyPending = false;
      let fromClient = Buffer.alloc(0);
      let fromServer = Buffer.alloc(0);

      client.on("data", (chunk: Buffer) => {
        fromClient = Buffer.concat([fromClient, chunk]);
        for (;;) {
          if (!started) {
            if (fromClient.length < 8) break;
            const length = fromClient.readInt32BE(0);
            if (length > 10_000) {
              this.broken = "unreadable startup";
              break;
            }
            if (fromClient.length < length) break;
            const code = fromClient.readInt32BE(4);
            if (code === 80877103 || code === 80877104) {
              sslReplyPending = true; // SSL/GSS request: a one-byte reply, then the startup message
            } else if (code !== 80877102) {
              started = true;
              owed += 1; // the startup ends with one ReadyForQuery
            }
            fromClient = fromClient.subarray(length);
            continue;
          }
          if (fromClient.length < 5) break;
          const type = String.fromCharCode(fromClient[0]);
          const length = fromClient.readInt32BE(1) + 1;
          if (fromClient.length < length) break;
          if (type !== "p" && type !== "X") {
            this.messages += 1;
            const startsQuery = type === "P" || type === "Q";
            if (owed > 0 || (described && startsQuery)) this.pipelined += 1;
            if (type === "H") described = true;
            if (type === "B" || type === "S") described = false;
            if (type === "S" || type === "Q") owed += 1;
          }
          fromClient = fromClient.subarray(length);
        }
        upstream.write(chunk);
      });

      upstream.on("data", (chunk: Buffer) => {
        if (this.silent) return; // a server that stopped answering
        fromServer = Buffer.concat([fromServer, chunk]);
        if (sslReplyPending && fromServer.length > 0) {
          sslReplyPending = false;
          if (fromServer[0] === 0x53 /* S */) this.broken = "TLS";
          fromServer = fromServer.subarray(1);
        }
        while (fromServer.length >= 5) {
          const length = fromServer.readInt32BE(1) + 1;
          if (fromServer.length < length) break;
          if (fromServer[0] === 0x5a /* Z */) owed = Math.max(0, owed - 1);
          fromServer = fromServer.subarray(length);
        }
        client.write(chunk);
      });

      const close = () => {
        this.pairs.delete(pair);
        client.destroy();
        upstream.destroy();
      };
      client.on("close", close);
      upstream.on("close", close);
      client.on("error", close);
      upstream.on("error", close);
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    return String((this.server.address() as net.AddressInfo).port);
  }

  /** From now on the server's answers are swallowed: a silently dead connection. */
  silence() {
    this.silent = true;
  }

  /** Drops one live connection abruptly (TCP reset), as a pooler restart does. */
  resetOne() {
    const [pair] = this.pairs;
    if (!pair) throw new Error("no connection to reset");
    pair.client.resetAndDestroy();
    pair.upstream.destroy();
  }

  async close() {
    for (const { client, upstream } of this.pairs) {
      client.destroy();
      upstream.destroy();
    }
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!adminUrl)("the application's database client on real Postgres", () => {
  const name = `client_test_${randomBytes(6).toString("hex")}`;
  const limitedRole = `client_test_limited_${randomBytes(4).toString("hex")}`;
  let admin: ReturnType<typeof unpatchedPostgres>;
  /** A separate, direct connection: sees only what was COMMITTED. */
  let observer: ReturnType<typeof unpatchedPostgres>;
  let direct: URL;
  const watches: WireWatch[] = [];
  const clients: Array<{ end: (o?: { timeout?: number }) => Promise<void> }> = [];

  beforeAll(async () => {
    admin = unpatchedPostgres(adminUrl!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${name}`);
    direct = new URL(adminUrl!);
    direct.pathname = `/${name}`;
    observer = unpatchedPostgres(direct.toString(), { max: 1, onnotice: () => {} });
    await observer.unsafe("create table items (id serial primary key, label text not null)");
  });

  afterAll(async () => {
    for (const c of clients) await c.end({ timeout: 1 }).catch(() => {});
    for (const w of watches) await w.close();
    await observer?.end({ timeout: 1 }).catch(() => {});
    await admin?.unsafe(`drop database if exists ${name} with (force)`).catch(() => {});
    await admin?.unsafe(`drop role if exists ${limitedRole}`).catch(() => {});
    await admin?.end({ timeout: 1 }).catch(() => {});
  });

  /** A fresh proxy in front of the test database, and its URL. */
  async function proxied(user?: { name: string; password: string }) {
    const watch = new WireWatch({ host: direct.hostname, port: Number(direct.port || 5432) });
    watches.push(watch);
    const url = new URL(direct.toString());
    url.hostname = "127.0.0.1";
    url.port = await watch.listen();
    if (user) {
      url.username = user.name;
      url.password = user.password;
    }
    return { watch, url: url.toString() };
  }

  function app(url: string, overrides: Parameters<typeof openDatabase>[2] = {}) {
    const broken: string[] = [];
    const opened = openDatabase(url, (reason) => broken.push(reason), overrides);
    clients.push(opened.sql);
    return { ...opened, broken };
  }

  async function committed(label: string): Promise<number> {
    const [row] = await observer.unsafe("select count(*)::int as n from items where label = $1", [label]);
    return row.n as number;
  }

  const label = (prefix: string) => `${prefix}-${randomBytes(4).toString("hex")}`;

  /** Opens every connection of the pool and leaves them idle, as on a server that has been running. */
  async function warm(db: ReturnType<typeof openDatabase>["db"]) {
    await Promise.all(Array.from({ length: POOL_SIZE }, () => db.execute(sql`select pg_sleep(0.05)`)));
  }

  /** The patched driver directly, behind guardClient with a short deadline. */
  async function guarded(url: string, deadlineMs: number, max = 1) {
    const raw = postgres(url, { ...CONNECTION_OPTIONS, max });
    clients.push(raw);
    const onTimeout = vi.fn(() => void raw.end({ timeout: 0 }));
    const client = guardClient(raw, { deadlineMs, onTimeout });
    // Connected before the clock matters.
    await Promise.all(Array.from({ length: max }, () => client.unsafe("select pg_sleep(0.02)")));
    return { raw, client, onTimeout };
  }

  it("the proxy does see pipelining: the UNPATCHED npm driver pipelines a busy pool", async () => {
    // Guards every "0 pipelined" below against passing because the proxy saw nothing.
    const { watch, url } = await proxied();
    const bare = unpatchedPostgres(url, { ...CONNECTION_OPTIONS, max: 1 });
    clients.push(bare);
    await Promise.all(Array.from({ length: 6 }, (_, i) => bare.unsafe(`select ${i} as n`)));
    expect(watch.pipelined).toBeGreaterThan(0);
    expect(watch.broken).toBeNull();
  });

  it("max_pipeline: 0 fails every transaction - why it is pinned - and the pool is flagged for discarding", async () => {
    const { url } = await proxied();
    const off = unpatchedPostgres(url, { ...CONNECTION_OPTIONS, max_pipeline: 0 } as unpatchedPostgres.Options<Record<string, never>>);
    clients.push(off);
    const onBroken = vi.fn();
    const guarded = guardClient(off, { onBroken });
    await expect(guarded.begin(async (tx) => tx.unsafe("select 1"))).rejects.toMatchObject({ code: "UNSAFE_TRANSACTION" });
    expect(onBroken).toHaveBeenCalledTimes(1);
  });

  it("?max_pipeline=0 in the connection string cannot switch it off", async () => {
    const { url } = await proxied();
    const withParam = new URL(url);
    withParam.searchParams.set("max_pipeline", "0");
    const { sql: client, db, broken } = app(withParam.toString());
    expect((client.options as unknown as { max_pipeline: number }).max_pipeline).toBe(100);
    const marker = label("param");
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into items (label) values (${marker})`);
    });
    expect(await committed(marker)).toBe(1);
    expect(broken).toEqual([]);
  });

  it("commits a transaction, and rolls one back when it throws", async () => {
    const { url, watch } = await proxied();
    const { db, broken } = app(url);
    const kept = label("kept");
    const dropped = label("dropped");

    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into items (label) values (${kept})`);
      await tx.execute(sql`insert into items (label) values (${kept})`);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`insert into items (label) values (${dropped})`);
        throw new Error("changed my mind");
      }),
    ).rejects.toThrow("changed my mind");

    // Seen from ANOTHER connection: committed, not merely written.
    expect(await committed(kept)).toBe(2);
    expect(await committed(dropped)).toBe(0);
    expect(broken).toEqual([]);
    expect(watch.pipelined).toBe(0);
  });

  it("never pipelines, however much runs at once - and every write is committed", async () => {
    const { url, watch } = await proxied();
    const { db, broken } = app(url);
    const marker = label("burst");
    // Warm: new connections sit in "connecting" and are never routed to, which
    // would hide the old busy-connection routing.
    await warm(db);

    // Far wider than the pool: plain queries, writes, and transactions that
    // themselves fan out - the shapes the pages and webhooks use. Queries
    // WITHOUT parameters matter most: postgres.js (prepare: false) describes a
    // query with parameters before running it, which stops it pipelining
    // behind one - but it pipelines freely behind one without.
    const work: Array<Promise<unknown>> = [];
    for (let i = 0; i < 24; i++) {
      work.push(i % 2 ? db.execute(sql`select pg_sleep(0.01)`) : db.execute(sql`select pg_sleep(0.01), ${i}::int as n`));
    }
    for (let i = 0; i < 6; i++) work.push(db.execute(sql`insert into items (label) values (${marker})`));
    for (let i = 0; i < 6; i++) {
      work.push(
        db.transaction(async (tx) => {
          // A statement without parameters first: the driver pipelined behind those.
          await Promise.all([
            tx.execute(sql`select pg_sleep(0.01)`),
            tx.execute(sql`insert into items (label) values (${marker})`),
            tx.execute(sql`select 1`),
            tx.execute(sql`insert into items (label) values (${marker})`),
          ]);
        }),
      );
    }
    await Promise.all(work);

    expect(watch.pipelined).toBe(0);
    expect(watch.messages).toBeGreaterThan(100);
    expect(watch.broken).toBeNull();
    expect(await committed(marker)).toBe(6 + 6 * 2);
    expect(broken).toEqual([]);
  });

  it("a failed transaction stays atomic, even with its other statements still queued", async () => {
    const { url, watch } = await proxied();
    const { db, broken } = app(url);
    const marker = label("atomic");
    await expect(
      db.transaction(async (tx) => {
        await Promise.all([
          tx.execute(sql`select 1/0`),
          tx.execute(sql`select pg_sleep(0.05)`),
          tx.execute(sql.raw(`insert into items (label) values ('${marker}')`)),
          tx.execute(sql`insert into items (label) values (${marker})`),
        ]);
      }),
    ).rejects.toThrow();
    await sleep(300);
    expect(await committed(marker)).toBe(0);
    expect(watch.pipelined).toBe(0);
    expect(broken).toEqual([]);
  });

  it("a nested transaction rolls back on its own and keeps the outer one's work", async () => {
    const { url, watch } = await proxied();
    const { db } = app(url);
    const outer = label("outer");
    const inner = label("inner");
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into items (label) values (${outer})`);
      await tx
        .transaction(async (nested) => {
          await nested.execute(sql`insert into items (label) values (${inner})`);
          throw new Error("inner fails");
        })
        .catch(() => undefined);
    });
    expect(await committed(outer)).toBe(1);
    expect(await committed(inner)).toBe(0);
    expect(watch.pipelined).toBe(0);
  });

  it("connections that expire while busy never cause pipelining", async () => {
    const { url, watch } = await proxied();
    // max_lifetime 1s: connections retire constantly under load.
    const { db, broken } = app(url, { max_lifetime: 1 });
    const marker = label("lifetime");
    let transactions = 0;
    const until = Date.now() + 3_500;
    while (Date.now() < until) {
      await Promise.all([
        db.execute(sql`select pg_sleep(0.02)`),
        db.execute(sql`select pg_sleep(0.01)`),
        db.execute(sql`select ${1}::int`),
        db.execute(sql`select 2`),
        db.execute(sql`select pg_sleep(0.01)`),
        db.transaction(async (tx) => {
          await tx.execute(sql`insert into items (label) values (${marker})`);
        }),
        db.execute(sql`select 3`),
      ]);
      transactions += 1;
    }
    expect(watch.connections).toBeGreaterThan(POOL_SIZE); // they did retire
    expect(watch.pipelined).toBe(0);
    expect(await committed(marker)).toBe(transactions);
    expect(broken).toEqual([]);
  });

  it("connections refused by the server never cause pipelining", async () => {
    // A role allowed two connections, with a pool of four: startups are refused (53300).
    const password = randomBytes(8).toString("hex");
    await admin.unsafe(`create role ${limitedRole} login password '${password}' connection limit 2`);
    await admin.unsafe(`grant connect on database ${name} to ${limitedRole}`);
    const { url, watch } = await proxied({ name: limitedRole, password });
    const { sql: client } = app(url, { connect_timeout: 5 });
    const guarded = guardClient(client);
    const results: PromiseSettledResult<unknown>[] = [];
    for (let round = 0; round < 5; round++) {
      results.push(
        ...(await Promise.allSettled(Array.from({ length: 8 }, (_, i) => guarded.unsafe(i % 2 ? "select pg_sleep(0.02)" : "select 1")))),
      );
    }
    const refused = results.filter((r) => r.status === "rejected");
    expect(refused.length).toBeGreaterThan(0); // the scenario happened
    for (const r of refused) expect((r as PromiseRejectedResult).reason).toMatchObject({ code: "53300" });
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(watch.pipelined).toBe(0);
    await client.end({ timeout: 1 });
  });

  it("a dropped connection: waiting work moves to a fresh connection, and a transaction still commits", async () => {
    const { url, watch } = await proxied();
    const { db, broken } = app(url);
    const marker = label("reset");
    // Warm: all four connections open and idle, as on a server that has been running.
    await Promise.all(Array.from({ length: POOL_SIZE }, () => db.execute(sql`select pg_sleep(0.05)`)));
    // Four slow queries hold every connection; more work waits behind them.
    // (Started now: a drizzle query only runs once awaited.)
    const busy = Array.from({ length: POOL_SIZE }, () => db.execute(sql`select pg_sleep(0.6)`).then((rows) => rows));
    await sleep(150);
    const waiting = [
      db.execute(sql`select 1`).then((rows) => rows),
      db.execute(sql`select 2`).then((rows) => rows),
      db.transaction(async (tx) => {
        await tx.execute(sql`insert into items (label) values (${marker})`);
      }),
    ];
    await sleep(50);
    expect(watch.connections).toBe(POOL_SIZE);
    watch.resetOne();

    const all = Promise.allSettled([...busy, ...waiting]);
    const outcome = await Promise.race([all, sleep(8_000).then(() => "stranded" as const)]);
    expect(outcome).not.toBe("stranded");
    const settled = outcome as PromiseSettledResult<unknown>[];
    // Only the query on the dropped connection fails - one of the four slow
    // ones - and everything that was waiting ran on a fresh connection.
    const failed = settled.filter((r) => r.status === "rejected");
    expect(failed).toHaveLength(1);
    expect(settled.slice(0, POOL_SIZE).filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(settled.slice(POOL_SIZE).every((r) => r.status === "fulfilled")).toBe(true);
    expect(watch.connections).toBe(POOL_SIZE + 1);
    expect(await committed(marker)).toBe(1);
    expect(watch.pipelined).toBe(0);
    expect(broken).toEqual([]);
  });

  it("a query the driver rejects before its answer never causes pipelining", async () => {
    const { url, watch } = await proxied();
    const { db } = app(url);
    await warm(db);
    // Started now (a drizzle query only runs once awaited): they hold three connections.
    const slow = [1, 2, 3].map(() => db.execute(sql`select pg_sleep(0.2)`).then((rows) => rows));
    await sleep(50);
    // A Date in a raw template: the driver's Bind throws while its connection
    // still owes an answer - the moment new work used to be written down it.
    const early = await db.execute(sql`select ${new Date() as unknown as string}::timestamptz as t`).then(
      () => "answered",
      (error: unknown) => error,
    );
    expect(early).toBeInstanceOf(Error);
    const next = [1, 2, 3].map((n) => db.execute(sql.raw(`select ${n}`)).then((rows) => rows));
    const results = await Promise.allSettled([...slow, ...next]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(watch.pipelined).toBe(0);
  });

  it("a query that runs out of time while waiting for a connection fails cleanly and is never sent", async () => {
    const { url } = await proxied();
    const raw = postgres(url, { ...CONNECTION_OPTIONS, max: 1 });
    clients.push(raw);
    const guarded = guardClient(raw, { deadlineMs: 300 });
    await guarded.unsafe("select 1"); // connected: the deadline covers only the wait
    const marker = label("never");
    const slow = guarded.unsafe("select pg_sleep(1)").then(() => "answered", (error: unknown) => error);
    const waiting = guarded.unsafe(`insert into items (label) values ('${marker}')`).then(() => "answered", (error: unknown) => error);
    expect(await waiting).toBeInstanceOf(QueryTimeoutError);
    expect(await slow).toBeInstanceOf(QueryTimeoutError);
    await sleep(1_200);
    expect(await committed(marker)).toBe(0);
    await expect(guarded.unsafe("select 1 as ok")).resolves.toEqual([{ ok: 1 }]);
  });

  it("a transaction whose BEGIN never answers is timed out, so the pool can be discarded", async () => {
    const { url, watch } = await proxied();
    const raw = postgres(url, { ...CONNECTION_OPTIONS, max: 1 });
    clients.push(raw);
    const onTimeout = vi.fn(() => void raw.end({ timeout: 0 }));
    const guarded = guardClient(raw, { deadlineMs: 1_000, onTimeout });
    await guarded.unsafe("select 1"); // connected
    watch.silence();
    const started = Date.now();
    await expect(guarded.begin(async (tx) => tx.unsafe("select 1"))).rejects.toBeTruthy();
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("a transaction whose COMMIT never answers is timed out too", async () => {
    const { url, watch } = await proxied();
    const raw = postgres(url, { ...CONNECTION_OPTIONS, max: 1 });
    clients.push(raw);
    const onTimeout = vi.fn(() => void raw.end({ timeout: 0 }));
    const guarded = guardClient(raw, { deadlineMs: 1_000, onTimeout });
    await guarded.unsafe("select 1"); // connected
    const started = Date.now();
    await expect(
      guarded.begin(async (tx) => {
        await tx.unsafe("select 1");
        watch.silence(); // the server stops answering before COMMIT
      }),
    ).rejects.toBeTruthy();
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("a statement inside a transaction, or a nested one, has its own deadline", async () => {
    for (const nested of [false, true]) {
      const { url, watch } = await proxied();
      const { client, onTimeout } = await guarded(url, 1_000);
      let statement: unknown = null;
      const started = Date.now();
      await client
        .begin(async (tx) => {
          const run = async (s: typeof tx) => {
            await s.unsafe("select 1");
            watch.silence(); // the server stops answering mid-transaction
            statement = await s.unsafe("select 2").then(() => "answered", (error: unknown) => error);
          };
          if (nested) await tx.savepoint(run);
          else await run(tx);
        })
        .catch(() => undefined);
      expect(statement).toBeInstanceOf(QueryTimeoutError);
      expect(onTimeout).toHaveBeenCalled();
      expect(Date.now() - started).toBeLessThan(5_000);
    }
  });

  it("a long transaction is not cut off, and a finished one is not timed out afterwards", async () => {
    const { url } = await proxied();
    const { client, onTimeout } = await guarded(url, 1_000);
    // The callback takes longer than the deadline; each statement is quick.
    await client.begin(async (tx) => {
      await tx.unsafe("select 1");
      await sleep(1_500);
      await tx.unsafe("select 2");
    });
    await sleep(1_300); // past the deadline after COMMIT
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("a transaction whose connection the server closes fails at once, its queued statements too, and the pool stays whole", async () => {
    const { url } = await proxied();
    const { client, onTimeout } = await guarded(url, 2_000, POOL_SIZE);
    const started = Date.now();
    let statements: unknown[] = [];
    const outcome = await client
      .begin(async (tx) => {
        const [{ pid }] = await tx.unsafe("select pg_backend_pid() as pid");
        // Three statements: one running, two queued behind it.
        const pending = [tx.unsafe("select pg_sleep(0.5)"), tx.unsafe("select 1"), tx.unsafe("select 2")].map((q) =>
          q.then(() => "answered", (error: unknown) => error),
        );
        await sleep(100);
        await admin.unsafe(`select pg_terminate_backend(${Number(pid)})`);
        statements = await Promise.all(pending);
      })
      .then(() => "committed", (error: unknown) => error);
    expect(outcome).toBeInstanceOf(Error);
    expect(statements).toHaveLength(3);
    for (const s of statements) expect(s).toBeInstanceOf(Error);
    expect(Date.now() - started).toBeLessThan(1_500); // not their deadlines

    // No late timeout discards the pool, and all four connections still work at once.
    await sleep(2_300);
    expect(onTimeout).not.toHaveBeenCalled();
    const at = Date.now();
    const again = await Promise.allSettled(Array.from({ length: POOL_SIZE }, () => client.unsafe("select pg_sleep(1)")));
    expect(again.every((r) => r.status === "fulfilled")).toBe(true);
    expect(Date.now() - at).toBeLessThan(1_700);
  });

  it("a statement issued after the transaction ended is refused, not run outside it", async () => {
    const { url } = await proxied();
    const { client } = await guarded(url, 2_000);
    const marker = label("after");
    let leaked: { unsafe: (text: string) => Promise<unknown> } | null = null;
    await client.begin(async (tx) => {
      leaked = tx;
      await tx.unsafe("select 1");
    });
    await expect(leaked!.unsafe(`insert into items (label) values ('${marker}')`)).rejects.toMatchObject({ code: "TRANSACTION_ENDED" });
    await sleep(200);
    expect(await committed(marker)).toBe(0);
  });

  it("refuses the driver features that would bypass one query at a time", async () => {
    const { url } = await proxied();
    const { client } = await guarded(url, 2_000);
    expect(() => client.reserve()).toThrow(/not supported/);
    expect(() => client.listen("x", () => undefined)).toThrow(/not supported/);
    expect(() => client.subscribe("*", () => undefined)).toThrow(/not supported/);
  });

  it("opens no more connections than the pool size", async () => {
    const { url, watch } = await proxied();
    const { db } = app(url);
    await warm(db);
    await Promise.all(Array.from({ length: 20 }, () => db.execute(sql`select pg_sleep(0.01)`)));
    expect(watch.connections).toBeLessThanOrEqual(POOL_SIZE);
    expect(watch.pipelined).toBe(0);
  });
});
