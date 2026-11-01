import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { spendCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { CHAT_FREE_PER_DAY, startOfUtcDay } from "./config";

/**
 * The workspace's messages: CHAT_FREE_PER_DAY free each UTC day (client,
 * 2026-10-31: per workspace, not per website), then one `chat_message` price
 * each (Admin -> Credits).
 */

/** Free messages the workspace has used today. */
export async function freeUsedToday(organizationId: string, now: Date = new Date(), tx: Executor = db): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.organizationId, organizationId),
        eq(chatMessages.role, "user"),
        eq(chatMessages.free, true),
        gte(chatMessages.createdAt, startOfUtcDay(now)),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function freeLeftToday(organizationId: string, now: Date = new Date()): Promise<number> {
  return Math.max(0, CHAT_FREE_PER_DAY - (await freeUsedToday(organizationId, now)));
}

export type Allowance =
  | { ok: true; free: true; spendKey: null }
  | { ok: true; free: false; spendKey: string | null }
  | { ok: false; price: number; available: number };

/**
 * Takes one message from the day's free ones, or charges it. Inside the
 * transaction that stores the message: a per-workspace lock makes two
 * messages sent at once count one after the other, so the fifth free message
 * cannot be used twice.
 */
export async function takeAllowance(
  tx: Executor,
  input: { organizationId: string; websiteId: string; key: string },
  now: Date = new Date(),
): Promise<Allowance> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`chat:${input.organizationId}`}))`);
  if ((await freeUsedToday(input.organizationId, now, tx)) < CHAT_FREE_PER_DAY) return { ok: true, free: true, spendKey: null };
  const spent = await spendCredits(tx, { organizationId: input.organizationId, action: "chat_message", key: input.key, websiteId: input.websiteId }, now);
  if (!spent.ok) return { ok: false, price: spent.price, available: spent.available };
  return { ok: true, free: false, spendKey: spent.spendId ? input.key : null };
}
