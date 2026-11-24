import "server-only";

import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyWorkspaces, emailPreferences, member, session, subscriptions, user } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { INACTIVE_DAYS, type BroadcastAudience } from "./shared";

/**
 * Who a broadcast goes to. ONE definition for the count on the page, the list
 * written when it starts and the check before each send.
 *
 * SUPPRESSED, whatever the audience:
 *  - someone who turned tips and reports off (Settings, or any unsubscribe
 *    link): the one email choice RepGet has, and a broadcast is exactly what
 *    it covers. No row means they never chose, which is on.
 *  - an address nobody proved (email_verified false): sign-up is open, so it
 *    may belong to somebody who never heard of RepGet.
 * Bounces are NOT known here: RepGet receives no bounce reports. Resend keeps
 * its own suppression list and refuses those sends.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/*
  "user"."id" is written out: in a single-table select drizzle drops the table
  from a column inside sql``, and a bare "id" would be the subquery's own.

  Mirrors ENTITLED_STATUSES in lib/usage.ts.
*/
const payingSql: SQL = sql`(
  exists (
    select 1 from ${member} bm
    join ${subscriptions} bs on bs.organization_id = bm.organization_id
    where bm.user_id = "user"."id" and bs.status in ('active', 'trialing', 'past_due') and bs.plan_id is not null
  ) or exists (
    select 1 from ${member} bm
    join ${agencyWorkspaces} ba on ba.organization_id = bm.organization_id
    where bm.user_id = "user"."id"
  )
)`;

function inactiveSql(now: Date): SQL {
  // Dates leave raw SQL as ISO text: postgres-js does not serialise Date in raw templates.
  const before = new Date(now.getTime() - INACTIVE_DAYS * DAY_MS).toISOString();
  return sql`("user"."created_at" < ${before}::timestamp and not exists (
    select 1 from ${session} bx where bx.user_id = "user"."id" and bx.updated_at >= ${before}::timestamp
  ))`;
}

export function audienceSql(audience: BroadcastAudience, now: Date = new Date()): SQL {
  switch (audience) {
    case "all":
      return sql`true`;
    case "free":
      return sql`not ${payingSql}`;
    case "paid":
      return payingSql;
    case "inactive":
      return inactiveSql(now);
  }
}

const optedOutSql: SQL = sql`exists (
  select 1 from ${emailPreferences} bp where bp.user_id = "user"."id" and not bp.tips
)`;

/** May be emailed a broadcast at all. */
export const mayReceiveSql: SQL = sql`("user"."email_verified" and not ${optedOutSql})`;

export async function countRecipients(audience: BroadcastAudience, executor: Executor = db, now: Date = new Date()): Promise<number> {
  const [row] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(and(mayReceiveSql, audienceSql(audience, now)));
  return Number(row?.n ?? 0);
}

export type AudienceSummary = {
  registered: number;
  suppressed: number;
  optedOut: number;
  unverified: number;
  /** Who would receive it now, per audience. */
  recipients: Record<BroadcastAudience, number>;
};

/** The page's figures, in one query over the user table. */
export async function audienceSummary(executor: Executor = db, now: Date = new Date()): Promise<AudienceSummary> {
  const n = (condition: SQL) => sql<number>`count(*) filter (where ${condition})::int`;
  const [row] = await executor
    .select({
      registered: sql<number>`count(*)::int`,
      optedOut: n(optedOutSql),
      unverified: n(sql`not "user"."email_verified"`),
      suppressed: n(sql`not ${mayReceiveSql}`),
      all: n(mayReceiveSql),
      free: n(sql`${mayReceiveSql} and ${audienceSql("free", now)}`),
      paid: n(sql`${mayReceiveSql} and ${audienceSql("paid", now)}`),
      inactive: n(sql`${mayReceiveSql} and ${audienceSql("inactive", now)}`),
    })
    .from(user);
  const num = (value: unknown) => Number(value ?? 0);
  return {
    registered: num(row?.registered),
    suppressed: num(row?.suppressed),
    optedOut: num(row?.optedOut),
    unverified: num(row?.unverified),
    recipients: { all: num(row?.all), free: num(row?.free), paid: num(row?.paid), inactive: num(row?.inactive) },
  };
}

/** Why this person must not be emailed NOW, or their address. Read right before each send. */
export async function checkRecipient(userId: string, executor: Executor = db): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const [row] = await executor
    .select({ email: user.email, verified: user.emailVerified, tips: emailPreferences.tips })
    .from(user)
    .leftJoin(emailPreferences, eq(emailPreferences.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return { ok: false, reason: "account deleted" };
  if (row.tips === false) return { ok: false, reason: "unsubscribed" };
  if (!row.verified) return { ok: false, reason: "email not verified" };
  return { ok: true, email: row.email };
}
