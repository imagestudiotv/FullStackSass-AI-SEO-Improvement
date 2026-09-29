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
 * its own client - wrapped here too. A transaction's own BEGIN, COMMIT and
 * ROLLBACK are sent by the driver, not through sql.unsafe(), so sql.begin()
 * gets its own time limit for those (see guardClient).
 *
 * One query at a time per connection - never pipelined - is the driver's job:
 * src/vendor/postgres (patched) and lib/db/index.ts.
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
   * connection for (UNSAFE_TRANSACTION - the 2026-09-28 incident, caused by
   * max_pipeline: 0). The server has then begun a transaction on a connection
   * the driver hands back to the pool: every later statement on it would run
   * inside that transaction and be thrown away when the connection closes.
   * lib/db/index.ts discards the pool, which closes that connection - and
   * rolls the stray transaction back - at once.
   */
  onBroken?: () => void;
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
        const timer = setTimeout(() => {
          console.error(
            `[db] query timed out after ${deadlineMs}ms: ${summarise(sqlText)}`,
          );
          // Frees it if it never left the queue; a query already on a dead
          // socket cannot be recalled, but the caller is no longer waiting.
          try {
            target.cancel?.();
          } catch {
            // Nothing useful to do; the timeout below is what matters.
          }
          try {
            options.onTimeout?.();
          } catch (error) {
            console.error("[db] onTimeout failed", error);
          }
          reject(new QueryTimeoutError(sqlText, deadlineMs));
        }, deadlineMs);

        run(
          (value) => {
            clearTimeout(timer);
            const took = Date.now() - startedAt;
            if (took >= slowMs) {
              console.warn(`[db] slow query ${took}ms: ${summarise(sqlText)}`);
            }
            resolve(value);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
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
 * Calls onTimeout when a transaction's own BEGIN (including the wait for a
 * connection) or its COMMIT/ROLLBACK does not answer in time. The driver
 * sends those itself, so withDeadline never sees them; without this, a
 * transaction on a silently dead connection waited out Vercel's 300 seconds.
 * Discarding the pool (lib/db/index.ts) terminates the connection, which
 * rejects the transaction.
 */
function transactionWatchdog(options: Options) {
  const deadlineMs = options.deadlineMs ?? DEADLINE_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    arm(what: string) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.error(`[db] transaction ${what} did not answer within ${deadlineMs}ms`);
        try {
          options.onTimeout?.();
        } catch (error) {
          console.error("[db] onTimeout failed", error);
        }
      }, deadlineMs);
    },
    disarm() {
      clearTimeout(timer);
    },
  };
}

/** Driver features that would bypass one-query-at-a-time or the pooler. */
const REFUSED = new Set<PropertyKey>(["reserve", "listen", "subscribe"]);

/**
 * Wraps a postgres.js client so every query it runs has a deadline, and every
 * transaction a time limit on its BEGIN and COMMIT/ROLLBACK.
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
          const watchdog = transactionWatchdog(options);
          // The driver can settle begin() (the connection closed) before the
          // callback does: never re-arm after that, or a healthy pool would be
          // discarded DEADLINE_MS later.
          let beginSettled = false;
          const last = args.length - 1;
          const callback = args[last] as (tx: postgres.Sql) => unknown;
          args[last] = async (tx: postgres.Sql) => {
            watchdog.disarm(); // BEGIN answered
            try {
              return await callback(guardClient(tx, options));
            } finally {
              if (!beginSettled) watchdog.arm("COMMIT/ROLLBACK");
            }
          };
          watchdog.arm("BEGIN");
          try {
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
            beginSettled = true;
            watchdog.disarm();
          }
        };
      }
      if (property === "savepoint") {
        // A nested transaction (drizzle's tx.transaction): same deadlines.
        return (...args: unknown[]) => {
          const last = args.length - 1;
          const callback = args[last];
          if (typeof callback === "function") {
            args[last] = (sp: postgres.Sql) => (callback as (s: postgres.Sql) => unknown)(guardClient(sp, options));
          }
          return (Reflect.get(target, "savepoint") as (...a: unknown[]) => unknown)(...args);
        };
      }
      if (REFUSED.has(property)) {
        return () => {
          throw new Error(
            `sql.${String(property)}() is not supported: it bypasses one-query-at-a-time (src/vendor/postgres) or needs a session the transaction pooler does not keep`,
          );
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
