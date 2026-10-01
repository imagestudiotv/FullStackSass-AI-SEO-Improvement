"use server";

import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction, type AdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { blogSlug, type BlogCategory, type BlogCategoryInfo, type BlogFaq, type BlogSource } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";
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
  category: string;
  author: string;
  shortAnswer: string;
  bodyHtml: string;
  faqs: BlogFaq[];
  sources: BlogSource[];
};

const DEFAULT_AUTHOR = "RepGet team";
/** Paths under /blog that are not posts. */
const RESERVED_SLUGS = new Set(["category"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class BlogError extends Error {}

/** Links to RepGet's own site stay followed internal links (see sanitize.ts). */
function siteHosts(): Set<string> {
  const host = new URL(siteUrl()).hostname.toLowerCase();
  return new Set([host, host.startsWith("www.") ? host.slice(4) : `www.${host}`]);
}

function hasText(html: string): boolean {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").trim().length > 0;
}

type Clean = {
  title: string;
  slug: string;
  description: string;
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
  const bodyHtml = sanitizeHtml(String(input.bodyHtml ?? ""), { siteHosts: siteHosts() });

  const faqRows = Array.isArray(input.faqs) ? input.faqs.slice(0, 30) : [];
  const faqs: BlogFaq[] = [];
  for (const faq of faqRows) {
    const question = String(faq?.question ?? "").trim().slice(0, 300);
    const answer = sanitizeHtml(String(faq?.answer ?? "").trim().slice(0, 5000), { siteHosts: siteHosts() });
    if (!question && !hasText(answer)) continue;
    if (!question || !hasText(answer)) throw new BlogError("Each FAQ needs both a question and an answer");
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
    category,
    author: String(input.author ?? "").trim().slice(0, 100) || DEFAULT_AUTHOR,
    shortAnswer: String(input.shortAnswer ?? "").trim().slice(0, 1000) || null,
    bodyHtml,
    faqs,
    sources,
  };
}

/** True for Postgres's unique-violation error, however the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

const TAKEN = (slug: string) => `Another post already uses the address /blog/${slug} - choose another`;

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
        .select({ id: blogCategories.id })
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
        return created;
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
        JSON.stringify(fields.faqs) !== JSON.stringify(current.faqs) ||
        JSON.stringify(fields.sources) !== JSON.stringify(current.sources);
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
      return updated;
    });
    refresh(saved.id);
    return { ok: true, data: saved };
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
    const slug = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(blogCategories).where(eq(blogCategories.id, input.id)).for("update");
      if (!current) throw new BlogError("Category not found");
      if (await sameName(tx, name, current.id)) throw new BlogError(`There is already a category called "${name}"`);
      await tx.update(blogCategories).set({ name, blurb, updatedAt: new Date() }).where(eq(blogCategories.id, current.id));
      if (name !== current.name) {
        await tx.update(blogPosts).set({ category: name }).where(eq(blogPosts.category, current.name));
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
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "There is already a category with that name" };
    throw error;
  }
}

/** Deletes a category no post uses (drafts included). */
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
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof BlogError) return { ok: false, error: error.message };
    throw error;
  }
}
