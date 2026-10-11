import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, isDatabaseConfigured } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";
import type { Testimonial } from "@/lib/marketing/testimonials";

/**
 * The testimonial cards from Admin -> Testimonials (lib/admin/
 * testimonials.ts), in their order.
 *
 * The homepages are built ahead and refreshed in the background, like their
 * prices (lib/billing.ts listPlansForPrebuiltPage): a build with no database
 * configured gets no cards; a database that fails throws, so a homepage
 * missing its cards is never published because of a blip. Saving a card
 * refreshes the homepages at once.
 */

type Row = typeof testimonials.$inferSelect;

function toCard(row: Row): Testimonial {
  return { name: row.name, role: row.role, quote: row.quote, avatar: row.avatarUrl };
}

/** True for Postgres's "relation does not exist", however the driver wraps it. */
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "42P01";
}

/**
 * The cards visitors see: published ones only.
 *
 * A database without the table yet (code deployed before migration 0055)
 * has no published card, so it reads as none rather than failing the
 * homepage's build. Any other failure still throws (see above).
 */
export async function listPublishedTestimonials(): Promise<Testimonial[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.published, true))
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt));
    return rows.map(toCard);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn("[testimonials] the testimonials table does not exist yet (migration 0055): showing none");
    return [];
  }
}

/** Every card, drafts included, for the administrators' design preview. */
export async function listTestimonialsForPreview(): Promise<(Testimonial & { published: boolean })[]> {
  const rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt));
  return rows.map((row) => ({ ...toCard(row), published: row.published }));
}
