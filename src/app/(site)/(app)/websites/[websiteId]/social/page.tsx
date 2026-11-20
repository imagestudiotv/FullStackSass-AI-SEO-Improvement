import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { calendarMonth } from "@/lib/billing/entitlement-period";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { readCreditSettings } from "@/lib/credits/prices";
import { db } from "@/lib/db";
import { socialSuggestions } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { plural } from "@/lib/i18n/format";
import { FREE_PLAN } from "@/lib/plans/free-plan";
import { freePlanPostsThisMonth, isFreePlanWebsite } from "@/lib/plans/free-plan-server";
import { inWarmup, listAccounts, pinterestBoards, socialAccess } from "@/lib/social/accounts";
import { isBundleConfigured } from "@/lib/social/bundle";
import { isConnectNotice } from "@/lib/social/connect-return";
import { isSocialPlatform, SUGGESTIONS_PER_DAY } from "@/lib/social/platforms";
import { requireWebsitePage } from "@/lib/tenant";

import type { AccountView, SuggestionView } from "./opportunities";
import { SocialPanel } from "./social-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/websites/[websiteId]/social">): Promise<Metadata> {
  const { websiteId } = await params;
  const { userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);
  return { title: t.app.social.title };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Opportunities (client, 2026-10-27; redesigned from the client's design
 * 2026-11-03; docs/social-media.md): the website's accounts, the week's
 * suggestions and drafts, and what was posted. Only reads - the suggestions
 * are written by the daily job (lib/social/suggest.ts).
 */
export default async function WebsiteSocialPage({ params, searchParams }: PageProps<"/websites/[websiteId]/social">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  await requireWebsitePlan(ctx, { internalTesting: true });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [plan, free, accounts, open, posted, todayCount, credits, { t, locale }, query] = await Promise.all([
    socialAccess(site.id),
    isFreePlanWebsite(site.id),
    listAccounts(site.id),
    // Waiting for the customer (a saved draft too), or for RepGet: the last week's.
    db
      .select()
      .from(socialSuggestions)
      .where(
        and(
          eq(socialSuggestions.websiteId, site.id),
          inArray(socialSuggestions.status, ["new", "draft", "scheduled", "posting", "failed"]),
          gte(socialSuggestions.createdAt, new Date(now.getTime() - 7 * DAY_MS)),
        ),
      )
      .orderBy(desc(socialSuggestions.createdAt))
      .limit(40),
    db
      .select()
      .from(socialSuggestions)
      .where(and(eq(socialSuggestions.websiteId, site.id), eq(socialSuggestions.status, "posted")))
      .orderBy(desc(socialSuggestions.postedAt))
      .limit(20),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(socialSuggestions)
      .where(and(eq(socialSuggestions.websiteId, site.id), eq(socialSuggestions.day, today))),
    readCreditSettings(),
    getAppMessages(userId),
    searchParams,
  ]);

  const bundle = isBundleConfigured();
  const pinterest = accounts.find((account) => account.platform === "pinterest" && account.bundleAccountId);
  // Best effort: a slow bundle.social must not keep the page from opening.
  const boards = bundle && pinterest ? await pinterestBoards(site.id).catch(() => []) : [];

  /*
    Free: its hard FREE_PLAN.socialPostsPerMonth posts a month are what limits
    it, so that is the count it is shown - with the day's drafts only while
    the month's drafts (FREE_PLAN.socialSuggestionsPerMonth, lib/social/
    suggest.ts) are not used up, when no more come today anyway.
  */
  const freeMonth = free
    ? await Promise.all([
        freePlanPostsThisMonth(site.id, now),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(socialSuggestions)
          .where(and(eq(socialSuggestions.websiteId, site.id), gte(socialSuggestions.day, calendarMonth(now).start.toISOString().slice(0, 10)))),
      ]).then(([posts, drafts]) => ({
        posts,
        postsMax: FREE_PLAN.socialPostsPerMonth,
        draftsLeft: Math.max(0, FREE_PLAN.socialSuggestionsPerMonth - Number(drafts[0]?.n ?? 0)),
      }))
    : null;

  // The video platforms' accounts are on the Videos page.
  const accountViews: AccountView[] = accounts.filter((account) => isSocialPlatform(account.platform)).map((account) => ({
    platform: account.platform,
    username: account.username,
    connected: Boolean(account.bundleAccountId),
    autoPost: account.autoPost,
    warmupEndsAt: account.warmupEndsAt.toISOString(),
    inWarmup: inWarmup(account, now),
    pausedReason: account.pausedAt ? (account.pausedReason ?? "") : null,
    target: account.target,
  }));
  const view = (row: (typeof open)[number]): SuggestionView => ({
    id: row.id,
    platform: row.platform,
    kind: row.kind,
    status: row.status,
    threadUrl: row.threadUrl,
    threadTitle: row.threadTitle,
    threadSnippet: row.threadSnippet,
    title: row.title,
    body: row.body,
    warmup: row.warmup,
    imageUrl: row.imageUrl,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    postedAt: row.postedAt?.toISOString() ?? null,
    postedUrl: row.postedUrl,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  });

  // A Free website's posts cost no credit: they are the month's (lib/plans/free-plan-server.ts takeFreePlanPost).
  const price = free ? 0 : credits.prices.social_post;
  const notice = typeof query.social === "string" ? query.social : null;
  // Only a platform's own name reaches the toast, never whatever a link carries.
  const noticePlatform = typeof query.platform === "string" && isSocialPlatform(query.platform) ? query.platform : null;

  return (
    <SocialPanel
      websiteId={site.id}
      canEdit={access !== "viewer"}
      level={plan.level}
      platforms={[...plan.platforms]}
      manualOnly={plan.manualOnly === true}
      bundle={bundle}
      accounts={accountViews}
      open={open.map(view)}
      posted={posted.map(view)}
      todayCount={Number(todayCount[0]?.n ?? 0)}
      perDay={SUGGESTIONS_PER_DAY}
      freeMonth={freeMonth}
      priceLabel={price > 0 ? plural(t.app.credits.creditsCount, price) : t.app.social.free}
      boards={boards}
      notice={isConnectNotice(notice) ? { kind: notice, platform: noticePlatform } : null}
      locale={locale}
      t={t.app.social}
    />
  );
}
