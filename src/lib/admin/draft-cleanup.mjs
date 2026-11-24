import { DROP_TOPIC_SQL, DRAFT_KEEP_RULES, KEEP_CODE_SQL } from "./draft-deletion-rules.mjs";

/**
 * The work of scripts/ops/delete-imagestudio-drafts-2026-11-24.mjs, apart from
 * its arguments and its connection, so it is tested against a real database
 * (draft-cleanup.test.ts). One website's unpublished, never-delivered drafts
 * created before a date, by the same rules as Admin -> Partner Network's
 * "Delete selected" (draft-deletion-rules.mjs).
 *
 * @typedef {(text: string, params: unknown[]) => Promise<Record<string, any>[]>} Query
 * @typedef {{ websiteId: string, before: string }} Scope `before` is an ISO day, exclusive (UTC).
 */

/** Every draft in scope, with the reason it is kept (null: it would be deleted). @param {Query} query @param {Scope} scope */
export async function surveyDrafts(query, { websiteId, before }) {
  return query(
    `select a.id, a.title, a.created_at, a.calendar_item_id, ${KEEP_CODE_SQL} as keep
     from articles a
     where a.website_id = $1 and a.status = 'draft' and a.created_at < $2::timestamp
     order by a.created_at, a.id`,
    [websiteId, before],
  );
}

/** How many are kept for each reason, in the rules' order. @param {Record<string, any>[]} rows */
export function keptCounts(rows) {
  return DRAFT_KEEP_RULES.map((rule) => ({ reason: rule.label, drafts: rows.filter((row) => row.keep === rule.code).length })).filter((row) => row.drafts > 0);
}

/** Everything the deletion removes or changes, as it is now. Cascading tables first named in the schema. */
const BACKUP_TABLES = [
  ["articles", "id"],
  ["article_versions", "article_id"],
  ["publish_logs", "article_id"],
  ["publication_dispatches", "article_id"],
  ["article_indexing", "article_id"],
  ["article_translation_attempts", "article_id"],
  ["placements", "article_id"],
];

/**
 * Deletes them, inside the caller's transaction. `backup` receives every row
 * the deletion touches and must finish BEFORE anything is deleted; if it
 * throws, the caller rolls back and nothing has changed.
 *
 * @param {Query} query one transaction's query function
 * @param {Scope & { backup: (data: Record<string, unknown>) => Promise<void>, actor: string, note: string }} options
 */
export async function deleteDrafts(query, { websiteId, before, backup, actor, note }) {
  // The app's lock order (lib/articles/deletion.ts): placements, then articles. A delivery's claim takes the article's lock.
  await query(
    `select p.id from placements p join articles a on a.id = p.article_id
     where a.website_id = $1 and a.status = 'draft' and a.created_at < $2::timestamp order by p.id for update of p`,
    [websiteId, before],
  );
  await query(
    `select a.id from articles a where a.website_id = $1 and a.status = 'draft' and a.created_at < $2::timestamp order by a.id for update`,
    [websiteId, before],
  );
  // Read again, under the locks: what became protected meanwhile is kept.
  const rows = await surveyDrafts(query, { websiteId, before });
  const doomed = rows.filter((row) => row.keep === null);
  const ids = doomed.map((row) => row.id);
  if (ids.length === 0) return { deleted: 0, topics: 0, rows };

  /** @type {Record<string, unknown>} */
  const data = {};
  for (const [table, column] of BACKUP_TABLES) {
    data[table] = (await query(`select to_jsonb(t) as row from ${table} t where t.${column} = any($1::uuid[])`, [ids])).map((r) => r.row);
  }
  const topicIds = doomed.map((row) => row.calendar_item_id).filter(Boolean);
  data.calendar_items = (await query(`select to_jsonb(t) as row from calendar_items t where t.id = any($1::uuid[])`, [topicIds])).map((r) => r.row);
  await backup(data);

  let topics = 0;
  for (const row of doomed) {
    if (!row.calendar_item_id) continue;
    topics += (await query(DROP_TOPIC_SQL, [row.calendar_item_id, websiteId, row.id])).length;
  }
  const gone = await query(`delete from articles where website_id = $1 and id = any($2::uuid[]) returning id`, [websiteId, ids]);
  if (gone.length !== ids.length) throw new Error(`Expected to delete ${ids.length} drafts, deleted ${gone.length}`);
  const [site] = await query(`select domain, organization_id from websites where id = $1`, [websiteId]);
  await query(
    `insert into admin_audit_log (actor_email, action, target_type, target_id, organization_id, summary, detail)
     values ($1, 'article.deleted', 'website', $2, $3, $4, $5::text::jsonb)`,
    [actor, websiteId, site?.organization_id ?? null, `Deleted ${ids.length} unpublished drafts of ${site?.domain ?? websiteId} - ${note}`.slice(0, 500), JSON.stringify({ before, articleIds: ids, topicsDropped: topics, reason: note })],
  );
  return { deleted: gone.length, topics, rows };
}
