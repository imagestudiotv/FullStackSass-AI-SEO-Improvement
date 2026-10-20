import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogAutopilot } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * The blog autopilot (client, 2026-10-16): RepGet's own blog written for it,
 * one article a day, "following exact style of writing we have, and options
 * we use", in every language, "separately from our platform".
 *
 * The client's four choices:
 *  1. One English article a day, and the same article in each other language
 *     as a linked translation (so Google sees one article in five languages).
 *  2. Everything is saved as a DRAFT; an administrator reads and publishes it.
 *     Nothing goes live by itself. Translations keep the "reviewed by a native
 *     speaker" tick before they can be published (lib/admin/blog.ts).
 *  3. Topics: the client's own list first, in its order; then topics RepGet
 *     finds itself from search data, skipping what the blog already covers.
 *  4. Pictures are made for every article.
 *
 * This file is the settings and the topic list's rules; the writing, the
 * pictures, the translations and the daily run live beside it.
 */

/** The single settings row's key. */
export const AUTOPILOT_KEY = "blog";

/** The languages articles can also be written in: every blog language but English. */
export const AUTOPILOT_LANGUAGES = LOCALES.filter((locale): locale is Exclude<Locale, typeof DEFAULT_LOCALE> => locale !== DEFAULT_LOCALE);

export type AutopilotLanguage = (typeof AUTOPILOT_LANGUAGES)[number];

export type AutopilotSettings = {
  enabled: boolean;
  /** The UTC hour the day's (first) article is written. */
  runHour: number;
  /** Articles a day: the first at runHour, then one an hour (client, 2026-10-20: "not just one daily"). */
  articlesPerDay: number;
  /** Also written in these, besides English. */
  languages: AutopilotLanguage[];
  updatedBy: string | null;
  updatedAt: Date | null;
};

/** The most articles a day: one an hour, one at a time, each about $0.90 in five languages. */
export const AUTOPILOT_MAX_PER_DAY = 5;

/** Until an administrator saves the settings: off, one a day at 06:00 UTC (08:00 in Rome in summer), every language. */
export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  runHour: 6,
  articlesPerDay: 1,
  languages: [...AUTOPILOT_LANGUAGES],
  updatedBy: null,
  updatedAt: null,
};

export const TOPIC_LIMITS = {
  /** A topic is a line saying what the article is about. */
  topicMin: 3,
  topic: 200,
  keyword: 150,
  notes: 1000,
  /** Topics added in one paste. */
  bulk: 100,
} as const;

export const TOPIC_STATUSES = ["queued", "writing", "written", "failed"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export function isAutopilotLanguage(value: unknown): value is AutopilotLanguage {
  return typeof value === "string" && (AUTOPILOT_LANGUAGES as readonly string[]).includes(value);
}

/** The stored languages, cleaned: known ones only, each once, in the blog's order. */
export function autopilotLanguages(value: unknown): AutopilotLanguage[] {
  const wanted = new Set(Array.isArray(value) ? value.filter(isAutopilotLanguage) : []);
  return AUTOPILOT_LANGUAGES.filter((language) => wanted.has(language));
}

/** The settings, or the defaults before anyone saved them. */
export async function readAutopilotSettings(executor: Executor = db): Promise<AutopilotSettings> {
  const [row] = await executor.select().from(blogAutopilot).where(eq(blogAutopilot.key, AUTOPILOT_KEY)).limit(1);
  if (!row) return DEFAULT_AUTOPILOT;
  return {
    enabled: row.enabled,
    runHour: Math.min(Math.max(Math.trunc(row.runHour), 0), 23),
    articlesPerDay: Math.min(Math.max(Math.trunc(row.articlesPerDay), 1), AUTOPILOT_MAX_PER_DAY),
    languages: autopilotLanguages(row.languages),
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

/** "06:00 UTC" - the hour as the settings page shows it. */
export function utcHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00 UTC`;
}

/**
 * The same hour in Rome, where the client is, for the label: "08:00 in Rome".
 * Worked out for `on` (default now), so it follows summer and winter time.
 */
export function romeHourLabel(hour: number, on: Date = new Date()): string {
  const at = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), hour));
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return `${local} in Rome`;
}
