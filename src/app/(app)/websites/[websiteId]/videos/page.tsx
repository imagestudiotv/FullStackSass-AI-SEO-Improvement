import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { queueJob } from "@/inngest/send";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { creditOverviewForRequest } from "@/lib/credits/overview-request";
import { readCreditSettings } from "@/lib/credits/prices";
import { db } from "@/lib/db";
import { socialAccounts, videoIdeas, videoMedia } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { plural } from "@/lib/i18n/format";
import { VIDEOS_COPY } from "@/lib/i18n/videos";
import { isBundleConfigured } from "@/lib/social/bundle";
import { requireWebsitePage } from "@/lib/tenant";
import {
  CAPTION_STYLES,
  COMPLETE_AFTER,
  DURATION_RANGES,
  isCreativeDirection,
  isIdeaCategory,
  isVideoFormat,
  isVideoPlatform,
  MAX_REEL_SECONDS,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  silentTiming,
  type DestinationState,
  type FactClaim,
  type IdeaOverrides,
  type MediaItem,
  type ProductionChoices,
  type ReelProps,
  type ShotPlan,
  type VideoScript,
  type VideoStyle,
} from "@/lib/video/formats";
import { totalViews } from "@/lib/video/followup";
import { MUSIC_TRACKS } from "@/lib/video/music";
import { brandLook, readVideoSettings, videoAccess, type VideoSettings } from "@/lib/video/settings";
import type { ProductionReelProps } from "@/remotion/props";

import { ideaAllowance } from "@/lib/video/batches";
import { readDestinations } from "@/lib/video/destinations";
import { readNativeAudio } from "@/lib/video/native-audio";
import { videoPublishingStatus } from "@/lib/video/publish-actions";
import { reviewBlocksAutoPublish } from "@/lib/video/review";
import { videoProfile } from "@/lib/video/strategy/profile";

import { VideosPanel, type IdeaView, type VideoAccountView } from "./videos-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/websites/[websiteId]/videos">): Promise<Metadata> {
  const { websiteId } = await params;
  const { userId } = await requireWebsitePage(websiteId);
  const { locale } = await getAppMessages(userId);
  return { title: VIDEOS_COPY[locale].title };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** How often the page looks again while a video is being made or published. */
const REFRESH_SECONDS = 10;

/**
 * Videos (client, 2026-10-29; docs/videos.md): today's ideas to swipe, the
 * videos made from them, what was posted, and the settings, under a strip of
 * three numbers (ideas ready, made today, credits available). Only reads - and
 * asks for today's ideas when the website has none yet, so the first visit
 * is not an empty page.
 */
export default async function WebsiteVideosPage({ params, searchParams }: PageProps<"/websites/[websiteId]/videos">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  await requireWebsitePlan(ctx);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [level, settings, ideas, made, posted, approvedToday, media, accounts, credits, wallet, { t, locale }, query, allowance, profile, publishingStatus] = await Promise.all([
    videoAccess(site.id),
    readVideoSettings(site.id),
    db
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.websiteId, site.id), eq(videoIdeas.day, today), eq(videoIdeas.status, "new")))
      .orderBy(videoIdeas.createdAt),
    db
      .select()
      .from(videoIdeas)
      .where(
        and(
          eq(videoIdeas.websiteId, site.id),
          inArray(videoIdeas.status, ["approved", "making", "ready", "draft", "scheduled", "posting", "failed"]),
          gte(videoIdeas.updatedAt, new Date(now.getTime() - 30 * DAY_MS)),
        ),
      )
      .orderBy(desc(videoIdeas.approvedAt))
      .limit(40),
    db
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.websiteId, site.id), eq(videoIdeas.status, "posted")))
      .orderBy(desc(videoIdeas.postedAt))
      .limit(30),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(videoIdeas)
      .where(and(eq(videoIdeas.websiteId, site.id), gte(videoIdeas.approvedAt, new Date(`${today}T00:00:00Z`)))),
    db.select().from(videoMedia).where(eq(videoMedia.websiteId, site.id)).orderBy(desc(videoMedia.createdAt)),
    db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, site.id)),
    readCreditSettings(),
    // The balance the sidebar shows (the same cached read), for the owner only: credits belong to the
    // paying workspace, and a guest would be shown money that is not theirs (dashboard/page.tsx).
    access === "owner" ? creditOverviewForRequest(ctx.ownerOrgId).catch(() => null) : null,
    getAppMessages(userId),
    searchParams,
    ideaAllowance(site.id, now),
    videoProfile(site.id),
    videoPublishingStatus(site.id),
  ]);

  // The first visit of the day: today's ideas are written now (the job tops them up to twenty).
  const [{ n: todayCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videoIdeas)
    .where(and(eq(videoIdeas.websiteId, site.id), eq(videoIdeas.day, today)));
  const writing = Number(todayCount) === 0 && level !== "none" && site.status === "ready";
  if (writing && access !== "viewer") await queueJob({ name: "video/ideas.requested", data: { websiteId: site.id } }).catch(() => false);

  // Without the status, nothing optional is offered (X, Instagram's own audio).
  const publishing = publishingStatus.ok
    ? publishingStatus.data
    : { x: { available: false, reason: "disabled" as const }, instagramAudio: { available: false as const, reason: "not_configured" as const }, linkedin: { connected: false, target: null } };
  // The audience fields as the form edits them (the business profile and Brand Voice, shared).
  const profileForm = {
    targetAudience: profile?.targetAudience ?? "",
    language: profile?.language ?? "",
    country: profile?.country ?? "",
    tone: profile?.tone ?? "",
    avoid: profile?.avoid ?? "",
    priorityTopics: profile?.priorityTopics ?? "",
    tonePreset: profile?.tonePreset ?? settings.tonePreset,
  };
  const brand = brandLook(site, settings.logoUrl);
  const view = (row: (typeof ideas)[number]): IdeaView => {
    const script = row.script as VideoScript;
    const timing = row.timing as { words: ReelProps["words"]; sceneStartsMs: number[] } | null;
    const voiced = Boolean(row.voiceUrl && timing);
    const props: ProductionReelProps = {
      style: row.style as VideoStyle,
      brand,
      script,
      voiceUrl: voiced ? row.voiceUrl : null,
      words: voiced ? timing!.words : [],
      sceneStartsMs: voiced ? timing!.sceneStartsMs : silentTiming(script).sceneStartsMs,
      voiceMs: voiced ? Math.min(row.durationMs ?? 0, MAX_REEL_SECONDS * 1000) : 0,
      music: null,
      media: (row.media as MediaItem[]) ?? [],
      captions: row.captions,
      // The idea's own production (direction, shots, audio, captions), so the preview shows what will be made;
      // before it is made, footage, voice and music are not chosen yet: the templates say it is a concept.
      direction: isCreativeDirection(row.direction) ? row.direction : "animated",
      plan: (row.plan as ShotPlan | null) ?? null,
      production: (row.production as ProductionChoices | null) ?? null,
      format: isVideoFormat(row.format) ? row.format : "reel",
      concept: !voiced,
      language: row.language,
    };
    return {
      id: row.id,
      format: row.format,
      style: row.style,
      title: row.title,
      caption: row.caption,
      status: row.status,
      voice: row.voice,
      musicTrack: row.musicTrack,
      captions: row.captions,
      props,
      videoUrl: row.filesDeletedAt ? null : row.videoUrl,
      slideUrls: row.filesDeletedAt ? [] : (row.slideUrls ?? []),
      platforms: (row.platforms ?? []).filter(isVideoPlatform),
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      postedAt: row.postedAt?.toISOString() ?? null,
      postedUrls: row.postedUrls ?? {},
      stats: row.stats ?? {},
      statsAt: row.statsAt?.toISOString() ?? null,
      views: totalViews(row.stats),
      error: row.error,
      category: isIdeaCategory(row.category) ? row.category : "educational",
      direction: isCreativeDirection(row.direction) ? row.direction : "animated",
      why: row.why,
      techniques: row.techniques ?? [],
      production: productionOf(row, settings),
      overrides: (row.overrides ?? {}) as IdeaOverrides,
      reviewStatus: row.reviewStatus,
      reviewReasons: row.reviewReasons ?? [],
      claims: (row.claims ?? []) as FactClaim[],
      reviewBlocks: reviewBlocksAutoPublish(row),
      destinations: readDestinations(row.destinations) as Record<string, DestinationState>,
      nativeAudio: readNativeAudio(row.nativeAudio),
    };
  };

  const accountViews: VideoAccountView[] = accounts
    .filter((account) => isVideoPlatform(account.platform))
    .map((account) => ({
      platform: account.platform,
      username: account.username,
      connected: Boolean(account.bundleAccountId),
      pausedReason: account.pausedAt ? (account.pausedReason ?? "") : null,
      // Pinterest's board, shared with the social Pins (chosen on Opportunities).
      board: account.target?.trim() || null,
    }));

  const price = credits.prices.video_post;
  const tab = typeof query.tab === "string" && ["ideas", "videos", "posted", "settings"].includes(query.tab) ? query.tab : "ideas";
  const notice = typeof query.social === "string" ? query.social : null;
  const noticePlatform = typeof query.platform === "string" ? query.platform : null;

  return (
    <VideosPanel
      websiteId={site.id}
      canEdit={access !== "viewer"}
      level={level}
      bundle={isBundleConfigured()}
      initialTab={tab as "ideas" | "videos" | "posted" | "settings"}
      ideas={ideas.map(view)}
      made={made.map(view)}
      posted={posted.map(view)}
      writing={writing}
      approvedToday={Number(approvedToday[0]?.n ?? 0)}
      goal={COMPLETE_AFTER}
      allowance={{
        dailyWritten: allowance.dailyWritten,
        extraUsed: allowance.extraUsed,
        extraLeft: allowance.extraLeft,
        busy: allowance.busy,
        tooSoon: Boolean(allowance.nextAllowedAt && allowance.nextAllowedAt.getTime() > now.getTime()),
      }}
      priceLabel={price > 0 ? plural(t.app.credits.creditsCount, price) : t.app.social.free}
      credits={wallet ? { available: wallet.available, label: plural(t.app.credits.creditsCount, wallet.available) } : null}
      settings={settings}
      profile={profileForm}
      publishing={publishing}
      brand={brand}
      media={media.map((item) => ({ id: item.id, url: item.url, kind: item.kind === "video" ? "video" : "image", name: item.name }))}
      accounts={accountViews}
      tracks={MUSIC_TRACKS.map((track) => ({ id: track.id, title: track.title, mood: track.mood }))}
      notice={notice === "connected" || notice === "not_connected" || notice === "connect_failed" ? { kind: notice, platform: noticePlatform } : null}
      refreshSeconds={REFRESH_SECONDS}
      locale={locale}
      t={VIDEOS_COPY[locale]}
    />
  );
}

const pick = <V extends string>(list: readonly V[], value: unknown, fallback: V): V =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as V) : fallback;

/**
 * An idea's production choices: its own (written with it since 2026-11-12),
 * or for an older idea the ones its voice, music and captions already meant.
 */
function productionOf(
  row: { production: unknown; voice: string | null; musicTrack: string | null },
  settings: VideoSettings,
): ProductionChoices {
  const saved = (row.production ?? {}) as Partial<ProductionChoices>;
  return {
    audio: saved.audio === "voiceover" || saved.audio === "text_music" ? saved.audio : row.voice ? "voiceover" : "text_music",
    narration: pick(NARRATION_STYLES, saved.narration, settings.narration),
    captionStyle: pick(CAPTION_STYLES, saved.captionStyle, settings.captionStyle),
    music: pick(MUSIC_DIRECTIONS, saved.music, row.musicTrack === "none" ? "none" : "auto"),
    duration: pick(DURATION_RANGES, saved.duration, settings.duration),
    showHook: typeof saved.showHook === "boolean" ? saved.showHook : true,
    includeCta: typeof saved.includeCta === "boolean" ? saved.includeCta : true,
    ctaText: typeof saved.ctaText === "string" && saved.ctaText.trim() ? saved.ctaText : null,
  };
}
