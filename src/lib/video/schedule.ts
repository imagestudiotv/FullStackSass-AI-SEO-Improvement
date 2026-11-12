import "server-only";

import { and, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { videoIdeas, videoScheduleSlots, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { BEST_HOURS, MAX_AUTO_POSTS_PER_DAY, type PostingFrequency, type PublishMode } from "./formats";

/**
 * When videos are published automatically (docs/videos.md). Split out of
 * make.ts (2026-11-12) so making and scheduling have one owner each: the
 * posting frequency, slot reservations and the website's timezone live here.
 *
 * A slot is one video per website per hour (video_schedule_slots, unique on
 * website + hour). Reserving runs under a per-website advisory lock - the
 * day's and week's counts and the insert are one decision - and the unique
 * index still refuses a taken hour, in which case the next one is tried. So
 * two jobs finishing at once never take the same hour or exceed the
 * frequency. A slot stays after the video is posted (the hour was used) and
 * is released when the video is taken off the schedule, fails or moves.
 *
 * Time zone: websites have no time-zone column, only a country. The local
 * time is the country's standard offset from UTC_OFFSET (central Europe for
 * anything else), applied in one place (localOffsetHours), without daylight
 * saving: the best hours may sit an hour off in summer.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** The minute past the hour a post goes out at (uneven, like the social posts). */
const MINUTE = 7;
/** How far ahead a slot is looked for. */
const HORIZON_DAYS = 30;

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

/** The website's local offset from UTC, in hours: the one place the country is turned into a time zone. */
export function localOffsetHours(country: string | null | undefined): number {
  return UTC_OFFSET[(country ?? "").trim().toLowerCase()] ?? 1;
}

/** The local day number (days since the epoch, local time) of a UTC instant. */
const localDay = (ms: number, offset: number) => Math.floor((ms + offset * HOUR_MS) / DAY_MS);
/** The local week number, weeks starting on Monday. 1970-01-01 was a Thursday: day 4 is a Monday. */
const localWeek = (ms: number, offset: number) => Math.floor((localDay(ms, offset) - 4) / 7);
const hourOf = (ms: number) => Math.floor(ms / HOUR_MS);

/** How many automatic posts a frequency allows (client, 2026-11-12: never more than MAX_AUTO_POSTS_PER_DAY a day). */
export type FrequencyLimits = { perDay: number; perWeek: number; /** Days kept free between two posts (3 a week: every other day). */ gapDays: number };

export function frequencyLimits(frequency: PostingFrequency | null): FrequencyLimits {
  const limits: Record<PostingFrequency | "legacy", FrequencyLimits> = {
    "3_week": { perDay: 1, perWeek: 3, gapDays: 1 },
    "5_week": { perDay: 1, perWeek: 5, gapDays: 0 },
    "1_day": { perDay: 1, perWeek: 7, gapDays: 0 },
    "2_day": { perDay: 2, perWeek: 14, gapDays: 0 },
    // Before frequencies (null): each made video at the next free best hour - at most one per best hour.
    legacy: { perDay: BEST_HOURS.length, perWeek: BEST_HOURS.length * 7, gapDays: 0 },
  };
  const chosen = limits[frequency ?? "legacy"];
  return { ...chosen, perDay: Math.min(chosen.perDay, MAX_AUTO_POSTS_PER_DAY) };
}

/** The best hours from `now` on, as publish times (minute MINUTE), at least 30 minutes away. */
function bestTimes(now: Date, offset: number): number[] {
  const earliest = now.getTime() + 30 * 60_000;
  const out: number[] = [];
  for (let day = 0; day <= HORIZON_DAYS; day += 1) {
    for (const hour of BEST_HOURS) {
      const at = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day, hour - offset, MINUTE);
      if (at >= earliest) out.push(at);
    }
  }
  return out.sort((a, b) => a - b);
}

/** What is already on the website's calendar: reserved slots and scheduled/posted videos, apart from this idea. */
async function calendar(websiteId: string, exceptIdeaId: string | null, since: Date, executor: Executor): Promise<number[]> {
  const slots = await executor
    .select({ at: videoScheduleSlots.at, ideaId: videoScheduleSlots.ideaId })
    .from(videoScheduleSlots)
    .where(and(eq(videoScheduleSlots.websiteId, websiteId), gte(videoScheduleSlots.at, since)));
  const ideas = await executor
    .select({ id: videoIdeas.id, at: videoIdeas.scheduledFor })
    .from(videoIdeas)
    .where(
      and(
        eq(videoIdeas.websiteId, websiteId),
        inArray(videoIdeas.status, ["scheduled", "posting", "posted"]),
        isNotNull(videoIdeas.scheduledFor),
        gte(videoIdeas.scheduledFor, since),
        ...(exceptIdeaId ? [ne(videoIdeas.id, exceptIdeaId)] : []),
      ),
    );
  const hours = new Set<number>();
  for (const slot of slots) if (slot.ideaId !== exceptIdeaId) hours.add(hourOf(slot.at.getTime()));
  for (const idea of ideas) if (idea.at) hours.add(hourOf(idea.at.getTime()));
  return [...hours];
}

function fits(at: number, busyHours: number[], offset: number, limits: FrequencyLimits | null): boolean {
  if (busyHours.includes(hourOf(at))) return false;
  if (!limits) return true;
  const day = localDay(at, offset);
  const week = localWeek(at, offset);
  const times = busyHours.map((hour) => hour * HOUR_MS);
  if (times.filter((time) => localDay(time, offset) === day).length >= limits.perDay) return false;
  if (times.filter((time) => localWeek(time, offset) === week).length >= limits.perWeek) return false;
  if (limits.gapDays > 0 && times.some((time) => localDay(time, offset) !== day && Math.abs(localDay(time, offset) - day) <= limits.gapDays)) return false;
  return true;
}

async function offsetFor(websiteId: string, executor: Executor): Promise<number> {
  const [site] = await executor.select({ country: websites.country }).from(websites).where(eq(websites.id, websiteId));
  return localOffsetHours(site?.country);
}

/**
 * Reserves the first best time that fits (free hour, and the frequency's
 * limits when given) for an idea; its earlier slot, if any, is released.
 * null when nothing fits within HORIZON_DAYS.
 */
async function reserve(
  websiteId: string,
  ideaId: string,
  now: Date,
  limits: FrequencyLimits | null,
  executor: Executor,
): Promise<Date | null> {
  return executor.transaction(async (tx) => {
    // One reservation per website at a time: the counts below and the insert are one decision.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`video-slots:${websiteId}`}))`);
    await tx.delete(videoScheduleSlots).where(eq(videoScheduleSlots.ideaId, ideaId));
    const offset = await offsetFor(websiteId, tx);
    const busy = await calendar(websiteId, ideaId, new Date(now.getTime() - 8 * DAY_MS), tx);
    for (const at of bestTimes(now, offset)) {
      if (!fits(at, busy, offset, limits)) continue;
      const inserted = await tx
        .insert(videoScheduleSlots)
        .values({ websiteId, ideaId, at: new Date(hourOf(at) * HOUR_MS) })
        .onConflictDoNothing()
        .returning({ id: videoScheduleSlots.id });
      if (inserted.length > 0) return new Date(at);
      // Taken meanwhile by a writer outside the lock: try the next one.
      busy.push(hourOf(at));
    }
    return null;
  });
}

/**
 * The next of the best hours (BEST_HOURS, the website's local time) with no
 * other video of the website on it, at least 30 minutes from now - "Publish
 * at the best time". With an idea it is reserved for it (the publish job's
 * "later" and the customer's choice); without one it is only looked up.
 */
export async function nextPublishTime(websiteId: string, now: Date = new Date(), ideaId?: string, executor: Executor = db): Promise<Date> {
  if (ideaId) {
    const at = await reserve(websiteId, ideaId, now, null, executor);
    if (at) return at;
  } else {
    const offset = await offsetFor(websiteId, executor);
    const busy = await calendar(websiteId, null, new Date(now.getTime() - DAY_MS), executor);
    const found = bestTimes(now, offset).find((at) => fits(at, busy, offset, null));
    if (found) return new Date(found);
  }
  return new Date(now.getTime() + 30 * 60_000);
}

/**
 * A time the customer chose (Publish now, or a date): its hour is taken for
 * the idea when free, so automatic posts keep away from it. Never refused -
 * the customer's choice wins over the calendar.
 */
export async function claimScheduleSlot(websiteId: string, ideaId: string, at: Date, executor: Executor = db): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`video-slots:${websiteId}`}))`);
    await tx.delete(videoScheduleSlots).where(eq(videoScheduleSlots.ideaId, ideaId));
    await tx
      .insert(videoScheduleSlots)
      .values({ websiteId, ideaId, at: new Date(hourOf(at.getTime()) * HOUR_MS) })
      .onConflictDoNothing();
  });
}

/** Gives an idea's slot back: taken off the schedule, failed, or moved. */
export async function releaseScheduleSlot(ideaId: string, executor: Executor = db): Promise<void> {
  await executor.delete(videoScheduleSlots).where(eq(videoScheduleSlots.ideaId, ideaId));
}

/* ----------------------------------------------------------------- review */

type ReviewFields = { reviewStatus: string; reviewedHash: string | null };

/**
 * TODO(viral-integration): replace with Worker A's
 * `reviewBlocksAutoPublish` from ./review (same signature). Until then: an
 * idea whose review is required and not given holds automatic publishing.
 * A's version also re-checks an approval against the content hash.
 */
function reviewBlocksAutoPublishShim(idea: ReviewFields): boolean {
  return idea.reviewStatus === "required";
}

export function reviewBlocksAutoPublish(idea: ReviewFields): boolean {
  return reviewBlocksAutoPublishShim(idea);
}

/**
 * When a made video is published automatically (lib/video/make.ts
 * finishMaking): null when the website does not publish automatically
 * (manual: Review before publishing; draft: kept in Your videos), or when a
 * person must review it first (it stays ready); otherwise the next best
 * time within the posting frequency, reserved for it. Automatic posting
 * never makes or charges a video: it only places the ones already made.
 */
export async function autoPublishTime(
  idea: { id: string; websiteId: string } & ReviewFields,
  settings: { publishMode: PublishMode; frequency: PostingFrequency | null },
  now: Date = new Date(),
  executor: Executor = db,
): Promise<Date | null> {
  if (settings.publishMode !== "auto") return null;
  if (reviewBlocksAutoPublish(idea)) return null;
  return reserve(idea.websiteId, idea.id, now, frequencyLimits(settings.frequency), executor);
}
