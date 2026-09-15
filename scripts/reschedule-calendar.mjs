/**
 * Re-dates planned articles onto consecutive days.
 *
 * The calendar planner used to spread a month's allowance evenly —
 * `30 / count` days apart — so a 25-article plan showed one article every
 * other day with blank boxes between. That was fixed in de256bf, but items
 * planned before it keep the dates they were given, and re-running research
 * adds to the calendar rather than replacing it. A site planned more than
 * once therefore carries several interleaved runs, which is what produces
 * the gaps a customer sees.
 *
 * This only moves dates. Nothing is deleted, no article is touched, and any
 * item that already has an article keeps its date — moving that would
 * disagree with the article the customer can already read.
 *
 * Idempotent: running it twice produces the same calendar.
 *
 *   node scripts/reschedule-calendar.mjs <domain> [--apply]
 *
 * Without --apply it prints what would change and writes nothing.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const domain = process.argv[2];
const apply = process.argv.includes("--apply");

if (!domain) {
  console.error("Usage: node scripts/reschedule-calendar.mjs <domain> [--apply]");
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

/**
 * Every website matching the domain, not just the first.
 *
 * A domain is not unique: two workspaces can each connect the same site, and
 * they do. Taking `limit 1` rescheduled one workspace's calendar and left the
 * other untouched, which looks exactly like the script not working.
 */
const sites = await sql`
  select w.id, w.domain, o.name as workspace,
         coalesce(p.article_limit, 30) as article_limit
  from websites w
  join organization o on o.id = w.organization_id
  left join subscriptions s on s.organization_id = w.organization_id
  left join plans p on p.id = s.plan_id
  where w.domain = ${domain}`;

if (sites.length === 0) {
  console.error(`No website found for ${domain}`);
  await sql.end();
  process.exit(1);
}

if (sites.length > 1) {
  console.log(`${sites.length} workspaces have ${domain}.\n`);
}

let movedTotal = 0;

for (const site of sites) {
  /**
   * Items with no article yet, oldest first. Anything already written keeps
   * its date: the customer may have read it, and moving it would contradict
   * what they were shown.
   */
  const movable = await sql`
    select ci.id, ci.title
    from calendar_items ci
    left join articles a on a.calendar_item_id = ci.id
    where ci.website_id = ${site.id} and a.id is null
    order by ci.scheduled_for asc nulls last, ci.created_at asc`;

  console.log(`${site.workspace} — ${site.domain}`);

  if (movable.length === 0) {
    console.log("  nothing to reschedule\n");
    continue;
  }

  /**
   * Articles per day, derived from the items actually being scheduled — not
   * from the plan's monthly allowance.
   *
   * Using the allowance packed seven items onto two days on a 100-a-month
   * plan, because it asked for four a day regardless of there being only
   * seven. The rule is that a month's worth spreads across the month, so
   * fewer items than days means one a day; scheduleDates does exactly this,
   * and this must match it or a rescheduled calendar disagrees with a freshly
   * planned one.
   */
  const perDay = Math.max(1, Math.ceil(movable.length / 30));
  const from = new Date();

  const updates = movable.map((item, index) => {
    const date = new Date(from);
    date.setDate(date.getDate() + 1 + Math.floor(index / perDay));
    date.setHours(9 + (index % perDay) * 3, 0, 0, 0);
    return { id: item.id, title: item.title, to: date };
  });

  const days = new Set(updates.map((u) => u.to.toDateString())).size;
  console.log(
    `  ${updates.length} items, ${perDay} per day, across ${days} consecutive days ` +
      `(${updates[0].to.toISOString().slice(0, 10)} .. ${updates.at(-1).to.toISOString().slice(0, 10)})`,
  );

  if (!apply) {
    console.log("  dry run — nothing written\n");
    continue;
  }

  for (const update of updates) {
    await sql`
      update calendar_items
      set scheduled_for = ${update.to}, updated_at = now()
      where id = ${update.id}`;
  }

  movedTotal += updates.length;
  console.log(`  rescheduled ${updates.length}\n`);
}

if (apply) {
  console.log(`Done. ${movedTotal} items rescheduled.`);
} else {
  console.log("Re-run with --apply to write these dates.");
}

await sql.end();
