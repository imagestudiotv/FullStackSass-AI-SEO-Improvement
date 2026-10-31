import "server-only";

import { eq } from "drizzle-orm";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { videoSettings, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import {
  isVideoPlatform,
  isVideoStyle,
  isVoice,
  VIDEO_PLATFORMS,
  type BrandLook,
  type PublishMode,
  type VideoPlatform,
  type VideoStyle,
  type Voice,
} from "./formats";

/**
 * A website's video settings, with the defaults where it has no row yet, and
 * who may use videos at all.
 */

export type VideoSettings = {
  style: VideoStyle;
  voice: Voice | null;
  music: boolean;
  captions: boolean;
  publishMode: PublishMode;
  platforms: VideoPlatform[];
  logoUrl: string | null;
};

export const DEFAULT_SETTINGS: VideoSettings = {
  style: "bold",
  voice: "coral",
  music: true,
  captions: true,
  publishMode: "manual",
  platforms: [...VIDEO_PLATFORMS],
  logoUrl: null,
};

export async function readVideoSettings(websiteId: string, executor: Executor = db): Promise<VideoSettings> {
  const [row] = await executor.select().from(videoSettings).where(eq(videoSettings.websiteId, websiteId));
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    style: isVideoStyle(row.style) ? row.style : DEFAULT_SETTINGS.style,
    voice: row.voice && isVoice(row.voice) ? row.voice : null,
    music: row.music,
    captions: row.captions,
    publishMode: row.publishMode === "auto" ? "auto" : "manual",
    platforms: row.platforms.filter(isVideoPlatform),
    logoUrl: row.logoUrl,
  };
}

export async function saveVideoSettings(websiteId: string, settings: VideoSettings): Promise<void> {
  const values = { ...settings, updatedAt: new Date() };
  await db
    .insert(videoSettings)
    .values({ websiteId, ...values })
    .onConflictDoUpdate({ target: videoSettings.websiteId, set: values });
}

/**
 * Who may make videos (client, 2026-10-29: "we can include video in trials
 * too, for convincing people to stay"): a paid plan and the free-articles
 * trial alike. Without a plan, nothing.
 */
export async function videoAccess(websiteId: string): Promise<"paid" | "trial" | "none"> {
  if ((await isEntitledToSpend(websiteId)).ok) return "paid";
  if ((await isEntitledToSpend(websiteId, { freeArticles: true })).ok) return "trial";
  return "none";
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalHex(value: string | null | undefined): string | null {
  const match = value?.trim().match(HEX);
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  return `#${hex.toLowerCase()}`;
}

function channels(hex: string): [number, number, number] {
  return [0, 2, 4].map((at) => parseInt(hex.slice(1 + at, 3 + at), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: string, b: string, t: number): string {
  const [x, y] = [channels(a), channels(b)];
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as [number, number, number]);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The colours a video uses, from the website's one brand colour (the same
 * one its article pictures use): the colour itself, a lighter accent, and a
 * deep background, so text stays readable whatever the brand picked.
 */
export function brandLook(
  site: { brandName: string | null; domain: string; brandColor: string | null },
  logoUrl: string | null,
): BrandLook {
  const primary = normalHex(site.brandColor) ?? "#4f46e5";
  const light = luminance(primary) > 0.45;
  return {
    name: site.brandName?.trim() || site.domain,
    domain: site.domain.replace(/^www\./, ""),
    primary,
    accent: light ? mix(primary, "#000000", 0.35) : mix(primary, "#ffffff", 0.45),
    background: mix(primary, "#05060a", light ? 0.85 : 0.72),
    text: "#ffffff",
    // The customer's uploaded logo, or none: the closing card then shows the brand's initial.
    // (Not a favicon service: a render must not wait on another site's answer.)
    logoUrl,
  };
}

export async function websiteBrand(websiteId: string): Promise<BrandLook | null> {
  const [site] = await db
    .select({ brandName: websites.brandName, domain: websites.domain, brandColor: websites.brandColor })
    .from(websites)
    .where(eq(websites.id, websiteId));
  if (!site) return null;
  return brandLook(site, (await readVideoSettings(websiteId)).logoUrl);
}
