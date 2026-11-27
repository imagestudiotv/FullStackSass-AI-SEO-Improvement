import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray, like, sql } from "drizzle-orm";

import { consumeReservation, reserveAll } from "@/lib/billing/spend-quota";
import { db, isDatabaseConfigured } from "@/lib/db";
import { creditSettings, spendReservations } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { llmCostUsd } from "@/lib/usage";

import {
  FREE_TOOL_SLUGS,
  parseToolCookie,
  TOOL_ATTRIBUTION_DAYS,
  TOOL_COOKIE,
  type FreeToolSlug,
  type ToolUsePath,
} from "./free-tools";

/**
 * Usage, AI cost, sign-ups and the on/off switch for EVERY free tool
 * (owner, 2026-11-27: "how much we spend, and other useful information to
 * check over time if there is a good option to keep").
 *
 * NO NEW TABLE. Visitors without an account have no organization, so their
 * uses cannot be usage_events rows; they go where the guest ledger already
 * lives - spend_reservations, as `consumed` rows outside any limit:
 *
 *  - a use:     key "free-tool:use:<slug>", operation "free_tool.use",
 *               metadata { tool, path, locale, visitor, usage?, failed? }.
 *               `visitor` is visitorKey() - a hash, never the address - and
 *               `usage` the model call's tokens and USD cost, priced like
 *               every other call (lib/usage.ts PRICING). One key per tool, so
 *               the existing (key, counted_at) index answers "today" and
 *               "the last 90 days" directly;
 *  - a sign-up: key "free-tool:signup:<slug>", operation
 *               "free_tool.signup", subject_id = the new user's id (the
 *               ledger's unique (operation, key, subject_id) index makes a
 *               repeated hook count once).
 *
 * SETTINGS are credit_settings rows, like every admin setting:
 * "tool_enabled:<slug>" (0 = off; no row = on) and
 * "tool_daily_cap_cents:<slug>" (a tool's AI spend per UTC day, in US
 * cents; 0 = no server AI at all; no row = DEFAULT_DAILY_CAP_CENTS).
 */

export const USE_OPERATION = "free_tool.use";
export const SIGNUP_OPERATION = "free_tool.signup";

export const toolUseKey = (tool: FreeToolSlug) => `free-tool:use:${tool}`;
export const signupKey = (tool: FreeToolSlug) => `free-tool:signup:${tool}`;
export const enabledSettingKey = (tool: FreeToolSlug) => `tool_enabled:${tool}`;
export const capSettingKey = (tool: FreeToolSlug) => `tool_daily_cap_cents:${tool}`;

/**
 * The daily AI spend cap when no administrator has set one. Only the new
 * Blog Writer has one by default ($1.00 a day: about 400 openings with
 * Haiku); the older AI tools keep only their own hourly limits until an
 * administrator sets a cap in Admin -> Free tools, so nothing they do
 * changes the day this ships.
 */
export const DEFAULT_DAILY_CAP_CENTS: Partial<Record<FreeToolSlug, number>> = {
  "blog-writer": 100,
};

/** The largest cap the admin page accepts: $1,000 a day. */
export const MAX_DAILY_CAP_CENTS = 100_000;

/** Client-reported uses (on-device, template) one visitor may record per tool and day: an honest visitor never gets near it. */
export const REPORTED_USES_PER_VISITOR_PER_DAY = 100;

export type ToolSetting = {
  enabled: boolean;
  /** Null: no cap of its own. */
  dailyCapCents: number | null;
  /** False when the cap is the default in code. */
  capFromSetting: boolean;
};

export type ToolUsage = { model: string; inputTokens: number; outputTokens: number };

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Every tool's switch and cap, from one read. */
export async function readToolSettings(): Promise<Record<FreeToolSlug, ToolSetting>> {
  const rows = await db
    .select({ key: creditSettings.key, value: creditSettings.value })
    .from(creditSettings)
    .where(like(creditSettings.key, "tool\\_%"));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const out = {} as Record<FreeToolSlug, ToolSetting>;
  for (const tool of FREE_TOOL_SLUGS) {
    const enabled = values.get(enabledSettingKey(tool));
    const cap = values.get(capSettingKey(tool));
    out[tool] = {
      enabled: enabled === undefined ? true : enabled > 0,
      dailyCapCents: cap ?? DEFAULT_DAILY_CAP_CENTS[tool] ?? null,
      capFromSetting: cap !== undefined,
    };
  }
  return out;
}

export async function readToolSetting(tool: FreeToolSlug): Promise<ToolSetting> {
  return (await readToolSettings())[tool];
}

/**
 * The tools switched off, for the pages' gate (the tools layouts). A page is
 * never broken over this: no database (the build) or an error means none.
 */
export async function disabledTools(): Promise<FreeToolSlug[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const settings = await readToolSettings();
    return FREE_TOOL_SLUGS.filter((tool) => !settings[tool].enabled);
  } catch (error) {
    console.warn("[free-tools] could not read the tool switches; every tool stays on", error);
    return [];
  }
}

/** What a tool's server AI calls have cost since `since` (today, UTC, by default), in USD. */
export async function toolSpendUsd(tool: FreeToolSlug, since: Date = startOfUtcDay()): Promise<number> {
  const [row] = await db
    .select({ usd: sql<string | null>`coalesce(sum((${spendReservations.metadata}->'usage'->>'costUsd')::numeric), 0)` })
    .from(spendReservations)
    .where(and(eq(spendReservations.key, toolUseKey(tool)), gte(spendReservations.countedAt, since)));
  return Number(row?.usd ?? 0);
}

/**
 * Whether a tool may make a paid AI call now: switched on, and today's
 * recorded spend under its cap. Checked before every call; the calls already
 * in flight can pass it together, which the tool's own concurrency and daily
 * limits keep to a few cents.
 */
export async function toolServerGate(tool: FreeToolSlug): Promise<"ok" | "disabled" | "cap"> {
  const setting = await readToolSetting(tool);
  if (!setting.enabled) return "disabled";
  if (setting.dailyCapCents === null) return "ok";
  if (setting.dailyCapCents <= 0) return "cap";
  const spent = await toolSpendUsd(tool);
  return spent * 100 >= setting.dailyCapCents ? "cap" : "ok";
}

/**
 * Records one use. Never throws: a visitor's result is not lost because the
 * ledger could not be written.
 */
export async function recordToolUse(event: {
  tool: FreeToolSlug;
  path: ToolUsePath;
  visitor: string;
  locale?: Locale | null;
  usage?: ToolUsage | null;
  /** A paid call whose answer could not be used: its cost counts, the use does not. */
  failed?: boolean;
  now?: Date;
}): Promise<void> {
  const now = event.now ?? new Date();
  const usage = event.usage
    ? {
        kind: "llm",
        provider: "anthropic",
        model: event.usage.model,
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        costUsd: llmCostUsd(event.usage.model, event.usage.inputTokens, event.usage.outputTokens),
      }
    : null;
  try {
    await db.insert(spendReservations).values({
      id: randomUUID(),
      key: toolUseKey(event.tool),
      operation: USE_OPERATION,
      state: "consumed",
      limitValue: 0,
      countedAt: now,
      consumedAt: now,
      spendOutcome: usage ? "paid" : null,
      metadata: {
        tool: event.tool,
        path: event.path,
        locale: event.locale ?? null,
        visitor: event.visitor,
        ...(usage ? { usage } : {}),
        ...(event.failed ? { failed: true } : {}),
      },
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("[free-tools] could not record a use", error);
  }
}

/**
 * A use the BROWSER reports (its own AI, or the template): recorded only
 * within REPORTED_USES_PER_VISITOR_PER_DAY, so the endpoint cannot be used
 * to fill the ledger.
 */
export async function recordReportedUse(event: { tool: FreeToolSlug; path: Exclude<ToolUsePath, "server">; visitor: string; locale: Locale }): Promise<boolean> {
  try {
    const reserved = await reserveAll(
      [{ key: `free-tool:reported:${event.tool}:${event.visitor}`, limit: REPORTED_USES_PER_VISITOR_PER_DAY, window: { seconds: 86_400 } }],
      { operation: "free_tool.reported", metadata: { visitor: event.visitor } },
    );
    if (!reserved.ok) return false;
    await consumeReservation(reserved.reservations[0].id, "paid");
  } catch (error) {
    console.warn("[free-tools] could not check a reported use", error);
    return false;
  }
  await recordToolUse(event);
  return true;
}

type HookContext = {
  headers?: HeadersInit | Headers;
  request?: Request;
  getCookie?: (key: string) => string | null;
} | null;

function readHookCookie(context: HookContext): string | null {
  const direct = context?.getCookie?.(TOOL_COOKIE);
  if (direct) return direct;
  const headers = new Headers((context?.headers as HeadersInit | undefined) ?? context?.request?.headers ?? undefined);
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === TOOL_COOKIE) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Called by Better Auth's user-create hook (lib/auth.ts) for every NEW
 * account: when this browser used a free tool in the last
 * TOOL_ATTRIBUTION_DAYS days, the sign-up is counted for that tool, once.
 * Never throws.
 */
export async function captureToolSignup(user: { id: string }, context: HookContext, now: Date = new Date()): Promise<FreeToolSlug | null> {
  try {
    const cookie = parseToolCookie(readHookCookie(context));
    if (!cookie) return null;
    const age = now.getTime() - cookie.usedAt.getTime();
    // A little clock skew either way; nothing older than the window.
    if (age < -5 * 60_000 || age > TOOL_ATTRIBUTION_DAYS * 86_400_000) return null;
    await db
      .insert(spendReservations)
      .values({
        id: randomUUID(),
        key: signupKey(cookie.tool),
        operation: SIGNUP_OPERATION,
        subjectId: user.id,
        state: "consumed",
        limitValue: 0,
        countedAt: now,
        consumedAt: now,
        metadata: { tool: cookie.tool, usedAt: cookie.usedAt.toISOString() },
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    return cookie.tool;
  } catch (error) {
    console.error("[free-tools] could not record a tool sign-up", error);
    return null;
  }
}

export type ToolReportRow = {
  tool: FreeToolSlug;
  uses: Record<ToolUsePath, number>;
  totalUses: number;
  visitors: number;
  costUsd: number;
  /** Paid calls whose answer could not be used. */
  failedCalls: number;
  signups: number;
  /** Null without sign-ups. */
  costPerSignupUsd: number | null;
  /** Today's (UTC) AI spend, for the cap. */
  todayUsd: number;
};

/**
 * Per tool, from `since`: uses by path, distinct visitors, AI cost, sign-ups
 * and cost per sign-up. Two grouped reads over the ledger's (key,
 * counted_at) index.
 */
export async function toolReport(since: Date, now: Date = new Date()): Promise<ToolReportRow[]> {
  const today = startOfUtcDay(now);
  const keys = FREE_TOOL_SLUGS.map(toolUseKey);
  const uses = await db
    .select({
      key: spendReservations.key,
      path: sql<string | null>`${spendReservations.metadata}->>'path'`,
      uses: sql<number>`count(*) filter (where coalesce(${spendReservations.metadata}->>'failed', 'false') <> 'true')`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${spendReservations.metadata}->>'failed' = 'true')`.mapWith(Number),
      usd: sql<string | null>`coalesce(sum((${spendReservations.metadata}->'usage'->>'costUsd')::numeric), 0)`,
      todayUsd: sql<string | null>`coalesce(sum((${spendReservations.metadata}->'usage'->>'costUsd')::numeric) filter (where ${spendReservations.countedAt} >= ${today.toISOString()}::timestamp), 0)`,
    })
    .from(spendReservations)
    .where(and(inArray(spendReservations.key, keys), gte(spendReservations.countedAt, since)))
    .groupBy(spendReservations.key, sql`${spendReservations.metadata}->>'path'`);
  const visitors = await db
    .select({
      key: spendReservations.key,
      visitors: sql<number>`count(distinct ${spendReservations.metadata}->>'visitor')`.mapWith(Number),
    })
    .from(spendReservations)
    .where(and(inArray(spendReservations.key, keys), gte(spendReservations.countedAt, since)))
    .groupBy(spendReservations.key);
  const signups = await db
    .select({ key: spendReservations.key, n: sql<number>`count(*)`.mapWith(Number) })
    .from(spendReservations)
    .where(and(inArray(spendReservations.key, FREE_TOOL_SLUGS.map(signupKey)), gte(spendReservations.countedAt, since)))
    .groupBy(spendReservations.key);

  return FREE_TOOL_SLUGS.map((tool) => {
    const mine = uses.filter((row) => row.key === toolUseKey(tool));
    const byPath: Record<ToolUsePath, number> = { on_device: 0, server: 0, template: 0 };
    for (const row of mine) {
      const path = row.path === "on_device" || row.path === "template" ? row.path : "server";
      byPath[path] += row.uses;
    }
    const costUsd = mine.reduce((sum, row) => sum + Number(row.usd ?? 0), 0);
    const signupCount = signups.find((row) => row.key === signupKey(tool))?.n ?? 0;
    return {
      tool,
      uses: byPath,
      totalUses: byPath.on_device + byPath.server + byPath.template,
      visitors: visitors.find((row) => row.key === toolUseKey(tool))?.visitors ?? 0,
      costUsd,
      failedCalls: mine.reduce((sum, row) => sum + row.failed, 0),
      signups: signupCount,
      costPerSignupUsd: signupCount > 0 ? costUsd / signupCount : null,
      todayUsd: mine.reduce((sum, row) => sum + Number(row.todayUsd ?? 0), 0),
    };
  });
}
