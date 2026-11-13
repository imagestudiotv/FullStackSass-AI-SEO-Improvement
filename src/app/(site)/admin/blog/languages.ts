import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Admin -> Blog lists one language at a time (client, 2026-10-15: "add
 * separate language tabs: English | Italian | ... so I can access the blogs
 * from all languages at once because once will be many will create
 * confusing"): /admin/blog for English, /admin/blog?lang=it for Italian.
 * A post started from a language's tab starts in that language.
 */
export function adminBlogPath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/admin/blog" : `/admin/blog?lang=${locale}`;
}

/** Admin -> Blog -> New post, in a language. */
export function newBlogPostPath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/admin/blog/new" : `/admin/blog/new?lang=${locale}`;
}
