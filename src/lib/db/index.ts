import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

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

let client: ReturnType<typeof postgres> | null = null;
let instance: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    client = postgres(url, {
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
       * Four rather than one. `max: 1` is the usual advice when a pooler sits
       * in front, and it is wrong here: this codebase fans out with
       * Promise.all — billing/page.tsx awaits six queries at once — and
       * measured against this database, one and two connections HANG on that
       * page rather than queueing, while three and above return in ~2s. Four
       * keeps a connection spare above the observed cliff and still cuts the
       * per-instance footprint by more than half. Do not lower this below the
       * widest Promise.all in the app without re-testing that page.
       */
      max: 4,

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
    });
    instance = drizzle(client, { schema });
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
