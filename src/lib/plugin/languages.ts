import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";

/**
 * The site's WPML languages, as the RepGet plugin (1.9.0+) reports them in
 * X-RepGet-Languages on every check: "en,it,es", the default first. Stored
 * in websites.plugin_languages for "Also publish in" (lib/articles/
 * translation-languages.ts) - the site's language links name only the
 * languages that have a page, and Image Studio's Spanish has none yet.
 */

const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

/** The header as codes, or null when there is none or it is not that shape. At most 20. */
export function parsePluginLanguages(header: string | null | undefined): string[] | null {
  if (!header) return null;
  const codes = header
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
  if (codes.length === 0 || codes.length > 20 || !codes.every((code) => CODE.test(code))) return null;
  return [...new Set(codes)];
}

/** Stores what the plugin reported, only when it changed: one write per change, not per check. */
export async function recordPluginLanguages(websiteId: string, header: string | null | undefined): Promise<void> {
  const codes = parsePluginLanguages(header);
  if (!codes) return;
  const value = JSON.stringify(codes);
  await db
    .update(websites)
    .set({ pluginLanguages: codes })
    .where(and(eq(websites.id, websiteId), sql`${websites.pluginLanguages} is distinct from ${value}::jsonb`));
}
