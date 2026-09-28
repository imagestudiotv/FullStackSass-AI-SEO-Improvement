import { randomBytes } from "node:crypto";
import net from "node:net";

import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONNECTION_OPTIONS, openDatabase, POOL_SIZE } from "@/lib/db";
import { Gate, guardClient, QueryTimeoutError } from "@/lib/db/deadline";
import { testPostgresUrl } from "@/test/postgres";

/**
 * The application's database client - its exact settings, gate and
 * deadlines (lib/db/index.ts) - against a REAL Postgres server, watched on
 * the wire by a proxy.
 *
 * WHY. On 2026-09-28 the client was switched to max_pipeline: 0 to stop
 * pipelining, which Supabase's transaction pooler cannot handle. Every
 * transaction then failed at BEGIN (UNSAFE_TRANSACTION): payment webhooks,
 * admin switches, link verification. No test noticed, because the tests run
 * on PGlite and the one test of the client's settings replaced postgres.js
 * with a fake. This one runs the real driver, so it proves both halves:
 * transactions commit, and no connection is ever sent a query before the
 * previous one has answered.
 */

const adminUrl = testPostgresUrl();

/**
 * A TCP proxy in front of Postgres that follows the protocol per connection:
 * every Sync ('S') or simple Query ('Q') the client sends - and the startup
 * message - is answered by exactly one ReadyForQuery ('Z'). A client message
 * written while an answer is still owed is pipelining.
 */
class WireWatch {
  pipelined = 0;
  connections = 0;
  private server: net.Server;
  private readonly sockets = new Set<net.Socket>();

  constructor(target: { host: string; port: number }) {
    this.server = net.createServer((client) => {
      this.connections += 1;
      const upstream = net.connect(target.port, target.host);
      this.sockets.add(client);
      this.sockets.add(upstream);
      let owed = 0;
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
          // 'p' answers an authentication request; 'X' ends the session.
          if (type !== "p" && type !== "X" && owed > 0) this.pipelined += 1;
          if (type === "S" || type === "Q") owed += 1;
          fromClient = fromClient.subarray(length);
        }
        upstream.write(chunk);
      });

      upstream.on("data", (chunk: Buffer) => {
        fromServer = Buffer.concat([fromServer, chunk]);
        if (sslReplyPending && fromServer.length > 0) {
          sslReplyPending = false;
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
        client.destroy();
        upstream.destroy();
      };
      client.on("close", close);
      upstream.on("close", close);
      client.on("error", close);
      upstream.on("error", close);
    });
  }

  async listen(): Promise<number> {
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    return (this.server.address() as net.AddressInfo).port;
  }

  async close() {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}

describe.skipIf(!adminUrl)("the application's database client on real Postgres", () => {
  const name = `client_test_${randomBytes(6).toString("hex")}`;
  let admin: ReturnType<typeof postgres>;
  let watch: WireWatch;
  let url: string;
  /** A separate, direct connection: sees only what was COMMITTED. */
  let observer: ReturnType<typeof postgres>;
  const opened: Array<{ sql: ReturnType<typeof postgres> }> = [];

  beforeAll(async () => {
    admin = postgres(adminUrl!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${name}`);
    const direct = new URL(adminUrl!);
    direct.pathname = `/${name}`;
    observer = postgres(direct.toString(), { max: 1, onnotice: () => {} });
    await observer.unsafe("create table items (id serial primary key, label text not null)");

    watch = new WireWatch({ host: direct.hostname, port: Number(direct.port || 5432) });
    const port = await watch.listen();
    const proxied = new URL(direct.toString());
    proxied.hostname = "127.0.0.1";
    proxied.port = String(port);
    url = proxied.toString();
  });

  afterAll(async () => {
    for (const o of opened) await o.sql.end({ timeout: 1 }).catch(() => {});
    await observer?.end({ timeout: 1 }).catch(() => {});
    await watch?.close();
    await admin?.unsafe(`drop database if exists ${name} with (force)`).catch(() => {});
    await admin?.end({ timeout: 1 }).catch(() => {});
  });

  function app() {
    const broken: string[] = [];
    const client = openDatabase(url, (reason) => broken.push(reason));
    opened.push(client);
    return { ...client, broken };
  }

  async function committed(label: string): Promise<number> {
    const [row] = await observer.unsafe("select count(*)::int as n from items where label = $1", [label]);
    return row.n as number;
  }

  it("the proxy does see pipelining: postgres.js on its own pipelines a busy pool", async () => {
    // Guards the check below against passing because the proxy saw nothing.
    const bare = postgres(url, { ...CONNECTION_OPTIONS, max: 1 });
    opened.push({ sql: bare });
    const before = watch.pipelined;
    await Promise.all(Array.from({ length: 6 }, (_, i) => bare.unsafe(`select ${i} as n`)));
    expect(watch.pipelined).toBeGreaterThan(before);
  });

  it("max_pipeline: 0 - the setting that was tried - fails every transaction", async () => {
    const off = postgres(url, { ...CONNECTION_OPTIONS, max_pipeline: 0 } as postgres.Options<Record<string, never>>);
    opened.push({ sql: off });
    await expect(off.begin(async (tx) => tx.unsafe("select 1"))).rejects.toMatchObject({ code: "UNSAFE_TRANSACTION" });
  });

  it("commits a transaction, and rolls one back when it throws", async () => {
    const { db, broken } = app();
    const kept = `kept-${randomBytes(4).toString("hex")}`;
    const dropped = `dropped-${randomBytes(4).toString("hex")}`;

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
  });

  it("never pipelines, however much runs at once - and every write is committed", async () => {
    const { db, broken } = app();
    const label = `burst-${randomBytes(4).toString("hex")}`;
    const before = watch.pipelined;

    // Far wider than the pool: plain queries, writes, and transactions that
    // themselves fan out - the shapes the pages and webhooks use. Queries
    // WITHOUT parameters matter most: postgres.js (prepare: false) sends a
    // query with parameters only after describing it, which stops it
    // pipelining behind one - but it pipelines freely behind one without
    // (the operations page's "select * from platform_controls", or BEGIN).
    const work: Array<Promise<unknown>> = [];
    for (let i = 0; i < 24; i++) {
      work.push(i % 2 ? db.execute(sql`select pg_sleep(0.01)`) : db.execute(sql`select pg_sleep(0.01), ${i}::int as n`));
    }
    for (let i = 0; i < 6; i++) work.push(db.execute(sql`insert into items (label) values (${label})`));
    for (let i = 0; i < 6; i++) {
      work.push(
        db.transaction(async (tx) => {
          await Promise.all([
            tx.execute(sql`insert into items (label) values (${label})`),
            tx.execute(sql`select pg_sleep(0.01)`),
            tx.execute(sql`insert into items (label) values (${label})`),
          ]);
        }),
      );
    }
    await Promise.all(work);

    expect(watch.pipelined - before).toBe(0);
    expect(await committed(label)).toBe(6 + 6 * 2);
    expect(broken).toEqual([]);
  });

  it("a query that runs out of time while waiting for a place fails cleanly, and is never sent", async () => {
    // Directly on the wrapper, with a short deadline and one place.
    const raw = postgres(url, { ...CONNECTION_OPTIONS, max: 1 });
    opened.push({ sql: raw });
    const guarded = guardClient(raw, { gate: new Gate(1), deadlineMs: 300 });
    const marker = `never-${randomBytes(4).toString("hex")}`;
    // A place is taken when a query is awaited: the slow one first.
    const slow = guarded.unsafe("select pg_sleep(1)").then(() => "answered", (error: unknown) => error);
    const waiting = guarded.unsafe(`insert into items (label) values ('${marker}')`).then(() => "answered", (error: unknown) => error);
    expect(await waiting).toBeInstanceOf(QueryTimeoutError);
    expect(await slow).toBeInstanceOf(QueryTimeoutError);
    // The slow one is cancelled on the server; the waiting one never reached it.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(await committed(marker)).toBe(0);
    await expect(guarded.unsafe("select 1 as ok")).resolves.toEqual([{ ok: 1 }]);
  });

  it("uses no more connections than the pool size", async () => {
    const { db } = app();
    const [row] = (await db.execute(sql`select current_setting('max_connections')::int as n`)) as unknown as Array<{ n: number }>;
    expect(row.n).toBeGreaterThan(POOL_SIZE);
    const before = watch.connections;
    await Promise.all(Array.from({ length: 20 }, () => db.execute(sql`select pg_sleep(0.01)`)));
    // Connections opened by this pool for the burst above (the first query opened one).
    expect(watch.connections - before).toBeLessThanOrEqual(POOL_SIZE);
  });
});
