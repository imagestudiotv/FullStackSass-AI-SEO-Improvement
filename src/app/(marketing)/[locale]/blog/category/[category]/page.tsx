import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogPagination } from "@/components/blog-pagination";
import { PostCard } from "@/components/post-card";
import { categoryBySlug } from "@/lib/blog/categories";
import { BLOG_CHROME, blogPath, categoryAlternates, categoryPath, homePath } from "@/lib/blog/locale";
import { blogPage, blogPageHref, pageSuffix } from "@/lib/blog/pagination";
import { listPostPage, publishedCategoryLocales } from "@/lib/blog/posts";
import { categoryText, jsonLdScript } from "@/lib/blog/shared";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList } from "@/lib/structured-data";

import { ClosingCta } from "../../../../home-sections";

/**
 * A blog category in another language than English: /it/blog/category/<slug>
 * (client, 2026-10-15: categories on every language's blog). The same
 * address as the English page under the language's prefix, with the
 * category's name and description in that language (Admin -> Blog; the
 * English ones where it has none) and that language's posts in it.
 *
 * A language with no post in the category yet says so and shows the English
 * ones, like the language's blog front page - and asks search engines not to
 * index the page, which has nothing of its own. hreflang links the category's
 * pages in the languages that do have posts in it (lib/blog/locale.ts).
 *
 * Per request, from the database, like the English category pages.
 */
export const dynamic = "force-dynamic";

/** How many English posts a language's empty category page shows. */
const ENGLISH_SHOWN = 6;

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

async function find(params: Props["params"]) {
  const { locale, category: slug } = await params;
  if (!isLocale(locale) || locale === "en") return null;
  const category = await categoryBySlug(slug);
  return category ? { locale: locale as Exclude<Locale, "en">, category } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const found = await find(params);
  if (!found) return { title: "Category not found" };
  const { locale, category } = found;
  const t = BLOG_CHROME[locale];
  const text = categoryText(category, locale);
  // Page 2 on has a title and description of its own, beside its own canonical.
  const page = blogPage((await searchParams).page);
  const locales = await publishedCategoryLocales(category.name);
  const empty = !locales.includes(locale);
  const base = publicPageMetadata(blogPageHref(categoryPath(locale, category.slug), page));
  const languages = page === 1 && !empty ? categoryAlternates(category.slug, locales) : undefined;
  return {
    title: `${text.name}${pageSuffix(page, t.pageN)}`,
    description: page > 1 ? `${text.blurb.replace(/\.$/, "")}${pageSuffix(page, t.pageN)}.` : text.blurb,
    ...base,
    alternates: languages ? { ...base.alternates, languages } : base.alternates,
    // Nothing in this language yet: only the English posts, which have their own page.
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function LocaleBlogCategoryPage({ params, searchParams }: Props) {
  const found = await find(params);
  // An unknown category is a genuine 404, as on the English page.
  if (!found) notFound();
  const { locale, category } = found;
  const t = BLOG_CHROME[locale];
  const text = categoryText(category, locale);
  const path = categoryPath(locale, category.slug);

  const page = blogPage((await searchParams).page);
  const { posts, total } = await listPostPage(page, { locale, category: category.name });
  // Past the last page is a 404, not the empty-section message.
  if (page > 1 && posts.length === 0) notFound();
  const english = total === 0 ? (await listPostPage(1, { category: category.name })).posts.slice(0, ENGLISH_SHOWN) : [];

  // The visible trail below, as structured data: same names, same order.
  const trail = [
    { name: t.home, path: homePath(locale) },
    { name: t.blog, path: blogPath(locale) },
    { name: text.name, path },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        // Category names are typed in the admin panel: escaped, not trusted.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbList(siteUrl(), trail)) }}
      />
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-14">
          <nav
            aria-label={getMessages(locale).app.editor.breadcrumbLabel}
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            {trail.slice(0, -1).map((step) => (
              <span key={step.path} className="flex items-center gap-1.5">
                <Link href={step.path} className="text-primary hover:underline">
                  {step.name}
                </Link>
                <span aria-hidden="true">/</span>
              </span>
            ))}
            <span className="text-foreground">{text.name}</span>
          </nav>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">{text.name}</h1>
          {text.blurb ? <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{text.blurb}</p> : null}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14">
        {total > 0 ? (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            {/* Said plainly, in the language, rather than shown as an empty grid. */}
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="font-medium">{t.sectionEmpty}</p>
            </div>
            {english.length > 0 ? (
              <div className="mt-12">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">{t.inEnglish}</h2>
                  <Link href={categoryPath("en", category.slug)} className="text-sm font-medium text-primary hover:underline">
                    {t.readInEnglish}
                  </Link>
                </div>
                <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" lang="en">
                  {english.map((post) => (
                    <li key={post.slug}>
                      <PostCard post={post} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <BlogPagination page={page} total={total} path={path} locale={locale} />
      </div>

      <ClosingCta t={getMessages(locale).home} href={(target) => localePath(locale, target)} />
    </div>
  );
}
