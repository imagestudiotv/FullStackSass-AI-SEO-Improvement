import "server-only";

import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";

import { BLOG_PAGE_SIZE } from "@/lib/blog/pagination";
import { blogLocale, blogPath } from "@/lib/blog/locale";
import { blogSlug, categoryText, readingMinutes, type BlogCategoryTranslations, type BlogPost } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * The public blog's reads: PUBLISHED posts only. Drafts and unpublished posts
 * exist only in the admin panel (lib/admin/blog.ts); a draft's slug must not
 * answer at /blog/<slug>, or an unfinished post is one guessed URL away.
 *
 * The pages that call these render per request (like the homepage, which
 * reads live prices), so a post published or changed in the admin panel is
 * live at once and a build never needs the database.
 *
 * Every read is for ONE language, English unless asked (lib/blog/locale.ts):
 * /blog and its category and author pages list English posts, /it/blog and
 * its category and author pages the Italian ones, and a slug only answers in
 * its own language.
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
 * fall back to the name made into an address. `categoryTranslations` gives
 * the category's name in the post's language (categoryLabel).
 */
export function toBlogPost(
  row: Row & { publishedAt: Date },
  categorySlug: string | null = null,
  categoryTranslations: BlogCategoryTranslations | null = null,
): BlogPost {
  const locale = blogLocale(row.locale);
  const post: BlogPost = {
    slug: row.slug,
    title: row.title,
    seoTitle: row.seoTitle,
    primaryKeyword: row.primaryKeyword,
    secondaryKeywords: row.secondaryKeywords,
    breadcrumbLabel: row.breadcrumbLabel,
    description: row.description,
    category: row.category,
    categoryLabel: categoryText({ name: row.category, blurb: "", translations: categoryTranslations ?? undefined }, locale).name,
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
    locale,
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
  filter: { category?: string; author?: string; locale?: Locale } = {},
): Promise<{ posts: BlogPost[]; total: number }> {
  const only = and(
    eq(blogPosts.locale, filter.locale ?? DEFAULT_LOCALE),
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
    posts: rows.flatMap(toPublished),
  };
}

/**
 * How many published posts each category holds in a language (English unless
 * asked), by name: a blog front page's chips. Counted in the database, now
 * that the page lists only one page of posts.
 */
export async function publishedCategoryCounts(locale: Locale = DEFAULT_LOCALE): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: blogPosts.category, count: sql<number>`count(*)::int` })
    .from(blogPosts)
    .where(and(published, eq(blogPosts.locale, locale)))
    .groupBy(blogPosts.category);
  return Object.fromEntries(rows.map((row) => [row.category, row.count]));
}

/**
 * The languages with at least one published post in a category (by name),
 * English first: the versions of its page, for hreflang - a language's page
 * with nothing in it is not one of them.
 */
export async function publishedCategoryLocales(category: string): Promise<Locale[]> {
  const rows = await db
    .selectDistinct({ locale: blogPosts.locale })
    .from(blogPosts)
    .where(and(published, eq(blogPosts.category, category)));
  const found = new Set(rows.map((row) => blogLocale(row.locale)));
  return LOCALES.filter((locale) => found.has(locale));
}

/** Published posts with their category's page address and its names in the other languages. */
function publishedPosts(only?: SQL) {
  return db
    .select({ post: blogPosts, categorySlug: blogCategories.slug, categoryTranslations: blogCategories.translations })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogCategories.name, blogPosts.category))
    .where(only ? and(published, only) : published);
}

type PublishedRow = Awaited<ReturnType<typeof publishedPosts>>[number];

/** A row of publishedPosts as the pages render it; none while it has no publication date (cannot happen when published). */
function toPublished({ post, categorySlug, categoryTranslations }: PublishedRow): BlogPost[] {
  return post.publishedAt ? [toBlogPost({ ...post, publishedAt: post.publishedAt }, categorySlug, categoryTranslations)] : [];
}

/** Every published post in a language (English unless asked), newest first. */
export async function listPosts(locale: Locale = DEFAULT_LOCALE): Promise<BlogPost[]> {
  const rows = await publishedPosts(eq(blogPosts.locale, locale)).orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id));
  return rows.flatMap(toPublished);
}

/** One published post by slug, in a language (English unless asked), or null. */
export async function getPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<BlogPost | null> {
  const [row] = await publishedPosts(and(eq(blogPosts.slug, slug), eq(blogPosts.locale, locale))).limit(1);
  return row ? (toPublished(row)[0] ?? null) : null;
}

/**
 * One published post by slug in whichever language it is written - slugs are
 * unique across languages - or null. For what is keyed by the slug alone, a
 * "Get Featured" request (lib/blog/sponsorship.ts): its `locale` says where
 * the post lives.
 */
export async function getPostInAnyLanguage(slug: string): Promise<BlogPost | null> {
  const [row] = await publishedPosts(eq(blogPosts.slug, slug)).limit(1);
  return row ? (toPublished(row)[0] ?? null) : null;
}

/** A published version of an article in one language: where it lives. */
export type PostVersion = { locale: Locale; path: string };

/**
 * Every PUBLISHED language of the article a post belongs to - the English
 * original and its translations, the post itself included - for hreflang
 * and the post's "Also in" line. Drafts never appear: a link to one would be
 * a 404.
 */
export async function postVersions(slug: string, locale: Locale): Promise<PostVersion[]> {
  const [self] = await db
    .select({ id: blogPosts.id, translationOf: blogPosts.translationOf })
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.locale, locale), published))
    .limit(1);
  if (!self) return [];
  const root = self.translationOf ?? self.id;
  const rows = await db
    .select({ slug: blogPosts.slug, locale: blogPosts.locale })
    .from(blogPosts)
    .where(and(published, or(eq(blogPosts.id, root), eq(blogPosts.translationOf, root))));
  return rows
    .map((row) => ({ locale: blogLocale(row.locale), path: blogPath(blogLocale(row.locale), row.slug) }))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

/** The languages, other than English, with at least one published post: their blog pages exist. */
export async function publishedLocales(): Promise<Locale[]> {
  const rows = await db.selectDistinct({ locale: blogPosts.locale }).from(blogPosts).where(published);
  return rows.map((row) => blogLocale(row.locale)).filter((locale) => locale !== DEFAULT_LOCALE);
}

/**
 * Posts to read next, excluding the current one.
 *
 * Deliberately simple: the newest others, same category first - someone
 * reading a playbook wants the next playbook - then anything else, so the
 * section is never short on a small blog.
 */
export async function relatedPosts(current: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = (await listPosts(current.locale ?? DEFAULT_LOCALE)).filter((post) => post.slug !== current.slug);
  return [
    ...others.filter((post) => post.category === current.category),
    ...others.filter((post) => post.category !== current.category),
  ].slice(0, limit);
}
