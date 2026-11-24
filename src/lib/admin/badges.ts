import "server-only";

import { and, count, eq, gt, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin/guard";
import { waitingForReviewSql } from "@/lib/admin/review-queue-sql";
import { failedPostSql, failedVideoSql } from "@/lib/admin/social-posting";
import { missingPlacements } from "@/lib/backlinks/placements";
import { db } from "@/lib/db";
import {
  addonPurchases,
  addons,
  articles,
  blogAutopilotTopics,
  blogComments,
  blogSponsorships,
  earnSubmissions,
  feedback,
  freePlanAccounts,
  organization,
  partnerApplications,
  partnerCommissions,
  partnerProviderEvents,
  partnerReviewCases,
  partnerSettlements,
  payments,
  publicationDispatches,
  socialAccounts,
  socialSuggestions,
  user,
  videoIdeas,
  websiteProjects,
  websites,
} from "@/lib/db/schema";
import { partnerDeps } from "@/lib/partners/server";
import { IN_FLIGHT_TIMEOUT_MS, UNACKNOWLEDGED } from "@/lib/publishing/dispatch";

import { assembleBadges, type AdminBadges, type BadgePart, type SeenPath } from "./badges-shared";

/**
 * The counts beside the admin sidebar's sections (Daniel, 2026-11-24: "it will
 * be good to receive a notification, 1, 2 or something to understand what is
 * happening ... and we act instant instead of guessing").
 *
 * Two kinds: "waiting" is something a person must act on, and stays until they
 * do; "new" is what arrived since this administrator last opened the page, for
 * pages with nothing to act on. The last-opened times are in a cookie
 * (lib/admin/badges-seen.ts), so nothing is written to the database.
 *
 * FAILS SOFT, one count at a time: a count that cannot be read shows no badge
 * and breaks nothing. Cheap counts, in parallel, kept for a few seconds so
 * several tabs do not repeat them.
 */

type Seen = Partial<Record<SeenPath, Date>>;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Failures older than this are history: without an end, one could never clear. */
const FAILED_DAYS = 30;
/** Never opened on this browser: what arrived in the last day is new. */
const FIRST_LOOK_MS = DAY_MS;

const one = async (query: PromiseLike<{ n: number }[]>) => Number((await query)[0]?.n ?? 0);

type WaitingSource = { href: string; what: string; count: (now: Date) => Promise<number> };
type NewSource = { href: string; what: string; seen: SeenPath; count: (since: Date) => Promise<number> };

/** The environment the partner program runs in here; its other one's rows are never shown on these pages. */
const partnerEnvironment = () => partnerDeps().settings.environment();

/** Exported for the test that checks every one of them. */
export const WAITING_SOURCES: WaitingSource[] = [
  {
    href: "/admin/website-projects",
    what: "to quote",
    count: () => one(db.select({ n: count() }).from(websiteProjects).where(eq(websiteProjects.status, "quote_requested"))),
  },
  {
    href: "/admin/website-projects",
    what: "to deliver",
    count: () => one(db.select({ n: count() }).from(websiteProjects).where(eq(websiteProjects.status, "paid"))),
  },
  {
    href: "/admin/feedback",
    what: "unread",
    count: () => one(db.select({ n: count() }).from(feedback).where(eq(feedback.status, "new"))),
  },
  {
    href: "/admin/earn-credits",
    what: "claims to decide",
    count: () => one(db.select({ n: count() }).from(earnSubmissions).where(eq(earnSubmissions.status, "pending"))),
  },
  {
    // The same claims, for the page a story ends up on; it links to Earn Credits, where they are decided.
    href: "/admin/success-stories",
    what: "customer stories sent through Earn Credits",
    count: () =>
      one(db.select({ n: count() }).from(earnSubmissions).where(and(eq(earnSubmissions.status, "pending"), eq(earnSubmissions.kind, "story")))),
  },
  {
    href: "/admin/service-orders",
    what: "to deliver",
    count: () =>
      one(
        db
          .select({ n: count() })
          .from(addonPurchases)
          .innerJoin(addons, eq(addons.id, addonPurchases.addonId))
          .leftJoin(websiteProjects, eq(websiteProjects.id, addonPurchases.id))
          // A website project's order is delivered on its own page.
          .where(and(eq(addons.kind, "service"), eq(addonPurchases.status, "paid"), isNull(websiteProjects.id))),
      ),
  },
  {
    href: "/admin/network",
    what: "articles to review",
    count: () => one(db.select({ n: count() }).from(articles).where(waitingForReviewSql)),
  },
  {
    href: "/admin/network",
    what: "links reported missing",
    count: async () => (await missingPlacements(100)).length,
  },
  {
    href: "/admin/network/operations",
    what: "deliveries with no known outcome",
    count: (now) =>
      one(
        db
          .select({ n: count() })
          .from(publicationDispatches)
          .where(
            or(
              eq(publicationDispatches.status, "uncertain"),
              inArray(publicationDispatches.status, [...UNACKNOWLEDGED]),
              and(eq(publicationDispatches.status, "in_flight"), lte(publicationDispatches.claimedAt, new Date(now.getTime() - IN_FLIGHT_TIMEOUT_MS))),
            ),
          ),
      ),
  },
  {
    href: "/admin/articles",
    what: "failed in the last 30 days",
    count: (now) =>
      one(
        db
          .select({ n: count() })
          .from(articles)
          .where(and(eq(articles.status, "failed"), gte(articles.updatedAt, new Date(now.getTime() - FAILED_DAYS * DAY_MS)))),
      ),
  },
  {
    href: "/admin/websites",
    what: "with a failed analysis",
    count: () => one(db.select({ n: count() }).from(websites).where(eq(websites.status, "failed"))),
  },
  {
    href: "/admin/blog",
    what: "paid Get Featured requests",
    count: () => one(db.select({ n: count() }).from(blogSponsorships).where(eq(blogSponsorships.status, "paid"))),
  },
  {
    href: "/admin/blog",
    what: "failed autopilot topics",
    count: () => one(db.select({ n: count() }).from(blogAutopilotTopics).where(eq(blogAutopilotTopics.status, "failed"))),
  },
  {
    href: "/admin/social-posting",
    what: "accounts paused by the provider",
    count: () => one(db.select({ n: count() }).from(socialAccounts).where(isNotNull(socialAccounts.pausedAt))),
  },
  {
    href: "/admin/partners",
    what: "Stripe events that failed",
    count: () => one(db.select({ n: count() }).from(partnerProviderEvents).where(eq(partnerProviderEvents.status, "failed"))),
  },
  {
    href: "/admin/partners/applications",
    what: "applications to review",
    count: () => one(db.select({ n: count() }).from(partnerApplications).where(eq(partnerApplications.status, "submitted"))),
  },
  {
    href: "/admin/partners/commissions",
    what: "commissions to review",
    count: async () => {
      const environment = partnerEnvironment();
      if (!environment) return 0;
      return one(
        db
          .select({ n: count() })
          .from(partnerCommissions)
          .where(and(eq(partnerCommissions.environment, environment), eq(partnerCommissions.reviewState, "needs_review"), eq(partnerCommissions.status, "pending"))),
      );
    },
  },
  {
    href: "/admin/partners/payouts",
    what: "payouts to look at",
    count: async () => {
      const environment = partnerEnvironment();
      if (!environment) return 0;
      return one(
        db
          .select({ n: count() })
          .from(partnerSettlements)
          .where(and(eq(partnerSettlements.environment, environment), inArray(partnerSettlements.state, ["transfer_unknown", "needs_review", "payout_failed"]))),
      );
    },
  },
  {
    href: "/admin/partners/reviews",
    what: "cases to decide",
    count: () => one(db.select({ n: count() }).from(partnerReviewCases).where(eq(partnerReviewCases.status, "open"))),
  },
];

export const NEW_SOURCES: NewSource[] = [
  { href: "/admin/users", what: "new", seen: "/admin/users", count: (since) => one(db.select({ n: count() }).from(user).where(gt(user.createdAt, since))) },
  { href: "/admin/websites", what: "new", seen: "/admin/websites", count: (since) => one(db.select({ n: count() }).from(websites).where(gt(websites.createdAt, since))) },
  {
    href: "/admin/organizations",
    what: "new",
    seen: "/admin/organizations",
    count: (since) => one(db.select({ n: count() }).from(organization).where(gt(organization.createdAt, since))),
  },
  {
    href: "/admin/free-plan",
    what: "new",
    seen: "/admin/free-plan",
    count: (since) => one(db.select({ n: count() }).from(freePlanAccounts).where(gt(freePlanAccounts.startedAt, since))),
  },
  { href: "/admin/payments", what: "new", seen: "/admin/payments", count: (since) => one(db.select({ n: count() }).from(payments).where(gt(payments.createdAt, since))) },
  {
    // Comments go live at once: moderating them starts with knowing there is one.
    href: "/admin/blog",
    what: "new comments",
    seen: "/admin/blog/comments",
    count: (since) =>
      one(
        db
          .select({ n: count() })
          .from(blogComments)
          .where(and(gt(blogComments.createdAt, since), isNull(blogComments.removedAt), isNull(blogComments.deletedAt))),
      ),
  },
  {
    href: "/admin/social-posting",
    what: "new failed posts",
    seen: "/admin/social-posting",
    count: (since) => one(db.select({ n: count() }).from(socialSuggestions).where(and(failedPostSql, gt(socialSuggestions.updatedAt, since)))),
  },
  {
    href: "/admin/social-posting",
    what: "new failed videos",
    seen: "/admin/social-posting",
    count: (since) => one(db.select({ n: count() }).from(videoIdeas).where(and(failedVideoSql, gt(videoIdeas.updatedAt, since)))),
  },
];

async function soft(href: string, work: () => Promise<number>): Promise<number> {
  try {
    const value = await work();
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    console.error(`[admin/badges] the count for ${href} failed`, error);
    return 0;
  }
}

const WAITING_TTL_MS = 10_000;
let waitingMemo: { at: number; parts: Promise<BadgePart[]> } | null = null;

/** What waits is the same for every administrator, so one read serves them all for a few seconds. */
function waitingParts(now: Date, fresh: boolean): Promise<BadgePart[]> {
  if (!fresh && waitingMemo && now.getTime() - waitingMemo.at < WAITING_TTL_MS && now.getTime() >= waitingMemo.at) return waitingMemo.parts;
  const parts = Promise.all(
    WAITING_SOURCES.map(async (source): Promise<BadgePart> => ({
      href: source.href,
      kind: "waiting",
      what: source.what,
      count: await soft(source.href, () => source.count(now)),
    })),
  );
  waitingMemo = { at: now.getTime(), parts };
  return parts;
}

/** Every badge for the signed-in administrator. `fresh` skips the few-second memory, after something changed. */
export async function getAdminBadges(seen: Seen, options: { fresh?: boolean; now?: Date } = {}): Promise<AdminBadges> {
  await requireAdmin();
  const now = options.now ?? new Date();
  const firstLook = new Date(now.getTime() - FIRST_LOOK_MS);
  const [waiting, fresh] = await Promise.all([
    waitingParts(now, options.fresh ?? false),
    Promise.all(
      NEW_SOURCES.map(async (source): Promise<BadgePart> => ({
        href: source.href,
        kind: "new",
        what: source.what,
        count: await soft(source.href, () => source.count(seen[source.seen] ?? firstLook)),
      })),
    ),
  ]);
  return assembleBadges([...waiting, ...fresh]);
}
