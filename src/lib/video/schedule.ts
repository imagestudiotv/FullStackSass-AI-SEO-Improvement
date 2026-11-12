import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { videoIdeas, websites } from "@/lib/db/schema";

import { BEST_HOURS } from "./formats";

/**
 * When videos are published automatically (docs/videos.md). Split out of
 * make.ts (2026-11-12) so making and scheduling have one owner each: the
 * posting frequency, slot reservations and the website's timezone live here.
 */

/**
 * Hours from UTC for the countries RepGet's customers are in, for the best
 * posting hours; anything else is taken as central Europe (the client's).
 */
const UTC_OFFSET: Record<string, number> = {
  "united states": -5,
  usa: -5,
  us: -5,
  canada: -5,
  "united kingdom": 0,
  uk: 0,
  gb: 0,
  ireland: 0,
  portugal: 0,
  australia: 10,
  india: 5,
  brazil: -3,
  mexico: -6,
};

/**
 * The next of the best hours (BEST_HOURS, the website's local time) that has
 * no other video of the website on it, at least 30 minutes from now.
 */
export async function nextPublishTime(websiteId: string, now: Date = new Date()): Promise<Date> {
  const [site] = await db.select({ country: websites.country }).from(websites).where(eq(websites.id, websiteId));
  const offset = UTC_OFFSET[(site?.country ?? "").trim().toLowerCase()] ?? 1;
  const taken = await db
    .select({ at: videoIdeas.scheduledFor })
    .from(videoIdeas)
    .where(and(eq(videoIdeas.websiteId, websiteId), inArray(videoIdeas.status, ["scheduled", "posting"])));
  const busy = new Set(taken.flatMap((row) => (row.at ? [Math.floor(row.at.getTime() / 3_600_000)] : [])));
  const earliest = now.getTime() + 30 * 60_000;
  for (let day = 0; day < 30; day += 1) {
    for (const hour of BEST_HOURS) {
      const at = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day, hour - offset, 7);
      if (at >= earliest && !busy.has(Math.floor(at / 3_600_000))) return new Date(at);
    }
  }
  return new Date(earliest);
}
