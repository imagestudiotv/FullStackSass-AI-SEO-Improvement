import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { brandVoice, websites } from "@/lib/db/schema";
import { normalizeLanguage, SUPPORTED_LANGUAGES } from "@/lib/websites/languages";

import { TONE_PRESETS, type TonePreset } from "../formats";
import { MAX_PRIORITY_TOPICS, readVideoSettings } from "../settings";

/**
 * The Videos page's "Audience & topics" (client, 2026-11-12: "reuse the
 * existing business profile and Brand Voice settings ... changes should
 * update the same underlying profile"). Audience, language and market are
 * the website's profile (websites), tone and words to avoid its Brand Voice
 * (brand_voice); only the priority topics and the tone preset are video
 * settings. Saved through the profile's and Brand Voice's own actions
 * (saveVideoProfileAction in lib/video/actions.ts), so their rules apply.
 *
 * The reader is not a server action: the page's server component calls it
 * after its own access check.
 */

export type VideoProfile = {
  targetAudience: string | null;
  /** The stored English name ("Romanian"), one of SUPPORTED_LANGUAGES, or a legacy value. */
  language: string | null;
  country: string | null;
  tone: string | null;
  avoid: string | null;
  priorityTopics: string | null;
  tonePreset: TonePreset;
};

export async function videoProfile(websiteId: string): Promise<VideoProfile | null> {
  const [[site], [voice], settings] = await Promise.all([
    db.select({ targetAudience: websites.targetAudience, language: websites.language, country: websites.country }).from(websites).where(eq(websites.id, websiteId)),
    db.select({ tone: brandVoice.tone, avoid: brandVoice.avoid }).from(brandVoice).where(eq(brandVoice.websiteId, websiteId)),
    readVideoSettings(websiteId),
  ]);
  if (!site) return null;
  return {
    targetAudience: site.targetAudience,
    language: site.language,
    country: site.country,
    tone: voice?.tone ?? null,
    avoid: voice?.avoid ?? null,
    priorityTopics: settings.priorityTopics,
    tonePreset: settings.tonePreset,
  };
}

export type VideoProfileInput = Partial<Record<keyof VideoProfile, unknown>>;

/** The Brand Voice and profile limits (lib/brand/actions.ts clips tone and avoid at 500). */
export const MAX_PROFILE_TEXT = 500;
export const MAX_COUNTRY = 100;

export type CleanProfile = {
  website: { targetAudience?: string | null; language?: string | null; country?: string | null };
  voice: { tone?: string | null; avoid?: string | null };
  video: { priorityTopics?: string | null; tonePreset?: TonePreset };
};

/**
 * A profile Save checked; null names nothing - the first bad field is
 * returned instead. The language must be one RepGet writes (any spelling
 * normalizeLanguage knows: "ro", "Română" -> "Romanian"); an empty one
 * clears it.
 */
export function cleanVideoProfile(input: VideoProfileInput): { ok: true; value: CleanProfile } | { ok: false; field: keyof VideoProfile } {
  const value: CleanProfile = { website: {}, voice: {}, video: {} };
  const text = (key: keyof VideoProfile, max: number): string | null | undefined | false => {
    const raw = input[key];
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    if (typeof raw !== "string") return false;
    const trimmed = raw.trim();
    if (trimmed.length > max) return false;
    return trimmed || null;
  };
  const audience = text("targetAudience", MAX_PROFILE_TEXT);
  if (audience === false) return { ok: false, field: "targetAudience" };
  if (audience !== undefined) value.website.targetAudience = audience;
  const country = text("country", MAX_COUNTRY);
  if (country === false) return { ok: false, field: "country" };
  if (country !== undefined) value.website.country = country;
  const language = text("language", 80);
  if (language === false) return { ok: false, field: "language" };
  if (language !== undefined) {
    if (language === null) value.website.language = null;
    else {
      const known = normalizeLanguage(language);
      if (!known || !SUPPORTED_LANGUAGES.some((option) => option.value === known)) return { ok: false, field: "language" };
      value.website.language = known;
    }
  }
  const tone = text("tone", MAX_PROFILE_TEXT);
  if (tone === false) return { ok: false, field: "tone" };
  if (tone !== undefined) value.voice.tone = tone;
  const avoid = text("avoid", MAX_PROFILE_TEXT);
  if (avoid === false) return { ok: false, field: "avoid" };
  if (avoid !== undefined) value.voice.avoid = avoid;
  const topics = text("priorityTopics", MAX_PRIORITY_TOPICS);
  if (topics === false) return { ok: false, field: "priorityTopics" };
  if (topics !== undefined) value.video.priorityTopics = topics;
  if (input.tonePreset !== undefined) {
    if (typeof input.tonePreset !== "string" || !(TONE_PRESETS as readonly string[]).includes(input.tonePreset)) return { ok: false, field: "tonePreset" };
    value.video.tonePreset = input.tonePreset as TonePreset;
  }
  return { ok: true, value };
}
