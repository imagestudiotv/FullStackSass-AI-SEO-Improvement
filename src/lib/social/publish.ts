import "server-only";

import { and, eq } from "drizzle-orm";

import { refundSpend, spendCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { socialAccounts, socialSuggestions, socialTeams, websites } from "@/lib/db/schema";
import { isFreePlanWebsite, takeFreePlanPost } from "@/lib/plans/free-plan-server";

import { autoPostAllowed, socialAccess } from "./accounts";
import { BundleError, createPost, getPost, isBundleConfigured, uploadFromUrl, type BundlePost } from "./bundle";
import { PLATFORMS, type SocialPlatform } from "./platforms";

/**
 * Publishing the customer's own posts through bundle.social (client,
 * 2026-10-27: "RepGet posts the customer's own posts automatically").
 *
 * A scheduled post is published at its time unless the customer skipped or
 * edited it into a one-click post first: the status is checked under a row
 * lock, so publishing, "Post now" and a retry publish it once. Its credit
 * (1, Admin -> Credits "social_post") is charged as it is handed to
 * bundle.social, keyed by the suggestion, and given back if the platform
 * refuses it. A Free website's post costs no credit: it takes one of the
 * month's FREE_PLAN.socialPostsPerMonth instead, and a refused post is not
 * counted.
 *
 * A REFUSAL PAUSES THE ACCOUNT'S AUTOMATIC POSTING (the anti-ban rule): a
 * platform that refused a post - spam filter, rate limit, suspended account -
 * would refuse the next one too, and every further try makes a ban more
 * likely. The reason stays in social_accounts for administrators; the
 * customer sees only that the post is ready to post by hand, as are the
 * account's other waiting posts. What starts it again, and when: pause.ts.
 */

export type PublishOutcome = "posting" | "posted" | "skipped" | "failed" | "no_credits" | "free_posts_used";

const spendKey = (id: string) => `social:${id}`;

/** A Free website's post refused because the month's are used: the stored error, shown in the reader's language. */
export const FREE_POSTS_USED = "free_posts_used";

/** A bundle.social error that will not go away by trying again. */
function isPermanent(error: unknown): boolean {
  return error instanceof BundleError && error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 429;
}

function shortReason(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

async function pause(websiteId: string, platform: string, reason: string, now: Date) {
  await db
    .update(socialAccounts)
    .set({ pausedAt: now, pausedReason: shortReason(reason), updatedAt: now })
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
  // Its other waiting posts are the customer's to post: the page must not promise a time RepGet will not keep.
  await db
    .update(socialSuggestions)
    .set({ status: "new", scheduledFor: null, updatedAt: now })
    .where(and(eq(socialSuggestions.websiteId, websiteId), eq(socialSuggestions.platform, platform), eq(socialSuggestions.status, "scheduled")));
}

async function fail(id: string, reason: string, now: Date) {
  await refundSpend(spendKey(id));
  await db
    .update(socialSuggestions)
    .set({ status: "failed", error: shortReason(reason), updatedAt: now })
    .where(eq(socialSuggestions.id, id));
}

/**
 * Hands a scheduled post to bundle.social. "posting" means it was accepted
 * and checkPublished follows it; anything else is final.
 */
export async function publishSuggestion(id: string, now: Date = new Date()): Promise<PublishOutcome> {
  const [peek] = await db.select({ websiteId: socialSuggestions.websiteId }).from(socialSuggestions).where(eq(socialSuggestions.id, id));
  if (!peek) return "skipped";
  // Asked before the lock: the entitlement reads go through the shared connection.
  const access = await socialAccess(peek.websiteId);

  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(socialSuggestions).where(eq(socialSuggestions.id, id)).for("update");
    if (!row || row.status !== "scheduled" || row.kind !== "post") return { outcome: "skipped" as const };

    const platform = row.platform as SocialPlatform;
    const [account] = await tx
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.websiteId, row.websiteId), eq(socialAccounts.platform, platform)));
    const [team] = await tx.select().from(socialTeams).where(eq(socialTeams.websiteId, row.websiteId));
    // Not publishable any more: it waits for the customer's one click instead.
    if (
      access.manualOnly ||
      !isBundleConfigured() ||
      !account?.bundleAccountId ||
      !account.autoPost ||
      // A LinkedIn post scheduled while SOCIAL_LINKEDIN_AUTOPOST was on, once it is off (accounts.ts).
      !autoPostAllowed(platform) ||
      account.pausedAt ||
      !team ||
      !access.platforms.includes(platform)
    ) {
      await tx.update(socialSuggestions).set({ status: "new", scheduledFor: null, updatedAt: now }).where(eq(socialSuggestions.id, id));
      return { outcome: "skipped" as const };
    }

    // The Free plan's posts are a monthly limit, not credits (lib/plans/free-plan-server.ts takeFreePlanPost).
    const free = await isFreePlanWebsite(row.websiteId, tx);
    if (free) {
      if (!(await takeFreePlanPost(tx, row.websiteId, now))) {
        await tx
          .update(socialSuggestions)
          .set({ status: "failed", error: FREE_POSTS_USED, updatedAt: now })
          .where(eq(socialSuggestions.id, id));
        return { outcome: "free_posts_used" as const };
      }
    } else {
      const [site] = await tx.select({ organizationId: websites.organizationId }).from(websites).where(eq(websites.id, row.websiteId));
      const spent = await spendCredits(tx, { organizationId: site.organizationId, action: "social_post", key: spendKey(id), websiteId: row.websiteId }, now);
      if (!spent.ok) {
        await tx
          .update(socialSuggestions)
          .set({ status: "failed", error: "not_enough_credits", updatedAt: now })
          .where(eq(socialSuggestions.id, id));
        return { outcome: "no_credits" as const };
      }
    }
    await tx
      .update(socialSuggestions)
      .set({ status: "posting", creditSpendKey: free ? null : spendKey(id), updatedAt: now })
      .where(eq(socialSuggestions.id, id));
    return { outcome: "claimed" as const, row, account, teamId: team.teamId };
  });
  if (claimed.outcome !== "claimed") return claimed.outcome;

  const { row, account, teamId } = claimed;
  const platform = row.platform as SocialPlatform;
  const type = PLATFORMS[platform].bundleType!;
  if (platform === "pinterest" && (!account.target || !row.imageUrl)) {
    await fail(id, !account.target ? "Choose a Pinterest board first" : "This Pin has no picture", now);
    return "failed";
  }
  if (platform === "linkedin" && !account.target) {
    // bundle.social asks which profile or page after LinkedIn's login; without one LinkedIn refuses the post.
    await fail(id, "Choose your LinkedIn profile or page first", now);
    return "failed";
  }
  try {
    const data: Record<string, unknown> =
      platform === "reddit"
        ? { sr: `u/${account.username}`, text: row.title ?? row.body.slice(0, 120), description: row.body }
        : platform === "pinterest"
          ? {
              boardName: account.target,
              text: row.title ?? undefined,
              description: row.body,
              altText: row.title ?? undefined,
              uploadIds: row.imageUrl ? [await uploadFromUrl(teamId, row.imageUrl)] : [],
              ...(row.link ? { link: row.link } : {}),
            }
          : platform === "linkedin"
            ? // A text post (a link in it gets LinkedIn's own preview), public, to the profile or page chosen when connecting.
              { text: row.body, privacy: "PUBLIC" }
            : { text: row.body };
    const post = await createPost({ teamId, type, data, title: row.title ?? row.body.slice(0, 80), referenceKey: id, now });
    await db.update(socialSuggestions).set({ bundlePostId: post.id, updatedAt: now }).where(eq(socialSuggestions.id, id));
    return settle(id, row.websiteId, platform, post, now);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isPermanent(error)) await pause(row.websiteId, platform, reason, now);
    await fail(id, reason, now);
    return "failed";
  }
}

/** Follows a post bundle.social accepted: posted, refused, or still on its way. */
export async function checkPublished(id: string, now: Date = new Date()): Promise<PublishOutcome> {
  const [row] = await db.select().from(socialSuggestions).where(eq(socialSuggestions.id, id));
  if (!row || row.status !== "posting" || !row.bundlePostId) return row?.status === "posted" ? "posted" : "skipped";
  return settle(id, row.websiteId, row.platform as SocialPlatform, await getPost(row.bundlePostId), now);
}

async function settle(id: string, websiteId: string, platform: SocialPlatform, post: BundlePost, now: Date): Promise<PublishOutcome> {
  const type = PLATFORMS[platform].bundleType!;
  if (post.status === "POSTED") {
    await db
      .update(socialSuggestions)
      .set({ status: "posted", postedAt: now, postedUrl: post.externalData?.[type]?.permalink ?? null, error: null, updatedAt: now })
      .where(eq(socialSuggestions.id, id));
    return "posted";
  }
  if (post.status === "ERROR" || post.status === "DELETED") {
    const reason = post.errors?.[type] ?? post.error ?? "The platform did not publish this post";
    await pause(websiteId, platform, reason, now);
    await fail(id, reason, now);
    return "failed";
  }
  return "posting";
}

/** A job that died after charging and before handing the post over: back to the customer, credit returned. */
export async function abandonPublishing(id: string, now: Date = new Date()): Promise<void> {
  const [row] = await db.select().from(socialSuggestions).where(eq(socialSuggestions.id, id));
  if (row?.status === "posting" && !row.bundlePostId) await fail(id, "Publishing did not finish", now);
}
