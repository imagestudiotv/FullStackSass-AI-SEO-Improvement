import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { queueJob } from "@/inngest/send";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { FreePlanNotice } from "@/components/free-plan/free-plan-notice";
import { isFreePlanWebsite } from "@/lib/plans/free-plan-server";
import { creditOverviewForRequest } from "@/lib/credits/overview-request";
import { readCreditSettings } from "@/lib/credits/prices";
import { db } from "@/lib/db";
import { socialAccounts, videoIdeaBatches, videoIdeas, videoMedia } from "@/lib/db/schema";
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
import { productionChoicesOf } from "@/lib/video/cost";
import { MUSIC_TRACKS, MUSIC_VOLUME, ideaTrack, musicUrl } from "@/lib/video/music";
import { brandLook, readVideoSettings, videoAccess, type VideoSettings } from "@/lib/video/settings";
import type { ProductionReelProps } from "@/remotion/props";

import { DAILY_MAX_ATTEMPTS, ideaAllowance } from "@/lib/video/batches";
import { readDestinations } from "@/lib/video/destinations";
import { readNativeAudio } from "@/lib/video/native-audio";
import { videoPublishingStatus } from "@/lib/video/publish-actions";
import { reviewBlocksAutoPublish } from "@/lib/video/review";
import { previewClips } from "@/lib/video/preview-media";
import { videoProfile } from "@/lib/video/strategy/profile";
import { cleanClipText } from "@/remotion/clip-text";

import { POSTED_STATUSES, SAVED_STATUSES } from "./logic";
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
 * Videos (client, 2026-10-29; docs/videos.md): today's ideas, one at a time,
 * the saved videos made from them (not published yet), what is scheduled or
 * posted, and the settings, under a strip of
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
    // Saved Videos (client, 2026-11-21): approved, not scheduled or published yet.
    db
      .select()
      .from(videoIdeas)
      .where(
        and(
          eq(videoIdeas.websiteId, site.id),
          inArray(videoIdeas.status, [...SAVED_STATUSES]),
          gte(videoIdeas.updatedAt, new Date(now.getTime() - 30 * DAY_MS)),
        ),
      )
      .orderBy(desc(videoIdeas.approvedAt))
      .limit(40),
    // Posted: what is scheduled or on its way (any age), then what is out, newest first.
    db
      .select()
      .from(videoIdeas)
      .where(
        and(
          eq(videoIdeas.websiteId, site.id),
          inArray(videoIdeas.status, [...POSTED_STATUSES]),
        ),
      )
      .orderBy(sql`case when ${videoIdeas.status} = 'posted' then 1 else 0 end`, desc(sql`coalesce(${videoIdeas.postedAt}, ${videoIdeas.scheduledFor}, ${videoIdeas.updatedAt})`))
      .limit(40),
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
  // A day whose batch used all its writing attempts with nothing written: say so, instead of
  // "Writing..." for the rest of the day (every job would answer "busy"; New ideas still work).
  const [daily] = await db
    .select({ attempts: videoIdeaBatches.attempts, status: videoIdeaBatches.status })
    .from(videoIdeaBatches)
    .where(and(eq(videoIdeaBatches.websiteId, site.id), eq(videoIdeaBatches.day, today), eq(videoIdeaBatches.slot, 0)));
  const ideasFailed = Number(todayCount) === 0 && !!daily && daily.status !== "writing" && daily.attempts >= DAILY_MAX_ATTEMPTS;
  const writing = Number(todayCount) === 0 && !ideasFailed && level !== "none" && site.status === "ready";
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
  // The clip each idea's preview plays before it is made (client, 2026-11-21): its POV clip or the hook clip picked for it.
  const clips = await previewClips(ideas.map((row) => row.plan as ShotPlan | null));
  const previewClipOf = new Map(ideas.map((row, i) => [row.id, clips[i]]));
  const view = (row: (typeof ideas)[number]): IdeaView => {
    const script = row.script as VideoScript;
    const timing = row.timing as { words: ReelProps["words"]; sceneStartsMs: number[] } | null;
    const voiced = Boolean(row.voiceUrl && timing);
    const plan = row.plan as ShotPlan | null;
    // The music it is (or will be) made with, so the preview is heard as the video will be (client, 2026-11-23).
    const direction = plan && Array.isArray(plan.scenes) && isCreativeDirection(row.direction) ? row.direction : "animated";
    const track = ideaTrack({
      id: row.id,
      style: row.style,
      musicTrack: row.musicTrack,
      direction,
      hasProduction: Boolean(row.production),
      music: productionChoicesOf(row).music,
      planMood: plan?.musicMood ?? null,
      websiteMusic: settings.music,
    });
    const props: ProductionReelProps = {
      style: row.style as VideoStyle,
      brand,
      script,
      voiceUrl: voiced ? row.voiceUrl : null,
      words: voiced ? timing!.words : [],
      sceneStartsMs: voiced ? timing!.sceneStartsMs : silentTiming(script).sceneStartsMs,
      voiceMs: voiced ? Math.min(row.durationMs ?? 0, MAX_REEL_SECONDS * 1000) : 0,
      music: track ? { url: musicUrl(track, ""), volume: voiced ? MUSIC_VOLUME.underVoice : MUSIC_VOLUME.alone } : null,
      media: (row.media as MediaItem[]) ?? [],
      captions: row.captions,
      // The idea's own production (direction, shots, audio, captions), so the preview shows what will be made;
      // before it is made, footage and voice are not chosen yet: the templates say it is a concept.
      direction: isCreativeDirection(row.direction) ? row.direction : "animated",
      plan: (row.plan as ShotPlan | null) ?? null,
      production: (row.production as ProductionChoices | null) ?? null,
      format: isVideoFormat(row.format) ? row.format : "reel",
      concept: !voiced,
      language: row.language,
      ...(!voiced && previewClipOf.get(row.id) ? { sceneMedia: [previewClipOf.get(row.id)!] } : {}),
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
      coverUrl: row.filesDeletedAt ? null : row.coverUrl,
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
  const ideasPrice = credits.prices.video_ideas;
  const tab = typeof query.tab === "string" && ["ideas", "videos", "posted", "settings"].includes(query.tab) ? query.tab : "ideas";
  const notice = typeof query.social === "string" ? query.social : null;
  const noticePlatform = typeof query.platform === "string" ? query.platform : null;

  /*
    The Free plan: AI video production needs an upgrade (videoAccess says
    "none"); said plainly above the panel rather than leaving it empty.
  */
  const free = level === "none" && access === "owner" && (await isFreePlanWebsite(site.id));
  if (free) {
    return <FreePlanNotice locale={locale} reason="lockedVideos" websiteId={site.id} source="videos" className="mt-2" />;
  }

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
      ideasFailed={ideasFailed}
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
      ideasPrice={ideasPrice}
      ideasPriceLabel={ideasPrice > 0 ? plural(t.app.credits.creditsCount, ideasPrice) : t.app.social.free}
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
  const textStyle = cleanClipText(saved.textStyle);
  return {
    audio: saved.audio === "voiceover" || saved.audio === "text_music" ? saved.audio : row.voice ? "voiceover" : "text_music",
    narration: pick(NARRATION_STYLES, saved.narration, settings.narration),
    captionStyle: pick(CAPTION_STYLES, saved.captionStyle, settings.captionStyle),
    music: pick(MUSIC_DIRECTIONS, saved.music, row.musicTrack === "none" ? "none" : "auto"),
    duration: pick(DURATION_RANGES, saved.duration, settings.duration),
    showHook: typeof saved.showHook === "boolean" ? saved.showHook : true,
    includeCta: typeof saved.includeCta === "boolean" ? saved.includeCta : true,
    ctaText: typeof saved.ctaText === "string" && saved.ctaText.trim() ? saved.ctaText : null,
    ...(textStyle ? { textStyle } : {}),
  };
}
