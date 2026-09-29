# postgres.js 3.4.9, patched: one query at a time per connection

This is a copy of `postgres` 3.4.9 (https://github.com/porsager/postgres,
Unlicense / public domain): the ESM files from the published package's `src/`
folder. It has a few small changes, in `index.js` and one in `connection.js`,
each marked `REPGET PATCH`. The application's database client (`src/lib/db/index.ts`)
imports this copy. The npm package stays installed for its TypeScript types
(`index.d.ts` here re-exports them) and for operator scripts.

## Why

Supabase's transaction pooler (Supavisor, port 6543) loses **pipelined**
queries: a query written to a connection before that connection's previous
query has answered never gets an answer. postgres.js pipelines whenever it has
more work than free connections. That happens in two ways:

- a `Promise.all` wider than the pool;
- a connection leaving service while others are busy: ending at
  `max_lifetime` or `idle_timeout`, dropped (ECONNRESET), or refused at
  startup.

In each case it writes the next query down a busy connection. That hung the
admin operations, backlinks and dashboard pages.

Two fixes that avoid changing the driver were tried, and both failed:

- **`max_pipeline: 0`** (2026-09-28). It also stops `sql.begin()` reserving its
  connection, so *every* transaction failed at BEGIN with `UNSAFE_TRANSACTION`.
  The stray server-side transaction then swallowed later writes on that
  connection: payment webhooks, admin switches and link verification were
  down for about 8 hours.
- **A gate in front of the driver** (PR #56). An independent review showed the
  driver can settle a query before its connection is usable again, in all the
  connection-leaving-service cases above, so pipelining and stranded
  transactions still happened. It also broke rollback atomicity for statements
  still waiting at the gate.

So the routing itself is changed.

## The changes (`index.js`)

1. **`handler()`**: a query that finds no open or closed connection waits in the
   driver's queue. Before, it went to `busy.shift()`, which pipelined it.
2. **`onopen()`**: a connection that becomes free takes **one** queued query.
   Before, it took `ceil(queue / (connecting + 1))` queries written back to back.
3. **`begin()`'s statement handler**: statements of one transaction run one
   after another on its connection. Before, `c.execute(q) || move(c, full)`
   pipelined them. COMMIT and ROLLBACK are therefore always sent after every
   statement the transaction issued, so a failed transaction stays atomic.
4. **A transaction owns its connection explicitly**, a consequence of change
   3, found by a second review:
   - Its statements run only while the connection is still reserved for it.
     After the connection closes (server FIN, `pg_terminate_backend`, a pooler
     restart) or after COMMIT/ROLLBACK released it, a statement is rejected
     (`TRANSACTION_ENDED`, or the close error). It is no longer written to a
     dead socket (an uncaught TypeError that left the connection parked or
     poisoned) or to a connection another request now uses.
   - Statements still queued when the connection closes, or when `begin()`
     returns, are rejected at once instead of waiting out their deadline.
   - A cancelled statement is skipped instead of stalling the transaction.

And one change in `connection.js`:

5. **`closed()`** clears the last error the server sent. Before, after the
   server terminated a connection (57P01), the next unrelated query given to
   that connection slot failed with that stale error.

`sql.begin()` still reserves its connection, because `max_pipeline` stays at
its default (pinned in `src/lib/db/index.ts`). `sql.reserve()` is not changed
and the application does not use it: `guardClient` refuses it.

## Proof and upgrading

`src/lib/db/client.postgres.test.ts` runs this copy against real Postgres
through a proxy that watches the wire. That test runs in CI. It checks that:

- nothing is ever pipelined under bursts, connection expiry, refused
  connections, dropped connections and client-side errors;
- transactions commit, and they stay atomic when a statement fails;
- the unpatched npm package does pipeline, which shows the proxy can see it.

To upgrade postgres.js:

1. Copy the new version's `src/*.js` here.
2. Re-apply the `REPGET PATCH` changes.
3. Bump the npm package to the same version, for its types.
4. Make that test pass.
