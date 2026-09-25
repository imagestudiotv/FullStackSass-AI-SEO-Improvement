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

type Options = { deadlineMs?: number; slowMs?: number };

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

/** Wraps a postgres.js client so every query it runs has a deadline. */
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
        return (...args: unknown[]) => {
          const last = args.length - 1;
          const callback = args[last] as (tx: postgres.Sql) => unknown;
          args[last] = (tx: postgres.Sql) => callback(guardClient(tx, options));
          return (target.begin as (...a: unknown[]) => unknown)(...args);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
