import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The baseline-trigger prerequisite shared by the cutover scripts and the
 * report. A trigger that merely carries the right NAME is not enough: it must
 * be 0042's trigger, on public.articles, firing AFTER INSERT for each row,
 * and enabled for ordinary application writes. Anything less must refuse -
 * and the refused unfreeze must leave the article write freeze in place.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { runReconciliation } from "@/lib/billing/reconciliation";
import { RECONCILIATION_SQL } from "@/lib/billing/reconciliation-sql.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const FREEZE = read("scripts/cutover/freeze-article-writes.sql");
const UNFREEZE = read("scripts/cutover/unfreeze-article-writes.sql");
const BACKFILL = read("scripts/cutover/article-baseline-backfill.sql");

let test: TestDb;
let websiteId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  ({ websiteId } = await seedWebsite(test));
});

/** Back to 0042's trigger, as installed, with the write freeze on. */
beforeEach(async () => {
  await test.client.exec(`
    drop trigger if exists articles_allowance_baseline on articles;
    drop table if exists decoy_articles;
    create trigger articles_allowance_baseline after insert on articles
      for each row execute function article_allowance_baseline();`);
  await test.client.exec(FREEZE);
});

const oldCodeInsert = () =>
  test.client.query<{ id: string }>(
    "insert into articles (website_id, title, status) values ($1, 'old code', 'draft') returning id",
    [websiteId],
  );

async function freezeIsIntact() {
  const { rows } = await test.client.query(
    "select 1 from pg_trigger where tgname = 'cutover_article_write_freeze' and tgrelid = 'public.articles'::regclass",
  );
  expect(rows).toHaveLength(1);
  await expect(oldCodeInsert()).rejects.toThrow(/paused for a database migration/);
}

describe("the baseline trigger prerequisite refuses", () => {
  it.each([
    ["a missing trigger", "drop trigger articles_allowance_baseline on articles"],
    ["a disabled trigger", "alter table articles disable trigger articles_allowance_baseline"],
    [
      "a same-named trigger on another table",
      `drop trigger articles_allowance_baseline on articles;
       create table decoy_articles (id int);
       create trigger articles_allowance_baseline after insert on decoy_articles
         for each row execute function article_allowance_baseline();`,
    ],
    [
      "a replica-only trigger, which normal application sessions skip",
      "alter table articles enable replica trigger articles_allowance_baseline",
    ],
    [
      "a same-named trigger that does not fire on insert",
      `drop trigger articles_allowance_baseline on articles;
       create trigger articles_allowance_baseline after delete on articles
         for each row execute function article_allowance_baseline();`,
    ],
    [
      "a same-named trigger that fires once per statement, not per article",
      `drop trigger articles_allowance_baseline on articles;
       create trigger articles_allowance_baseline after insert on articles
         for each statement execute function article_allowance_baseline();`,
    ],
  ])("%s", async (_label, breakIt) => {
    await test.client.exec(breakIt);

    await expect(test.client.exec(UNFREEZE)).rejects.toThrow(/apply 0042 before lifting the freeze/);
    await freezeIsIntact();
    await expect(test.client.exec(BACKFILL)).rejects.toThrow(/apply 0042 first/);
    expect(await runReconciliation(test.db, "articleBaselineTriggerMissing")).toHaveLength(1);
  });
});

describe("a valid trigger", () => {
  it("passes all three checks, lifts the freeze, and counts a later old-code article that is deleted", async () => {
    expect(await runReconciliation(test.db, "articleBaselineTriggerMissing")).toEqual([]);
    await test.client.exec(BACKFILL);
    await test.client.exec(UNFREEZE);

    const { rows: freeze } = await test.client.query(
      "select 1 from pg_trigger where tgname = 'cutover_article_write_freeze'",
    );
    expect(freeze).toEqual([]);

    const {
      rows: [article],
    } = await oldCodeInsert();
    await test.client.query("delete from articles where id = $1", [article.id]);
    const { rows: ledger } = await test.client.query<{ state: string; operation: string }>(
      "select state, operation from spend_reservations where subject_id = $1",
      [article.id],
    );
    expect(ledger).toEqual([{ state: "consumed", operation: "article.legacy" }]);
  });

  it("is checked by the same predicate in all three places", () => {
    const predicate = (text: string) => {
      const start = text.toLowerCase().indexOf("from pg_trigger t");
      const end = text.indexOf("(t.tgtype & 4) = 4", start);
      return text.slice(start, end).replace(/\s+/g, " ").toLowerCase();
    };
    const fromUnfreeze = predicate(UNFREEZE);
    expect(fromUnfreeze).toContain("tgenabled in ('o', 'a')");
    expect(predicate(BACKFILL)).toBe(fromUnfreeze);
    expect(predicate(RECONCILIATION_SQL.articleBaselineTriggerMissing)).toBe(fromUnfreeze);
  });
});
