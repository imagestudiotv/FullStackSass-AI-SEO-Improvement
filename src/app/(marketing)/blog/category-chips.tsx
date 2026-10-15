import Link from "next/link";

import { categoryPath } from "@/lib/blog/locale";
import { categoryText, type BlogCategoryInfo } from "@/lib/blog/shared";
import type { Locale } from "@/lib/i18n/config";

/**
 * A blog front page's categories, each with how many posts it holds in the
 * page's language, linking to that language's category page (client,
 * 2026-10-15: categories on every language's blog, under their names in that
 * language).
 *
 * Counts are real, read from the posts themselves. A category chip claiming a
 * number the index cannot fill is the first thing a reader notices.
 *
 * Empty categories are hidden rather than shown with a zero. A chip reading
 * "Comparisons 0" advertises a section with nothing in it and makes the whole
 * blog look abandoned; the category page still exists for when the first
 * post lands.
 */
export function CategoryChips({
  categories,
  counts,
  locale,
}: {
  categories: BlogCategoryInfo[];
  /** Published posts in the page's language, by category name (lib/blog/posts.ts publishedCategoryCounts). */
  counts: Record<string, number>;
  locale: Locale;
}) {
  const shown = categories.filter((category) => (counts[category.name] ?? 0) > 0);
  if (shown.length === 0) return null;
  return (
    <ul className="mt-7 flex flex-wrap gap-2.5">
      {shown.map((category) => (
        <li key={category.slug}>
          <Link
            href={categoryPath(locale, category.slug)}
            className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40"
          >
            {categoryText(category, locale).name}
            <span className="text-muted-foreground tabular-nums">{counts[category.name]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
