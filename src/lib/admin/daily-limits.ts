"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { creditSettings, websites } from "@/lib/db/schema";
import { dailyCapFor, dailyLimitKey, MAX_DAILY_LIMIT, NO_DAILY_LIMIT } from "@/lib/publishing/daily-cap";

/**
 * Sets how many articles the scheduler may start for one website per UTC day
 * (lib/publishing/daily-cap.ts), without a deploy. `perDay` null removes the
 * limit: the website is written at its monthly allowance's pace again.
 *
 * Takes effect from the next scheduled run (06:00 and 14:00 UTC); articles
 * already started today count towards a new limit.
 */
export async function setArticlesPerDay(
  websiteId: string,
  perDay: number | null,
): Promise<{ ok: true; data: { perDay: number | null } } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const value = perDay === null ? NO_DAILY_LIMIT : Number(perDay);
  if (perDay !== null && (!Number.isInteger(value) || value < 1 || value > MAX_DAILY_LIMIT)) {
    return { ok: false, error: `Articles per day must be a whole number from 1 to ${MAX_DAILY_LIMIT}.` };
  }
  const [site] = await db
    .select({ id: websites.id, domain: websites.domain, organizationId: websites.organizationId })
    .from(websites)
    .where(eq(websites.id, websiteId));
  if (!site) return { ok: false, error: "This website no longer exists." };

  const before = await dailyCapFor(site.id);
  const key = dailyLimitKey(site.id);
  await db
    .insert(creditSettings)
    .values({ key, value, updatedBy: admin.email, updatedAt: new Date() })
    .onConflictDoUpdate({ target: creditSettings.key, set: { value, updatedBy: admin.email, updatedAt: new Date() } });
  const after = value > 0 ? value : null;
  const shown = (limit: number | null) => (limit === null ? "no limit" : `${limit} a day`);
  await recordAdminAction({
    actorEmail: admin.email,
    action: "website.articles_per_day_changed",
    targetType: "website",
    targetId: site.id,
    organizationId: site.organizationId,
    summary: `Articles per day for ${site.domain}: ${shown(before)} -> ${shown(after)}`,
    detail: { before, after },
  });
  revalidatePath("/admin/websites");
  return { ok: true, data: { perDay: after } };
}
