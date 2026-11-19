"use server";

import { asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { recordAdminAction, type AdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { isUniqueViolation } from "@/lib/blog/post-fields";
import { db } from "@/lib/db";
import { successStories } from "@/lib/db/schema";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { ALLOWED_IMAGE_TYPES, isImageStorageConfigured, MAX_IMAGE_BYTES, storeArticleImage } from "@/lib/images/storage";
import { cleanSuccessStory, SuccessStoryError } from "@/lib/success-stories/clean";
import { successStoryPath, type StoryMetric, type SuccessStoryInput } from "@/lib/success-stories/fields";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Success stories (client, 2026-11-19: "add options to adding
 * success stories from the dashboard, I want to place here the
 * dumitruculiuc website for example, and other websites too").
 * Administrators write, publish, reorder and delete them; only PUBLISHED
 * ones reach the public pages (lib/success-stories/stories.ts): a card after
 * Image Studio's on the homepage, /success-stories and /discover, and a page
 * at /success-stories/<slug>. The order here is the order after Image
 * Studio - nothing written here can go before it (lib/success-stories/
 * order.ts). Every change is checked on the server (requireAdmin, then
 * lib/success-stories/clean.ts) and recorded in the admin audit log.
 */

export type AdminSuccessStory = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  title: string;
  summary: string;
  categoryLabel: string | null;
  bodyHtml: string;
  metrics: StoryMetric[];
  discoverSlug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  updatedAt: Date;
  updatedBy: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "Success story not found";

function toAdmin(row: typeof successStories.$inferSelect): AdminSuccessStory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    websiteUrl: row.websiteUrl,
    logoUrl: row.logoUrl,
    title: row.title,
    summary: row.summary,
    categoryLabel: row.categoryLabel,
    bodyHtml: row.bodyHtml,
    metrics: row.metrics ?? [],
    discoverSlug: row.discoverSlug,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    published: row.published,
    publishedAt: row.publishedAt,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/**
 * The pages that show the stories, in every language: the homepages and
 * /success-stories (built ahead), and the story's own page under each address
 * it had. /discover is drawn per request.
 */
function refresh(slugs: (string | null | undefined)[] = [], id?: string) {
  for (const locale of LOCALES) {
    revalidatePath(localePath(locale, "/"));
    revalidatePath(localePath(locale, "/success-stories"));
    for (const slug of new Set(slugs)) if (slug) revalidatePath(successStoryPath(locale, slug));
  }
  revalidatePath("/admin/success-stories");
  if (id) revalidatePath(`/admin/success-stories/${id}`);
}

/** Every story, drafts included, in the order the public pages show them after Image Studio. */
export async function listSuccessStoriesAdmin(): Promise<AdminSuccessStory[]> {
  await requireAdmin();
  const rows = await db.select().from(successStories).orderBy(asc(successStories.sortOrder), asc(successStories.createdAt));
  return rows.map(toAdmin);
}

export async function getSuccessStoryAdmin(id: string): Promise<AdminSuccessStory | null> {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(successStories).where(eq(successStories.id, id)).limit(1);
  return row ? toAdmin(row) : null;
}

/**
 * Creates a story (id null, last in the order) or saves one, publishing or
 * unpublishing it in the same step. The address must be free: one story per
 * /success-stories/<slug>.
 */
export async function saveSuccessStory(input: {
  id: string | null;
  story: SuccessStoryInput;
}): Promise<ActionResult<{ id: string; slug: string; published: boolean }>> {
  const admin = await requireAdmin();
  if (input?.id !== null && !UUID.test(String(input?.id))) return { ok: false, error: NOT_FOUND };

  let fields: ReturnType<typeof cleanSuccessStory>;
  try {
    fields = cleanSuccessStory(input.story);
  } catch (error) {
    if (error instanceof SuccessStoryError) return { ok: false, error: error.message };
    throw error;
  }
  const publish = input.story?.published === true;

  try {
    const { row, oldSlug } = await db.transaction(async (tx) => {
      const now = new Date();

      if (input.id === null) {
        const [last] = await tx.select({ order: sql<number>`coalesce(max(${successStories.sortOrder}), 0)::int` }).from(successStories);
        const [created] = await tx
          .insert(successStories)
          .values({
            ...fields,
            sortOrder: (last?.order ?? 0) + 1,
            published: publish,
            publishedAt: publish ? now : null,
            createdBy: admin.email,
            updatedBy: admin.email,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await recordAdminAction(
          {
            actorEmail: admin.email,
            action: publish ? "success_story.published" : "success_story.created",
            targetType: "success_story",
            targetId: created.id,
            summary: `${publish ? "Published" : "Added"} the success story "${fields.title}" (${fields.name})`,
            detail: { slug: fields.slug },
          },
          tx,
        );
        return { row: created, oldSlug: null };
      }

      const [current] = await tx.select().from(successStories).where(eq(successStories.id, input.id)).for("update");
      if (!current) throw new SuccessStoryError(NOT_FOUND);
      const [saved] = await tx
        .update(successStories)
        .set({
          ...fields,
          published: publish,
          // The first publication's date stays through unpublishing and publishing again.
          publishedAt: publish ? (current.publishedAt ?? now) : current.publishedAt,
          updatedBy: admin.email,
          updatedAt: now,
        })
        .where(eq(successStories.id, current.id))
        .returning();
      const action: AdminAction =
        publish && !current.published ? "success_story.published" : !publish && current.published ? "success_story.unpublished" : "success_story.saved";
      const verb = { "success_story.published": "Published", "success_story.unpublished": "Unpublished", "success_story.saved": "Saved" }[
        action as "success_story.published" | "success_story.unpublished" | "success_story.saved"
      ];
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action,
          targetType: "success_story",
          targetId: current.id,
          summary: `${verb} the success story "${fields.title}" (${fields.name})`,
          detail: { slug: fields.slug, live: publish, ...(current.slug !== fields.slug ? { previousSlug: current.slug } : {}) },
        },
        tx,
      );
      return { row: saved, oldSlug: current.slug };
    });
    refresh([row.slug, oldSlug], row.id);
    return { ok: true, data: { id: row.id, slug: row.slug, published: row.published } };
  } catch (error) {
    if (error instanceof SuccessStoryError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: `Another story already uses /success-stories/${fields.slug} - choose another address` };
    throw error;
  }
}

/** Publishes or unpublishes a story from the list, without opening it. */
export async function setSuccessStoryPublished(id: string, published: boolean): Promise<ActionResult<{ published: boolean }>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(id)) || typeof published !== "boolean") return { ok: false, error: NOT_FOUND };
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(successStories).where(eq(successStories.id, id)).for("update");
    if (!current) return null;
    if (current.published === published) return current;
    const now = new Date();
    const [saved] = await tx
      .update(successStories)
      .set({ published, publishedAt: published ? (current.publishedAt ?? now) : current.publishedAt, updatedBy: admin.email, updatedAt: now })
      .where(eq(successStories.id, id))
      .returning();
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: published ? "success_story.published" : "success_story.unpublished",
        targetType: "success_story",
        targetId: id,
        summary: `${published ? "Published" : "Unpublished"} the success story "${current.title}" (${current.name})`,
        detail: { slug: current.slug },
      },
      tx,
    );
    return saved;
  });
  if (!result) return { ok: false, error: NOT_FOUND };
  refresh([result.slug], id);
  return { ok: true, data: { published: result.published } };
}

/** Deletes a story for good. A published one disappears from every page at once. */
export async function deleteSuccessStory(id: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(id))) return { ok: false, error: NOT_FOUND };
  const [row] = await db.delete(successStories).where(eq(successStories.id, id)).returning();
  if (!row) return { ok: false, error: NOT_FOUND };
  await recordAdminAction({
    actorEmail: admin.email,
    action: "success_story.deleted",
    targetType: "success_story",
    targetId: row.id,
    summary: `Deleted the success story "${row.title}" (${row.name})`,
    detail: { slug: row.slug, wasPublished: row.published },
  });
  refresh([row.slug]);
  return { ok: true, data: null };
}

/** Moves a story one place earlier or later (swaps it with its neighbour). Image Studio stays first whatever this says. */
export async function moveSuccessStory(id: string, direction: "up" | "down"): Promise<ActionResult<null>> {
  await requireAdmin();
  if (!UUID.test(String(id)) || (direction !== "up" && direction !== "down")) return { ok: false, error: NOT_FOUND };
  const moved = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(successStories).where(eq(successStories.id, id)).for("update");
    if (!current) return false;
    const [neighbour] = await tx
      .select()
      .from(successStories)
      .where(direction === "up" ? lt(successStories.sortOrder, current.sortOrder) : gt(successStories.sortOrder, current.sortOrder))
      .orderBy(direction === "up" ? desc(successStories.sortOrder) : asc(successStories.sortOrder))
      .limit(1)
      .for("update");
    if (!neighbour) return true;
    // Neither updated_at nor updated_by: the order is not an edit of either story.
    await tx.update(successStories).set({ sortOrder: neighbour.sortOrder, updatedAt: sql`${successStories.updatedAt}` }).where(eq(successStories.id, current.id));
    await tx.update(successStories).set({ sortOrder: current.sortOrder, updatedAt: sql`${successStories.updatedAt}` }).where(eq(successStories.id, neighbour.id));
    return true;
  });
  if (!moved) return { ok: false, error: NOT_FOUND };
  refresh();
  return { ok: true, data: null };
}

/**
 * Stores a logo or portrait for a story: cropped to a centred square and
 * saved as a 256 x 256 WebP (the cards draw it at 48-56px; the page's
 * structured data names it too), among the blog's pictures - the only stored
 * pictures the site's image optimiser serves (next.config.ts) - named after
 * the business. Returns its address for the story.
 */
export async function uploadSuccessStoryLogo(formData: FormData): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  if (!isImageStorageConfigured()) return { ok: false, error: "Image storage is not set up yet" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a picture to upload" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) return { ok: false, error: "Use a PNG, JPEG or WebP picture" };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `That picture is ${Math.round(file.size / 1024 / 1024)}MB. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.` };
  }
  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(256, 256, { fit: "cover", position: "attention" })
      .webp({ quality: 88, alphaQuality: 100 })
      .toBuffer();
  } catch {
    return { ok: false, error: "That file could not be read as a picture" };
  }
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const url = await storeArticleImage("blog", "posts", webp, "image/webp", name ? `${name} logo` : null);
  return { ok: true, data: { url } };
}
