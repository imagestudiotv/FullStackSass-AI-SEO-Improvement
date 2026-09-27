import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

/**
 * A disposable database on a REAL Postgres server, for tests that need
 * separate connections - lock contention cannot be shown on PGlite, which
 * has exactly one.
 *
 * Opt-in: set TEST_POSTGRES_URL to a server you are happy to have databases
 * created and dropped on, e.g. a throwaway container:
 *
 *   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16
 *   TEST_POSTGRES_URL=postgres://postgres:test@127.0.0.1:55432/postgres npx vitest run
 *
 * Each call creates a fresh database named billing_test_<random>, replays the
 * migrations into it (the real vector type when the server has pgvector,
 * text otherwise, as in src/test/db.ts), and
 * drops it on dispose. Only localhost is accepted unless
 * TEST_POSTGRES_ALLOW_REMOTE=1, so a production URL pasted by mistake is
 * refused rather than written to.
 */

const root = path.resolve(__dirname, "../..");

export function testPostgresUrl(): string | null {
  const raw = process.env.TEST_POSTGRES_URL;
  if (!raw) {
    /*
      CI sets REQUIRE_TEST_POSTGRES=1 so a missing database FAILS the run
      instead of silently skipping every independent-connection test.
    */
    if (process.env.REQUIRE_TEST_POSTGRES === "1") {
      throw new Error("REQUIRE_TEST_POSTGRES=1 but TEST_POSTGRES_URL is not set");
    }
    return null;
  }
  const host = new URL(raw).hostname;
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (!local && process.env.TEST_POSTGRES_ALLOW_REMOTE !== "1") {
    throw new Error(
      `TEST_POSTGRES_URL points at ${host}; only localhost is used unless TEST_POSTGRES_ALLOW_REMOTE=1`,
    );
  }
  return raw;
}

type Journal = { entries: { tag: string }[] };

export async function createPostgresTestDb(
  connections: number,
  /**
   * Replay migrations only up to and including this journal index, so a
   * test can apply later ones itself (the cutover tests apply 0041/0042).
   */
  options: { throughIndex?: number } = {},
) {
  const adminUrl = testPostgresUrl();
  if (!adminUrl) throw new Error("TEST_POSTGRES_URL is not set");

  const name = `billing_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  const setup = postgres(url.toString(), { max: 1, onnotice: () => {} });

  /*
    The REAL vector type when the server has pgvector (CI's
    pgvector/pgvector image, Supabase): the migrations then run exactly as
    written. Only a server without it falls back to text for the one
    embedding column, as PGlite does.
  */
  const [{ available: hasVector }] = await setup<{ available: boolean }[]>`
    select exists (select 1 from pg_available_extensions where name = 'vector') as available`;
  if (hasVector) await setup.unsafe("create extension if not exists vector");
  else if (process.env.REQUIRE_PGVECTOR === "1") {
    throw new Error("REQUIRE_PGVECTOR=1 but the server has no pgvector extension");
  }
  const journal = JSON.parse(
    readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
  ) as Journal;
  for (const { tag } of journal.entries.filter(
    (_entry, index) => options.throughIndex === undefined || index <= options.throughIndex,
  )) {
    const file = readFileSync(path.join(root, "drizzle", `${tag}.sql`), "utf8");
    for (const statement of (hasVector ? file : file.replace(/vector\(\d+\)/g, "text"))
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await setup.unsafe(statement);
    }
  }

  /** One client per connection, each pinned to a single socket. */
  const clients = Array.from({ length: connections }, () =>
    postgres(url.toString(), { max: 1, onnotice: () => {}, prepare: false }),
  );
  const dbs = clients.map((client) => drizzle(client, { schema }));

  async function dispose() {
    await Promise.all(clients.map((client) => client.end()));
    await setup.end();
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  }

  return { dbs, clients, sql: setup, dispose, hasVector };
}
