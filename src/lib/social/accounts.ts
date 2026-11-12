import "server-only";

import { and, eq } from "drizzle-orm";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { socialAccounts, socialSuggestions, socialTeams, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { VIDEO_PLATFORM_SPECS, VIDEO_PLATFORMS } from "@/lib/video/formats";

import { createTeam, teamAccounts, type BundleAccount } from "./bundle";
import { PLATFORMS, SOCIAL_PLATFORMS, TRIAL_PLATFORMS, WARMUP_DAYS, type SocialPlatform } from "./platforms";

/**
 * A website's social accounts: which platforms it may use, connecting one by
 * username, and reading back the ones connected through bundle.social.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type SocialAccess = {
  /** "paid": every platform; "trial": the free articles, Quora only; "none": no plan. */
  level: "paid" | "trial" | "none";
  platforms: readonly SocialPlatform[];
  /** RepGet publishes nothing by itself here: every post waits for a person's click. */
  manualOnly?: true;
};

/**
 * What a website may use (client, 2026-10-27): a paid plan every platform, a
 * trial Quora only - the others are shown but locked - and nothing without a
 * plan.
 *
 * A website in internal testing (lib/billing/internal-testing.ts) gets every
 * platform, with `manualOnly`. A trial's Quora has no own posts, so it would
 * test one reply box and call the rest locked; but a paid plan's accounts publish
 * by themselves once connected (social_accounts.auto_post defaults to on), and
 * this site must not. So it is suggestions and one-click posts on all six, and
 * suggest.ts and publish.ts never hand a post to bundle.social.
 */
export async function socialAccess(websiteId: string): Promise<SocialAccess> {
  if ((await isEntitledToSpend(websiteId)).ok) return { level: "paid", platforms: SOCIAL_PLATFORMS };
  if ((await isEntitledToSpend(websiteId, { freeArticles: true })).ok) return { level: "trial", platforms: TRIAL_PLATFORMS };
  if ((await isEntitledToSpend(websiteId, { internalTesting: true })).ok) return { level: "paid", platforms: SOCIAL_PLATFORMS, manualOnly: true };
  return { level: "none", platforms: [] };
}

export type SocialAccount = typeof socialAccounts.$inferSelect;

export async function listAccounts(websiteId: string, executor: Executor = db): Promise<SocialAccount[]> {
  return executor.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId));
}

/** Whether an account is still in its warm-up. */
export function inWarmup(account: Pick<SocialAccount, "warmupEndsAt">, now: Date = new Date()): boolean {
  return account.warmupEndsAt.getTime() > now.getTime();
}

const warmupEnd = (now: Date) => new Date(now.getTime() + WARMUP_DAYS * DAY_MS);

/**
 * Connects a platform by username (Quora always; the others while
 * bundle.social is not configured). The same username again keeps its
 * warm-up; a different one is a new account and starts a new one.
 */
export async function connectUsername(
  websiteId: string,
  platform: SocialPlatform,
  username: string,
  now: Date = new Date(),
): Promise<SocialAccount> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)))
      .for("update");
    if (existing) {
      const same = existing.username.toLowerCase() === username.toLowerCase();
      const [row] = await tx
        .update(socialAccounts)
        .set({ username, warmupEndsAt: same ? existing.warmupEndsAt : warmupEnd(now), updatedAt: now })
        .where(eq(socialAccounts.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await tx
      .insert(socialAccounts)
      .values({ websiteId, platform, username, warmupEndsAt: warmupEnd(now) })
      .returning();
    return row;
  });
}

/**
 * Removes a platform: its account, and the own posts still waiting to be
 * published there. What was posted stays in the history.
 */
export async function removeAccount(websiteId: string, platform: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(socialAccounts)
      .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
    await tx
      .update(socialSuggestions)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(socialSuggestions.websiteId, websiteId),
          eq(socialSuggestions.platform, platform),
          eq(socialSuggestions.status, "scheduled"),
        ),
      );
  });
}

/** The website's bundle.social team, created on first use. */
export async function ensureTeam(websiteId: string): Promise<string> {
  const [existing] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
  if (existing) return existing.teamId;
  const [site] = await db
    .select({ brandName: websites.brandName, domain: websites.domain })
    .from(websites)
    .where(eq(websites.id, websiteId));
  const teamId = await createTeam(site?.brandName || site?.domain || "RepGet website");
  // Two first connections at once: the first team wins; the other is left unused.
  const [saved] = await db
    .insert(socialTeams)
    .values({ websiteId, teamId })
    .onConflictDoNothing()
    .returning({ teamId: socialTeams.teamId });
  if (saved) return saved.teamId;
  const [winner] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
  return winner.teamId;
}

/** bundle.social's account types to RepGet's platforms: the social ones, and the video ones (lib/video). */
const PLATFORM_BY_BUNDLE_TYPE = new Map<string, string>([
  ...SOCIAL_PLATFORMS.flatMap((platform) => {
    const type = PLATFORMS[platform].bundleType;
    return type ? [[type, platform] as const] : [];
  }),
  ...VIDEO_PLATFORMS.map((platform) => [VIDEO_PLATFORM_SPECS[platform].bundleType, platform] as const),
]);

/**
 * social_accounts.target for the platforms where it is not a board (videos,
 * 2026-11-12), read back from bundle.social on every sync:
 *  - LinkedIn: where its posts go - "profile" (the member) or "organization"
 *    (a company page), "selected" when a target is chosen but its kind is not
 *    recognisable, null when none is chosen yet (bundle.social's page asks
 *    for one after LinkedIn's login; posting fails without it).
 *  - Instagram: how it is connected - "facebook_login" or "instagram_login".
 *    Instagram's audio API (native music on Reels) needs Facebook Login.
 * A team holds one account per platform, so a website has one LinkedIn
 * destination: its profile or one page, as chosen when connecting.
 */
export type LinkedinTarget = "profile" | "organization" | "selected";
export type InstagramLogin = "facebook_login" | "instagram_login";

export function linkedinTargetOf(account: Pick<BundleAccount, "externalId" | "userId">): LinkedinTarget | null {
  const id = account.externalId?.trim();
  if (!id) return null;
  if (/organization|company/i.test(id)) return "organization";
  if (/person|member/i.test(id) || (account.userId && id === account.userId)) return "profile";
  return "selected";
}

export function instagramLoginOf(account: Pick<BundleAccount, "instagramConnectionMethod">): InstagramLogin | null {
  if (account.instagramConnectionMethod === "FACEBOOK") return "facebook_login";
  if (account.instagramConnectionMethod === "INSTAGRAM") return "instagram_login";
  return null;
}

/** The target to store for a platform read back from bundle.social (Pinterest keeps the customer's board). */
function syncedTarget(platform: string, account: BundleAccount, existing: string | null | undefined): string | null {
  if (platform === "pinterest") return existing ?? account.channels.find((channel) => channel.name)?.name ?? null;
  if (platform === "linkedin") return linkedinTargetOf(account);
  if (platform === "instagram") return instagramLoginOf(account);
  return existing ?? null;
}

/**
 * Reads the accounts connected on bundle.social back into RepGet: a new one
 * starts its warm-up, a known one keeps it, and one disconnected there falls
 * back to a username (own posts become one-click). A Pinterest account gets
 * its first board until the customer picks another.
 */
export async function syncBundleAccounts(websiteId: string, now: Date = new Date()): Promise<SocialAccount[]> {
  const [team] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
  if (!team) return listAccounts(websiteId);
  const remote = await teamAccounts(team.teamId);

  await db.transaction(async (tx) => {
    const current = await tx.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId)).for("update");
    const byPlatform = new Map(current.map((row) => [row.platform, row]));
    const seen = new Set<string>();

    for (const account of remote) {
      const platform = PLATFORM_BY_BUNDLE_TYPE.get(account.type);
      if (!platform) continue;
      seen.add(platform);
      // A LinkedIn company page is shown by its name, not the member who connected it.
      const page = platform === "linkedin" ? account.channels.find((channel) => channel.id === account.externalId)?.name : null;
      const username = page || account.username || account.displayName || platform;
      const existing = byPlatform.get(platform);
      if (existing) {
        const sameAccount = existing.bundleAccountId === account.id || existing.username.toLowerCase() === username.toLowerCase();
        await tx
          .update(socialAccounts)
          .set({
            username,
            bundleAccountId: account.id,
            target: syncedTarget(platform, account, existing.target),
            warmupEndsAt: sameAccount ? existing.warmupEndsAt : warmupEnd(now),
            updatedAt: now,
          })
          .where(eq(socialAccounts.id, existing.id));
      } else {
        await tx.insert(socialAccounts).values({
          websiteId,
          platform,
          username,
          bundleAccountId: account.id,
          target: syncedTarget(platform, account, null),
          warmupEndsAt: warmupEnd(now),
        });
      }
    }

    for (const row of current) {
      if (row.bundleAccountId && !seen.has(row.platform)) {
        await tx.update(socialAccounts).set({ bundleAccountId: null, updatedAt: now }).where(eq(socialAccounts.id, row.id));
      }
    }
  });

  return listAccounts(websiteId);
}

/** A Pinterest account's boards, from bundle.social. */
export async function pinterestBoards(websiteId: string): Promise<string[]> {
  const [team] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
  if (!team) return [];
  const remote = await teamAccounts(team.teamId);
  const pinterest = remote.find((account) => account.type === "PINTEREST");
  return (pinterest?.channels ?? []).flatMap((channel) => (channel.name ? [channel.name] : []));
}
