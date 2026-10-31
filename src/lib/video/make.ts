import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { refundSpend } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { videoIdeas, websites } from "@/lib/db/schema";
import { track } from "@/lib/usage";

import {
  BEST_HOURS,
  isVoice,
  silentTiming,
  slideCount,
  spokenParts,
  type CaptionWord,
  type MediaItem,
  type ReelProps,
  type VideoScript,
  type VideoStyle,
} from "./formats";
import { MUSIC_VOLUME, musicTrack, musicUrl, pickTrack } from "./music";
import { renderReelLocally, renderSlides } from "./render";
import { readVideoSettings, websiteBrand } from "./settings";
import { storeVideoFile } from "./storage";
import { isVoiceConfigured, speakScript, VOICE_COST_PER_MINUTE } from "./voice";

/**
 * Making an approved idea into its video: the voice first (its length sets
 * every scene's time), then the render (lib/video/render.ts), then the file
 * stored and the video ready - published at once by RepGet when the website
 * publishes automatically, otherwise waiting for the customer's Publish.
 *
 * The idea's credit was charged when it was approved (lib/video/actions.ts);
 * a video that cannot be made gives it back (failMaking).
 */

export type VideoIdea = typeof videoIdeas.$inferSelect;
export type Timing = { words: CaptionWord[]; sceneStartsMs: number[] };

export const spendKey = (id: string) => `video:${id}`;

/** The running app's address: where the render machine fetches the music from. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.repget.com").replace(/\/+$/, "");
}

/** The props the templates are given for an idea, in its current state. */
export async function reelProps(idea: VideoIdea): Promise<ReelProps> {
  const brand = await websiteBrand(idea.websiteId);
  if (!brand) throw new Error("The website is gone");
  const script = idea.script as VideoScript;
  const timing = idea.timing as Timing | null;
  const voiced = Boolean(idea.voiceUrl && timing);
  const track = musicTrack(idea.musicTrack);
  return {
    style: idea.style as VideoStyle,
    brand,
    script,
    voiceUrl: voiced ? idea.voiceUrl : null,
    words: voiced ? timing!.words : [],
    sceneStartsMs: voiced ? timing!.sceneStartsMs : silentTiming(script).sceneStartsMs,
    voiceMs: voiced ? (idea.durationMs ?? 0) : 0,
    music: track ? { url: musicUrl(track, appUrl()), volume: voiced ? MUSIC_VOLUME.underVoice : MUSIC_VOLUME.alone } : null,
    media: (idea.media as MediaItem[]) ?? [],
    captions: idea.captions,
  };
}

/**
 * Speaks the idea's script, once: a retried job finds the voice already
 * there. Without a voice chosen (or without OpenAI) the scenes run on fixed
 * times.
 */
export async function prepareVoice(id: string): Promise<VideoIdea> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea) throw new Error("The idea is gone");
  if (idea.format !== "reel" || idea.voiceUrl || !idea.voice || !isVoice(idea.voice) || !isVoiceConfigured()) {
    if (idea.format === "reel" && !idea.voiceUrl) {
      const [row] = await db
        .update(videoIdeas)
        .set({ durationMs: silentTiming(idea.script as VideoScript).totalMs, updatedAt: new Date() })
        .where(eq(videoIdeas.id, id))
        .returning();
      return row;
    }
    return idea;
  }
  const spoken = await speakScript(spokenParts(idea.script as VideoScript), idea.voice, idea.language);
  const voiceUrl = await storeVideoFile(idea.websiteId, `ideas/${id}`, spoken.audio, "audio/wav");
  const [row] = await db
    .update(videoIdeas)
    .set({
      voiceUrl,
      timing: { words: spoken.words, sceneStartsMs: spoken.sceneStartsMs } satisfies Timing,
      durationMs: spoken.durationMs,
      updatedAt: new Date(),
    })
    .where(eq(videoIdeas.id, id))
    .returning();
  const [site] = await db.select({ organizationId: websites.organizationId }).from(websites).where(eq(websites.id, idea.websiteId));
  if (site) {
    await track(site.organizationId, {
      kind: "llm",
      websiteId: idea.websiteId,
      provider: "openai",
      model: "gpt-4o-mini-tts",
      quantity: Math.round(spoken.durationMs / 1000),
      costUsd: (spoken.durationMs / 60_000) * VOICE_COST_PER_MINUTE,
      metadata: { purpose: "video_voice", ideaId: id },
    });
  }
  return row;
}

/** The music for an idea, chosen when it is made unless the customer chose one (or none). */
export async function chooseMusic(idea: VideoIdea): Promise<VideoIdea> {
  if (idea.musicTrack !== null) return idea;
  const settings = await readVideoSettings(idea.websiteId);
  const track = settings.music ? pickTrack(idea.id, idea.style) : null;
  const [row] = await db
    .update(videoIdeas)
    .set({ musicTrack: track?.id ?? "none", updatedAt: new Date() })
    .where(eq(videoIdeas.id, idea.id))
    .returning();
  return row;
}

/** A reel rendered on this machine (development), stored. */
export async function makeReelLocally(idea: VideoIdea): Promise<string> {
  const file = await renderReelLocally(await reelProps(idea));
  return storeVideoFile(idea.websiteId, `ideas/${idea.id}`, file, "video/mp4");
}

/** A carousel's slides, rendered and stored. */
export async function makeCarousel(idea: VideoIdea): Promise<string[]> {
  const props = await reelProps(idea);
  const slides = await renderSlides(props, slideCount(props.script));
  const urls: string[] = [];
  for (const slide of slides) urls.push(await storeVideoFile(idea.websiteId, `ideas/${idea.id}`, slide, "image/png"));
  return urls;
}

/** The video is made: ready, and on its way when the website publishes automatically. */
export async function finishMaking(
  id: string,
  files: { videoUrl?: string; slideUrls?: string[] },
  now: Date = new Date(),
): Promise<{ autoAt: Date | null }> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea || idea.status !== "making") return { autoAt: null };
  const settings = await readVideoSettings(idea.websiteId);
  const autoAt = settings.publishMode === "auto" ? await nextPublishTime(idea.websiteId, now) : null;
  await db
    .update(videoIdeas)
    .set({
      status: autoAt ? "scheduled" : "ready",
      videoUrl: files.videoUrl ?? null,
      slideUrls: files.slideUrls ?? null,
      platforms: autoAt ? settings.platforms : idea.platforms,
      scheduledFor: autoAt,
      error: null,
      updatedAt: now,
    })
    .where(eq(videoIdeas.id, id));
  return { autoAt };
}

/** The video could not be made: the credit goes back and the customer sees why. */
export async function failMaking(id: string, reason: string, now: Date = new Date()): Promise<void> {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea || !["approved", "making"].includes(idea.status)) return;
  if (idea.creditSpendKey) await refundSpend(idea.creditSpendKey);
  await db
    .update(videoIdeas)
    .set({ status: "failed", error: reason.replace(/\s+/g, " ").slice(0, 300), updatedAt: now })
    .where(eq(videoIdeas.id, id));
}

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
