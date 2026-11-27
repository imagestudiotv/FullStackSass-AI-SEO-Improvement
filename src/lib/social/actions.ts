"use server";

import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import { spendCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { creditSpends, socialAccounts, socialSuggestions, socialTeams, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { isFreePlanWebsite, takeFreePlanPost } from "@/lib/plans/free-plan-server";
import { siteUrl } from "@/lib/site-url";
import { requireEditor } from "@/lib/websites/require-editor";

import { connectUsername, ensureTeam, inWarmup, removeAccount, socialAccess } from "./accounts";
import { disconnectAccount, isBundleConfigured, portalLink } from "./bundle";
import { cleanUsername, isSocialPlatform, PLATFORMS, type SocialPlatform } from "./platforms";
import { postTarget, postText, type PostEdit as Edit } from "./post-target";
import { asksForRecommendations, communityOf, mayMention, mentionHistory, MENTION_WINDOW_DAYS } from "./mention";
import { checkDraft, namesBrand } from "./rules";

/**
 * The Social page's actions. Each checks, on the server: an editor of the
 * website (a viewer cannot spend its owner's credits), a plan that includes
 * the platform (a trial: Quora only), and the anti-ban rules for edited text.
 *
 * Errors are codes (SocialError) the page shows in the reader's language.
 */

export type SocialError =
  | "view_only"
  | "not_included"
  | "no_plan"
  | "bad_username"
  | "use_connect"
  | "not_configured"
  | "connect_failed"
  | "not_found"
  | "already_handled"
  | "empty"
  | "too_long"
  | "warmup_link"
  | "warmup_brand"
  | "mention_not_allowed"
  | "bad_link"
  | "not_enough_credits"
  | "free_posts_used"
  | "no_board";

export type SocialResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: SocialError; price?: number; available?: number };

const fail = (error: SocialError): { ok: false; error: SocialError } => ({ ok: false, error });

const pagePath = (websiteId: string) => `/websites/${websiteId}/social`;

/** The editor guard plus the plan's platforms. */
async function guard(websiteId: string, platform?: SocialPlatform) {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return { ok: false as const, error: "view_only" as const };
  const access = await socialAccess(websiteId);
  if (access.level === "none") return { ok: false as const, error: "no_plan" as const };
  if (platform && !access.platforms.includes(platform)) return { ok: false as const, error: "not_included" as const };
  return { ok: true as const, site: editor.context.site, access };
}

function appUrl(): string {
  // The running app's own address (localhost in development); siteUrl() is the public site.
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || siteUrl();
}

/** Asks for the website's suggestions now: the first ones after a connection, or a top-up to the day's ten. */
async function queueSuggestions(websiteId: string) {
  await queueJob({ name: "social/suggest.requested", data: { websiteId } });
}

// ---------------------------------------------------------------- accounts

/** Connects by username: Quora always, the others while bundle.social is not set up. */
export async function connectSocialUsername(websiteId: string, platform: string, username: string): Promise<SocialResult> {
  if (!isSocialPlatform(platform)) return fail("not_found");
  const checked = await guard(websiteId, platform);
  if (!checked.ok) return fail(checked.error);
  if (PLATFORMS[platform].bundleType && isBundleConfigured()) return fail("use_connect");
  const name = cleanUsername(platform, username);
  if (!name) return fail("bad_username");
  await connectUsername(websiteId, platform, name);
  await queueSuggestions(websiteId);
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** The bundle.social page where the customer connects the account; they come back to /api/social/connected. */
export async function startSocialConnect(websiteId: string, platform: string, language = "en"): Promise<SocialResult<{ url: string }>> {
  if (!isSocialPlatform(platform)) return fail("not_found");
  const type = PLATFORMS[platform].bundleType;
  if (!type) return fail("not_found");
  const checked = await guard(websiteId, platform);
  if (!checked.ok) return fail(checked.error);
  if (!isBundleConfigured()) return fail("not_configured");
  try {
    const teamId = await ensureTeam(websiteId);
    const back = `${appUrl()}/api/social/connected?website=${encodeURIComponent(websiteId)}&platform=${platform}`;
    const url = await portalLink({ teamId, type, redirectUrl: back, language, userName: checked.site.brandName ?? checked.site.domain });
    return { ok: true, data: { url } };
  } catch (error) {
    console.error("[social] connect link failed", { websiteId, platform, error });
    return fail("connect_failed");
  }
}

/** Disconnects a platform, there and here; its waiting own posts are dropped. */
export async function disconnectSocial(websiteId: string, platform: string): Promise<SocialResult> {
  if (!isSocialPlatform(platform)) return fail("not_found");
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
  const type = PLATFORMS[platform].bundleType;
  if (account?.bundleAccountId && type && isBundleConfigured()) {
    const [team] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
    // Best effort: removing it here must not depend on bundle.social answering.
    if (team) await disconnectAccount(team.teamId, type).catch((error) => console.error("[social] disconnect failed", error));
  }
  await removeAccount(websiteId, platform);
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Turns RepGet's publishing of own posts on or off for an account; resuming also clears a pause. */
export async function setSocialAutoPost(websiteId: string, platform: string, on: boolean): Promise<SocialResult> {
  if (!isSocialPlatform(platform)) return fail("not_found");
  const checked = await guard(websiteId, platform);
  if (!checked.ok) return fail(checked.error);
  await db
    .update(socialAccounts)
    .set({ autoPost: on, ...(on ? { pausedAt: null, pausedReason: null } : {}), updatedAt: new Date() })
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
  if (!on) {
    // Waiting own posts become one-click.
    await db
      .update(socialSuggestions)
      .set({ status: "new", scheduledFor: null })
      .where(
        and(eq(socialSuggestions.websiteId, websiteId), eq(socialSuggestions.platform, platform), eq(socialSuggestions.status, "scheduled")),
      );
  }
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

export async function setPinterestBoard(websiteId: string, board: string): Promise<SocialResult> {
  const checked = await guard(websiteId, "pinterest");
  if (!checked.ok) return fail(checked.error);
  const name = board.trim().slice(0, 200);
  if (!name) return fail("no_board");
  await db
    .update(socialAccounts)
    .set({ target: name, updatedAt: new Date() })
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "pinterest")));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Writes today's suggestions now, up to the day's ten. */
export async function findSocialSuggestions(websiteId: string): Promise<SocialResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  await queueSuggestions(websiteId);
  return { ok: true, data: null };
}

// ------------------------------------------------------------- suggestions

/**
 * Waiting for the customer's one click: a new suggestion, one they edited and
 * saved as a draft (client's design, 2026-11-03: the Drafts stage), one
 * RepGet could not publish, a posted one clicked again (a closed tab), and
 * an own post RepGet has scheduled: posting that one by hand takes it out of
 * RepGet's hands under the row's lock (publish.ts finds it no longer
 * scheduled), so it goes out once. Never "posting": RepGet has handed that
 * one over, and posting it by hand would publish it twice.
 */
const ONE_CLICK = ["new", "draft", "failed", "posted", "scheduled"];

/** What can be kept as a draft: waiting for the customer, or not published by RepGet. */
const DRAFTABLE = ["new", "draft", "failed"];

/**
 * The spend a post by hand is charged under. Normally the suggestion's own
 * (a second click finds it and costs nothing). After RepGet's own try was
 * refused that spend was given back, and charging its key again would return
 * the refunded spend and take nothing: the post by hand has its own key.
 */
async function handSpendKey(tx: Executor, id: string): Promise<string> {
  const key = `social:${id}`;
  const [spend] = await tx.select({ refundedAt: creditSpends.refundedAt }).from(creditSpends).where(eq(creditSpends.idempotencyKey, key));
  return spend?.refundedAt ? `${key}:hand` : key;
}

async function suggestionFor(websiteId: string, id: string) {
  const [row] = await db
    .select()
    .from(socialSuggestions)
    .where(and(eq(socialSuggestions.id, id), eq(socialSuggestions.websiteId, websiteId)));
  return row ?? null;
}

/** The customer's edited text, held to the platform's length and the account's warm-up. */
async function checkEdit(
  websiteId: string,
  row: typeof socialSuggestions.$inferSelect,
  edit: Edit,
): Promise<SocialResult<{ body: string; title: string | null }>> {
  const platform = row.platform as SocialPlatform;
  const text = postText(platform, row.title, edit);
  if (!text.ok) return fail(text.error);
  const { body, title } = text;
  const [site] = await db.select({ brandName: websites.brandName, domain: websites.domain }).from(websites).where(eq(websites.id, websiteId));
  const [account] = await db
    .select({ warmupEndsAt: socialAccounts.warmupEndsAt })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, platform)));
  const warmup = account ? inWarmup(account) : row.warmup;
  const check = checkDraft({ platform, title, body, link: row.link }, { warmup, brandName: site?.brandName, domain: site?.domain ?? "" });
  if (!check.ok) {
    if (check.reason === "link during the warm-up") return fail("warmup_link");
    if (check.reason === "brand name during the warm-up") return fail("warmup_brand");
    if (check.reason === "too long" || check.reason === "title too long") return fail("too_long");
    if (check.reason === "empty") return fail("empty");
    return fail("bad_link");
  }
  // A reply that names the business, edited in by the customer or not, only where lib/social/mention.ts allows it.
  if (row.kind === "reply" && site && namesBrand(`${title ?? ""}
${body}`, site) && !(await replyMayMention(websiteId, row, site, warmup))) {
    return fail("mention_not_allowed");
  }
  return { ok: true, data: { body, title } };
}

/**
 * Whether this reply may name the business (lib/social/mention.ts): past the
 * warm-up, in a discussion that asks for recommendations, in a community that
 * allows it, and within the platform's one reply in ten of the window - this
 * reply left out of the count it is checked against.
 */
async function replyMayMention(
  websiteId: string,
  row: typeof socialSuggestions.$inferSelect,
  brand: { brandName: string | null; domain: string },
  warmup: boolean,
): Promise<boolean> {
  const now = new Date();
  const posted = await db
    .select({ body: socialSuggestions.body, postedAt: socialSuggestions.postedAt })
    .from(socialSuggestions)
    .where(
      and(
        eq(socialSuggestions.websiteId, websiteId),
        eq(socialSuggestions.platform, row.platform),
        eq(socialSuggestions.kind, "reply"),
        eq(socialSuggestions.status, "posted"),
        ne(socialSuggestions.id, row.id),
        gte(socialSuggestions.postedAt, new Date(now.getTime() - MENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000)),
      ),
    );
  return mayMention({
    warmup,
    asks: asksForRecommendations(`${row.threadTitle ?? ""}
${row.threadSnippet ?? ""}`),
    noPromotion: communityOf(row.platform, row.threadUrl).noPromotion,
    history: mentionHistory(posted, brand, now),
  });
}

/**
 * The one-click post: charges its credit (once - a second click on the same
 * suggestion is free; on the Free plan it takes one of the month's posts
 * instead, lib/plans/free-plan-server.ts takeFreePlanPost) and returns where
 * to post it, and whether that page has the text filled in (X, Threads) or the customer pastes it (Quora, and
 * replies on Reddit and Bluesky). The page has already copied the text and
 * opened that same address in the click (post-target.ts): a refusal here
 * charges nothing and moves nothing, and that tab stays open.
 */
export async function postSocialSuggestion(
  websiteId: string,
  id: string,
  edit: Edit,
): Promise<SocialResult<{ url: string; filled: boolean }>> {
  const row = await suggestionFor(websiteId, id);
  if (!row) return fail("not_found");
  const platform = row.platform as SocialPlatform;
  const checked = await guard(websiteId, platform);
  if (!checked.ok) return fail(checked.error);
  if (!ONE_CLICK.includes(row.status)) return fail("already_handled");

  const text = await checkEdit(websiteId, row, edit);
  if (!text.ok) return text;
  const { body, title } = text.data;
  const { url, filled } = postTarget({ platform, threadUrl: row.threadUrl, link: row.link, imageUrl: row.imageUrl }, { body, title });

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(socialSuggestions).where(eq(socialSuggestions.id, id)).for("update");
    if (!locked || !ONE_CLICK.includes(locked.status)) return fail("already_handled");
    const free = await isFreePlanWebsite(websiteId, tx);
    // Already posted: the spend it was charged under, whichever that was.
    const key = locked.status === "posted" && locked.creditSpendKey ? locked.creditSpendKey : await handSpendKey(tx, id);
    if (free) {
      // A second click on a post already counted takes nothing more, as it charges nothing more on a paid plan.
      if (locked.status !== "posted" && !(await takeFreePlanPost(tx, websiteId))) return fail("free_posts_used");
    } else {
      const spent = await spendCredits(tx, {
        organizationId: checked.site.organizationId,
        action: "social_post",
        key,
        websiteId,
      });
      if (!spent.ok) return { ok: false as const, error: "not_enough_credits" as const, price: spent.price, available: spent.available };
    }
    await tx
      .update(socialSuggestions)
      .set({
        status: "posted",
        body,
        title,
        error: null,
        // Free charges nothing: a key left from an earlier, paid charge stays with it.
        creditSpendKey: free ? locked.creditSpendKey : key,
        scheduledFor: null,
        postedAt: locked.postedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(socialSuggestions.id, id));
    return { ok: true as const, data: { url, filled } };
  });
  revalidatePath(pagePath(websiteId));
  return result;
}

/**
 * Skips a suggestion: it is not shown again, and nothing is charged.
 *
 * A SCHEDULED own post is different (client, 2026-11-03: "moves it to
 * Drafts", as his design has it): skipping cancels RepGet's publishing and
 * keeps the post, text and all, under Drafts - where it can be edited and
 * posted later, or skipped for good. The job waiting for its time finds it
 * no longer scheduled and does nothing (publish.ts).
 */
export async function skipSocialSuggestion(websiteId: string, id: string): Promise<SocialResult<{ drafted: boolean }>> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  const now = new Date();
  const drafted = await db
    .update(socialSuggestions)
    .set({ status: "draft", scheduledFor: null, updatedAt: now })
    .where(and(eq(socialSuggestions.id, id), eq(socialSuggestions.websiteId, websiteId), eq(socialSuggestions.status, "scheduled")))
    .returning({ id: socialSuggestions.id });
  if (drafted.length === 0) {
    await db
      .update(socialSuggestions)
      .set({ status: "dismissed", updatedAt: now })
      .where(
        and(
          eq(socialSuggestions.id, id),
          eq(socialSuggestions.websiteId, websiteId),
          inArray(socialSuggestions.status, ["new", "draft", "failed"]),
        ),
      );
  }
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { drafted: drafted.length > 0 } };
}

/**
 * Keeps the customer's edit without posting it: the suggestion moves to
 * Drafts (client's design, 2026-11-03: "Save draft"). Held to the same rules
 * as a post, so a draft can always be posted as saved. A draft stays
 * one-click: RepGet never publishes it, whatever the account's settings
 * (publish.ts takes "scheduled" only). One RepGet could not publish is a
 * suggestion like any other to the customer, so it can be kept too; its error
 * stays on the row for administrators.
 */
export async function saveSocialDraft(websiteId: string, id: string, edit: Edit): Promise<SocialResult> {
  const row = await suggestionFor(websiteId, id);
  if (!row) return fail("not_found");
  const checked = await guard(websiteId, row.platform as SocialPlatform);
  if (!checked.ok) return fail(checked.error);
  if (!DRAFTABLE.includes(row.status)) return fail("already_handled");
  const text = await checkEdit(websiteId, row, edit);
  if (!text.ok) return text;
  const saved = await db
    .update(socialSuggestions)
    .set({ status: "draft", body: text.data.body, title: text.data.title, updatedAt: new Date() })
    .where(
      and(eq(socialSuggestions.id, id), eq(socialSuggestions.websiteId, websiteId), inArray(socialSuggestions.status, DRAFTABLE)),
    )
    .returning({ id: socialSuggestions.id });
  // Posted or skipped in another tab in the meantime.
  if (saved.length === 0) return fail("already_handled");
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Saves an edit to an own post RepGet will publish. */
export async function editScheduledPost(websiteId: string, id: string, edit: Edit): Promise<SocialResult> {
  const row = await suggestionFor(websiteId, id);
  if (!row || row.status !== "scheduled") return fail(row ? "already_handled" : "not_found");
  const checked = await guard(websiteId, row.platform as SocialPlatform);
  if (!checked.ok) return fail(checked.error);
  const text = await checkEdit(websiteId, row, edit);
  if (!text.ok) return text;
  await db
    .update(socialSuggestions)
    .set({ body: text.data.body, title: text.data.title, updatedAt: new Date() })
    .where(and(eq(socialSuggestions.id, id), eq(socialSuggestions.status, "scheduled")));
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}

/** Publishes a scheduled own post now instead of at its time. */
export async function postScheduledNow(websiteId: string, id: string): Promise<SocialResult> {
  const row = await suggestionFor(websiteId, id);
  if (!row || row.status !== "scheduled") return fail(row ? "already_handled" : "not_found");
  const checked = await guard(websiteId, row.platform as SocialPlatform);
  if (!checked.ok) return fail(checked.error);
  const now = new Date();
  await db.update(socialSuggestions).set({ scheduledFor: now, updatedAt: now }).where(eq(socialSuggestions.id, id));
  // The job waiting for the old time finds it already handled when it wakes.
  await queueJob({ name: "social/post.scheduled", data: { suggestionId: id, at: now.toISOString() } });
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: null };
}
