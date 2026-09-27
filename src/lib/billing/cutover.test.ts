import { readFileSync } from "node:fs";
import path from "node:path";

import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The 0041 → 0042 cutover window, on a REAL Postgres with separate
 * connections: a migrator, an old-code writer (plain article INSERT/DELETE,
 * no reservation - what the committed code does) and an operator session.
 * Skipped unless TEST_POSTGRES_URL names a disposable server.
 *
 * The reproduced problem: an article the old code inserts and deletes
 * between 0041's backfill and 0042's trigger is counted by nobody, and both
 * baseline checks still come back empty. It happens whether the migrations
 * commit one by one (psql) or together (drizzle-kit migrate). The fix is the
 * database write freeze (scripts/cutover/freeze-article-writes.sql).
 */

const available = Boolean(testPostgresUrl());
const root = path.resolve(__dirname, "../../..");

const file = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8").replace(/--> statement-breakpoint/g, "");
const MIGRATION_0041 = file("drizzle/0041_article_allowance_baseline.sql");
const MIGRATION_0042 = file("drizzle/0042_article_baseline_trigger.sql");
const FREEZE = file("scripts/cutover/freeze-article-writes.sql");
const UNFREEZE = file("scripts/cutover/unfreeze-article-writes.sql");

const SITE = "11111111-1111-4111-8111-111111111111";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function settledWithin(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(() => true, () => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

describe.skipIf(!available)("article cutover window on real Postgres", () => {
  let migrator: postgres.Sql;
  let writer: postgres.Sql;
  let operator: postgres.Sql;
  let dispose: () => Promise<void>;

  /** Old code: an article row, no reservation. */
  const oldCodeInsert = (client: postgres.Sql | postgres.TransactionSql, title: string) =>
    client`insert into articles (website_id, title, status) values (${SITE}, ${title}, 'draft') returning id`;
  const oldCodeDelete = (client: postgres.Sql, id: string) =>
    client`delete from articles where id = ${id}`;
  const ledger = async () =>
    (await operator`select subject_id from spend_reservations where key = ${`articles:${SITE}`} and state = 'consumed'`).map(
      (row) => row.subject_id as string,
    );

  beforeAll(async () => {
    // 0000-0040 only: each test plays 0041 and 0042 itself.
    const created = await createPostgresTestDb(3, { throughIndex: 40 });
    [migrator, writer, operator] = created.clients;
    dispose = created.dispose;
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  beforeEach(async () => {
    // Back to "0040 applied" before each case.
    await operator.unsafe(`
      drop trigger if exists cutover_article_write_freeze on articles;
      drop function if exists cutover_block_article_writes();
      drop trigger if exists articles_allowance_baseline on articles;
      drop function if exists article_allowance_baseline();
      delete from spend_reservations; delete from articles; delete from websites; delete from organization;
      insert into organization (id, name, slug, created_at) values ('org_cut', 'Cut', 'cut', now());
      insert into websites (id, organization_id, url, domain) values ('${SITE}', 'org_cut', 'https://cut.test', 'cut.test');`);
  });

  it("REPRODUCTION, psql path: without the freeze an article written in the window is lost", async () => {
    const [existing] = await oldCodeInsert(writer, "before cutover");
    await migrator.unsafe(MIGRATION_0041);
    const [slipped] = await oldCodeInsert(writer, "in the window");
    await oldCodeDelete(writer, slipped.id);
    await migrator.unsafe(MIGRATION_0042);

    expect(await ledger()).toEqual([existing.id]); // the slipped article is gone for good
  });

  it("REPRODUCTION, single-transaction path: drizzle-kit migrate's one transaction does not close it", async () => {
    const between = gate();
    const inWindow = gate();
    const migration = migrator.begin(async (tx) => {
      await tx.unsafe(MIGRATION_0041);
      between.release();
      await inWindow.promise;
      await tx.unsafe(MIGRATION_0042);
    });
    await between.promise;
    const [slipped] = await oldCodeInsert(writer, "in the window");
    await oldCodeDelete(writer, slipped.id);
    inWindow.release();
    await migration;

    expect(await ledger()).toEqual([]);
  });

  it("with the freeze, old-code writes fail in the window on both paths, and nothing is lost", async () => {
    const [existing] = await oldCodeInsert(writer, "before cutover");
    await operator.unsafe(FREEZE);

    await expect(oldCodeInsert(writer, "in the window")).rejects.toThrow(/paused for a database migration/);
    await expect(oldCodeDelete(writer, existing.id)).rejects.toThrow(/paused for a database migration/);
    // A website deletion cascading to its articles is stopped too.
    await expect(writer`delete from websites where id = ${SITE}`).rejects.toThrow(/paused/);

    // psql path: separate commits.
    await migrator.unsafe(MIGRATION_0041);
    await expect(oldCodeInsert(writer, "between the files")).rejects.toThrow(/paused/);
    await migrator.unsafe(MIGRATION_0042);
    await operator.unsafe(UNFREEZE);

    // After: old code still running is covered by the trigger.
    const [later] = await oldCodeInsert(writer, "after cutover");
    await oldCodeDelete(writer, later.id);
    expect((await ledger()).sort()).toEqual([existing.id, later.id].sort());
  });

  it("with the freeze, the single-transaction path is closed as well", async () => {
    await operator.unsafe(FREEZE);
    const between = gate();
    const inWindow = gate();
    const migration = migrator.begin(async (tx) => {
      await tx.unsafe(MIGRATION_0041);
      between.release();
      await inWindow.promise;
      await tx.unsafe(MIGRATION_0042);
    });
    await between.promise;
    await expect(oldCodeInsert(writer, "in the window")).rejects.toThrow(/paused/);
    inWindow.release();
    await migration;
    await operator.unsafe(UNFREEZE);
    expect(await ledger()).toEqual([]);
  });

  it("the freeze waits for an in-flight writer before it takes effect", async () => {
    // A request already mid-transaction with an article written, not committed.
    const commit = gate();
    const inFlight = writer.begin(async (tx) => {
      const [row] = await oldCodeInsert(tx, "in flight");
      await commit.promise;
      return row.id as string;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const freeze = operator.unsafe(FREEZE);
    expect(await settledWithin(freeze, 500)).toBe(false); // it drains, it does not cut in

    commit.release();
    const drainedId = await inFlight;
    await freeze;

    await migrator.unsafe(MIGRATION_0041);
    await migrator.unsafe(MIGRATION_0042);
    await operator.unsafe(UNFREEZE);
    expect(await ledger()).toEqual([drainedId]);
  });

  it("refuses the article write of a transaction that began before the freeze", async () => {
    const began = gate();
    const mayWrite = gate();
    let xid = "";
    let startedAt = 0;

    // 1. The transaction starts and runs its first statement - no freeze yet.
    const early = writer.begin(async (tx) => {
      const [row] = await tx`
        select txid_current()::text as xid,
               extract(epoch from transaction_timestamp())::float8 as started`;
      xid = row.xid as string;
      startedAt = Number(row.started);
      began.release();
      await mayWrite.promise;
      // 3. Only now does it try to write an article.
      return oldCodeInsert(tx, "early transaction");
    });
    await began.promise;

    try {
      // 2. The freeze is installed and COMMITTED while that transaction is open.
      await operator.unsafe(FREEZE);
      const [open] = await operator`
        select state,
               extract(epoch from xact_start)::float8 as started,
               extract(epoch from clock_timestamp())::float8 as frozen_after
        from pg_stat_activity where backend_xid::text = ${xid}`;
      expect(open.state).toBe("idle in transaction");
      expect(Number(open.started)).toBe(startedAt); // the same, still-open transaction
      expect(startedAt).toBeLessThan(Number(open.frozen_after));
    } finally {
      mayWrite.release();
    }
    await expect(early).rejects.toThrow(/paused for a database migration/);
    const [written] = await operator`select count(*)::int as n from articles where title = 'early transaction'`;
    expect(written.n).toBe(0);
  });

  it("a disabled baseline trigger cannot lift the freeze, for any session", async () => {
    await operator.unsafe(FREEZE);
    await migrator.unsafe(MIGRATION_0041);
    await migrator.unsafe(MIGRATION_0042);
    await migrator.unsafe("alter table articles disable trigger articles_allowance_baseline");

    await expect(operator.unsafe(UNFREEZE)).rejects.toThrow(/apply 0042 before lifting the freeze/);
    await expect(oldCodeInsert(writer, "still frozen")).rejects.toThrow(/paused/);

    await migrator.unsafe("alter table articles enable trigger articles_allowance_baseline");
    await operator.unsafe(UNFREEZE);
    const [later] = await oldCodeInsert(writer, "after the unfreeze");
    await oldCodeDelete(writer, later.id);
    expect(await ledger()).toEqual([later.id]);
  });

  it("the freeze cannot be lifted before 0042's trigger exists", async () => {
    await operator.unsafe(FREEZE);
    await migrator.unsafe(MIGRATION_0041);
    await expect(operator.unsafe(UNFREEZE)).rejects.toThrow(/apply 0042 before lifting the freeze/);
    await expect(oldCodeInsert(writer, "still frozen")).rejects.toThrow(/paused/);
  });
});
