"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import { spendCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { socialAccounts, socialSuggestions, socialTeams, websites } from "@/lib/db/schema";
import { siteUrl } from "@/lib/site-url";
import { requireEditor } from "@/lib/websites/require-editor";

import { connectUsername, ensureTeam, inWarmup, removeAccount, socialAccess } from "./accounts";
import { disconnectAccount, isBundleConfigured, portalLink } from "./bundle";
import {
  cleanUsername,
  composeUrl,
  isSocialPlatform,
  PLATFORMS,
  replyUrl,
  threadFromUrl,
  type SocialPlatform,
} from "./platforms";
import { checkDraft } from "./rules";

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
  | "bad_link"
  | "not_enough_credits"
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

type Edit = { body: string; title?: string | null };

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
  const body = edit.body.trim();
  const title = edit.title === undefined ? row.title : edit.title?.trim() || null;
  if (!body) return fail("empty");
  if (body.length > PLATFORMS[platform].maxLength || (title && PLATFORMS[platform].titleMax && title.length > PLATFORMS[platform].titleMax!)) {
    return fail("too_long");
  }
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
  return { ok: true, data: { body, title } };
}

/**
 * The one-click post: charges its credit (once - a second click on the same
 * suggestion is free) and returns where to post it. The page has already
 * copied the text and opened a window; it sends that window here.
 */
export async function postSocialSuggestion(websiteId: string, id: string, edit: Edit): Promise<SocialResult<{ url: string }>> {
  const row = await suggestionFor(websiteId, id);
  if (!row) return fail("not_found");
  const platform = row.platform as SocialPlatform;
  const checked = await guard(websiteId, platform);
  if (!checked.ok) return fail(checked.error);
  if (!["new", "failed", "posted"].includes(row.status)) return fail("already_handled");

  const text = await checkEdit(websiteId, row, edit);
  if (!text.ok) return text;
  const { body, title } = text.data;
  const thread = row.threadUrl ? threadFromUrl(platform, row.threadUrl) : null;
  const url = thread ? replyUrl(thread, body) : composeUrl(platform, { title, body, link: row.link, imageUrl: row.imageUrl });

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(socialSuggestions).where(eq(socialSuggestions.id, id)).for("update");
    if (!locked || !["new", "failed", "posted"].includes(locked.status)) return fail("already_handled");
    const spent = await spendCredits(tx, {
      organizationId: checked.site.organizationId,
      action: "social_post",
      key: `social:${id}`,
      websiteId,
    });
    if (!spent.ok) return { ok: false as const, error: "not_enough_credits" as const, price: spent.price, available: spent.available };
    await tx
      .update(socialSuggestions)
      .set({
        status: "posted",
        body,
        title,
        error: null,
        creditSpendKey: `social:${id}`,
        postedAt: locked.postedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(socialSuggestions.id, id));
    return { ok: true as const, data: { url } };
  });
  revalidatePath(pagePath(websiteId));
  return result;
}

/** Skips a suggestion: it is not shown again, and nothing is charged. */
export async function skipSocialSuggestion(websiteId: string, id: string): Promise<SocialResult> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  await db
    .update(socialSuggestions)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(socialSuggestions.id, id),
        eq(socialSuggestions.websiteId, websiteId),
        inArray(socialSuggestions.status, ["new", "scheduled", "failed"]),
      ),
    );
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
