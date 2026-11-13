import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";

import { blogLocale, blogPath, categoryPath } from "@/lib/blog/locale";
import { db, isDatabaseConfigured } from "@/lib/db";
import { user } from "@/lib/db/auth-tables";
import { blogCategories, blogCommentUpvotes, blogComments, blogPosts, blogPostUpvotes } from "@/lib/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Customer stories, comments and upvotes on RepGet's blog (client,
 * 2026-11-11).
 *
 * - Customer stories are PUBLISHED posts in the "Customer stories" category
 *   (address customer-stories; migration 0090 creates it). Each can name the
 *   business it is about (blog_posts.business_*, set in the editor). The
 *   homepage shows the latest three in the visitor's language, and Earn
 *   Credits' "Discover businesses" lists them too.
 * - Any signed-in user can upvote a published post or a shown comment: one
 *   per user and item (unique indexes), toggled on and off.
 * - Any signed-in user can comment: plain text, 1-750 characters, live at
 *   once, a few per user per window (COMMENT_RATE). An administrator can
 *   remove and restore one (lib/admin/blog-comments.ts); its author can
 *   delete their own. Either hides it everywhere and it stops counting.
 *
 * Server-only: user ids come from the caller's session, checked in the
 * actions (lib/blog/engagement-actions.ts) - nothing here trusts a browser.
 */

/** The category's permanent address. */
export const CUSTOMER_STORIES_SLUG = "customer-stories";
/** Its English name, as migration 0090 creates it. */
const CUSTOMER_STORIES_NAME = "Customer stories";

export const COMMENT_MAX = 750;
/** At most `max` comments per user in each window (deleted and removed ones included). */
export const COMMENT_RATE = [
  { windowMs: 10 * 60 * 1000, max: 5 },
  { windowMs: 24 * 60 * 60 * 1000, max: 30 },
] as const;
/** The comments a post's page lists, newest first. */
export const COMMENTS_SHOWN = 200;

export type DiscoverBusiness = {
  postId: string;
  slug: string;
  locale: string;
  title: string;
  /** The business's name; the post's author when none is given. */
  name: string;
  category: string | null;
  /** One short line; the post's description when none is given. */
  tagline: string;
  websiteUrl: string | null;
  /** The post's featured image. */
  imageUrl: string | null;
  logoUrl: string | null;
  /** The post's public path. */
  href: string;
};

/** A post's description, for the homepage's stories (DiscoverBusiness has the tagline instead). */
export type CustomerStory = DiscoverBusiness & { description: string };

/** Something the caller asked for does not exist (or is not public). */
export class BlogEngagementNotFound extends Error {
  constructor() {
    super("not_found");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

const published = eq(blogPosts.status, "published");

/** True for Postgres's "relation/column does not exist", however the driver wraps it. */
function isMissingSchema(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  const code = e?.code ?? e?.cause?.code;
  return code === "42P01" || code === "42703";
}

/** The Customer stories category (by its address, or its English name if it was made by hand), or null. */
export async function customerStoriesCategory(): Promise<{ name: string; slug: string } | null> {
  const [row] = await db
    .select({ name: blogCategories.name, slug: blogCategories.slug })
    .from(blogCategories)
    .where(or(eq(blogCategories.slug, CUSTOMER_STORIES_SLUG), sql`lower(${blogCategories.name}) = ${CUSTOMER_STORIES_NAME.toLowerCase()}`))
    .orderBy(sql`(${blogCategories.slug} = ${CUSTOMER_STORIES_SLUG}) desc`)
    .limit(1);
  return row ?? null;
}

/** "View all customer stories": the category's page in a language. */
export function customerStoriesPath(locale: Locale, slug: string = CUSTOMER_STORIES_SLUG): string {
  return categoryPath(locale, slug);
}

async function storiesIn(category: string, locale: Locale, limit: number) {
  return db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      locale: blogPosts.locale,
      title: blogPosts.title,
      description: blogPosts.description,
      author: blogPosts.author,
      featuredImageUrl: blogPosts.featuredImageUrl,
      businessLogoUrl: blogPosts.businessLogoUrl,
      businessName: blogPosts.businessName,
      businessCategory: blogPosts.businessCategory,
      businessWebsiteUrl: blogPosts.businessWebsiteUrl,
      businessTagline: blogPosts.businessTagline,
    })
    .from(blogPosts)
    .where(and(published, eq(blogPosts.category, category), eq(blogPosts.locale, locale)))
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
    .limit(limit);
}

/**
 * The published customer stories in a language, newest first; the English
 * ones when that language has none (as a language's blog shows the English
 * posts while it has none of its own). Empty when there are none, or no
 * database (a build without one: the homepage hides the section).
 */
export async function listCustomerStories(locale: Locale, limit = 3): Promise<CustomerStory[]> {
  if (!isDatabaseConfigured()) return [];
  const take = Math.max(1, Math.min(100, Math.floor(limit)));
  try {
    const category = await customerStoriesCategory();
    if (!category) return [];
    let rows = await storiesIn(category.name, locale, take);
    if (rows.length === 0 && locale !== DEFAULT_LOCALE) rows = await storiesIn(category.name, DEFAULT_LOCALE, take);
    return rows.map((row) => {
      const rowLocale = blogLocale(row.locale);
      return {
        postId: row.id,
        slug: row.slug,
        locale: rowLocale,
        title: row.title,
        description: row.description,
        name: row.businessName?.trim() || row.author,
        category: row.businessCategory?.trim() || null,
        tagline: row.businessTagline?.trim() || row.description,
        websiteUrl: row.businessWebsiteUrl || null,
        imageUrl: row.featuredImageUrl || null,
        logoUrl: row.businessLogoUrl || null,
        href: blogPath(rowLocale, row.slug),
      };
    });
  } catch (error) {
    // Code deployed before migration 0090: no stories rather than a failed build.
    if (!isMissingSchema(error)) throw error;
    console.warn("[blog/engagement] the customer stories columns do not exist yet (migration 0090): showing none");
    return [];
  }
}

/**
 * The homepage's Customer stories (built ahead, like its other data): the
 * latest three in the visitor's language with the English fallback, and
 * "View all customer stories" - the category's page in that language. Null
 * when there are none: the section is hidden.
 *
 * When the stories shown are the English fallback, "View all" goes to the
 * English page too: the category's page in a language with no stories of its
 * own is empty and noindex, and /de linked it from every German homepage
 * (live audit, 2026-11-13).
 */
export async function homeCustomerStories(locale: Locale): Promise<{ stories: CustomerStory[]; viewAllHref: string } | null> {
  const stories = await listCustomerStories(locale, 3);
  if (stories.length === 0) return null;
  const category = await customerStoriesCategory();
  const pageLocale = stories.some((story) => story.locale === locale) ? locale : DEFAULT_LOCALE;
  return { stories, viewAllHref: customerStoriesPath(pageLocale, category?.slug ?? CUSTOMER_STORIES_SLUG) };
}

/* ------------------------------------------------------------------------- */
/* Upvotes                                                                    */
/* ------------------------------------------------------------------------- */

async function isPublishedPost(postId: string): Promise<boolean> {
  if (!isUuid(postId)) return false;
  const [row] = await db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.id, postId), published)).limit(1);
  return Boolean(row);
}

async function postUpvoteCount(postId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(blogPostUpvotes).where(eq(blogPostUpvotes.postId, postId));
  return row?.n ?? 0;
}

/**
 * Turns the user's upvote on a published post on or off. Idempotent: on
 * twice is one upvote (the unique index decides, so two presses at once
 * cannot make two). Throws BlogEngagementNotFound for a post that is not
 * published.
 */
export async function setPostUpvote(userId: string, postId: string, on: boolean): Promise<{ upvoted: boolean; count: number }> {
  if (!(await isPublishedPost(postId))) throw new BlogEngagementNotFound();
  if (on) {
    await db.insert(blogPostUpvotes).values({ postId, userId }).onConflictDoNothing();
  } else {
    await db.delete(blogPostUpvotes).where(and(eq(blogPostUpvotes.postId, postId), eq(blogPostUpvotes.userId, userId)));
  }
  return { upvoted: on, count: await postUpvoteCount(postId) };
}

/** A comment that is shown: neither removed nor deleted, on a published post. */
const shownComment = and(isNull(blogComments.removedAt), isNull(blogComments.deletedAt));

/** Turns the user's upvote on a shown comment on or off, like a post's. */
export async function setCommentUpvote(userId: string, commentId: string, on: boolean): Promise<{ upvoted: boolean; count: number }> {
  if (!isUuid(commentId)) throw new BlogEngagementNotFound();
  const [comment] = await db
    .select({ id: blogComments.id })
    .from(blogComments)
    .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
    .where(and(eq(blogComments.id, commentId), shownComment, published))
    .limit(1);
  if (!comment) throw new BlogEngagementNotFound();
  if (on) {
    await db.insert(blogCommentUpvotes).values({ commentId, userId }).onConflictDoNothing();
  } else {
    await db.delete(blogCommentUpvotes).where(and(eq(blogCommentUpvotes.commentId, commentId), eq(blogCommentUpvotes.userId, userId)));
  }
  const [row] = await db.select({ n: count() }).from(blogCommentUpvotes).where(eq(blogCommentUpvotes.commentId, commentId));
  return { upvoted: on, count: row?.n ?? 0 };
}

/* ------------------------------------------------------------------------- */
/* Comments                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * A comment as stored: plain text, trimmed, control characters (other than
 * line breaks) dropped, runs of blank lines made one. Its length is counted
 * in characters (code points), as the database's check counts it.
 */
export function cleanCommentBody(raw: unknown): string {
  let text = "";
  for (const char of String(raw ?? "").replace(/\r\n?/g, "\n")) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\n") text += char;
    else if (char === "\t") text += " ";
    else if (code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code < 0xa0)) text += char;
  }
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function commentLength(body: string): number {
  return [...body].length;
}

export type AddCommentResult = { ok: true; commentId: string } | { ok: false; reason: "empty" | "too_long" | "rate_limited" | "not_found" };

/**
 * Adds a comment to a published post, live at once. Checked: 1-750
 * characters, and COMMENT_RATE per user - counted under a per-user lock, so
 * a burst of requests cannot slip past it.
 */
export async function addComment(input: { userId: string; postId: string; body: string }): Promise<AddCommentResult> {
  const body = cleanCommentBody(input.body);
  if (!body) return { ok: false, reason: "empty" };
  if (commentLength(body) > COMMENT_MAX) return { ok: false, reason: "too_long" };
  if (!(await isPublishedPost(input.postId))) return { ok: false, reason: "not_found" };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`blog_comment:${input.userId}`}))`);
    const now = Date.now();
    for (const rule of COMMENT_RATE) {
      const [row] = await tx
        .select({ n: count() })
        .from(blogComments)
        .where(and(eq(blogComments.userId, input.userId), gte(blogComments.createdAt, new Date(now - rule.windowMs))));
      if ((row?.n ?? 0) >= rule.max) return { ok: false as const, reason: "rate_limited" as const };
    }
    const [created] = await tx
      .insert(blogComments)
      .values({ postId: input.postId, userId: input.userId, body })
      .returning({ id: blogComments.id });
    return { ok: true as const, commentId: created.id };
  });
}

/** Deletes the user's own comment (hidden for good; it still counts towards the rate limit). False when it is not theirs or already gone. */
export async function deleteOwnComment(userId: string, commentId: string): Promise<boolean> {
  if (!isUuid(commentId)) return false;
  const rows = await db
    .update(blogComments)
    .set({ deletedAt: new Date() })
    .where(and(eq(blogComments.id, commentId), eq(blogComments.userId, userId), isNull(blogComments.deletedAt)))
    .returning({ id: blogComments.id });
  return rows.length > 0;
}

/** A shown comment, as the post's page lists it. */
export type PublicComment = {
  id: string;
  authorName: string;
  /** ISO timestamp. */
  createdAt: string;
  body: string;
  upvotes: number;
  /** The viewer's own state; false when signed out. */
  upvoted: boolean;
  own: boolean;
};

export type PostEngagement = {
  postId: string;
  upvotes: number;
  upvoted: boolean;
  comments: PublicComment[];
  /** Whether the viewer is signed in. */
  signedIn: boolean;
};

/** A commenter's display name: the account's name, or a neutral fallback for one without. */
function displayName(name: string | null): string {
  const clean = (name ?? "").trim().replace(/\s+/g, " ");
  return clean.slice(0, 80);
}

/**
 * A published post's upvotes and shown comments (newest first), with the
 * viewer's own state when `viewerId` is given. Throws
 * BlogEngagementNotFound for a post that is not published.
 */
export async function postEngagement(postId: string, viewerId: string | null): Promise<PostEngagement> {
  if (!(await isPublishedPost(postId))) throw new BlogEngagementNotFound();
  const commentUpvotes = db
    .select({ commentId: blogCommentUpvotes.commentId, n: count().as("n") })
    .from(blogCommentUpvotes)
    .groupBy(blogCommentUpvotes.commentId)
    .as("comment_upvotes");
  const [upvotes, mine, rows] = await Promise.all([
    postUpvoteCount(postId),
    viewerId
      ? db
          .select({ id: blogPostUpvotes.id })
          .from(blogPostUpvotes)
          .where(and(eq(blogPostUpvotes.postId, postId), eq(blogPostUpvotes.userId, viewerId)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: blogComments.id,
        userId: blogComments.userId,
        body: blogComments.body,
        createdAt: blogComments.createdAt,
        name: user.name,
        upvotes: sql<number>`coalesce(${commentUpvotes.n}, 0)::int`,
      })
      .from(blogComments)
      .innerJoin(user, eq(user.id, blogComments.userId))
      .leftJoin(commentUpvotes, eq(commentUpvotes.commentId, blogComments.id))
      .where(and(eq(blogComments.postId, postId), shownComment))
      .orderBy(desc(blogComments.createdAt), desc(blogComments.id))
      .limit(COMMENTS_SHOWN),
  ]);
  const ids = rows.map((row) => row.id);
  const upvotedComments = new Set(
    viewerId && ids.length > 0
      ? (
          await db
            .select({ commentId: blogCommentUpvotes.commentId })
            .from(blogCommentUpvotes)
            .where(and(eq(blogCommentUpvotes.userId, viewerId), inArray(blogCommentUpvotes.commentId, ids)))
        ).map((row) => row.commentId)
      : [],
  );
  return {
    postId,
    upvotes,
    upvoted: mine.length > 0,
    signedIn: viewerId !== null,
    comments: rows.map((row) => ({
      id: row.id,
      authorName: displayName(row.name),
      createdAt: row.createdAt.toISOString(),
      body: row.body,
      upvotes: Number(row.upvotes),
      upvoted: upvotedComments.has(row.id),
      own: viewerId !== null && row.userId === viewerId,
    })),
  };
}

/**
 * The user's upvote and comment on each of the posts (any status; a post
 * with neither is listed as false/false). `commented` is a shown comment.
 */
export async function viewerEngagement(userId: string, postIds: string[]): Promise<Record<string, { upvoted: boolean; commented: boolean }>> {
  const ids = [...new Set(postIds.filter(isUuid))];
  const result: Record<string, { upvoted: boolean; commented: boolean }> = {};
  for (const id of postIds) result[id] = { upvoted: false, commented: false };
  if (ids.length === 0) return result;
  const [upvoted, commented] = await Promise.all([
    db
      .select({ postId: blogPostUpvotes.postId })
      .from(blogPostUpvotes)
      .where(and(eq(blogPostUpvotes.userId, userId), inArray(blogPostUpvotes.postId, ids))),
    db
      .selectDistinct({ postId: blogComments.postId })
      .from(blogComments)
      .where(and(eq(blogComments.userId, userId), inArray(blogComments.postId, ids), shownComment)),
  ]);
  for (const row of upvoted) result[row.postId] = { ...result[row.postId], upvoted: true };
  for (const row of commented) result[row.postId] = { ...result[row.postId], commented: true };
  return result;
}

/**
 * How many distinct published customer stories (any language) the user has
 * upvoted, and has a shown comment on: Earn Credits' "Discover businesses".
 */
export async function discoverProgress(userId: string): Promise<{ upvotes: number; comments: number }> {
  const category = await customerStoriesCategory();
  if (!category) return { upvotes: 0, comments: 0 };
  const story = and(published, eq(blogPosts.category, category.name));
  const [[upvotes], [comments]] = await Promise.all([
    db
      .select({ n: sql<number>`count(distinct ${blogPostUpvotes.postId})::int` })
      .from(blogPostUpvotes)
      .innerJoin(blogPosts, eq(blogPosts.id, blogPostUpvotes.postId))
      .where(and(eq(blogPostUpvotes.userId, userId), story)),
    db
      .select({ n: sql<number>`count(distinct ${blogComments.postId})::int` })
      .from(blogComments)
      .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
      .where(and(eq(blogComments.userId, userId), shownComment, story)),
  ]);
  return { upvotes: upvotes?.n ?? 0, comments: comments?.n ?? 0 };
}
