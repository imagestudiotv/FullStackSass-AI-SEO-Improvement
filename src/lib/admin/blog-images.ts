"use server";

import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { BLOG_LOCALES, blogLocale, isBlogLocale } from "@/lib/blog/locale";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import {
  BLOG_IMAGE_FOLDER,
  deleteStoredImage,
  isImageStorageConfigured,
  listStoredImages,
  storedImagePath,
} from "@/lib/images/storage";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * The pictures uploaded for RepGet's own blog (client, 2026-10-09: "We need to
 * have all images uploaded in the admin, in this way we can having control and
 * delete the images we are no longer using").
 *
 * The list is the storage folder itself (BLOG_IMAGE_FOLDER), so a picture
 * uploaded and never saved into a post is listed too. Which posts use a
 * picture is read from the posts' text at the time of asking; a picture in
 * use cannot be deleted.
 *
 * Every picture has languages (client, 2026-10-15: "we need to separate the
 * images suggestions for each language"): an Italian post's picker suggests
 * the Italian pictures, which often have Italian words in them, rather than
 * every picture the blog has. A picture is in the languages of the posts
 * that use it or, while none does, in the language it was uploaded for - an
 * upload goes in that language's folder, blog/posts/it/... (pictureLanguages).
 * Pictures from before sit directly in blog/posts and have only the first.
 */

export type BlogImage = {
  url: string;
  name: string;
  size: number | null;
  createdAt: string | null;
  /** The description (alt text) it has in the first post that uses it. */
  alt: string | null;
  usedIn: { id: string; title: string; slug: string; status: string }[];
  /**
   * The languages it is suggested in, in the site's order. Empty for a
   * picture from before languages that no post uses: the post editor's
   * picker lists it under "All languages" only.
   */
  languages: Locale[];
};

type PostText = {
  id: string;
  title: string;
  slug: string;
  status: string;
  locale: string;
  translationOf: string | null;
  createdAt: Date;
  bodyHtml: string;
};

async function postTexts(): Promise<PostText[]> {
  return db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      status: blogPosts.status,
      locale: blogPosts.locale,
      translationOf: blogPosts.translationOf,
      createdAt: blogPosts.createdAt,
      bodyHtml: blogPosts.bodyHtml,
    })
    .from(blogPosts);
}

/** Where pictures are: the blog folder itself (pictures from before languages), then a folder per language. */
const FOLDERS = [BLOG_IMAGE_FOLDER, ...BLOG_LOCALES.map((locale) => `${BLOG_IMAGE_FOLDER}/${locale}`)];

/**
 * A blog picture's place in storage: directly in the blog folder, or in one
 * language's folder inside it. Null for anything else - another folder, a
 * customer's picture, a folder itself, a path that climbs out.
 */
function blogImageFile(path: string): { language: Locale | null } | null {
  if (!path.startsWith(`${BLOG_IMAGE_FOLDER}/`)) return null;
  const parts = path.slice(BLOG_IMAGE_FOLDER.length + 1).split("/");
  // No empty, "." or ".." part: nothing that names a folder or climbs out of one.
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  const [first] = parts;
  // Directly in the blog folder: a picture from before languages - but a language's folder is not a picture.
  if (parts.length === 1) return isBlogLocale(first) ? null : { language: null };
  return parts.length === 2 && isBlogLocale(first) ? { language: first } : null;
}

/** The posts whose text contains this picture's address (or its storage key, if a link was rewritten). */
function usage(url: string, path: string, posts: PostText[]) {
  return posts.filter((post) => post.bodyHtml.includes(url) || post.bodyHtml.includes(`/${path}`));
}

/**
 * The languages a picture is suggested in.
 *
 * Those of the posts that use it, when any does: what a picture is used for
 * says more than where it was uploaded - a new post starts in English, so
 * pictures added before its language is switched to Italian were uploaded as
 * English ones.
 *
 * Except where a translation only carries the picture from its English post.
 * A translation starts as a copy of the English post, pictures included, and
 * counting those would put the English pictures among the Italian
 * suggestions as soon as an Italian draft is made. A translation's use is
 * the copy's when its English post still has the picture, or when the
 * picture is older than the translation and was not uploaded for its
 * language (the English post may have replaced it since). One added to the
 * translation later, or uploaded for its language, counts.
 *
 * A picture no post uses (or only such copies) is in the language it was
 * uploaded for, or in none - one from before languages - and the picker
 * lists it under "All languages" only.
 */
function pictureLanguages(file: { uploadedFor: Locale | null; storedAt: string | null }, users: PostText[]): Locale[] {
  const stored = file.storedAt ? Date.parse(file.storedAt) : Number.NaN;
  const copy = (post: PostText) =>
    post.translationOf !== null &&
    (users.some((other) => other.id === post.translationOf) ||
      // Not after the translation was made - an unknown date included - so it may have come with the copy.
      (file.uploadedFor !== blogLocale(post.locale) && !(stored >= post.createdAt.getTime())));
  const chosen = users.filter((post) => !copy(post)).map((post) => blogLocale(post.locale));
  const found = new Set<Locale>(chosen.length > 0 ? chosen : file.uploadedFor ? [file.uploadedFor] : []);
  return BLOG_LOCALES.filter((locale) => found.has(locale));
}

const decode = (value: string) =>
  value.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The alt text of the first <img> showing this picture, if any. */
function altFor(url: string, posts: PostText[]): string | null {
  for (const post of posts) {
    const at = post.bodyHtml.indexOf(url);
    if (at < 0) continue;
    const start = post.bodyHtml.lastIndexOf("<img", at);
    const end = post.bodyHtml.indexOf(">", at);
    if (start < 0 || end < 0) continue;
    const alt = /\balt="([^"]*)"/.exec(post.bodyHtml.slice(start, end + 1))?.[1];
    if (alt && alt.trim()) return decode(alt.trim());
  }
  return null;
}

/** Every blog picture, newest first, with where it is used. `term` matches the description, file name or a post title. */
export async function listBlogImages(term = ""): Promise<{ configured: boolean; images: BlogImage[] }> {
  await requireAdmin();
  if (!isImageStorageConfigured()) return { configured: false, images: [] };
  const [folders, posts] = await Promise.all([Promise.all(FOLDERS.map((folder) => listStoredImages(folder))), postTexts()]);
  // Each folder comes newest first; so does the whole. A picture with no date goes last.
  const files = folders.flat().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const images = files.map((file) => {
    const users = usage(file.url, file.path, posts);
    return {
      url: file.url,
      name: file.name,
      size: file.size,
      createdAt: file.createdAt,
      alt: altFor(file.url, posts),
      usedIn: users.map(({ id, title, slug, status }) => ({ id, title, slug, status })),
      languages: pictureLanguages({ uploadedFor: blogImageFile(file.path)?.language ?? null, storedAt: file.createdAt }, users),
    };
  });
  const needle = term.trim().toLowerCase();
  if (!needle) return { configured: true, images };
  return {
    configured: true,
    images: images.filter((image) =>
      [image.alt ?? "", image.name, ...image.usedIn.map((post) => post.title)].some((text) => text.toLowerCase().includes(needle)),
    ),
  };
}

/**
 * The same pictures for the post editor's picker, so an image already
 * uploaded can be used again instead of uploaded twice. Given a language -
 * the post's - only the pictures in it; given "all", or nothing, every one.
 */
export async function listBlogImagesForPicker(term: string, language?: string): Promise<{ url: string; name: string }[]> {
  const { images } = await listBlogImages(term);
  const only = isBlogLocale(language) ? language : null;
  return images
    .filter((image) => only === null || image.languages.includes(only))
    .slice(0, 60)
    .map((image) => ({ url: image.url, name: image.alt ?? image.name }));
}

/** Deletes a blog picture that no post uses. */
export async function deleteBlogImage(url: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!isImageStorageConfigured()) return { ok: false, error: "Image storage is not set up yet" };
  const path = typeof url === "string" ? storedImagePath(url) : null;
  // Only a file in the blog folder or a language's folder in it: never a customer's picture, never a folder.
  if (!path || !blogImageFile(path)) {
    return { ok: false, error: "That is not a blog picture." };
  }
  const users = usage(url, path, await postTexts());
  if (users.length > 0) {
    return {
      ok: false,
      error: `This picture is used in ${users.map((post) => `"${post.title}"`).join(", ")}. Remove it from ${users.length === 1 ? "that post" : "those posts"} first.`,
    };
  }
  try {
    await deleteStoredImage(path);
  } catch (error) {
    console.error("[admin/blog-images] delete failed", error);
    return { ok: false, error: "The picture could not be deleted. Try again." };
  }
  await recordAdminAction({
    actorEmail: admin.email,
    action: "blog.image_deleted",
    targetType: "blog_image",
    targetId: path,
    summary: `Deleted the blog picture ${path.slice(BLOG_IMAGE_FOLDER.length + 1)}`,
    detail: { path },
  });
  revalidatePath("/admin/blog/images");
  return { ok: true, data: null };
}
