import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { queueJob } from "@/inngest/send";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { readCreditSettings } from "@/lib/credits/prices";
import { db } from "@/lib/db";
import { socialAccounts, videoIdeas, videoMedia } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { plural } from "@/lib/i18n/format";
import { VIDEOS_COPY } from "@/lib/i18n/videos";
import { isBundleConfigured } from "@/lib/social/bundle";
import { requireWebsitePage } from "@/lib/tenant";
import { COMPLETE_AFTER, IDEAS_PER_DAY, isVideoPlatform, MAX_REEL_SECONDS, silentTiming, type MediaItem, type ReelProps, type VideoScript, type VideoStyle } from "@/lib/video/formats";
import { totalViews } from "@/lib/video/followup";
import { MUSIC_TRACKS } from "@/lib/video/music";
import { brandLook, readVideoSettings, videoAccess } from "@/lib/video/settings";

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
 * videos made from them, what was posted, and the settings. Only reads - and
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
  const [level, settings, ideas, made, posted, approvedToday, media, accounts, credits, { t, locale }, query] = await Promise.all([
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
          inArray(videoIdeas.status, ["approved", "making", "ready", "scheduled", "posting", "failed"]),
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
    getAppMessages(userId),
    searchParams,
  ]);

  // The first visit of the day: today's ideas are written now (the job tops them up to twenty).
  const [{ n: todayCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videoIdeas)
    .where(and(eq(videoIdeas.websiteId, site.id), eq(videoIdeas.day, today)));
  const writing = Number(todayCount) === 0 && level !== "none" && site.status === "ready";
  if (writing && access !== "viewer") await queueJob({ name: "video/ideas.requested", data: { websiteId: site.id } }).catch(() => false);

  const brand = brandLook(site, settings.logoUrl);
  const view = (row: (typeof ideas)[number]): IdeaView => {
    const script = row.script as VideoScript;
    const timing = row.timing as { words: ReelProps["words"]; sceneStartsMs: number[] } | null;
    const voiced = Boolean(row.voiceUrl && timing);
    const props: ReelProps = {
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
    };
  };

  const accountViews: VideoAccountView[] = accounts
    .filter((account) => isVideoPlatform(account.platform))
    .map((account) => ({
      platform: account.platform,
      username: account.username,
      connected: Boolean(account.bundleAccountId),
      pausedReason: account.pausedAt ? (account.pausedReason ?? "") : null,
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
      perDay={IDEAS_PER_DAY}
      priceLabel={price > 0 ? plural(t.app.credits.creditsCount, price) : t.app.social.free}
      settings={settings}
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
