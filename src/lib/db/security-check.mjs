/**
 * Database access-control inspection, shared by the CI test
 * (src/lib/db/rls.postgres.test.ts, on a fresh replay of every migration) and
 * the read-only command for a live database (scripts/check-db-security.mjs).
 *
 * Every table in "public" is server-side only (see src/lib/db/table.ts):
 *  - Row Level Security must be enabled;
 *  - Supabase's API roles (`anon`, `authenticated`) and PUBLIC must hold no
 *    privilege on any table, view or sequence, and must not be able to
 *    execute the application's own functions;
 *  - no policy may admit those roles;
 *  - the default privileges of the role that runs migrations must not hand
 *    new objects to them.
 * Extension objects (pgvector lives in "public" on Supabase) are excluded.
 *
 * Output is object names, privilege names and counts only - never row data.
 *
 * To make a table deliberately public, add it to ALLOWED_PUBLIC below with
 * the reason, in the same change that adds its policy and grants. Nothing is
 * public today.
 */

/** @type {Record<string, string>} table name -> why anonymous access is intended */
export const ALLOWED_PUBLIC = {};

export const API_ROLES = ["anon", "authenticated"];

const TABLE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];

/**
 * @param {any} sql a `postgres` client, or a transaction from one
 * @param {{ schema?: string }} [options]
 * @returns {Promise<{ problems: string[], summary: Record<string, unknown> }>}
 */
export async function inspectDatabaseSecurity(sql, options = {}) {
  const schema = options.schema ?? "public";
  const problems = [];

  const presentRoles = (
    await sql`select rolname from pg_roles where rolname = any(${API_ROLES})`
  ).map((r) => r.rolname);
  // PUBLIC always exists; a role that does not exist cannot be granted anything.
  const grantees = [...presentRoles, "public"];

  const relations = await sql`
    select c.oid::int as oid, c.relname as name, c.relkind as kind,
           c.relrowsecurity as rls,
           coalesce((select bool_or(o = 'security_invoker=true' or o = 'security_invoker=on')
                     from unnest(c.reloptions) o), false) as invoker
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema}
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
      )
    order by c.relname`;

  for (const rel of relations) {
    const allowed = Object.prototype.hasOwnProperty.call(ALLOWED_PUBLIC, rel.name);
    if ((rel.kind === "r" || rel.kind === "p") && !rel.rls) {
      problems.push(`table ${rel.name}: row level security is disabled`);
    }
    if (rel.kind === "v" && !rel.invoker && !allowed) {
      problems.push(`view ${rel.name}: not security_invoker (runs with its owner's rights)`);
    }
  }

  // One query per object type: has_*_privilege also counts privileges a role
  // gets through PUBLIC or through membership in another role.
  const relationPrivileges = await sql`
    select c.relname as name, c.relkind as kind, g.grantee,
           array_remove(array[
             ${sql.unsafe(TABLE_PRIVILEGES.map((p) => `case when c.relkind <> 'S' and has_table_privilege(g.grantee, c.oid, '${p}') then '${p}' end`).join(", "))},
             case when c.relkind = 'S' and has_sequence_privilege(g.grantee, c.oid, 'USAGE') then 'USAGE' end,
             case when c.relkind = 'S' and has_sequence_privilege(g.grantee, c.oid, 'SELECT') then 'SELECT' end,
             case when c.relkind = 'S' and has_sequence_privilege(g.grantee, c.oid, 'UPDATE') then 'UPDATE' end
           ], null) as held
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(${grantees}::text[]) as g(grantee)
    where n.nspname = ${schema}
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
      )
    order by c.relname, g.grantee`;
  for (const row of relationPrivileges) {
    if (Object.prototype.hasOwnProperty.call(ALLOWED_PUBLIC, row.name)) continue;
    if (row.held.length) {
      problems.push(`${kindName(row.kind)} ${row.name}: ${row.grantee} holds ${row.held.join(", ")}`);
    }
  }

  const functions = await sql`
    select p.oid::regprocedure::text as signature,
           array(select g from unnest(${grantees}::text[]) g
                 where has_function_privilege(g, p.oid, 'EXECUTE')) as executable_by
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = ${schema}
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
    order by 1`;
  for (const fn of functions) {
    for (const grantee of fn.executable_by) {
      problems.push(`function ${fn.signature}: ${grantee} can execute it`);
    }
  }

  const policies = await sql`
    select tablename, policyname, roles::text[] as roles, permissive
    from pg_policies where schemaname = ${schema}`;
  for (const policy of policies) {
    if (Object.prototype.hasOwnProperty.call(ALLOWED_PUBLIC, policy.tablename)) continue;
    const roles = (policy.roles ?? []).map((r) => String(r).toLowerCase());
    const admits = roles.filter((r) => r === "public" || API_ROLES.includes(r));
    if (admits.length) {
      problems.push(`policy ${policy.policyname} on ${policy.tablename}: applies to ${admits.join(", ")}`);
    }
  }

  // Default privileges of the role this connection runs as (the one that
  // runs migrations): new objects must not be handed to the API roles.
  const defaults = await sql`
    select d.defaclobjtype as objtype, d.defaclacl::text as acl
    from pg_default_acl d
    left join pg_namespace n on n.oid = d.defaclnamespace
    where d.defaclrole = (select oid from pg_roles where rolname = current_user)
      and (n.nspname = ${schema} or d.defaclnamespace = 0)`;
  for (const entry of defaults) {
    for (const role of presentRoles) {
      if (new RegExp(`[{,]${role}=`).test(entry.acl)) {
        problems.push(`default privileges (${defaultKind(entry.objtype)}) of ${"current role"}: grant to ${role}`);
      }
    }
  }

  return {
    problems,
    summary: {
      apiRolesPresent: presentRoles,
      tables: relations.filter((r) => r.kind === "r" || r.kind === "p").length,
      tablesWithoutRls: relations.filter((r) => (r.kind === "r" || r.kind === "p") && !r.rls).length,
      views: relations.filter((r) => r.kind === "v" || r.kind === "m").length,
      sequences: relations.filter((r) => r.kind === "S").length,
      functions: functions.length,
      policies: policies.length,
      allowedPublic: Object.keys(ALLOWED_PUBLIC),
    },
  };
}

function kindName(kind) {
  return { r: "table", p: "table", v: "view", m: "materialized view", f: "foreign table", S: "sequence" }[kind] ?? kind;
}

function defaultKind(type) {
  return { r: "tables", S: "sequences", f: "functions", T: "types", n: "schemas" }[type] ?? type;
}
