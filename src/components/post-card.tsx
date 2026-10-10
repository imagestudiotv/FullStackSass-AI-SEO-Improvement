import Link from "next/link";

import { PostCover } from "@/components/post-cover";
import { BLOG_CHROME, blogPath, fill } from "@/lib/blog/locale";
import type { BlogPost } from "@/lib/blog/shared";

const DATE_LOCALES = { en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", de: "de-DE" } as const;

/** Long-form dates, since a blog index read by humans is not a log file. In the post's language. */
export function formatPostDate(iso: string, locale: keyof typeof DATE_LOCALES = "en"): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(DATE_LOCALES[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A post as a card: cover, category, title, summary, date and read time.
 *
 * The whole card is not one link. A card-sized anchor wrapping a category chip
 * that is itself a link produces nested interactive elements, which is invalid
 * and unreachable by keyboard. Instead the title is the link and an overlay
 * stretches its hit area over the card, leaving the chip separately clickable.
 *
 * A post in another language links to its own address (/it/blog/...), with
 * its date and read time in that language. Category pages are English, so
 * its category is a label rather than a link.
 */
export function PostCard({ post }: { post: BlogPost }) {
  const locale = post.locale ?? "en";
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
      <PostCover
        slug={post.slug}
        title={post.title}
        category={post.category}
        className="aspect-[100/56] w-full border-b"
      />

      <div className="flex flex-1 flex-col p-5">
        {locale === "en" ? (
          <Link
            href={`/blog/category/${post.categorySlug}`}
            className="relative z-10 w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted-foreground/15"
          >
            {post.category}
          </Link>
        ) : (
          <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{post.category}</span>
        )}

        <h3 className="mt-3 font-semibold tracking-tight text-balance">
          <Link
            href={blogPath(locale, post.slug)}
            // Stretches the link over the whole card without nesting anchors.
            className="after:absolute after:inset-0 group-hover:text-primary"
          >
            {post.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {post.description}
        </p>

        {/* mt-auto pins the meta line to the bottom so it aligns across a row. */}
        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>
            {formatPostDate(post.publishedAt, locale)}
          </time>
          <span className="mx-1.5">·</span>
          {fill(BLOG_CHROME[locale].minRead, { n: post.readingMinutes })}
        </p>
      </div>
    </article>
  );
}
