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
 * The text last sent can be proven, as recoverSentRevision in
 * src/lib/publishing/controls.ts does: a mix of what RepGet still holds hashes to
 * the latest settled send's own hash.
 */
const SENT_TEXT_PROVEN = `exists (
  select 1 from (
    select pd.revision_hash, pd.request_snapshot from publication_dispatches pd
    where pd.article_id = a.id and pd.status = 'sent' and not pd.late
    order by pd.claimed_at desc limit 1
  ) sent
  cross join lateral (values (a.title), (coalesce(sent.request_snapshot ->> 'title', a.title))) t(title)
  cross join lateral (values (a.slug), (case when sent.request_snapshot ? 'slug' then sent.request_snapshot ->> 'slug' else a.slug end)) s(slug)
  cross join lateral (select a.body_html as body union all select v.body_html from article_versions v where v.article_id = a.id) b
  where encode(sha256(convert_to(
    coalesce(t.title, '') || chr(31) || coalesce(s.slug, '') || chr(31) ||
    coalesce(a.meta_description, '') || chr(31) || coalesce(b.body, '') || chr(31) ||
    coalesce(a.image_url, '') || chr(31) || coalesce(a.image_alt, ''),
    'UTF8')), 'hex') = sent.revision_hash
)`;

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
        case
          when a.review_status = 'pending' and a.approved_revision is null then
            case when ${SENT_TEXT_PROVEN} then 'on_site_change_waiting_sent_text_recovered' else 'on_site_change_waiting_text_unavailable' end
          when a.review_status = 'approved' and a.review_approved_hash is distinct from ${REVISION} then 'on_site_approval_stale_stored_as_published'
          when ${RESEARCH_HELD} then 'delivered_with_held_sources'
          else 'delivered'
        end
      when a.status <> 'draft' then 'other'
      when not (${NOT_DELIVERING}) then 'being_delivered'
      when a.review_status = 'pending' then 'already_in_queue'
      when a.review_status = 'approved' then
        case when a.review_approved_hash is distinct from ${REVISION} or ${RESEARCH_HELD}
          then 'moves_approval_no_longer_stands' else 'stays_approved_ready' end
      else 'moves_never_approved'
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

/** Presses still recorded on delivered articles: switching on clears them, unsent. */
export const STALE_PRESS_QUERY = `
  select count(*)::int as articles from articles
  where publish_requested is not null and (status = 'published' or published_url is not null)`;

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
      const [stale] = await tx.unsafe(STALE_PRESS_QUERY);
      report(`${String(stale.articles).padStart(7)}  stale presses on delivered articles, cleared if switched on now`);
      const [modes] = await tx.unsafe(MODES_QUERY);
      for (const [mode, count] of Object.entries(modes)) report(`${String(count).padStart(7)}  websites on ${mode} publishing`);
      return { enabled: Boolean(control?.enabled), rows, moving: moving(rows), websitesAwaitingFirst: Number(first.websites), stalePresses: Number(stale.articles), modes };
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
