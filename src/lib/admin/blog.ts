"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction, type AdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import {
  blogSlug,
  FAQ_ANSWER_LIMIT,
  hasText,
  readingMinutes,
  TEAM_AUTHOR,
  type BlogCategory,
  type BlogCategoryInfo,
  type BlogFaq,
  type BlogSource,
} from "@/lib/blog/shared";
import { SEARCH_LIMITS, secondaryKeywordList } from "@/lib/blog/keywords";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";
import { notifyIndexNow } from "@/lib/indexnow";
import {
  ALLOWED_IMAGE_TYPES,
  isImageStorageConfigured,
  MAX_IMAGE_BYTES,
  storeArticleImage,
} from "@/lib/images/storage";
import { siteUrl } from "@/lib/site-url";
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
 *   uses can be deleted.
 * - The search fields (SEO title, keywords, breadcrumb label; client,
 *   2026-10-08) are optional and checked like the rest. Changing only them
 *   does not mark a live post "Updated": readers see the same article.
 * - A change readers can see - publishing, editing a live post, unpublishing,
 *   changing a category with live posts, deleting a category - is reported
 *   to Bing and the other IndexNow engines once saved, naming only the pages
 *   that changed (lib/indexnow.ts; production only, never in the way of the
 *   save). A draft's changes are not: nobody can see them.
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
};

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
};

export type BlogPostInput = {
  title: string;
  /** Empty: made from the title. */
  slug: string;
  description: string;
  /** Empty: the browser and search title is the title (lib/blog/keywords.ts). */
  seoTitle: string;
  primaryKeyword: string;
  /** As typed: tidied, and repeats dropped, on save. */
  secondaryKeywords: string[];
  /** Empty: the breadcrumb ends with the title. */
  breadcrumbLabel: string;
  category: string;
  author: string;
  shortAnswer: string;
  bodyHtml: string;
  faqs: BlogFaq[];
  sources: BlogSource[];
};

/** Paths under /blog that are not posts. */
const RESERVED_SLUGS = new Set(["category", "author", "sponsorship"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class BlogError extends Error {}

/** Links to RepGet's own site stay followed internal links (see sanitize.ts). */
function siteHosts(): Set<string> {
  const host = new URL(siteUrl()).hostname.toLowerCase();
  return new Set([host, host.startsWith("www.") ? host.slice(4) : `www.${host}`]);
}

type Clean = {
  title: string;
  slug: string;
  description: string;
  seoTitle: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  breadcrumbLabel: string | null;
  category: BlogCategory;
  author: string;
  shortAnswer: string | null;
  bodyHtml: string;
  faqs: BlogFaq[];
  sources: BlogSource[];
};

/** Validates and tidies what the editor sent; `publishing` also requires what a live post needs. */
function clean(input: BlogPostInput, publishing: boolean): Clean {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) throw new BlogError("Give the post a title");

  const slug = blogSlug(String(input.slug ?? "").trim() || title);
  if (!slug) throw new BlogError("Give the post an address (slug) with letters or numbers");
  if (RESERVED_SLUGS.has(slug)) throw new BlogError(`"${slug}" is used by the blog itself - choose another address`);

  // That it exists is checked when saving, with the category row locked (saveBlogPost).
  const category = String(input.category ?? "").trim();
  if (!category) throw new BlogError("Choose a category");

  const description = String(input.description ?? "").trim().slice(0, 300);

  const primaryKeyword = oneLine(input.primaryKeyword).slice(0, SEARCH_LIMITS.keyword);
  const secondaryKeywords = secondaryKeywordList(Array.isArray(input.secondaryKeywords) ? input.secondaryKeywords : [], primaryKeyword);
  // Refused rather than cut, like the FAQs: dropping the 31st phrase would lose one the writer meant to keep.
  if (secondaryKeywords.length > SEARCH_LIMITS.secondaryKeywords) {
    throw new BlogError(
      `Up to ${SEARCH_LIMITS.secondaryKeywords} secondary keywords - this post has ${secondaryKeywords.length}. Remove some before saving.`,
    );
  }
  const tooLong = secondaryKeywords.find((keyword) => keyword.length > SEARCH_LIMITS.keyword);
  if (tooLong) {
    throw new BlogError(`The secondary keyword "${tooLong.slice(0, 40)}…" is too long - keep each one under ${SEARCH_LIMITS.keyword} characters`);
  }
  const bodyHtml = sanitizeHtml(String(input.bodyHtml ?? ""), { siteHosts: siteHosts() });

  const faqRows = Array.isArray(input.faqs) ? input.faqs.slice(0, 30) : [];
  const faqs: BlogFaq[] = [];
  for (const [index, faq] of faqRows.entries()) {
    const question = String(faq?.question ?? "").trim().slice(0, 300);
    const answer = sanitizeHtml(String(faq?.answer ?? "").trim(), { siteHosts: siteHosts() });
    // An answer without a word in it ("<p></p>" from an emptied editor) is no answer.
    if (!question && !hasText(answer)) continue;
    if (!question || !hasText(answer)) throw new BlogError("Each FAQ needs both a question and an answer");
    /*
      Refused rather than cut. Cutting at the limit never happened while
      answers came from a textarea with a maxLength; they are the editor's
      HTML now, and the sanitiser neither closes tags nor removes half of
      one: a cut through '<a href="…' would keep the fragment, which on the
      page runs on into the FAQs after it, and a cut before a closing
      </strong> would make the rest of the page bold.

      Measured as stored, not as written. The sanitiser can lengthen what the
      editor writes (each <br> becomes <br />), so an answer written just
      under the limit was stored over it, and from then on every save of the
      post - even one that left the answer alone - was refused. Sanitising
      what is stored changes nothing, so a stored answer always passes again.
      The editor counts the same form (previewHtml) and warns first.
    */
    if (answer.length > FAQ_ANSWER_LIMIT) {
      throw new BlogError(
        `The answer to question ${index + 1} is too long: ${answer.length} characters with its formatting, and the limit is ${FAQ_ANSWER_LIMIT}. Shorten it or split it into two questions.`,
      );
    }
    faqs.push({ question, answer });
  }

  const sourceRows = Array.isArray(input.sources) ? input.sources.slice(0, 30) : [];
  const sources: BlogSource[] = [];
  for (const source of sourceRows) {
    const label = String(source?.label ?? "").trim().slice(0, 200);
    const url = String(source?.url ?? "").trim();
    if (!label && !url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BlogError(`"${url || label}" is not a web address - sources need a full address starting with https://`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new BlogError(`"${url}" is not a web address - sources need a full address starting with https://`);
    }
    sources.push({ label: label || parsed.hostname, url: parsed.toString() });
  }

  if (publishing) {
    if (!description) throw new BlogError("Add a description before publishing - search results and the blog's cards show it");
    if (!hasText(bodyHtml)) throw new BlogError("The post has no text yet");
  }

  return {
    title,
    slug,
    description,
    seoTitle: oneLine(input.seoTitle).slice(0, SEARCH_LIMITS.seoTitle) || null,
    primaryKeyword: primaryKeyword || null,
    secondaryKeywords,
    breadcrumbLabel: oneLine(input.breadcrumbLabel).slice(0, SEARCH_LIMITS.breadcrumb) || null,
    category,
    author: oneLine(input.author).slice(0, 100) || TEAM_AUTHOR,
    shortAnswer: String(input.shortAnswer ?? "").trim().slice(0, 1000) || null,
    bodyHtml,
    faqs,
    sources,
  };
}

/** A one-line field: trimmed, inner runs of spaces made one. */
function oneLine(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/** True for Postgres's unique-violation error, however the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

const TAKEN = (slug: string) => `Another post already uses the address /blog/${slug} - choose another`;

/**
 * The public pages a live post is shown on: its own, the blog's front page and
 * its category's page - what a publish reports (see notifyIndexNow).
 */
function postPages(slug: string, categorySlug: string): string[] {
  return [`/blog/${slug}`, "/blog", `/blog/category/${categorySlug}`];
}

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
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.updatedAt));
}

export async function getBlogPostAdmin(id: string): Promise<AdminBlogPost | null> {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  if (!row) return null;
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
}): Promise<ActionResult<{ id: string; version: number; slug: string; status: string }>> {
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
        const [created] = await tx
          .insert(blogPosts)
          .values({
            ...fields,
            status: input.status,
            publishedAt: input.status === "published" ? now : null,
            createdBy: admin.email,
            updatedBy: admin.email,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: blogPosts.id, version: blogPosts.version, slug: blogPosts.slug, status: blogPosts.status });
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
        return { saved: created, changedPages: input.status === "published" ? postPages(fields.slug, category.slug) : [] };
      }

      const [current] = await tx.select().from(blogPosts).where(eq(blogPosts.id, input.id)).for("update");
      if (!current) throw new BlogError("Post not found");
      if (current.version !== input.expectedVersion) {
        throw new BlogError(
          "This post was changed after you opened it (by another administrator). Reload it to see the latest version, then make your change again.",
        );
      }
      if (current.publishedAt && fields.slug !== current.slug) {
        throw new BlogError(`The address of a published post cannot change - it would break every link to /blog/${current.slug}`);
      }
      if (taken && taken.id !== current.id) throw new BlogError(TAKEN(fields.slug));

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
          version: current.version + 1,
          updatedBy: admin.email,
          updatedAt: now,
        })
        .where(eq(blogPosts.id, current.id))
        .returning({ id: blogPosts.id, version: blogPosts.version, slug: blogPosts.slug, status: blogPosts.status });

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
          summary: `${verb} the blog post "${fields.title}"`,
          detail: { slug: fields.slug, version: updated.version, live: input.status === "published" },
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
      if (pageChanged) changedPages.push(`/blog/${fields.slug}`);
      if (cardChanged) {
        changedPages.push("/blog");
        if (nowLive) changedPages.push(`/blog/category/${category.slug}`);
        if (wasLive && (!nowLive || movedCategory)) {
          changedPages.push(`/blog/category/${movedCategory ? await categorySlugByName(tx, current.category) : category.slug}`);
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

/**
 * Stores a picture pasted, dropped or chosen in the post editor and returns
 * its address. In the article-image bucket, under blog/ - never under a
 * customer's folder.
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
  const url = await storeArticleImage("blog", "posts", Buffer.from(await file.arrayBuffer()), file.type);
  return { ok: true, data: { url } };
}

/* ------------------------------------------------------------------------ */
/* Categories                                                                */
/* ------------------------------------------------------------------------ */

export type AdminBlogCategory = BlogCategoryInfo & {
  id: string;
  /** Posts in it, drafts included. */
  posts: number;
};

/** Every category with how many posts use it, in the blog's order. */
export async function listBlogCategoriesAdmin(): Promise<AdminBlogCategory[]> {
  await requireAdmin();
  return db
    .select({
      id: blogCategories.id,
      name: blogCategories.name,
      slug: blogCategories.slug,
      blurb: blogCategories.blurb,
      posts: sql<number>`(select count(*)::int from blog_posts p where p.category = ${blogCategories.name})`,
    })
    .from(blogCategories)
    .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));
}

/** Name and description, tidied and checked. */
function cleanCategory(input: { name: unknown; blurb: unknown }): { name: string; blurb: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw new BlogError("Give the category a name");
  if (name.length > 40) throw new BlogError("Keep the name under 40 characters - it is shown as a chip and a heading");
  if (!blogSlug(name)) throw new BlogError("The name needs letters or numbers");
  const blurb = String(input.blurb ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return { name, blurb };
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

function refreshCategories(slug?: string) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/category/${slug}`);
}

/**
 * Adds a category, last in the order. Its address (/blog/category/<slug>) is
 * made from the name now and never changes.
 */
export async function createBlogCategory(input: { name: string; blurb: string }): Promise<ActionResult<AdminBlogCategory>> {
  const admin = await requireAdmin();
  try {
    const { name, blurb } = cleanCategory(input);
    const slug = blogSlug(name);
    const created = await db.transaction(async (tx) => {
      if (await sameName(tx, name, null)) throw new BlogError(`There is already a category called "${name}"`);
      const [taken] = await tx.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
      if (taken) throw new BlogError(`Another category already uses the address /blog/category/${slug} - choose a different name`);
      const [last] = await tx.select({ order: sql<number>`coalesce(max(${blogCategories.sortOrder}), -1)::int` }).from(blogCategories);
      const [row] = await tx
        .insert(blogCategories)
        .values({ name, slug, blurb, sortOrder: (last?.order ?? -1) + 1 })
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
      return { id: row.id, name, slug, blurb, posts: 0 };
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
 * Renames a category or changes its description. Its posts follow a new
 * name in the same transaction; its address stays.
 */
export async function saveBlogCategory(input: { id: string; name: string; blurb: string }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(input.id)) return { ok: false, error: "Category not found" };
  try {
    const { name, blurb } = cleanCategory(input);
    const changedPages: string[] = [];
    const slug = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(blogCategories).where(eq(blogCategories.id, input.id)).for("update");
      if (!current) throw new BlogError("Category not found");
      if (await sameName(tx, name, current.id)) throw new BlogError(`There is already a category called "${name}"`);
      await tx.update(blogCategories).set({ name, blurb, updatedAt: new Date() }).where(eq(blogCategories.id, current.id));
      if (name !== current.name) {
        await tx.update(blogPosts).set({ category: name }).where(eq(blogPosts.category, current.name));
      }

      /*
        Reported only while the category has live posts - without them its
        page is not in the sitemap. Its page shows the name and description; a
        new name also shows on the blog's front page and on each live post.
      */
      const live = await tx
        .select({ slug: blogPosts.slug })
        .from(blogPosts)
        .where(and(eq(blogPosts.category, name), eq(blogPosts.status, "published")));
      const renamed = name !== current.name;
      if (live.length > 0 && (renamed || blurb !== current.blurb)) {
        changedPages.push(`/blog/category/${current.slug}`);
        if (renamed) changedPages.push("/blog", ...live.map((post) => `/blog/${post.slug}`));
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
 * Deletes a category no post uses (drafts included). Its page stops existing,
 * which is reported (IndexNow takes gone pages too): it may have been listed
 * while it had live posts.
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
    notifyIndexNow([`/blog/category/${slug}`]);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    throw error;
  }
}
