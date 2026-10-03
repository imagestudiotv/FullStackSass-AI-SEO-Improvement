import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { ArticleDetail } from "@/lib/articles/actions";
import { releaseCheckFor, reviewHash } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, calendarItems, publicationDispatches, publishLogs } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";
import { isControlEnabled } from "@/lib/publishing/controls";
import { IN_FLIGHT_TIMEOUT_MS, UNACKNOWLEDGED } from "@/lib/publishing/dispatch";
import type { ProviderErrorKind } from "@/lib/publishing/provider";
import type { IntegrationView } from "@/lib/publishing/shared";

import { publishFailureKind } from "./failure-copy";
import type { Destination, LastOutcome, PublishFacts, ReviewState } from "./publish-state";

/**
 * The publishing facts the article page shows, read once per request.
 *
 * Every query is bounded (one row, or the latest ten history rows) and
 * scoped to an article the page has already resolved inside the caller's
 * website. Reading changes nothing: no job, no check, no write.
 */

/** One publishing attempt as the history shows it. No raw error text crosses to the browser. */
export type HistoryRow = {
  id: string;
  /** published (delivered) | failed */
  status: string;
  /** What the CMS reported it stored: publish | draft | future | null (unknown). */
  remoteStatus: string | null;
  remoteUrl: string | null;
  errorKind: ProviderErrorKind | null;
  /** ISO, for <time dateTime>. */
  at: string;
  /** Formatted on the server in the reader's language (UTC), so the browser renders the same text. */
  when: string;
};

export const HISTORY_LIMIT = 10;

/** Date and time, UTC, in the reader's convention - formatted here to avoid a server/browser mismatch. */
export function formatWhen(value: Date, locale: Locale): string {
  return `${formatDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function formatDay(value: Date, locale: Locale): string {
  return formatDate(value, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** The connection the publish job uses: connected, newest verified first (lib/publishing/credentials.ts). */
export function pickDestination(integrations: IntegrationView[], pluginConnected: boolean): Destination {
  const connected = integrations
    .filter((integration) => integration.status === "connected")
    .sort((a, b) => (b.verifiedAt?.getTime() ?? 0) - (a.verifiedAt?.getTime() ?? 0));
  const first = connected[0];
  if (first) return { kind: "direct", name: first.providerName, provider: first.kind, site: first.siteName };
  return pluginConnected ? { kind: "plugin" } : { kind: "none" };
}

function outcomeOf(
  log: { status: string; remoteStatus: string | null; error: string | null; createdAt: Date } | undefined,
  dispatch: { status: string; channel: string; claimedAt: Date } | undefined,
  locale: Locale,
): LastOutcome {
  // A plugin hand-over nobody acknowledged, newer than any recorded result.
  if (
    dispatch &&
    dispatch.channel === "plugin" &&
    (UNACKNOWLEDGED as readonly string[]).includes(dispatch.status) &&
    (!log || dispatch.claimedAt > log.createdAt)
  ) {
    return { kind: "pluginUnconfirmed", when: formatWhen(dispatch.claimedAt, locale) };
  }
  if (!log) return { kind: "none" };
  const when = formatWhen(log.createdAt, locale);
  if (log.status === "failed") return { kind: "failed", when, errorKind: publishFailureKind(log.error) };
  // "published" means delivered; what the CMS stored is remoteStatus (null: unknown, never assumed live).
  if (log.remoteStatus === "publish") return { kind: "live", when };
  if (log.remoteStatus === "draft") return { kind: "draft", when };
  if (log.remoteStatus === "future") return { kind: "scheduled", when };
  return { kind: "delivered", when };
}

export async function loadPublishing(input: {
  siteId: string;
  article: ArticleDetail;
  autoPublish: boolean;
  publishAs: string;
  destination: Destination;
  /** The latest direct dispatch is uncertain (lib/publishing/dispatch.ts latestUncertain). */
  uncertain: boolean;
  locale: Locale;
  now?: Date;
}): Promise<{ facts: PublishFacts; history: HistoryRow[] }> {
  const { siteId, article, locale } = input;
  const now = input.now ?? new Date();

  const [[extra], [latest], [lastSent], logs, frozen] = await Promise.all([
    db
      .select({
        reviewStatus: articles.reviewStatus,
        reviewApprovedHash: articles.reviewApprovedHash,
        scheduledFor: calendarItems.scheduledFor,
      })
      .from(articles)
      .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
      .where(and(eq(articles.id, article.id), eq(articles.websiteId, siteId)))
      .limit(1),
    db
      .select({
        id: publicationDispatches.id,
        status: publicationDispatches.status,
        channel: publicationDispatches.channel,
        claimedAt: publicationDispatches.claimedAt,
      })
      .from(publicationDispatches)
      .where(and(eq(publicationDispatches.articleId, article.id), eq(publicationDispatches.websiteId, siteId)))
      .orderBy(desc(publicationDispatches.claimedAt))
      .limit(1),
    // The claim's already_sent rule reads the latest timely "sent" dispatch.
    db
      .select({
        revisionHash: publicationDispatches.revisionHash,
        requestedStatus: publicationDispatches.requestedStatus,
        remoteStatus: publicationDispatches.remoteStatus,
      })
      .from(publicationDispatches)
      .where(
        and(
          eq(publicationDispatches.articleId, article.id),
          eq(publicationDispatches.websiteId, siteId),
          eq(publicationDispatches.status, "sent"),
          eq(publicationDispatches.late, false),
        ),
      )
      .orderBy(desc(publicationDispatches.claimedAt))
      .limit(1),
    // Joined through articles so a log of another tenant's article cannot be read.
    db
      .select({
        id: publishLogs.id,
        status: publishLogs.status,
        remoteStatus: publishLogs.remoteStatus,
        remoteUrl: publishLogs.remoteUrl,
        error: publishLogs.error,
        createdAt: publishLogs.createdAt,
      })
      .from(publishLogs)
      .innerJoin(articles, eq(publishLogs.articleId, articles.id))
      .where(and(eq(articles.id, article.id), eq(articles.websiteId, siteId)))
      .orderBy(desc(publishLogs.createdAt))
      .limit(HISTORY_LIMIT),
    isControlEnabled("publication_freeze"),
  ]);

  const fields = {
    title: article.title,
    slug: article.slug,
    metaDescription: article.metaDescription,
    bodyHtml: article.bodyHtml,
    imageUrl: article.imageUrl,
    imageAlt: article.imageAlt,
  };

  let review: ReviewState = "none";
  if (extra && extra.reviewStatus !== null) {
    const check = releaseCheckFor({ ...fields, reviewStatus: extra.reviewStatus, reviewApprovedHash: extra.reviewApprovedHash });
    review = check.ok ? "approved" : check.reason === "changed_since_approval" ? "changed" : "pending";
  }

  const revision = reviewHash(fields);
  const sameRevision = Boolean(lastSent && lastSent.revisionHash === revision);

  const scheduledFor = extra?.scheduledFor ?? null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const plannedInFuture = scheduledFor
    ? Date.UTC(scheduledFor.getUTCFullYear(), scheduledFor.getUTCMonth(), scheduledFor.getUTCDate()) > today
    : false;

  const facts: PublishFacts = {
    destination: input.destination,
    review,
    frozen,
    uncertain: input.uncertain,
    delivering: Boolean(
      latest && latest.status === "in_flight" && latest.claimedAt.getTime() > now.getTime() - IN_FLIGHT_TIMEOUT_MS,
    ),
    liveOnSite: article.status === "published" || lastSent?.remoteStatus === "publish",
    alreadySent: {
      publish: sameRevision && lastSent?.requestedStatus === "publish",
      draft: sameRevision && lastSent?.requestedStatus === "draft",
    },
    lastOutcome: outcomeOf(logs[0], latest, locale),
    latestDispatchId: latest?.id ?? null,
    latestLogId: logs[0]?.id ?? null,
    planned: scheduledFor ? formatDay(scheduledFor, locale) : null,
    plannedInFuture,
    autoPublish: input.autoPublish ? (input.publishAs === "draft" ? "draft" : "live") : "off",
  };

  const history: HistoryRow[] = logs.map((log) => ({
    id: log.id,
    status: log.status,
    remoteStatus: log.remoteStatus,
    remoteUrl: log.remoteUrl,
    errorKind: log.status === "failed" || log.error ? publishFailureKind(log.error) : null,
    at: log.createdAt.toISOString(),
    when: formatWhen(log.createdAt, locale),
  }));

  return { facts, history };
}
