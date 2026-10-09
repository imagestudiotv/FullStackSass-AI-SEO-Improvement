import "server-only";

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { BLOG_PAGE_SIZE } from "@/lib/blog/pagination";
import { blogSlug, readingMinutes, type BlogPost } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";

/**
 * The public blog's reads: PUBLISHED posts only. Drafts and unpublished posts
 * exist only in the admin panel (lib/admin/blog.ts); a draft's slug must not
 * answer at /blog/<slug>, or an unfinished post is one guessed URL away.
 *
 * The pages that call these render per request (like the homepage, which
 * reads live prices), so a post published or changed in the admin panel is
 * live at once and a build never needs the database.
 */

type Row = typeof blogPosts.$inferSelect;

/** A date as the blog shows it: the UTC calendar day. */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A stored post in the shape the pages render. `categorySlug` is its
 * category's page address, when the category still exists; a post whose
 * category was renamed away (cannot happen: renaming renames its posts) would
 * fall back to the name made into an address.
 */
export function toBlogPost(row: Row & { publishedAt: Date }, categorySlug: string | null = null): BlogPost {
  const post: BlogPost = {
    slug: row.slug,
    title: row.title,
    seoTitle: row.seoTitle,
    primaryKeyword: row.primaryKeyword,
    secondaryKeywords: row.secondaryKeywords,
    breadcrumbLabel: row.breadcrumbLabel,
    description: row.description,
    category: row.category,
    categorySlug: categorySlug ?? blogSlug(row.category),
    publishedAt: day(row.publishedAt),
    // Only a revision on a later day reads as an update.
    updatedAt: row.revisedAt && day(row.revisedAt) > day(row.publishedAt) ? day(row.revisedAt) : undefined,
    author: row.author,
    readingMinutes: 0,
    shortAnswer: row.shortAnswer ?? undefined,
    faqs: row.faqs.length > 0 ? row.faqs : undefined,
    sources: row.sources.length > 0 ? row.sources : undefined,
    body: row.bodyHtml,
  };
  post.readingMinutes = readingMinutes(post);
  return post;
}

const published = eq(blogPosts.status, "published");

/**
 * One page of published posts, newest first, BLOG_PAGE_SIZE to a page
 * (client, 2026-10-08: 30 per page, then the next page), with how many there
 * are in all. For the blog's front page, a category's page (`category`, a
 * name) and an author's page (`author`, any letter case).
 *
 * Posts published at the same moment are ordered by id, so a post never
 * appears on two pages or on none as the pages are walked.
 */
export async function listPostPage(
  page: number,
  filter: { category?: string; author?: string } = {},
): Promise<{ posts: BlogPost[]; total: number }> {
  const only = and(
    filter.category ? eq(blogPosts.category, filter.category) : undefined,
    filter.author ? sql`lower(trim(${blogPosts.author})) = ${filter.author.trim().toLowerCase()}` : undefined,
  );
  const [[count], rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(only ? and(published, only) : published),
    publishedPosts(only)
      .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
      .limit(BLOG_PAGE_SIZE)
      .offset((page - 1) * BLOG_PAGE_SIZE),
  ]);
  return {
    total: count.total,
    posts: rows.flatMap(({ post, categorySlug }) =>
      post.publishedAt ? [toBlogPost({ ...post, publishedAt: post.publishedAt }, categorySlug)] : [],
    ),
  };
}

/**
 * How many published posts each category holds, by name: the front page's
 * chips. Counted in the database, now that the page lists only one page of
 * posts.
 */
export async function publishedCategoryCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: blogPosts.category, count: sql<number>`count(*)::int` })
    .from(blogPosts)
    .where(published)
    .groupBy(blogPosts.category);
  return Object.fromEntries(rows.map((row) => [row.category, row.count]));
}

/** Published posts with their category's page address. */
function publishedPosts(only?: SQL) {
  return db
    .select({ post: blogPosts, categorySlug: blogCategories.slug })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogCategories.name, blogPosts.category))
    .where(only ? and(published, only) : published);
}

/** Every published post, newest first. */
export async function listPosts(): Promise<BlogPost[]> {
  const rows = await publishedPosts().orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id));
  return rows.flatMap(({ post, categorySlug }) =>
    post.publishedAt ? [toBlogPost({ ...post, publishedAt: post.publishedAt }, categorySlug)] : [],
  );
}

/** One published post by slug, or null. */
export async function getPost(slug: string): Promise<BlogPost | null> {
  const [row] = await publishedPosts(eq(blogPosts.slug, slug)).limit(1);
  return row?.post.publishedAt ? toBlogPost({ ...row.post, publishedAt: row.post.publishedAt }, row.categorySlug) : null;
}

/**
 * Posts to read next, excluding the current one.
 *
 * Deliberately simple: the newest others, same category first - someone
 * reading a playbook wants the next playbook - then anything else, so the
 * section is never short on a small blog.
 */
export async function relatedPosts(current: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = (await listPosts()).filter((post) => post.slug !== current.slug);
  return [
    ...others.filter((post) => post.category === current.category),
    ...others.filter((post) => post.category !== current.category),
  ].slice(0, limit);
}
