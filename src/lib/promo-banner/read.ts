import "server-only";

import { eq } from "drizzle-orm";

import { db, isDatabaseConfigured } from "@/lib/db";
import { siteBanner } from "@/lib/db/schema";
import { EMPTY_BANNER, isBannerTone, liveBanner, type LiveBanner, type SiteBanner } from "@/lib/promo-banner/banner";

export const BANNER_KEY = "top";

/** True for Postgres's "relation does not exist", however the driver wraps it. */
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "42P01";
}

/** The saved banner, or the empty one when nothing is saved yet (or migration 0089 is not applied). */
export async function readSiteBanner(): Promise<SiteBanner> {
  try {
    const [row] = await db.select().from(siteBanner).where(eq(siteBanner.key, BANNER_KEY)).limit(1);
    if (!row) return EMPTY_BANNER;
    return {
      enabled: row.enabled,
      copy: row.copy ?? {},
      endsAt: row.endsAt,
      tone: isBannerTone(row.tone) ? row.tone : EMPTY_BANNER.tone,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn("[site-banner] the site_banner table does not exist yet (migration 0089): no banner");
    return EMPTY_BANNER;
  }
}

/**
 * The bar for the public pages, or null. Read by the (marketing) layout on
 * every public page, cached ones included (they are rebuilt when an
 * administrator saves; lib/admin/site-banner.ts). A promotion is never worth
 * a broken page: no database at build time, or a database error, means no bar.
 */
export async function readLiveBanner(): Promise<LiveBanner | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    return liveBanner(await readSiteBanner());
  } catch (error) {
    console.warn("[site-banner] could not read the banner; showing none", error);
    return null;
  }
}
