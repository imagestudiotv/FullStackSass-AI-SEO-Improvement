"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction, type AdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { isAiConfigured } from "@/lib/ai/client";
import { blogLocale, blogPath, categoryPath, isBlogLocale, LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import {
  blogSlug,
  categoryText,
  readingMinutes,
  type BlogCategoryInfo,
  type BlogCategoryTranslations,
  type BlogFaq,
  type BlogSource,
} from "@/lib/blog/shared";
import { translateBlogPost, type TranslatableFields } from "@/lib/blog/translate";
import { blogLinkTargets, localizeLinks } from "@/lib/blog/translation-links";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { notifyIndexNow } from "@/lib/indexnow";
import {
  ALLOWED_IMAGE_TYPES,
  isImageStorageConfigured,
  MAX_IMAGE_BYTES,
  storeArticleImage,
} from "@/lib/images/storage";
import {
  BlogPostError as BlogError,
  cleanBlogPost as clean,
  isUniqueViolation,
  oneLine,
  RESERVED_SLUGS,
  type BlogPostInput,
  type CleanBlogPost as Clean,
} from "@/lib/blog/post-fields";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * RepGet's own blog, written in the admin panel: list, edit, publish,
 * unpublish and delete posts. Every action checks admin access on the server
 * and is recorded in the admin audit log.
 *
 * Rules:
 * - Only published posts are public (lib/blog/posts.ts). Publishing is
 *   immediate; a published post's saved changes are live at once.
 * - The slug is locked once a post has been published: every link to it and
 *   its ranking depend on it.
 * - Every save carries the version it started from; a save from an older copy
 *   is refused, so two administrators cannot overwrite each other.
 * - The body and FAQ answers are sanitised like article text: the HTML is
 *   published on RepGet's own site.
 * - Only a post that is not published can be deleted.
 * - Categories are added, renamed and described here too (client,
 *   2026-10-01). A category's address is set when it is created and never
 *   changes; renaming one renames it on its posts; only a category no post
 *   uses can be deleted. Its name and description can be given in each of
 *   the blog's other languages (client, 2026-10-15), shown on that
 *   language's blog; a language without them shows the English.
 * - The search fields (SEO title, keywords, breadcrumb label; client,
 *   2026-10-08) are optional and checked like the rest. Changing only them
 *   does not mark a live post "Updated": readers see the same article.
 * - A change readers can see - publishing, editing a live post, unpublishing,
 *   changing a category with live posts, deleting a category - is reported
 *   to Bing and the other IndexNow engines once saved, naming only the pages
 *   that changed (lib/indexnow.ts; production only, never in the way of the
 *   save). A draft's changes are not: nobody can see them.
 * - Languages (client, 2026-10-09; lib/blog/locale.ts): a post is written in
 *   one language, chosen when it is created. An English post can be given a
 *   translation per language - drafted by AI or copied to translate by hand
 *   (createBlogTranslation) - which is saved as a draft marked "needs
 *   review". It cannot be published until an administrator confirms a
 *   native speaker has read and corrected it (`reviewed` on the save).
 */

export type AdminBlogRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
  updatedBy: string | null;
  locale: Locale;
  /** The English post this translates, or null for an original. */
  translationOf: string | null;
  needsReview: boolean;
};

/** One language of an article, as the editor lists it. */
export type BlogTranslationRow = { id: string; locale: Locale; title: string; slug: string; status: string; needsReview: boolean };

export type { BlogPostInput };

export type AdminBlogPost = AdminBlogRow & {
  description: string;
  seoTitle: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  breadcrumbLabel: string | null;
  author: string;
  shortAnswer: string | null;
  bodyHtml: string;
  faqs: BlogFaq[];
  sources: BlogSource[];
  revisedAt: Date | null;
  version: number;
  /** For an original: its translations, one per language. */
  translations: BlogTranslationRow[];
  /** For a translation: the post it translates. */
  original: BlogTranslationRow | null;
};


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


const TAKEN = (slug: string) => `Another post already uses the address "${slug}" (addresses are unique across languages) - choose another`;

/**
 * The public pages a live post is shown on: its own, its language's blog
 * front page and its category's page in its language - what a publish
 * reports (see notifyIndexNow).
 */
function postPages(locale: Locale, slug: string, categorySlug: string): string[] {
  return [blogPath(locale, slug), blogPath(locale), categoryPath(locale, categorySlug)];
}

const UNREVIEWED =
  "This translation has not been reviewed yet. Have a native speaker read and correct it, then tick “Reviewed by a native speaker” before publishing.";

/**
 * Stored FAQs and sources in the order clean() builds them. Postgres keeps a
 * jsonb object's keys in its own order (shorter first), so a stored
 * {answer, question} never equalled a cleaned {question, answer} and every
 * save of a post with FAQs or sources counted as a change - marking it
 * "Updated" with nothing changed.
 */
function sameFaqs(a: BlogFaq[], b: BlogFaq[]): boolean {
  const key = (faqs: BlogFaq[]) => JSON.stringify(faqs.map((faq) => [faq.question, faq.answer]));
  return key(a) === key(b);
}
function sameSources(a: BlogSource[], b: BlogSource[]): boolean {
  const key = (sources: BlogSource[]) => JSON.stringify(sources.map((source) => [source.label, source.url]));
  return key(a) === key(b);
}

/** Minutes to read, as the post's card on the listing pages shows it. */
function cardMinutes(post: { bodyHtml: string; shortAnswer: string | null; faqs: BlogFaq[] }): number {
  return readingMinutes({ body: post.bodyHtml, shortAnswer: post.shortAnswer ?? undefined, faqs: post.faqs });
}

/** A category's address, by its name; the same fallback the public pages use (lib/blog/posts.ts). */
async function categorySlugByName(tx: Pick<typeof db, "select">, name: string): Promise<string> {
  const [found] = await tx.select({ slug: blogCategories.slug }).from(blogCategories).where(eq(blogCategories.name, name)).limit(1);
  return found?.slug ?? blogSlug(name);
}

function refresh(id?: string) {
  revalidatePath("/admin/blog");
  if (id) revalidatePath(`/admin/blog/${id}`);
}

/** Every post, drafts included, most recently edited first. */
export async function listBlogPostsAdmin(): Promise<AdminBlogRow[]> {
  await requireAdmin();
  return db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      category: blogPosts.category,
      status: blogPosts.status,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      updatedBy: blogPosts.updatedBy,
      locale: blogPosts.locale,
      translationOf: blogPosts.translationOf,
      needsReview: blogPosts.needsReview,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.updatedAt))
    .then((rows) => rows.map((row) => ({ ...row, locale: blogLocale(row.locale) })));
}

const translationRow = {
  id: blogPosts.id,
  locale: blogPosts.locale,
  title: blogPosts.title,
  slug: blogPosts.slug,
  status: blogPosts.status,
  needsReview: blogPosts.needsReview,
};

export async function getBlogPostAdmin(id: string): Promise<AdminBlogPost | null> {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  if (!row) return null;
  const [translations, [original]] = await Promise.all([
    row.translationOf ? Promise.resolve([]) : db.select(translationRow).from(blogPosts).where(eq(blogPosts.translationOf, row.id)).orderBy(asc(blogPosts.locale)),
    row.translationOf ? db.select(translationRow).from(blogPosts).where(eq(blogPosts.id, row.translationOf)).limit(1) : Promise.resolve([]),
  ]);
  const withLocale = (entry: (typeof translations)[number]) => ({ ...entry, locale: blogLocale(entry.locale) });
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    status: row.status,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    description: row.description,
    seoTitle: row.seoTitle,
    primaryKeyword: row.primaryKeyword,
    secondaryKeywords: row.secondaryKeywords,
    breadcrumbLabel: row.breadcrumbLabel,
    author: row.author,
    shortAnswer: row.shortAnswer,
    bodyHtml: row.bodyHtml,
    faqs: row.faqs,
    sources: row.sources,
    revisedAt: row.revisedAt,
    version: row.version,
    locale: blogLocale(row.locale),
    translationOf: row.translationOf,
    needsReview: row.needsReview,
    translations: translations.map(withLocale),
    original: original ? withLocale(original) : null,
  };
}

/**
 * Saves a post and sets its status in one step: "Save draft" and "Publish"
 * for a draft, "Save changes" and "Unpublish" for a published post. A new
 * post (id null) is created.
 */
export async function saveBlogPost(input: {
  id: string | null;
  /** The version the editor opened; ignored for a new post. */
  expectedVersion: number;
  status: "draft" | "published";
  post: BlogPostInput;
  /** A translation marked "needs review": the administrator confirms a native speaker has read and corrected it. */
  reviewed?: boolean;
}): Promise<ActionResult<{ id: string; version: number; slug: string; status: string; needsReview: boolean }>> {
  const admin = await requireAdmin();
  if (input.status !== "draft" && input.status !== "published") return { ok: false, error: "Unknown status" };
  if (input.id !== null && !UUID.test(input.id)) return { ok: false, error: "Post not found" };

  let fields: Clean;
  try {
    fields = clean(input.post, input.status === "published");
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    throw error;
  }

  try {
    const saved = await db.transaction(async (tx) => {
      const now = new Date();
      // Held until this save commits, so the category cannot be deleted or renamed under it.
      const [category] = await tx
        .select({ id: blogCategories.id, slug: blogCategories.slug })
        .from(blogCategories)
        .where(eq(blogCategories.name, fields.category))
        .for("share")
        .limit(1);
      if (!category) throw new BlogError("Choose a category - that one no longer exists");
      const [taken] = await tx.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, fields.slug)).limit(1);

      if (input.id === null) {
        if (taken) throw new BlogError(TAKEN(fields.slug));
        const locale = isBlogLocale(input.post.locale) ? input.post.locale : DEFAULT_LOCALE;
        const [created] = await tx
          .insert(blogPosts)
          .values({
            ...fields,
            locale,
            status: input.status,
            publishedAt: input.status === "published" ? now : null,
            createdBy: admin.email,
            updatedBy: admin.email,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: blogPosts.id, version: blogPosts.version, slug: blogPosts.slug, status: blogPosts.status, needsReview: blogPosts.needsReview });
        await recordAdminAction(
          {
            actorEmail: admin.email,
            action: input.status === "published" ? "blog.post_published" : "blog.post_created",
            targetType: "blog_post",
            targetId: created.id,
            summary: `${input.status === "published" ? "Published" : "Started"} the blog post "${fields.title}"`,
            detail: { slug: fields.slug },
          },
          tx,
        );
        return { saved: created, changedPages: input.status === "published" ? postPages(locale, fields.slug, category.slug) : [] };
      }

      const [current] = await tx.select().from(blogPosts).where(eq(blogPosts.id, input.id)).for("update");
      if (!current) throw new BlogError("Post not found");
      if (current.version !== input.expectedVersion) {
        throw new BlogError(
          "This post was changed after you opened it (by another administrator). Reload it to see the latest version, then make your change again.",
        );
      }
      const locale = blogLocale(current.locale);
      if (current.publishedAt && fields.slug !== current.slug) {
        throw new BlogError(`The address of a published post cannot change - it would break every link to ${blogPath(locale, current.slug)}`);
      }
      if (taken && taken.id !== current.id) throw new BlogError(TAKEN(fields.slug));
      const needsReview = current.needsReview && input.reviewed !== true;
      if (needsReview && input.status === "published") throw new BlogError(UNREVIEWED);

      const contentChanged =
        fields.title !== current.title ||
        fields.description !== current.description ||
        fields.shortAnswer !== current.shortAnswer ||
        fields.bodyHtml !== current.bodyHtml ||
        !sameFaqs(fields.faqs, current.faqs) ||
        !sameSources(fields.sources, current.sources);
      // Seen by search engines (the <title>, structured data, the breadcrumb), not a new version of the article.
      const searchChanged =
        fields.seoTitle !== current.seoTitle ||
        fields.primaryKeyword !== current.primaryKeyword ||
        JSON.stringify(fields.secondaryKeywords) !== JSON.stringify(current.secondaryKeywords) ||
        fields.breadcrumbLabel !== current.breadcrumbLabel;
      const wasLive = current.status === "published";
      const [updated] = await tx
        .update(blogPosts)
        .set({
          ...fields,
          status: input.status,
          publishedAt: current.publishedAt ?? (input.status === "published" ? now : null),
          // A change to a live post is a revision readers and search engines see.
          revisedAt: wasLive && input.status === "published" && contentChanged ? now : current.revisedAt,
          needsReview,
          version: current.version + 1,
          updatedBy: admin.email,
          updatedAt: now,
        })
        .where(eq(blogPosts.id, current.id))
        .returning({ id: blogPosts.id, version: blogPosts.version, slug: blogPosts.slug, status: blogPosts.status, needsReview: blogPosts.needsReview });

      const action: AdminAction =
        !wasLive && input.status === "published"
          ? "blog.post_published"
          : wasLive && input.status === "draft"
            ? "blog.post_unpublished"
            : "blog.post_saved";
      const verb = { "blog.post_published": "Published", "blog.post_unpublished": "Unpublished", "blog.post_saved": "Saved" }[
        action as "blog.post_published" | "blog.post_unpublished" | "blog.post_saved"
      ];
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action,
          targetType: "blog_post",
          targetId: current.id,
          summary: `${verb} the blog post "${fields.title}"${current.needsReview && !needsReview ? " (translation marked reviewed)" : ""}`,
          detail: { slug: fields.slug, version: updated.version, live: input.status === "published", locale, ...(current.needsReview && !needsReview ? { reviewed: true } : {}) },
        },
        tx,
      );

      /*
        Only pages whose content changed are reported (IndexNow asks for no
        more), and a draft never is: nobody can see it.

        The post's own page: when it went live or came down, or a live post's
        text, search fields, author or category changed.

        The listings - the blog's front page and the category pages: when the
        post joined or left them, or its card changed (title, description,
        category, minutes to read). A typo or a new author leaves them as they
        were. The category it is now in is reported only if it is live there;
        the one it was in, only if it has left it.
      */
      const nowLive = input.status === "published";
      const movedCategory = fields.category !== current.category;
      const pageChanged =
        wasLive !== nowLive ||
        (nowLive && (contentChanged || searchChanged || fields.author !== current.author || movedCategory));
      const cardChanged =
        wasLive !== nowLive ||
        (nowLive &&
          (fields.title !== current.title ||
            fields.description !== current.description ||
            movedCategory ||
            cardMinutes(fields) !== cardMinutes(current)));
      const changedPages: string[] = [];
      if (pageChanged) changedPages.push(blogPath(locale, fields.slug));
      if (cardChanged) {
        changedPages.push(blogPath(locale));
        // Its category's page in its own language lists it (/it/blog/category/... for an Italian post).
        if (nowLive) changedPages.push(categoryPath(locale, category.slug));
        if (wasLive && (!nowLive || movedCategory)) {
          changedPages.push(categoryPath(locale, movedCategory ? await categorySlugByName(tx, current.category) : category.slug));
        }
      }
      return { saved: updated, changedPages };
    });
    refresh(saved.saved.id);
    notifyIndexNow(saved.changedPages);
    return { ok: true, data: saved.saved };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: TAKEN(fields.slug) };
    throw error;
  }
}

/** Deletes a post that is not published. A live post is unpublished first. */
export async function deleteBlogPost(input: { id: string; expectedVersion: number }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(input.id)) return { ok: false, error: "Post not found" };
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(blogPosts).where(eq(blogPosts.id, input.id)).for("update");
      if (!current) throw new BlogError("Post not found");
      if (current.version !== input.expectedVersion) {
        throw new BlogError("This post was changed after you opened it. Reload it and try again.");
      }
      /*
        Only a post that is not live can go, so deleting changes no public
        page: a post that was once live was reported when it was unpublished.
      */
      if (current.status === "published") throw new BlogError("Unpublish the post before deleting it");
      await tx.delete(blogPosts).where(eq(blogPosts.id, current.id));
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "blog.post_deleted",
          targetType: "blog_post",
          targetId: current.id,
          summary: `Deleted the blog post "${current.title}"`,
          detail: { slug: current.slug, everPublished: current.publishedAt !== null },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    throw error;
  }
  refresh();
  return { ok: true, data: null };
}

/** The fields an article's translation is made from. */
function translatable(row: typeof blogPosts.$inferSelect): TranslatableFields {
  return {
    title: row.title,
    seoTitle: row.seoTitle ?? "",
    description: row.description,
    shortAnswer: row.shortAnswer ?? "",
    breadcrumbLabel: row.breadcrumbLabel ?? "",
    primaryKeyword: row.primaryKeyword ?? "",
    secondaryKeywords: row.secondaryKeywords,
    bodyHtml: row.bodyHtml,
    faqs: row.faqs,
  };
}

/**
 * Starts the translation of an English post into another language, as a
 * draft marked "needs review" (see the rules at the top), and returns its
 * id. `mode` "ai" drafts it with AI (lib/blog/translate.ts) - a minute or
 * two for a long post; "copy" copies the English text, to translate by hand.
 * A language that already has a translation returns that one instead.
 *
 * The draft keeps the original's category, author and sources. Its address
 * is made from the translated title (unique across languages: the language
 * code is added when the plain one is taken).
 */
export async function createBlogTranslation(input: {
  sourceId: string;
  locale: string;
  mode: "ai" | "copy";
}): Promise<ActionResult<{ id: string; existed: boolean }>> {
  const admin = await requireAdmin();
  if (!UUID.test(input.sourceId)) return { ok: false, error: "Post not found" };
  if (!isBlogLocale(input.locale) || input.locale === DEFAULT_LOCALE) return { ok: false, error: "Choose a language to translate into" };
  if (input.mode !== "ai" && input.mode !== "copy") return { ok: false, error: "Unknown way to translate" };
  const locale = input.locale;

  const [source] = await db.select().from(blogPosts).where(eq(blogPosts.id, input.sourceId)).limit(1);
  if (!source) return { ok: false, error: "Post not found" };
  if (source.translationOf || blogLocale(source.locale) !== DEFAULT_LOCALE) {
    return { ok: false, error: "Translations are made from the English post" };
  }
  const existing = async () =>
    (await db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.translationOf, source.id), eq(blogPosts.locale, locale))).limit(1))[0];
  const already = await existing();
  if (already) return { ok: true, data: { id: already.id, existed: true } };

  let content: TranslatableFields & { slug: string };
  if (input.mode === "ai") {
    if (!isAiConfigured()) return { ok: false, error: "AI is not set up on this server (ANTHROPIC_API_KEY). Copy the post to translate it by hand instead." };
    try {
      content = await translateBlogPost(translatable(source), DEFAULT_LOCALE, locale);
    } catch (error) {
      console.error("[admin/blog] AI translation failed", error);
      return { ok: false, error: `The ${LANGUAGE_NAMES_EN[locale]} draft could not be written: ${error instanceof Error ? error.message : "the AI did not answer"}. Try again, or copy the post to translate it by hand.` };
    }
  } else {
    content = { ...translatable(source), slug: `${source.slug}-${locale}` };
  }
  // Its links lead to that language's pages, not the English ones (client, 2026-10-20; lib/blog/translation-links.ts).
  const links = await blogLinkTargets(locale);
  content = {
    ...content,
    bodyHtml: localizeLinks(content.bodyHtml, locale, links),
    faqs: content.faqs.map((faq) => ({ ...faq, answer: localizeLinks(faq.answer, locale, links) })),
  };

  let fields: Clean;
  try {
    fields = clean(
      {
        ...content,
        slug: blogSlug(content.slug) || blogSlug(content.title),
        category: source.category,
        author: source.author,
        sources: source.sources,
      },
      false,
    );
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: `The ${LANGUAGE_NAMES_EN[locale]} draft could not be saved: ${error.message}` };
    throw error;
  }

  try {
    const created = await db.transaction(async (tx) => {
      // The plain address, then with the language code, then numbered: never another post's.
      const candidates = [fields.slug, `${fields.slug}-${locale}`, ...[2, 3, 4, 5].map((n) => `${fields.slug}-${locale}-${n}`)];
      let slug: string | null = null;
      for (const candidate of candidates) {
        const [taken] = await tx.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, candidate)).limit(1);
        if (!taken && !RESERVED_SLUGS.has(candidate)) {
          slug = candidate;
          break;
        }
      }
      if (!slug) throw new BlogError("Every address tried for the translation is taken. Rename the English post's address, then try again.");
      const now = new Date();
      const [row] = await tx
        .insert(blogPosts)
        .values({
          ...fields,
          slug,
          locale,
          translationOf: source.id,
          needsReview: true,
          status: "draft",
          createdBy: admin.email,
          updatedBy: admin.email,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: blogPosts.id });
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "blog.translation_created",
          targetType: "blog_post",
          targetId: row.id,
          summary: `Started the ${LANGUAGE_NAMES_EN[locale]} translation of "${source.title}" (${input.mode === "ai" ? "AI draft" : "copied to translate by hand"})`,
          detail: { source: source.id, locale, mode: input.mode, slug },
        },
        tx,
      );
      return row;
    });
    refresh(source.id);
    return { ok: true, data: { id: created.id, existed: false } };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    // Two administrators asked at once: the other one's draft is the translation.
    if (isUniqueViolation(error)) {
      const other = await existing();
      if (other) return { ok: true, data: { id: other.id, existed: true } };
    }
    throw error;
  }
}

/**
 * Stores a picture pasted, dropped or chosen in the post editor, or uploaded
 * on the Images page, and returns its address. In the article-image bucket,
 * under blog/ - never under a customer's folder - in the folder of the
 * language it is for, sent as "locale": the post's, or the one chosen on the
 * Images page. Each language's posts are suggested its own pictures
 * (lib/admin/blog-images.ts). Without a language, the blog folder itself, as
 * before languages.
 */
export async function uploadBlogImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  if (!isImageStorageConfigured()) return { ok: false, error: "Image storage is not set up yet" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) return { ok: false, error: "Use a PNG, JPEG or WebP image" };
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is ${Math.round(file.size / 1024 / 1024)}MB. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
    };
  }
  const language = formData.get("locale");
  const folder = isBlogLocale(language) ? `posts/${language}` : "posts";
  // Named after the file it came from, "keyword-planner-steps.webp" (client, 2026-10-20); a pasted "image.png" gets a time-and-random name.
  const url = await storeArticleImage("blog", folder, Buffer.from(await file.arrayBuffer()), file.type, file.name.replace(/\.[a-z0-9]+$/i, ""));
  return { ok: true, data: { url } };
}

/* ------------------------------------------------------------------------ */
/* Categories                                                                */
/* ------------------------------------------------------------------------ */

export type AdminBlogCategory = BlogCategoryInfo & {
  id: string;
  /** Posts in it, drafts included. */
  posts: number;
  /** Its name and description in the other languages; a missing one shows the English (client, 2026-10-15). */
  translations: BlogCategoryTranslations;
};

/** The languages a category is translated into: every one the blog has but English. */
const TRANSLATED_LOCALES = LOCALES.filter((locale): locale is keyof BlogCategoryTranslations => locale !== DEFAULT_LOCALE);

/** Every category with how many posts use it, in the blog's order. */
export async function listBlogCategoriesAdmin(): Promise<AdminBlogCategory[]> {
  await requireAdmin();
  return db
    .select({
      id: blogCategories.id,
      name: blogCategories.name,
      slug: blogCategories.slug,
      blurb: blogCategories.blurb,
      translations: blogCategories.translations,
      posts: sql<number>`(select count(*)::int from blog_posts p where p.category = ${blogCategories.name})`,
    })
    .from(blogCategories)
    .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));
}

/**
 * Name and description, tidied and checked, and the same for each language
 * typed in. A language left blank is dropped, so it shows the English name
 * and description; one with only a description keeps the English name.
 */
function cleanCategory(input: { name: unknown; blurb: unknown; translations?: unknown }): {
  name: string;
  blurb: string;
  translations: BlogCategoryTranslations;
} {
  const name = oneLine(input.name);
  if (!name) throw new BlogError("Give the category a name");
  if (name.length > 40) throw new BlogError("Keep the name under 40 characters - it is shown as a chip and a heading");
  if (!blogSlug(name)) throw new BlogError("The name needs letters or numbers");
  const blurb = oneLine(input.blurb).slice(0, 200);

  const given = input.translations && typeof input.translations === "object" ? (input.translations as Record<string, unknown>) : {};
  const translations: BlogCategoryTranslations = {};
  for (const locale of TRANSLATED_LOCALES) {
    const entry = given[locale] && typeof given[locale] === "object" ? (given[locale] as { name?: unknown; blurb?: unknown }) : {};
    const translatedName = oneLine(entry.name);
    const translatedBlurb = oneLine(entry.blurb).slice(0, 200);
    if (translatedName.length > 40) {
      throw new BlogError(`Keep the ${LANGUAGE_NAMES_EN[locale]} name under 40 characters - it is shown as a chip and a heading`);
    }
    if (translatedName || translatedBlurb) translations[locale] = { name: translatedName, blurb: translatedBlurb };
  }
  return { name, blurb, translations };
}

/** Another category already called this (in any letter case), or null. */
async function sameName(tx: Pick<typeof db, "select">, name: string, except: string | null) {
  const [row] = await tx
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(sql`lower(${blogCategories.name}) = lower(${name})${except ? sql` and ${blogCategories.id} <> ${except}` : sql``}`)
    .limit(1);
  return row ?? null;
}

/**
 * Two categories shown under the same name in a language would be two chips
 * reading the same: refused like a duplicate English name. Compares the names
 * as each language's blog shows them (a missing translation is the English).
 */
async function sameNameInALanguage(
  tx: Pick<typeof db, "select">,
  category: { name: string; translations: BlogCategoryTranslations },
  except: string | null,
): Promise<string | null> {
  const others = await tx
    .select({ id: blogCategories.id, name: blogCategories.name, translations: blogCategories.translations })
    .from(blogCategories);
  for (const locale of TRANSLATED_LOCALES) {
    const shown = categoryText({ ...category, blurb: "" }, locale).name.toLowerCase();
    const clash = others.find((other) => other.id !== except && categoryText({ ...other, blurb: "" }, locale).name.toLowerCase() === shown);
    if (clash) {
      const language = LANGUAGE_NAMES_EN[locale];
      const taken = `In ${language}, "${clash.name}" is already shown as "${categoryText({ ...clash, blurb: "" }, locale).name}"`;
      // Its own name there was typed in: that is what to change. Otherwise it is showing its English name there.
      return category.translations[locale]?.name?.trim()
        ? `${taken} - give this one a different ${language} name`
        : `${taken} - give this one ${/^[AEIOU]/.test(language) ? "an" : "a"} ${language} name of its own under "In other languages", or choose a different name`;
    }
  }
  return null;
}

function refreshCategories(slug?: string) {
  revalidatePath("/admin/blog");
  for (const locale of LOCALES) {
    revalidatePath(blogPath(locale));
    if (slug) revalidatePath(categoryPath(locale, slug));
  }
}

/**
 * Adds a category, last in the order. Its address (/blog/category/<slug>) is
 * made from the name now and never changes; it is the same in every language
 * (/it/blog/category/<slug>). Its other languages are optional here and can
 * be filled in later (saveBlogCategory).
 */
export async function createBlogCategory(input: {
  name: string;
  blurb: string;
  translations?: BlogCategoryTranslations;
}): Promise<ActionResult<AdminBlogCategory>> {
  const admin = await requireAdmin();
  try {
    const { name, blurb, translations } = cleanCategory(input);
    const slug = blogSlug(name);
    const created = await db.transaction(async (tx) => {
      if (await sameName(tx, name, null)) throw new BlogError(`There is already a category called "${name}"`);
      const clash = await sameNameInALanguage(tx, { name, translations }, null);
      if (clash) throw new BlogError(clash);
      const [taken] = await tx.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
      if (taken) throw new BlogError(`Another category already uses the address /blog/category/${slug} - choose a different name`);
      const [last] = await tx.select({ order: sql<number>`coalesce(max(${blogCategories.sortOrder}), -1)::int` }).from(blogCategories);
      const [row] = await tx
        .insert(blogCategories)
        .values({ name, slug, blurb, translations, sortOrder: (last?.order ?? -1) + 1 })
        .returning({ id: blogCategories.id });
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "blog.category_created",
          targetType: "blog_category",
          targetId: row.id,
          summary: `Added the blog category "${name}"`,
          detail: { slug },
        },
        tx,
      );
      return { id: row.id, name, slug, blurb, translations, posts: 0 };
    });
    refreshCategories(slug);
    return { ok: true, data: created };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "That category already exists" };
    throw error;
  }
}

/**
 * Renames a category, changes its description or its names and descriptions
 * in the other languages. Its posts follow a new name in the same
 * transaction; its address stays.
 */
export async function saveBlogCategory(input: {
  id: string;
  name: string;
  blurb: string;
  translations?: BlogCategoryTranslations;
}): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(input.id)) return { ok: false, error: "Category not found" };
  try {
    const cleaned = cleanCategory(input);
    const { name, blurb } = cleaned;
    const changedPages: string[] = [];
    const slug = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(blogCategories).where(eq(blogCategories.id, input.id)).for("update");
      if (!current) throw new BlogError("Category not found");
      // Sent without them (a page open from before they existed): kept as they are, not wiped.
      const translations = input.translations === undefined ? current.translations : cleaned.translations;
      if (await sameName(tx, name, current.id)) throw new BlogError(`There is already a category called "${name}"`);
      const clash = await sameNameInALanguage(tx, { name, translations }, current.id);
      if (clash) throw new BlogError(clash);
      await tx.update(blogCategories).set({ name, blurb, translations, updatedAt: new Date() }).where(eq(blogCategories.id, current.id));
      if (name !== current.name) {
        await tx.update(blogPosts).set({ category: name }).where(eq(blogPosts.category, current.name));
      }

      /*
        Reported only in a language where the category has live posts -
        without them its page there is not in the sitemap - and only where
        what that language shows changed (a new English name also changes the
        languages without a translation). Its page shows the name and
        description; a new name also shows on the language's blog front page
        and on each of its live posts.
      */
      const live = await tx
        .select({ slug: blogPosts.slug, locale: blogPosts.locale })
        .from(blogPosts)
        .where(and(eq(blogPosts.category, name), eq(blogPosts.status, "published")));
      for (const locale of LOCALES) {
        const posts = live.filter((post) => blogLocale(post.locale) === locale);
        if (posts.length === 0) continue;
        const before = categoryText(current, locale);
        const after = categoryText({ name, blurb, translations }, locale);
        if (before.name === after.name && before.blurb === after.blurb) continue;
        changedPages.push(categoryPath(locale, current.slug));
        if (before.name !== after.name) changedPages.push(blogPath(locale), ...posts.map((post) => blogPath(locale, post.slug)));
      }
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "blog.category_saved",
          targetType: "blog_category",
          targetId: current.id,
          summary: name !== current.name ? `Renamed the blog category "${current.name}" to "${name}"` : `Changed the blog category "${name}"`,
          detail: { slug: current.slug, previousName: current.name },
        },
        tx,
      );
      return current.slug;
    });
    refreshCategories(slug);
    notifyIndexNow(changedPages);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "There is already a category with that name" };
    throw error;
  }
}

/**
 * Deletes a category no post uses (drafts included). Its page in every
 * language (/blog/category/<slug>, /it/blog/category/<slug>...) stops
 * existing, which is reported (IndexNow takes gone pages too): each may have
 * been listed while it had live posts in its language.
 */
export async function deleteBlogCategory(input: { id: string }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(input.id)) return { ok: false, error: "Category not found" };
  try {
    const slug = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(blogCategories).where(eq(blogCategories.id, input.id)).for("update");
      if (!current) throw new BlogError("Category not found");
      const [used] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(blogPosts)
        .where(eq(blogPosts.category, current.name));
      if ((used?.n ?? 0) > 0) {
        throw new BlogError(
          `"${current.name}" still has ${used.n} post${used.n === 1 ? "" : "s"} (drafts included). Move them to another category first.`,
        );
      }
      await tx.delete(blogCategories).where(eq(blogCategories.id, current.id));
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "blog.category_deleted",
          targetType: "blog_category",
          targetId: current.id,
          summary: `Deleted the blog category "${current.name}"`,
          detail: { slug: current.slug },
        },
        tx,
      );
      return current.slug;
    });
    refreshCategories(slug);
    // Gone in every language, like the pages refreshCategories just revalidated.
    notifyIndexNow(LOCALES.map((locale) => categoryPath(locale, slug)));
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    throw error;
  }
}
