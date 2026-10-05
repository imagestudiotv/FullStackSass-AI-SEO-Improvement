import { createHash } from "node:crypto";
import type { BetterAuthOptions } from "better-auth";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

type Storage = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]>;
type Row = { count: number; retry_after: number };

/** Both the production driver and the PGlite test driver execute this SQL. */
function rows(result: unknown): Row[] {
  return Array.isArray(result) ? result : (result as { rows: Row[] }).rows;
}

/**
 * One PostgreSQL upsert owns the decision. ON CONFLICT locks the actual row
 * and rechecks its WHERE after waiting, including for a brand-new bucket.
 * Do not replace this with read/modify/write or an UPDATE whose predicate
 * lives only in an id subquery: both can over-admit concurrent requests.
 * Errors propagate; a database outage must never disable the limit.
 */
export function createAuthRateLimitStorage(database: Pick<typeof db, "execute"> = db): Storage {
  return {
    async consume(key, rule) {
      if (!Number.isSafeInteger(rule.max) || rule.max < 1 || !Number.isSafeInteger(rule.window) || rule.window < 1 || rule.window > 3600) {
        throw new Error("Invalid auth rate limit rule");
      }
      // Avoid storing raw client addresses or endpoint keys in the table.
      const bucket = createHash("sha256").update(key).digest("hex");
      const windowMs = rule.window * 1000;
      const now = sql`floor(extract(epoch from clock_timestamp()) * 1000)::bigint`;
      const accepted = rows(await database.execute(sql`
        insert into auth_rate_limits (key, count, last_request)
        values (${bucket}, 1, ${now})
        on conflict (key) do update set
          count = case when auth_rate_limits.last_request <= ${now} - ${windowMs}
            then 1 else auth_rate_limits.count + 1 end,
          last_request = greatest(auth_rate_limits.last_request, ${now})
        where auth_rate_limits.last_request <= ${now} - ${windowMs}
          or auth_rate_limits.count < ${rule.max}
        returning count
      `));
      if (accepted.length) {
        // Bounded expiry work on new/reset buckets. One hour exceeds every
        // configured window; locked rows are left for a later request.
        if (accepted[0].count === 1) {
          await database.execute(sql`
            delete from auth_rate_limits where key in (
              select key from auth_rate_limits
              where last_request < ${now} - 3600000
              order by last_request limit 100 for update skip locked
            )
          `);
        }
        return { allowed: true, retryAfter: null };
      }
      const denied = rows(await database.execute(sql`
        select greatest(1, ceil((last_request + ${windowMs} - ${now}) / 1000.0))::int as retry_after
        from auth_rate_limits where key = ${bucket}
      `));
      return { allowed: false, retryAfter: denied[0]?.retry_after ?? rule.window };
    },
  };
}
