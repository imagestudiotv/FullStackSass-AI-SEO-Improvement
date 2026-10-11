"use server";

import { asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { recordAdminAction, type AdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import { LOCALES, localePath } from "@/lib/i18n/config";
import {
  ALLOWED_IMAGE_TYPES,
  isImageStorageConfigured,
  MAX_IMAGE_BYTES,
  storeArticleImage,
  storedImagePath,
} from "@/lib/images/storage";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Testimonials: the homepage's testimonial cards (client,
 * 2026-10-11). Administrators write, reorder, publish and delete them;
 * only PUBLISHED cards reach the public homepage and the plan screen
 * (lib/marketing/testimonials-db.ts). Every change is checked on the server
 * and recorded in the admin audit log.
 *
 * Two rules keep the cards honest:
 * - A SAMPLE card (the client's design package, loaded by migration 0055:
 *   quotes written for the mockup, AI-generated faces, names from another
 *   company's reviews) cannot be published. It stops being a sample as soon
 *   as its words, name or picture are changed.
 * - Publishing a card - or changing a published one's words, name or
 *   picture - needs the administrator to confirm the person agreed in
 *   writing to those words, their name and their picture. Who confirmed it,
 *   and when, is stored on the card and in the audit log.
 */

export type AdminTestimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatarUrl: string | null;
  sortOrder: number;
  published: boolean;
  sample: boolean;
  permissionConfirmedBy: string | null;
  permissionConfirmedAt: Date | null;
  updatedAt: Date;
  updatedBy: string | null;
};

export type TestimonialInput = {
  name: string;
  role: string;
  quote: string;
  /** A stored picture's address, a file under /preview/testimonials or /images/testimonials, or null for initials. */
  avatarUrl: string | null;
  published: boolean;
  /** The administrator confirms the person agreed to these words, their name and their picture. */
  permissionConfirmed: boolean;
};

/** The lengths the card is designed for: a name and role on a line or two, a quote of a few sentences. */
const LIMITS = { name: 80, role: 100, quote: 600 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Pictures shipped with the site: the design package's, and the real ones. */
const LOCAL_PICTURE = /^\/(preview|images)\/testimonials\/[a-z0-9-]+\.(webp|png|jpe?g)$/;

class TestimonialError extends Error {}

const NOT_SAMPLE_YET =
  "This is a sample card from the design package. Replace its words, name or picture with a real customer's approved ones before publishing it.";
const CONFIRM =
  "Confirm that the person agreed in writing to publishing these words, their name and their picture, by ticking the box above Save.";

function oneLine(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function clean(input: TestimonialInput) {
  const name = oneLine(input.name, LIMITS.name + 1);
  const role = oneLine(input.role, LIMITS.role + 1);
  const quote = String(input.quote ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw new TestimonialError("Add the person's or company's name");
  if (name.length > LIMITS.name) throw new TestimonialError(`Keep the name under ${LIMITS.name} characters`);
  if (role.length > LIMITS.role) throw new TestimonialError(`Keep the role under ${LIMITS.role} characters`);
  if (!quote) throw new TestimonialError("Add the quote");
  if (quote.length > LIMITS.quote) {
    throw new TestimonialError(`The quote is ${quote.length} characters; keep it under ${LIMITS.quote} so the cards stay even`);
  }
  const avatar = input.avatarUrl ? String(input.avatarUrl).trim() : null;
  if (avatar && !LOCAL_PICTURE.test(avatar) && !(avatar.startsWith("https://") && storedImagePath(avatar))) {
    throw new TestimonialError("That picture is not one uploaded here - upload it again");
  }
  return { name, role, quote, avatarUrl: avatar };
}

/** The pages that show the cards: every homepage, the plan screen, the admin preview and list. */
function refresh(id?: string) {
  for (const locale of LOCALES) revalidatePath(localePath(locale, "/"));
  revalidatePath("/onboarding/plan");
  revalidatePath("/preview/testimonials");
  revalidatePath("/admin/testimonials");
  if (id) revalidatePath(`/admin/testimonials/${id}`);
}

function toAdmin(row: typeof testimonials.$inferSelect): AdminTestimonial {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    quote: row.quote,
    avatarUrl: row.avatarUrl,
    sortOrder: row.sortOrder,
    published: row.published,
    sample: row.sample,
    permissionConfirmedBy: row.permissionConfirmedBy,
    permissionConfirmedAt: row.permissionConfirmedAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/** Every card, in homepage order. */
export async function listTestimonialsAdmin(): Promise<AdminTestimonial[]> {
  await requireAdmin();
  const rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt));
  return rows.map(toAdmin);
}

export async function getTestimonialAdmin(id: string): Promise<AdminTestimonial | null> {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
  return row ? toAdmin(row) : null;
}

/**
 * Creates a card (id null, last in the order) or saves one, publishing or
 * unpublishing it in the same step. See the rules at the top.
 */
export async function saveTestimonial(input: {
  id: string | null;
  card: TestimonialInput;
}): Promise<ActionResult<{ id: string; published: boolean; sample: boolean }>> {
  const admin = await requireAdmin();
  if (input.id !== null && !UUID.test(input.id)) return { ok: false, error: "Testimonial not found" };

  let fields: ReturnType<typeof clean>;
  try {
    fields = clean(input.card);
  } catch (error) {
    if (error instanceof TestimonialError) return { ok: false, error: error.message };
    throw error;
  }
  const publish = input.card.published === true;
  const confirmed = input.card.permissionConfirmed === true;

  try {
    const saved = await db.transaction(async (tx) => {
      const now = new Date();

      if (input.id === null) {
        if (publish && !confirmed) throw new TestimonialError(CONFIRM);
        const [last] = await tx.select({ order: sql<number>`coalesce(max(${testimonials.sortOrder}), 0)::int` }).from(testimonials);
        const [row] = await tx
          .insert(testimonials)
          .values({
            ...fields,
            sortOrder: (last?.order ?? 0) + 1,
            published: publish,
            sample: false,
            permissionConfirmedBy: confirmed ? admin.email : null,
            permissionConfirmedAt: confirmed ? now : null,
            createdBy: admin.email,
            updatedBy: admin.email,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await recordAdminAction(
          {
            actorEmail: admin.email,
            action: publish ? "testimonial.published" : "testimonial.created",
            targetType: "testimonial",
            targetId: row.id,
            summary: `${publish ? "Published" : "Added"} the testimonial from "${fields.name}"`,
            detail: { permissionConfirmed: confirmed },
          },
          tx,
        );
        return row;
      }

      const [current] = await tx.select().from(testimonials).where(eq(testimonials.id, input.id)).for("update");
      if (!current) throw new TestimonialError("Testimonial not found");

      const contentChanged =
        fields.name !== current.name || fields.quote !== current.quote || fields.avatarUrl !== current.avatarUrl;
      const sample = current.sample && !contentChanged;
      if (publish && sample) throw new TestimonialError(NOT_SAMPLE_YET);
      // A card going live, or a live card's words, name or picture changing, needs the person's agreement again.
      const needsConfirmation = publish && (!current.published || contentChanged || fields.role !== current.role);
      if (needsConfirmation && !confirmed) throw new TestimonialError(CONFIRM);

      const [row] = await tx
        .update(testimonials)
        .set({
          ...fields,
          published: publish,
          sample,
          ...(needsConfirmation ? { permissionConfirmedBy: admin.email, permissionConfirmedAt: now } : {}),
          updatedBy: admin.email,
          updatedAt: now,
        })
        .where(eq(testimonials.id, current.id))
        .returning();

      const action: AdminAction =
        publish && !current.published
          ? "testimonial.published"
          : !publish && current.published
            ? "testimonial.unpublished"
            : "testimonial.saved";
      const verb = { "testimonial.published": "Published", "testimonial.unpublished": "Unpublished", "testimonial.saved": "Saved" }[
        action as "testimonial.published" | "testimonial.unpublished" | "testimonial.saved"
      ];
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action,
          targetType: "testimonial",
          targetId: current.id,
          summary: `${verb} the testimonial from "${fields.name}"`,
          detail: { live: publish, ...(needsConfirmation ? { permissionConfirmed: true } : {}), ...(current.sample && !sample ? { sampleReplaced: true } : {}) },
        },
        tx,
      );
      return row;
    });
    refresh(saved.id);
    return { ok: true, data: { id: saved.id, published: saved.published, sample: saved.sample } };
  } catch (error) {
    if (error instanceof TestimonialError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Deletes a card. A published one disappears from the homepage at once. */
export async function deleteTestimonial(id: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(id)) return { ok: false, error: "Testimonial not found" };
  const [row] = await db.delete(testimonials).where(eq(testimonials.id, id)).returning();
  if (!row) return { ok: false, error: "Testimonial not found" };
  await recordAdminAction({
    actorEmail: admin.email,
    action: "testimonial.deleted",
    targetType: "testimonial",
    targetId: row.id,
    summary: `Deleted the testimonial from "${row.name}"`,
    detail: { wasPublished: row.published, wasSample: row.sample },
  });
  refresh();
  return { ok: true, data: null };
}

/** Moves a card one place earlier or later on the homepage (swaps it with its neighbour). */
export async function moveTestimonial(id: string, direction: "up" | "down"): Promise<ActionResult<null>> {
  await requireAdmin();
  if (!UUID.test(id) || (direction !== "up" && direction !== "down")) return { ok: false, error: "Testimonial not found" };
  const moved = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(testimonials).where(eq(testimonials.id, id)).for("update");
    if (!current) return false;
    const [neighbour] = await tx
      .select()
      .from(testimonials)
      .where(direction === "up" ? lt(testimonials.sortOrder, current.sortOrder) : gt(testimonials.sortOrder, current.sortOrder))
      .orderBy(direction === "up" ? desc(testimonials.sortOrder) : asc(testimonials.sortOrder))
      .limit(1)
      .for("update");
    if (!neighbour) return true;
    // Neither updated_at nor updated_by: the order is not an edit of either card.
    await tx.update(testimonials).set({ sortOrder: neighbour.sortOrder, updatedAt: sql`${testimonials.updatedAt}` }).where(eq(testimonials.id, current.id));
    await tx
      .update(testimonials)
      .set({ sortOrder: current.sortOrder, updatedAt: sql`${testimonials.updatedAt}` })
      .where(eq(testimonials.id, neighbour.id));
    return true;
  });
  if (!moved) return { ok: false, error: "Testimonial not found" };
  refresh();
  return { ok: true, data: null };
}

/**
 * Stores a picture for a card: cropped to a centred square and saved as a
 * 128 x 128 WebP (sharp at the card's 64px on a 2x screen, a few KB), under
 * testimonials/ in the image bucket. Returns its address for the card.
 */
export async function uploadTestimonialPicture(formData: FormData): Promise<ActionResult<{ url: string }>> {
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
      .resize(128, 128, { fit: "cover", position: "attention" })
      .webp({ quality: 88, alphaQuality: 100 })
      .toBuffer();
  } catch {
    return { ok: false, error: "That file could not be read as a picture" };
  }
  const url = await storeArticleImage("testimonials", "pictures", webp, "image/webp");
  return { ok: true, data: { url } };
}
