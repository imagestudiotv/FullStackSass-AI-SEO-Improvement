import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogPagination } from "@/components/blog-pagination";
import { PostCard } from "@/components/post-card";
import { listCategories } from "@/lib/blog/categories";
import { BLOG_CHROME, blogPath, fill, LANGUAGE_NAMES } from "@/lib/blog/locale";
import { blogPage, blogPageHref, pageSuffix } from "@/lib/blog/pagination";
import { listPostPage, publishedCategoryCounts } from "@/lib/blog/posts";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { CategoryChips } from "../../blog/category-chips";
import { ClosingCta } from "../../home-sections";

/**
 * The blog's front page in one language: /it/blog, /es/blog, ... (client,
 * 2026-10-09; lib/blog/locale.ts). That language's posts, newest first,
 * then the latest English ones - a reader of a young translated blog still
 * finds something to read. A language with no post yet says so, in that
 * language, above the English ones. Like the other translated pages, it is
 * one page in five languages (hreflang from lib/i18n/config.ts).
 *
 * Its categories sit under the heading as on /blog, under their names in the
 * language and counting its posts (client, 2026-10-15), each leading to the
 * language's category page (/it/blog/category/<slug>).
 */
export const dynamic = "force-dynamic";

/** How many English posts follow a language's own. */
const ENGLISH_SHOWN = 6;

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };

async function language(params: Props["params"]): Promise<Exclude<Locale, "en">> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();
  return locale;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = await language(params);
  const page = blogPage((await searchParams).page);
  const t = BLOG_CHROME[locale];
  return {
    title: `${t.metaTitle}${pageSuffix(page, t.pageN)}`,
    description: page > 1 ? `${t.metaDescription.replace(/\.$/, "")}${pageSuffix(page, t.pageN)}.` : t.metaDescription,
    // Page 2 on is its own address (/it/blog?page=2), outside the hreflang set like the English one's.
    ...(page === 1 ? publicPageMetadata("/blog", { locale }) : publicPageMetadata(blogPageHref(blogPath(locale), page))),
  };
}

export default async function LocaleBlogIndexPage({ params, searchParams }: Props) {
  const locale = await language(params);
  const page = blogPage((await searchParams).page);
  const t = BLOG_CHROME[locale];
  const [{ posts, total }, english, categories, counts] = await Promise.all([
    listPostPage(page, { locale }),
    listPostPage(1, { locale: "en" }),
    listCategories(),
    publishedCategoryCounts(locale),
  ]);
  // Past the last page is a 404, not an empty grid.
  if (page > 1 && posts.length === 0) notFound();
  const englishShown = english.posts.slice(0, ENGLISH_SHOWN);

  return (
    <div lang={locale}>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t.blog} · {LANGUAGE_NAMES[locale]}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t.titleLead} <span className="text-primary">{t.titleAccent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{t.intro}</p>
          <CategoryChips categories={categories} counts={counts} locale={locale} />
        </div>
      </div>

      {total > 0 ? (
        <div className="mx-auto max-w-5xl px-4 py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{t.latest}</h2>
            <p className="text-sm text-muted-foreground tabular-nums">{fill(t.articles, { n: total })}</p>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
          <BlogPagination page={page} total={total} path={blogPath(locale)} locale={locale} />
        </div>
      ) : null}

      {page === 1 && englishShown.length > 0 ? (
        <div className={`mx-auto max-w-5xl px-4 ${total > 0 ? "pb-14" : "py-14"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{t.inEnglish}</h2>
            <Link href="/blog" className="text-sm font-medium text-primary hover:underline">
              {t.readInEnglish}
            </Link>
          </div>
          {total === 0 ? <p className="mt-2 text-muted-foreground">{t.noneYet}</p> : null}
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" lang="en">
            {englishShown.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ClosingCta t={getMessages(locale).home} href={(path) => localePath(locale, path)} />
    </div>
  );
}
