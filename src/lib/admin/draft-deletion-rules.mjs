/**
 * Which drafts may be deleted in bulk, shared by Admin -> Partner Network
 * ("Delete selected", lib/admin/review-drafts.ts) and the one-off script
 * (scripts/ops/delete-imagestudio-drafts-2026-11-24.mjs), so the two can never
 * disagree. Plain SQL and plain JavaScript: the script runs outside the app.
 *
 * A draft is kept when anything says it reached, may have reached or is about
 * to reach the customer's site, or when a network link on it concerns
 * somebody else. First reason that applies, in the order below.
 *
 * `a` is the articles row in every condition.
 */

/** @type {{ code: string, label: string, sql: string }[]} */
export const DRAFT_KEEP_RULES = [
  {
    code: "published",
    label: "It is on the website (a live address or a first-live date is recorded).",
    sql: "(a.published_url is not null or a.first_live_at is not null or a.status = 'published')",
  },
  { code: "being_written", label: "It is being written or is not a draft.", sql: "a.status <> 'draft'" },
  { code: "translation", label: "It is a translation: it goes with its original.", sql: "a.translation_of is not null" },
  {
    code: "in_flight",
    label: "It is being delivered to the website right now.",
    sql: "exists (select 1 from publication_dispatches d where d.article_id = a.id and d.status = 'in_flight')",
  },
  {
    // Only "failed" means the site provably refused it: sent, uncertain, expired, abandoned and released may all exist there.
    code: "delivered",
    label: "It was delivered to the website, or may have been (a draft in the CMS, or a delivery with no known outcome).",
    sql: "(exists (select 1 from publication_dispatches d where d.article_id = a.id and d.status <> 'failed') or exists (select 1 from publish_logs l where l.article_id = a.id and (l.status = 'published' or l.remote_id is not null or l.remote_url is not null)))",
  },
  { code: "requested", label: "Somebody pressed Publish on it and the plugin has not collected it yet.", sql: "a.publish_requested is not null" },
  {
    code: "approved",
    label: "It was approved for the customer. Reopen it on its review page first.",
    sql: "(a.review_status = 'approved' or a.approved_revision is not null)",
  },
  {
    code: "live_link",
    label: "It carries a network link that is, or may be, on the website.",
    sql: "exists (select 1 from placements p where p.article_id = a.id and p.status in ('published', 'live', 'unverified'))",
  },
  {
    code: "reserved_credits",
    label: "It carries a network link that holds another workspace's credits. Remove the link on its review page first.",
    sql: "exists (select 1 from placements p where p.article_id = a.id and p.status not in ('removed', 'cancelled'))",
  },
  { code: "translated", label: "It has translations.", sql: "exists (select 1 from articles t where t.translation_of = a.id)" },
];

/** The first reason a draft is kept, as its code; null when it may be deleted. */
export const KEEP_CODE_SQL = `(case ${DRAFT_KEEP_RULES.map((rule) => `when ${rule.sql} then '${rule.code}'`).join(" ")} else null end)`;

/** @param {string} code */
export function keepLabel(code) {
  return DRAFT_KEEP_RULES.find((rule) => rule.code === code)?.label ?? "It cannot be deleted.";
}

/**
 * A calendar topic whose article was deleted on purpose. The scheduler writes
 * only "planned" topics and a re-plan replaces only those, so it is never
 * written again; it has no date, so it holds no day of the calendar.
 */
export const DROPPED_TOPIC_STATUS = "skipped";

/** Marks one deleted article's topic, unless another article is written from it. $1 = calendar item, $2 = website, $3 = article. */
export const DROP_TOPIC_SQL = `update calendar_items ci
  set status = '${DROPPED_TOPIC_STATUS}', scheduled_for = null, updated_at = now()
  where ci.id = $1 and ci.website_id = $2
    and not exists (select 1 from articles o where o.calendar_item_id = ci.id and o.id <> $3)
  returning ci.id`;
