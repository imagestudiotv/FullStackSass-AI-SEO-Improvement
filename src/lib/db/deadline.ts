import type postgres from "postgres";

/**
 * A time limit, and a slow-query log, on every query the app sends.
 *
 * WHY. The backlinks page hung for Vercel's full 300 seconds three times in
 * September. Its queries are tiny and the server cancels anything over two
 * minutes, so no query was slow - the app was waiting on a connection that had
 * silently died. Nothing on the client side bounded that wait: a pooled socket
 * whose far end has vanished accepts the query and simply never answers, and
 * TCP takes far longer than 300 seconds to give up on it. The customer watched
 * a page load for five minutes and then fail.
 *
 * With this, such a query fails after DEADLINE_MS with an error naming the SQL,
 * the page shows its error screen - where "try again" is true, because the
 * retry gets a live connection - and the log says exactly which query hung,
 * which is the one thing the Vercel logs could not tell us last time.
 *
 * Applied where drizzle reaches the driver: it runs every statement through
 * sql.unsafe(), and transactions through sql.begin(), whose callback receives
 * its own client - wrapped here too.
 *
 * ONE QUERY PER CONNECTION AT A TIME. The same wrapper also admits queries
 * through a Gate, so the driver is never handed more work than it has
 * connections - see Gate below and lib/db/index.ts.
 */

/** Longer than any legitimate query here; far shorter than Vercel's 300s. */
export const DEADLINE_MS = 30_000;

/** Worth a log line: the page is visibly slow by now. */
export const SLOW_MS = 5_000;

export class QueryTimeoutError extends Error {
  constructor(sqlText: string, ms: number) {
    super(`Database query did not answer within ${ms}ms: ${summarise(sqlText)}`);
    this.name = "QueryTimeoutError";
  }
}

/** First line of the statement, enough to recognise it, never parameters. */
function summarise(sqlText: string): string {
  return sqlText.replace(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * At most `capacity` operations at once; the rest wait, first come first
 * served.
 *
 * WHY. postgres.js PIPELINES: when it has more queries than free
 * connections, it writes the next query down a connection whose previous
 * query has not answered yet. Supabase's transaction pooler loses pipelined
 * queries - they never answer - which is what hung the operations, backlinks
 * and dashboard pages (lib/db/index.ts). The driver's own switch for this,
 * max_pipeline: 0, cannot be used: postgres.js reserves a connection for a
 * transaction in the same step that setting skips, so with it EVERY
 * transaction fails at BEGIN ("UNSAFE_TRANSACTION"), which took down every
 * payment webhook and admin switch on 2026-09-28.
 *
 * So the limit is applied here instead, in front of the driver. The pool
 * gate's capacity is the pool size, and each query holds its place until it
 * has answered - by then postgres.js has put its connection back as free
 * (it resolves a query and frees the connection in one step) - and each
 * transaction holds one place from BEGIN to COMMIT. The driver therefore
 * always has a free connection for what it is given, and never pipelines.
 * Inside a transaction, a gate of one runs its queries one after another on
 * the transaction's connection.
 */
export class Gate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`Gate capacity must be a positive integer, got ${capacity}`);
  }

  /** Resolves, in turn, with the function that gives the place back. Call it exactly once. */
  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grant = () => {
        this.active += 1;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active -= 1;
          this.waiting.shift()?.();
        });
      };
      if (this.active < this.capacity) grant();
      else this.waiting.push(grant);
    });
  }

  /** For tests and logs. */
  get inUse(): number {
    return this.active;
  }
  get queued(): number {
    return this.waiting.length;
  }
}

type Options = {
  deadlineMs?: number;
  slowMs?: number;
  /**
   * Called once when a query misses its deadline. The query's connection is
   * almost certainly dead, and postgres.js keeps it in the pool with the query
   * still pending - so every later query that lands on it waits out the same
   * deadline. lib/db/index.ts discards the whole pool here.
   */
  onTimeout?: () => void;
  /**
   * Called when postgres.js reports a transaction it could not reserve a
   * connection for (UNSAFE_TRANSACTION). The server has then begun a
   * transaction on a connection the driver hands back to the pool: every
   * later statement on it would run inside that transaction and be thrown
   * away when the connection closes. lib/db/index.ts discards the pool, which
   * closes that connection - and rolls the stray transaction back - at once.
   */
  onBroken?: () => void;
  /**
   * Admits queries (and, on the pool, transactions): see Gate. The pool gets
   * one sized to its connections; each transaction a gate of one.
   */
  gate?: Gate;
};

type Thenable = {
  then: (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
  cancel?: () => void;
};

/**
 * Makes one postgres.js query race a timer.
 *
 * The query object is returned itself, not a new promise, because drizzle
 * calls .values() on it before awaiting it. Only its `then` is replaced, and
 * postgres.js' catch/finally go through `then`, so every way of awaiting it
 * is covered. The original `then` is what starts the query, so it still runs
 * exactly once.
 */
function withDeadline<Q>(query: Q, sqlText: string, options: Options): Q {
  const deadlineMs = options.deadlineMs ?? DEADLINE_MS;
  const slowMs = options.slowMs ?? SLOW_MS;
  const target = query as unknown as Thenable;
  const run = target.then.bind(target);
  let settled: Promise<unknown> | null = null;

  target.then = (onFulfilled, onRejected) => {
    if (!settled) {
      const startedAt = Date.now();
      settled = new Promise((resolve, reject) => {
        let timedOut = false;
        let sent = false;
        const timer = setTimeout(() => {
          timedOut = true;
          console.error(
            `[db] query timed out after ${deadlineMs}ms: ${summarise(sqlText)}`,
          );
          // Frees it if it never left the queue; a query already on a dead
          // socket cannot be recalled, but the caller is no longer waiting.
          // Only a query handed to the driver: cancelling one still waiting at
          // the gate would reject a promise nothing listens to (an unhandled
          // rejection) - and it will never be sent anyway.
          if (sent) {
            try {
              target.cancel?.();
            } catch {
              // Nothing useful to do; the timeout below is what matters.
            }
          }
          try {
            options.onTimeout?.();
          } catch (error) {
            console.error("[db] onTimeout failed", error);
          }
          reject(new QueryTimeoutError(sqlText, deadlineMs));
        }, deadlineMs);

        // The deadline covers the wait for a place as well as the query.
        const send = (release: () => void) => {
          // Timed out while waiting: never sent, and its place goes to the next.
          if (timedOut) return release();
          sent = true;
          run(
            (value) => {
              release();
              clearTimeout(timer);
              const took = Date.now() - startedAt;
              if (took >= slowMs) {
                console.warn(`[db] slow query ${took}ms: ${summarise(sqlText)}`);
              }
              resolve(value);
            },
            (error) => {
              release();
              clearTimeout(timer);
              reject(error);
            },
          );
        };
        if (options.gate) options.gate.acquire().then(send);
        else send(() => {});
      });
    }
    return settled.then(onFulfilled, onRejected);
  };

  return query;
}

function isUnsafeTransaction(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return code === "UNSAFE_TRANSACTION" || cause === "UNSAFE_TRANSACTION";
}

/**
 * Wraps a postgres.js client so every query it runs has a deadline and goes
 * through the gate, if one is given.
 */
export function guardClient<T extends postgres.Sql>(
  sql: T,
  options: Options = {},
): T {
  return new Proxy(sql, {
    get(target, property, receiver) {
      if (property === "unsafe") {
        return (sqlText: string, ...rest: unknown[]) =>
          withDeadline(
            (target.unsafe as (...args: unknown[]) => unknown)(sqlText, ...rest),
            sqlText,
            options,
          );
      }
      if (property === "begin") {
        return async (...args: unknown[]) => {
          // One place for the whole transaction: its connection is taken from BEGIN to COMMIT.
          const release = options.gate ? await options.gate.acquire() : () => {};
          try {
            const last = args.length - 1;
            const callback = args[last] as (tx: postgres.Sql) => unknown;
            // Its statements share its one connection: one at a time.
            const inside: Options = { ...options, gate: new Gate(1) };
            args[last] = (tx: postgres.Sql) => callback(guardClient(tx, inside));
            return await (target.begin as (...a: unknown[]) => Promise<unknown>)(...args);
          } catch (error) {
            if (isUnsafeTransaction(error)) {
              console.error("[db] a transaction could not reserve its connection (UNSAFE_TRANSACTION)");
              try {
                options.onBroken?.();
              } catch (hookError) {
                console.error("[db] onBroken failed", hookError);
              }
            }
            throw error;
          } finally {
            release();
          }
        };
      }
      if (property === "savepoint") {
        // A nested transaction: same connection, so the same gate and deadlines.
        return (...args: unknown[]) => {
          const last = args.length - 1;
          const callback = args[last];
          if (typeof callback === "function") {
            args[last] = (sp: postgres.Sql) => (callback as (s: postgres.Sql) => unknown)(guardClient(sp, options));
          }
          return (Reflect.get(target, "savepoint") as (...a: unknown[]) => unknown)(...args);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
