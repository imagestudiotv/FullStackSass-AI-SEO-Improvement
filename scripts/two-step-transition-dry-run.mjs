/**
 * What switching the two-step article flow on would do, counted and changing
 * nothing (docs/two-step-articles.md, "Transition"). Read-only: the database
 * enforces it, and there is no apply mode. The switch itself is the operator's
 * (Admin > Network > Operations), and activateTwoStep in
 * src/lib/publishing/controls.ts is what moves the articles; a test keeps these
 * counts and that function in step.
 *
 * Never loads .env.local. The database is named on purpose, every time:
 *
 *   TWO_STEP_DATABASE_URL=postgres://... node scripts/two-step-transition-dry-run.mjs
 *
 * Prints counts only: no titles, text or customer names.
 */
import { pathToFileURL } from "node:url";
import postgres from "postgres";

/** The same hash as reviewHashSql in src/lib/articles/review.ts. */
const REVISION = `encode(sha256(convert_to(
  coalesce(a.title, '') || chr(31) || coalesce(a.slug, '') || chr(31) ||
  coalesce(a.meta_description, '') || chr(31) || coalesce(a.body_html, '') || chr(31) ||
  coalesce(a.image_url, '') || chr(31) || coalesce(a.image_alt, ''),
  'UTF8')), 'hex')`;

const NOT_DELIVERING = `not exists (select 1 from publication_dispatches pd where pd.article_id = a.id and pd.status = 'in_flight')`;
const RESEARCH_HELD = `(a.research_review_required and a.research_approved_hash is distinct from ${REVISION})`;

/**
 * One row per class, each article in exactly one. "moves" says whether the
 * switch hands it to the team; `current` is the article's state before it.
 */
export const TRANSITION_QUERY = `
  with sorted as (
    select case
      when a.status in ('queued', 'generating') then 'being_written'
      when a.status = 'failed' then 'failed'
      when a.status = 'published' or a.published_url is not null then
        case when ${RESEARCH_HELD} then 'delivered_with_held_sources' else 'delivered' end
      when a.status <> 'draft' then 'other'
      when not (${NOT_DELIVERING}) then 'being_delivered'
      when a.review_status = 'pending' then 'already_in_queue'
      when a.review_status = 'approved' then
        case when a.review_approved_hash is distinct from ${REVISION} or ${RESEARCH_HELD}
          then 'moves_approval_no_longer_stands' else 'stays_approved_ready' end
      when ${RESEARCH_HELD} then 'moves_waiting_for_customer_sources'
      when a.publish_requested is not null then 'stays_customer_press_waiting'
      when w.auto_publish then 'moves_automatic_publishing'
      else 'stays_manual_draft_customer_reads'
    end as class
    from articles a
    join websites w on w.id = a.website_id
  )
  select class, count(*)::int as articles from sorted group by class order by class`;

/**
 * Websites whose first article would have gone out by itself, and now waits for
 * the customer's press or their automatic mode.
 */
export const FIRST_ARTICLE_QUERY = `
  select count(*)::int as websites from websites w
  where w.first_article_sent_at is null
    and exists (select 1 from articles a where a.website_id = w.id)`;

/**
 * Websites by publishing mode. Automatic websites keep publishing approved
 * articles by themselves. New websites got automatic publishing as a default
 * until the flow, so this cannot say which customers chose it.
 */
export const MODES_QUERY = `
  select
    count(*) filter (where not auto_publish)::int as manual,
    count(*) filter (where auto_publish and publish_as = 'draft')::int as automatic_drafts,
    count(*) filter (where auto_publish and publish_as <> 'draft')::int as automatic_live
  from websites`;

export function moving(rows) {
  return rows.filter((row) => row.class.startsWith("moves_")).reduce((sum, row) => sum + Number(row.articles), 0);
}

export async function dryRun(url, report = (line) => console.log(line)) {
  if (!url) throw new Error("Set TWO_STEP_DATABASE_URL explicitly; no database has been contacted.");
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
  try {
    return await client.begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local statement_timeout = '60s'`;
      const [control] = await tx`select enabled from platform_controls where key = 'two_step_articles'`;
      const rows = await tx.unsafe(TRANSITION_QUERY);
      const [first] = await tx.unsafe(FIRST_ARTICLE_QUERY);
      report(`two_step_articles is ${control?.enabled ? "ON" : "OFF"}`);
      for (const row of rows) report(`${String(row.articles).padStart(7)}  ${row.class}`);
      report(`${String(moving(rows)).padStart(7)}  would move to the team's queue if switched on now`);
      report(`${String(first.websites).padStart(7)}  websites with no first article sent yet`);
      const [modes] = await tx.unsafe(MODES_QUERY);
      for (const [mode, count] of Object.entries(modes)) report(`${String(count).padStart(7)}  websites on ${mode} publishing`);
      return { enabled: Boolean(control?.enabled), rows, moving: moving(rows), websitesAwaitingFirst: Number(first.websites), modes };
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dryRun(process.env.TWO_STEP_DATABASE_URL).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
