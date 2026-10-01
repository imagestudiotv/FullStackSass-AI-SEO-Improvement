import "server-only";

import { asc, eq } from "drizzle-orm";

import type { BlogCategoryInfo } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogCategories } from "@/lib/db/schema";

/**
 * The blog's categories, as the public pages and the editor read them.
 * Managed in Admin -> Blog (lib/admin/blog.ts); see blogCategories in the
 * schema for why a post names its category by name.
 */

const columns = { name: blogCategories.name, slug: blogCategories.slug, blurb: blogCategories.blurb };

/** Every category, in the order set in the admin panel. */
export async function listCategories(): Promise<BlogCategoryInfo[]> {
  return db.select(columns).from(blogCategories).orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));
}

/** The category a page address names, or null. */
export async function categoryBySlug(slug: string): Promise<BlogCategoryInfo | null> {
  const [row] = await db.select(columns).from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
  return row ?? null;
}
