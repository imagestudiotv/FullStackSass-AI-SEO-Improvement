"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { creditSettings } from "@/lib/db/schema";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { FREE_TOOL_SLUGS, isFreeToolSlug } from "@/lib/tools/free-tools";
import {
  capSettingKey,
  enabledSettingKey,
  MAX_DAILY_CAP_CENTS,
  readToolSetting,
  readToolSettings,
  toolReport,
  type ToolReportRow,
  type ToolSetting,
} from "@/lib/tools/tool-tracking";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Free tools (owner, 2026-11-27): every free tool's uses, AI cost
 * and sign-ups for a period, its on/off switch and its daily AI spend cap
 * (lib/tools/tool-tracking.ts). Every action checks admin access on the
 * server; every change is in the admin audit log.
 */

export type FreeToolPeriod = 7 | 30 | 90;

export type FreeToolsAdmin = {
  days: FreeToolPeriod;
  since: Date;
  rows: (ToolReportRow & { setting: ToolSetting })[];
};

export async function getFreeToolsAdmin(days: FreeToolPeriod): Promise<FreeToolsAdmin> {
  await requireAdmin();
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const [rows, settings] = await Promise.all([toolReport(since, now), readToolSettings()]);
  return { days, since, rows: rows.map((row) => ({ ...row, setting: settings[row.tool] })) };
}

/**
 * Rebuilds the cached tool pages, so a switch shows at once. The layouts sit
 * inside route groups ((marketing), (localized)), which a revalidatePath("/tools",
 * "layout") does not match: a local production build kept serving the cached
 * tool after it was switched off. Every tool page and hub is named by its
 * address too, in every language.
 */
function refreshToolPages() {
  revalidatePath("/admin/free-tools");
  revalidatePath("/tools", "layout");
  revalidatePath("/[locale]/tools", "layout");
  for (const locale of LOCALES) {
    revalidatePath(localePath(locale, "/tools"));
    for (const tool of FREE_TOOL_SLUGS) revalidatePath(localePath(locale, `/tools/${tool}`));
  }
}

async function upsertSetting(key: string, value: number, email: string) {
  const now = new Date();
  await db
    .insert(creditSettings)
    .values({ key, value, updatedBy: email, updatedAt: now })
    .onConflictDoUpdate({ target: creditSettings.key, set: { value, updatedBy: email, updatedAt: now } });
}

export async function setToolEnabled(tool: string, enabled: boolean): Promise<ActionResult<{ enabled: boolean }>> {
  const admin = await requireAdmin();
  if (!isFreeToolSlug(tool)) return { ok: false, error: "That is not a free tool." };
  const before = await readToolSetting(tool);
  await upsertSetting(enabledSettingKey(tool), enabled ? 1 : 0, admin.email);
  await recordAdminAction({
    actorEmail: admin.email,
    action: "free_tool.switched",
    targetType: "free_tool",
    targetId: tool,
    summary: `Free tool ${tool}: ${before.enabled ? "on" : "off"} -> ${enabled ? "on" : "off"}`,
    detail: { before: before.enabled, after: enabled },
  });
  refreshToolPages();
  return { ok: true, data: { enabled } };
}

/**
 * The tool's daily AI spend cap, in US cents. Null removes the
 * administrator's setting (the default in code applies again); 0 stops the
 * tool's server AI (its pages still answer on the device or with the template).
 */
export async function setToolDailyCap(tool: string, cents: number | null): Promise<ActionResult<{ dailyCapCents: number | null }>> {
  const admin = await requireAdmin();
  if (!isFreeToolSlug(tool)) return { ok: false, error: "That is not a free tool." };
  if (cents !== null && (!Number.isInteger(cents) || cents < 0 || cents > MAX_DAILY_CAP_CENTS)) {
    return { ok: false, error: `The cap must be whole cents from 0 to ${MAX_DAILY_CAP_CENTS} ($${MAX_DAILY_CAP_CENTS / 100}).` };
  }
  const before = await readToolSetting(tool);
  if (cents === null) {
    await db.delete(creditSettings).where(eq(creditSettings.key, capSettingKey(tool)));
  } else {
    await upsertSetting(capSettingKey(tool), cents, admin.email);
  }
  const after = await readToolSetting(tool);
  const shown = (value: number | null) => (value === null ? "no cap" : `$${(value / 100).toFixed(2)} a day`);
  await recordAdminAction({
    actorEmail: admin.email,
    action: "free_tool.cap_changed",
    targetType: "free_tool",
    targetId: tool,
    summary: `Daily AI cap for ${tool}: ${shown(before.dailyCapCents)} -> ${shown(after.dailyCapCents)}`,
    detail: { before: before.dailyCapCents, after: after.dailyCapCents },
  });
  revalidatePath("/admin/free-tools");
  return { ok: true, data: { dailyCapCents: after.dailyCapCents } };
}
