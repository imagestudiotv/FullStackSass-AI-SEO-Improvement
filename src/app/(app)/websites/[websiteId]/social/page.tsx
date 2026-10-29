import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { readCreditSettings } from "@/lib/credits/prices";
import { db } from "@/lib/db";
import { socialSuggestions } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { plural } from "@/lib/i18n/format";
import { inWarmup, listAccounts, pinterestBoards, socialAccess } from "@/lib/social/accounts";
import { isBundleConfigured } from "@/lib/social/bundle";
import { SUGGESTIONS_PER_DAY } from "@/lib/social/platforms";
import { requireWebsitePage } from "@/lib/tenant";

import { SocialPanel, type AccountView, type SuggestionView } from "./social-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/websites/[websiteId]/social">): Promise<Metadata> {
  const { websiteId } = await params;
  const { userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);
  return { title: t.app.social.title };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Social media (client, 2026-10-27; docs/social-media.md): the website's
 * accounts, today's suggestions and what was posted. Only reads - the
 * suggestions are written by the daily job (lib/social/suggest.ts).
 */
export default async function WebsiteSocialPage({ params, searchParams }: PageProps<"/websites/[websiteId]/social">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  await requireWebsitePlan(ctx);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [plan, accounts, open, posted, todayCount, credits, { t, locale }, query] = await Promise.all([
    socialAccess(site.id),
    listAccounts(site.id),
    // Waiting for the customer, or for RepGet: the last week's.
    db
      .select()
      .from(socialSuggestions)
      .where(
        and(
          eq(socialSuggestions.websiteId, site.id),
          inArray(socialSuggestions.status, ["new", "scheduled", "posting", "failed"]),
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

  const accountViews: AccountView[] = accounts.map((account) => ({
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
  });

  const price = credits.prices.social_post;
  const notice = typeof query.social === "string" ? query.social : null;
  const noticePlatform = typeof query.platform === "string" ? query.platform : null;

  return (
    <SocialPanel
      websiteId={site.id}
      canEdit={access !== "viewer"}
      level={plan.level}
      platforms={[...plan.platforms]}
      bundle={bundle}
      accounts={accountViews}
      open={open.map(view)}
      posted={posted.map(view)}
      todayCount={Number(todayCount[0]?.n ?? 0)}
      perDay={SUGGESTIONS_PER_DAY}
      priceLabel={price > 0 ? plural(t.app.credits.creditsCount, price) : t.app.social.free}
      boards={boards}
      notice={notice === "connected" || notice === "not_connected" || notice === "connect_failed" ? { kind: notice, platform: noticePlatform } : null}
      locale={locale}
      t={t.app.social}
    />
  );
}
