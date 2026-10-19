import "server-only";

import { createAuthRateLimitStorage } from "@/lib/auth/rate-limit-store";
import { consumeReservation, reserveAll } from "@/lib/billing/spend-quota";
import type { Database } from "@/lib/db/types";

import type { RateLimiter } from "../application/ports/directory";

/**
 * The app's two limiters, behind the partner program's RateLimiter port.
 *
 * quota - the spend-quota ledger: all-or-nothing over several rules, any
 *   window length, a row per admitted attempt (consumed at once, so the
 *   sweep never hands the slot back). For applications.
 * burst - Better Auth's upsert-per-bucket store: windows up to an hour, one
 *   row per bucket. For public tracking, where a row per visit would be noise.
 */

export function quotaRateLimiter(): RateLimiter {
  return {
    async admit(rules, operation) {
      const outcome = await reserveAll(
        rules.map((rule) => ({ key: rule.key, limit: rule.limit, window: { seconds: rule.windowSeconds } })),
        { operation },
      );
      if (!outcome.ok) return false;
      for (const reservation of outcome.reservations) await consumeReservation(reservation.id, "paid");
      return true;
    },
  };
}

export function burstRateLimiter(database?: Pick<Database, "execute">): RateLimiter {
  const storage = createAuthRateLimitStorage(database as never);
  return {
    async admit(rules) {
      for (const rule of rules) {
        const result = await storage.consume(`partners:${rule.key}`, {
          window: Math.min(Math.max(rule.windowSeconds, 1), 3600),
          max: rule.limit,
        });
        if (!result.allowed) return false;
      }
      return true;
    },
  };
}
