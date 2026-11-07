import "server-only";

import { isBlogLocale } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";
import { BLOG_IMAGE_FOLDER, storedImagePath, storedImagePrefix } from "@/lib/images/storage";

/**
 * Which stored files are the blog's pictures (Admin -> Blog -> Images), for
 * the library (lib/admin/blog-images.ts) and for a post's featured image
 * (lib/blog/post-fields.ts). Here rather than in the library's module, which
 * is "use server" and so may export only actions.
 */

/** Longest picture description kept: the editor's (components/image-picker.tsx). */
export const BLOG_IMAGE_ALT_MAX = 300;

/**
 * A blog picture's place in storage: directly in the blog folder, or in one
 * language's folder inside it. Null for anything else - another folder, a
 * customer's picture, a folder itself, a path that climbs out.
 */
export function blogImageFile(path: string): { language: Locale | null } | null {
  if (!path.startsWith(`${BLOG_IMAGE_FOLDER}/`)) return null;
  const parts = path.slice(BLOG_IMAGE_FOLDER.length + 1).split("/");
  // No empty, "." or ".." part: nothing that names a folder or climbs out of one.
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  const [first] = parts;
  // Directly in the blog folder: a picture from before languages - but a language's folder is not a picture.
  if (parts.length === 1) return isBlogLocale(first) ? null : { language: null };
  return parts.length === 2 && isBlogLocale(first) ? { language: first } : null;
}

/**
 * True when `url` is the public address of one of the blog's pictures: our
 * storage's address (no other site's), in the blog's folders, with nothing
 * after the file name. A featured image is always one of these, so the cover
 * of a post can only show a picture the library lists and protects.
 */
export function isBlogImageUrl(url: string): boolean {
  const prefix = storedImagePrefix();
  if (!prefix || !url.startsWith(prefix) || /[?#\s]/.test(url)) return false;
  const path = storedImagePath(url);
  return path !== null && blogImageFile(path) !== null;
}
