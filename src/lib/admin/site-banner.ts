"use server";

import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { siteBanner } from "@/lib/db/schema";
import { cleanBanner, type BannerInput, type SiteBanner } from "@/lib/promo-banner/banner";
import { BANNER_KEY, readSiteBanner } from "@/lib/promo-banner/read";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Site banner: the bar above the public site's header
 * (lib/promo-banner/banner.ts). Checks admin access on the server, and a
 * change is recorded in the admin audit log.
 */

export async function getSiteBannerAdmin(): Promise<SiteBanner> {
  await requireAdmin();
  return readSiteBanner();
}

export async function saveSiteBanner(input: BannerInput): Promise<ActionResult<SiteBanner>> {
  const admin = await requireAdmin();
  const cleaned = cleanBanner(input);
  if (!cleaned.ok) return cleaned;
  const value = cleaned.value;

  const before = await readSiteBanner();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(siteBanner)
      .values({ key: BANNER_KEY, ...value, updatedBy: admin.email, updatedAt: now })
      .onConflictDoUpdate({ target: siteBanner.key, set: { ...value, updatedBy: admin.email, updatedAt: now } });
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "site.banner_saved",
        targetType: "site_banner",
        targetId: BANNER_KEY,
        summary: `${value.enabled ? "Banner on" : "Banner off"}: "${value.copy.en?.message ?? ""}"${
          value.endsAt ? `, countdown to ${value.endsAt.toISOString()}` : ", no countdown"
        }`,
        detail: {
          before: { enabled: before.enabled, tone: before.tone, endsAt: before.endsAt, copy: before.copy },
          after: value,
        },
      },
      tx,
    );
  });

  revalidatePath("/admin/banner");
  // The bar is in every public page, the prebuilt ones included.
  revalidatePath("/", "layout");
  return { ok: true, data: await readSiteBanner() };
}
