import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import postgres from "@/vendor/postgres";

/**
 * Database access controls on REAL Postgres, set up like Supabase: the API
 * roles `anon` / `authenticated` exist, and the role that runs migrations
 * hands them every privilege on new objects by default - which is how
 * blog_posts, blog_categories and plugin_connect_requests ended up readable
 * and writable by them (no RLS, full grants). See drizzle/0056_rls_hardening.sql.
 *
 *  - every migration, replayed into such a database, leaves nothing open
 *    (this is the CI gate: a new table without RLS, a grant to an API role,
 *    an executable function or a permissive policy fails it);
 *  - the check is shown to catch the original omission (migrations up to 0055);
 *  - the API roles are refused drafts and handshake rows, and cannot insert,
 *    update, delete or truncate them - and with a stray grant, RLS still
 *    hides every row and refuses every write;
 *  - the application's own role (BYPASSRLS, like production's `postgres`)
 *    still runs the blog and the WordPress handshake.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return {
    db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }),
  };
});

import * as schema from "@/lib/db/schema";
import { blogCategories, blogPosts, pluginConnectRequests } from "@/lib/db/schema";
import { listCategories } from "@/lib/blog/categories";
import { getPost } from "@/lib/blog/posts";
import { approveHandshake, exchangeHandshakeCode, loadForViewer, startHandshake } from "@/lib/plugin/handshake";

import { inspectDatabaseSecurity } from "./security-check.mjs";

const available = Boolean(testPostgresUrl());
const APP_ROLE = "rg_rls_app";
const PROTECTED = ["blog_posts", "blog_categories", "plugin_connect_requests"] as const;

/** Supabase's API roles and default privileges, before any migration runs. */
async function supabaseLike(sql: ReturnType<typeof postgres>) {
  for (const statement of [
    "create role anon nologin noinherit",
    "create role authenticated nologin noinherit",
    "create role service_role nologin noinherit bypassrls",
    // Stands in for production's `postgres`: not a superuser, BYPASSRLS.
    `create role ${APP_ROLE} login nosuperuser bypassrls`,
  ]) {
    await sql.unsafe(`do $$ begin ${statement}; exception when duplicate_object or unique_violation then null; end $$`);
  }
  await sql.unsafe(`
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
}

type Code = { code?: string };

describe.skipIf(!available)("database access controls (Supabase roles, real Postgres)", () => {
  type Db = typeof import("@/lib/db").db;
  let sql: ReturnType<typeof postgres>;
  let dispose: () => Promise<void>;
  let appClient: ReturnType<typeof postgres>;
  let appDb: Db;
  const asApp = <T>(fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(appDb, fn);
  let siteId: string;
  const viewer = { sessionId: "s_rls_owner", userId: "u_rls_owner" };

  beforeAll(async () => {
    const created = await createPostgresTestDb(1, { beforeMigrations: supabaseLike });
    sql = created.sql;
    dispose = created.dispose;
    route.fallback = created.dbs[0];

    // The application's role gets table privileges (production's `postgres`
    // owns the tables; what matters here is BYPASSRLS without superuser).
    await sql.unsafe(`grant usage on schema public to ${APP_ROLE}; grant all on all tables in schema public to ${APP_ROLE};`);
    const [{ name }] = await sql<{ name: string }[]>`select current_database() as name`;
    const url = new URL(testPostgresUrl()!);
    url.username = APP_ROLE;
    url.password = "";
    url.pathname = `/${name}`;
    appClient = postgres(url.toString(), { max: 1, onnotice: () => {}, prepare: false });
    appDb = drizzle(appClient, { schema }) as unknown as Db;

    // Fixtures, written by the owner: a draft, a category, a handshake row.
    await sql`insert into blog_posts (slug, title, category, author, status, body_html) values ('draft-only', 'Unreleased', 'Guides', 'RepGet team', 'draft', '<p>secret plans</p>')`;
    await sql`insert into blog_categories (name, slug) values ('Internal', 'internal') on conflict do nothing`;
    await sql`insert into plugin_connect_requests (id, origin, code_hash, expires_at) values ('req_rls_fixture', 'https://wp.example', 'hash-of-a-code', now() + interval '10 minutes')`;
  }, 180_000);

  afterAll(async () => {
    await appClient?.end();
    await dispose?.();
  });

  it("leaves nothing open after every migration", async () => {
    const { problems, summary } = await inspectDatabaseSecurity(sql);
    expect(problems).toEqual([]);
    expect(summary.apiRolesPresent).toEqual(expect.arrayContaining(["anon", "authenticated"]));
    expect(summary.tables).toBeGreaterThanOrEqual(67);
    expect(summary.tablesWithoutRls).toBe(0);
  });

  it("catches the omission it fixes (migrations before 0056)", async () => {
    const before = await createPostgresTestDb(1, { throughIndex: 55, beforeMigrations: supabaseLike });
    try {
      const { problems } = await inspectDatabaseSecurity(before.sql);
      for (const table of PROTECTED) {
        expect(problems).toContain(`table ${table}: row level security is disabled`);
        expect(problems.some((p) => p.startsWith(`table ${table}: anon holds `))).toBe(true);
      }
      expect(problems.some((p) => p.startsWith("function repget_page_key(text,text): "))).toBe(true);
    } finally {
      await before.dispose();
    }
  }, 180_000);

  it("fails a later table that forgets RLS, or a stray grant", async () => {
    await sql
      .begin(async (tx) => {
        await tx.unsafe("create table leak_probe (id int)");
        const withoutRls = await inspectDatabaseSecurity(tx);
        expect(withoutRls.problems).toEqual(["table leak_probe: row level security is disabled"]);
        // The default privileges no longer hand new tables to the API roles...
        await tx.unsafe("alter table leak_probe enable row level security");
        expect((await inspectDatabaseSecurity(tx)).problems).toEqual([]);
        // ...and a grant added by hand is reported.
        await tx.unsafe("grant select on leak_probe to anon");
        expect((await inspectDatabaseSecurity(tx)).problems).toEqual(["table leak_probe: anon holds SELECT"]);
        throw new Error("rollback");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback") throw error;
      });
  });

  async function refusedAs(role: string, statement: string) {
    const error = await sql
      .begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx.unsafe(statement);
      })
      .then(
        () => null,
        (e: Code) => e,
      );
    return error?.code ?? "allowed";
  }

  for (const role of ["anon", "authenticated"]) {
    it(`refuses ${role} every read and write of drafts and handshakes`, async () => {
      for (const table of PROTECTED) {
        expect(await refusedAs(role, `select * from ${table}`)).toBe("42501");
        expect(await refusedAs(role, `delete from ${table}`)).toBe("42501");
        expect(await refusedAs(role, `update ${table} set ${table === "blog_categories" ? "blurb" : table === "blog_posts" ? "title" : "origin"} = 'x'`)).toBe("42501");
        expect(await refusedAs(role, `truncate ${table}`)).toBe("42501");
      }
      expect(await refusedAs(role, `insert into blog_posts (slug, title, category, author) values ('x', 'x', 'Guides', 'x')`)).toBe("42501");
      expect(await refusedAs(role, `insert into blog_categories (name, slug) values ('x', 'x')`)).toBe("42501");
      expect(await refusedAs(role, `insert into plugin_connect_requests (id, origin, expires_at) values ('x', 'x', now())`)).toBe("42501");
      expect(await refusedAs(role, `select repget_page_key('https://a.example/', null)`)).toBe("42501");
    });
  }

  it("hides every row and refuses every write even with a stray grant (RLS itself)", async () => {
    const seen = await sql
      .begin(async (tx) => {
        await tx.unsafe(`grant select, insert, update, delete on ${PROTECTED.join(", ")} to authenticated`);
        await tx.unsafe("set local role authenticated");
        const counts: Record<string, number> = {};
        for (const table of PROTECTED) {
          counts[table] = (await tx.unsafe(`select count(*)::int as n from ${table}`))[0].n;
          counts[`${table}:updated`] = (await tx.unsafe(`update ${table} set created_at = created_at returning 1`)).length;
          counts[`${table}:deleted`] = (await tx.unsafe(`delete from ${table} returning 1`)).length;
        }
        const insert = await tx
          .unsafe("insert into blog_posts (slug, title, category, author) values ('planted', 'x', 'Guides', 'x')")
          .then(
            () => "allowed",
            (e: Code & { message?: string }) => `${e.code} ${e.message}`,
          );
        counts.insertRefused = insert.startsWith("42501 new row violates row-level security policy") ? 1 : 0;
        throw Object.assign(new Error("rollback"), { counts });
      })
      .catch((error: Error & { counts?: Record<string, number> }) => {
        if (error.message !== "rollback") throw error;
        return error.counts!;
      });
    for (const table of PROTECTED) {
      expect(seen[table]).toBe(0);
      expect(seen[`${table}:updated`]).toBe(0);
      expect(seen[`${table}:deleted`]).toBe(0);
    }
    expect(seen.insertRefused).toBe(1);
    // ...and the owner's rows are all still there, unchanged.
    const [draft] = await sql`select title, body_html from blog_posts where slug = 'draft-only'`;
    expect(draft).toEqual({ title: "Unreleased", body_html: "<p>secret plans</p>" });
    expect((await sql`select count(*)::int as n from plugin_connect_requests where id = 'req_rls_fixture'`)[0].n).toBe(1);
  });

  it("still lets the application's own role run the blog", async () => {
    await asApp(async () => {
      await appDb.insert(blogPosts).values({
        slug: "rls-published",
        title: "Published",
        category: "Guides",
        author: "RepGet team",
        status: "published",
        publishedAt: new Date("2026-10-01T00:00:00Z"),
        bodyHtml: "<p>Hello</p>",
      });
      expect((await getPost("rls-published"))?.title).toBe("Published");
      expect(await getPost("draft-only")).toBeNull(); // drafts stay drafts
      const [draft] = await appDb.select().from(blogPosts).where(eq(blogPosts.slug, "draft-only"));
      expect(draft.status).toBe("draft"); // the admin panel reads drafts
      await appDb.update(blogPosts).set({ title: "Published (edited)" }).where(eq(blogPosts.slug, "rls-published"));
      expect((await getPost("rls-published"))?.title).toBe("Published (edited)");
      await appDb.delete(blogPosts).where(eq(blogPosts.slug, "rls-published"));
      expect(await getPost("rls-published")).toBeNull();
      await appDb.insert(blogCategories).values({ name: "Case studies", slug: "case-studies" });
      expect((await listCategories()).map((c) => c.slug)).toContain("case-studies");
    });
  });

  it("still lets the application's own role run the WordPress handshake", async () => {
    const now = new Date();
    await sql`insert into organization (id, name, slug, created_at) values ('org_rls', 'RLS Studio', 'rls', ${now})`;
    await sql`insert into "user" (id, name, email, created_at, updated_at) values (${viewer.userId}, 'O', 'o@rls.example', ${now}, ${now})`;
    await sql`insert into member (id, organization_id, user_id, role, created_at) values ('m_rls', 'org_rls', ${viewer.userId}, 'owner', ${now})`;
    await sql`insert into "session" (id, token, user_id, expires_at, created_at, updated_at) values (${viewer.sessionId}, 't_rls', ${viewer.userId}, ${new Date(Date.now() + 86_400_000)}, ${now}, ${now})`;
    [{ id: siteId }] = await sql`insert into websites (organization_id, url, domain) values ('org_rls', 'https://wp.rls.example', 'wp.rls.example') returning id`;

    await asApp(async () => {
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const started = await startHandshake(
        {
          siteUrl: "https://wp.rls.example",
          returnUrl: "https://wp.rls.example/wp-admin/admin.php?page=repget",
          state: randomBytes(24).toString("base64url"),
          challenge,
          pluginVersion: "1.7.0",
          link: undefined,
        },
        null,
        "203.0.113.9",
      );
      if (!started.ok) throw new Error(started.error);
      await loadForViewer(started.id, viewer);
      const approved = await approveHandshake({ id: started.id, websiteId: siteId, ...viewer });
      if (!approved.ok) throw new Error(approved.reason);
      const code = new URL(approved.redirectTo).searchParams.get("code")!;
      const exchanged = await exchangeHandshakeCode({ request: started.id, code, verifier });
      expect(exchanged.ok).toBe(true);
      const [row] = await appDb.select().from(pluginConnectRequests).where(eq(pluginConnectRequests.id, started.id));
      expect(row.consumedAt).not.toBeNull();
      expect(await appClient`select current_user as role`).toEqual([{ role: APP_ROLE }]);
    });
  });
});
