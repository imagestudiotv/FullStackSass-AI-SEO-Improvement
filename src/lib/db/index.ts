import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
// postgres.js 3.4.9 with its routing patched to never pipeline - see src/vendor/postgres/README.md.
import postgres from "@/vendor/postgres";

import { guardClient } from "./deadline";
import * as schema from "./schema";

/**
 * Database client, created on first query.
 *
 * Constructed lazily for the same reason as the Stripe and Anthropic clients:
 * `next build` evaluates every route module to collect page data, so a
 * module-scope throw fails the whole build on any machine without
 * DATABASE_URL — a fresh Vercel deploy, CI, or a new clone. Deferring it means
 * the build succeeds and only a request that actually needs the database
 * fails, with the same clear message.
 */

/** Connections per serverless instance (see `max` below). */
export const POOL_SIZE = 4;

/** The postgres.js settings. Exported for the real-Postgres test (client.postgres.test.ts). */
export const CONNECTION_OPTIONS = {
  /**
   * Supabase's transaction-mode pooler (port 6543) does not support
   * prepared statements, which postgres-js uses by default. Without
   * `prepare: false` every query works locally against a direct
   * connection and then fails once deployed. Do not remove this flag.
   */
  prepare: false,

  /**
   * A small pool per serverless instance, not postgres-js's default 10.
   *
   * Every route here runs as a Vercel serverless function, so the process
   * serves ONE request at a time — a second concurrent visitor is a
   * second instance with its own pool, never extra load on this one. The
   * default therefore sizes a pool for concurrency that cannot happen,
   * while the instances multiply against a fixed ceiling: this project's
   * Postgres reports max_connections = 60, so a dozen warm instances at
   * 10 apiece exhaust it and further connections are refused. That
   * surfaced as intermittent "Failed query" errors on whichever page
   * happened to ask next — billing, the dashboard, even sign-in — which
   * is why the failures looked unrelated to each other.
   *
   * Four rather than one: this codebase fans out with Promise.all -
   * billing/page.tsx awaits six queries at once, the operations page seven -
   * and more connections answer that sooner; the rest wait their turn in the
   * driver. (One and two connections used to HANG on those pages; that was
   * pipelining, below, not the pool size.)
   */
  max: POOL_SIZE,

  /**
   * Hand idle connections back instead of holding them forever (the
   * default is no timeout).
   *
   * A serverless instance is frozen between requests rather than exited,
   * so without this its socket stays checked out while nothing is using
   * it — connections accumulate until the pooler reaps them. Twenty
   * sockets were sitting idle on this database while it was refusing new
   * ones.
   */
  idle_timeout: 20,

  /**
   * Fail in ten seconds rather than thirty.
   *
   * When the pool IS exhausted, the default leaves the request hanging
   * past the point the customer has given up, and on a function with a
   * shorter limit the platform kills it first — producing a timeout whose
   * cause is invisible. Ten seconds still clears a cold start, and a
   * clear error reaches the error boundary with a digest attached.
   */
  connect_timeout: 10,

  /*
    Replace every connection after five minutes, busy or not. The
    postgres.js default is 30-60 minutes, and a connection that long-lived
    is the one most likely to have been dropped by the pooler or a NAT
    while this function instance was frozen between requests - the dead
    connection behind the backlinks page's 300-second hangs.
  */
  max_lifetime: 60 * 5,

  /*
    ONE QUERY PER CONNECTION AT A TIME - never pipelined.

    postgres.js pipelines by default: with more work than free connections -
    a Promise.all wider than the pool, or a connection ending, dropped or
    refused while the others are busy - it writes the next query down a
    connection before the previous one has answered. Supabase's transaction
    pooler does not survive that - the pipelined queries never answer.
    Reproduced against production on 2026-09-28 with the admin operations
    page's seven parallel queries.

    That is fixed in the driver itself: the copy in src/vendor/postgres has
    its routing patched so a query only ever goes to a free connection, and
    a transaction's statements run one after another (README.md there).

    max_pipeline is PINNED to the driver's default, because 0 - tried on
    2026-09-28 - broke every transaction: postgres.js reserves a
    transaction's connection (sql.begin) in the step max_pipeline: 0 skips,
    so each BEGIN failed with UNSAFE_TRANSACTION and left a server-side
    transaction open on a pooled connection, where later writes were
    silently lost (payment webhooks, admin switches and link verification
    were down for about 8 hours). Set here, it also wins over
    ?max_pipeline= in DATABASE_URL and PGMAX_PIPELINE in the environment.

    client.postgres.test.ts proves all of this on real Postgres through a
    proxy that watches the wire.
  */
  max_pipeline: 100,
};

let client: ReturnType<typeof postgres> | null = null;
let instance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Throws away a connection pool after one of its queries timed out, or after
 * a transaction could not reserve its connection (lib/db/deadline.ts,
 * onBroken: that connection was left inside a transaction).
 *
 * WHY. A timed-out query leaves its connection in postgres.js' pool, still
 * "busy" with a query no one will answer: the socket died (a pooler hiccup,
 * or the function was frozen mid-query). Every later query routed to it waits
 * out the same 30-second deadline, so a warm function instance kept failing
 * EVERY request - the admin operations page did, on each refresh, for over 15
 * minutes after a brief database stall on 2026-09-28, while other instances
 * were fine. Discarding the pool makes the next request open fresh
 * connections. Queries still running on the old pool fail; they were queued
 * behind a dead connection anyway.
 */
function discardPool(stale: ReturnType<typeof postgres>, reason: string): void {
  // Another timeout may already have replaced it.
  if (client !== stale) return;
  client = null;
  instance = null;
  console.error(`[db] ${reason} - discarding this instance's connection pool; the next query reconnects`);
  stale.end({ timeout: 0 }).catch(() => {});
}

/**
 * The patched driver with CONNECTION_OPTIONS, behind the deadlines
 * (lib/db/deadline.ts) - exactly what the application uses. `onBroken` is
 * called when the pool should be thrown away. Exported for the real-Postgres
 * test, which may override settings (for example a short max_lifetime).
 */
export function openDatabase(
  url: string,
  onBroken: (reason: string) => void = () => {},
  overrides: Partial<typeof CONNECTION_OPTIONS> = {},
) {
  const sql = postgres(url, { ...CONNECTION_OPTIONS, ...overrides });
  const db = drizzle(
    guardClient(sql, {
      onTimeout: () => onBroken("a query or transaction timed out"),
      onBroken: () => onBroken("a transaction could not reserve its connection"),
    }),
    { schema },
  );
  return { sql, db };
}

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    const opened = openDatabase(url, (reason) => discardPool(opened.sql, reason));
    client = opened.sql;
    instance = opened.db;
  }
  return instance;
}

/** True when a connection string is configured. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Proxy so every existing `db.select(...)` call site keeps working unchanged
 * while construction stays deferred to first property access.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
