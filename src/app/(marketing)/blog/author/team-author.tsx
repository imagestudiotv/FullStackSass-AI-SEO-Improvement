import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogPagination } from "@/components/blog-pagination";
import { PostCard } from "@/components/post-card";
import { BLOG_CHROME, blogPath, fill, homePath } from "@/lib/blog/locale";
import { blogPageHref, pageSuffix } from "@/lib/blog/pagination";
import { listPostPage } from "@/lib/blog/posts";
import { jsonLdScript, TEAM_AUTHOR, TEAM_AUTHOR_PATH } from "@/lib/blog/shared";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList, entityIds } from "@/lib/structured-data";

import { ClosingCta } from "../../home-sections";

/**
 * The RepGet team's author page (client, 2026-10-08, after
 * outrank.so/blog/author/outrank), in every language (client, 2026-10-15):
 * /blog/author/repget-team for English, /it/blog/author/repget-team and the
 * others. Who writes the blog and every post they wrote in the page's
 * language, 30 to a page; each of those posts' bylines links here, and their
 * structured data names this page as the author's.
 *
 * A language with no post by the team yet says so and shows the latest
 * English ones, as that language's blog front page does. Page 1 is one page
 * in five languages (TRANSLATED_PATHS gives its hreflang); page 2 on is its
 * own address, outside that set.
 *
 * Rendered per request from the database, like the rest of the blog.
 */

/** How many English posts follow a language's own while it has none. */
const ENGLISH_SHOWN = 6;

/** The team's author page in a language. */
export function teamAuthorPath(locale: Locale): string {
  return localePath(locale, TEAM_AUTHOR_PATH);
}

export function teamAuthorMetadata(locale: Locale, page: number): Metadata {
  const t = BLOG_CHROME[locale];
  const suffix = pageSuffix(page, t.pageN);
  return {
    title: `${t.teamName}${suffix}`,
    description: `${t.authorMetaDescription}${suffix}.`,
    ...(page === 1 ? publicPageMetadata(TEAM_AUTHOR_PATH, { locale }) : publicPageMetadata(blogPageHref(teamAuthorPath(locale), page))),
  };
}

/** The page itself, for the English and the language routes; awaited by each (a 404 past the last page throws from here). */
export async function teamAuthorPage({ locale, page }: { locale: Locale; page: number }) {
  const t = BLOG_CHROME[locale];
  const { posts, total } = await listPostPage(page, { author: TEAM_AUTHOR, locale });
  // Past the last page is a 404, not an empty grid.
  if (page > 1 && posts.length === 0) notFound();
  const english = locale !== "en" && total === 0 ? (await listPostPage(1, { author: TEAM_AUTHOR })).posts.slice(0, ENGLISH_SHOWN) : [];

  const site = siteUrl();
  const path = teamAuthorPath(locale);
  const address = `${site}${path}`;
  // The visible trail below, as structured data: same names, same order.
  const trail = [
    { name: t.home, path: homePath(locale) },
    { name: t.blog, path: blogPath(locale) },
    { name: t.teamName, path },
  ];
  const jsonLd = [
    /*
      A profile page about the team: what Google reads for an author page.
      The team is part of the Organization the homepage defines.
    */
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: address,
      name: t.teamName,
      inLanguage: locale,
      mainEntity: {
        "@type": "Organization",
        name: t.teamName,
        url: address,
        description: t.authorBio,
        logo: `${site}/icon-512.png`,
        parentOrganization: { "@id": entityIds(site).organization },
      },
    },
    breadcrumbList(site, trail),
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        // Built from constants here, but escaped like every blog page's.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
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
            <span className="text-foreground">{t.teamName}</span>
          </nav>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <Image
              src="/images/repget-mark.png"
              alt=""
              width={88}
              height={88}
              className="size-18 shrink-0 rounded-full border bg-card p-3 sm:size-22"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.authorEyebrow}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">{t.teamName}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{t.authorBio}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t.articlesHeading}</h2>
          {/* In another language with none yet, the message below says so: "0 articoli" above it would repeat it. */}
          {total > 0 || locale === "en" ? (
            <p className="text-sm text-muted-foreground tabular-nums">{fill(t.articles, { n: total })}</p>
          ) : null}
        </div>

        {total > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        ) : locale === "en" ? (
          <div className="mt-8 rounded-xl border bg-card p-8 text-center">
            <p className="font-medium">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {t.authorNoneYet}{" "}
              <Link href="/blog" className="underline underline-offset-4">
                Read the blog
              </Link>{" "}
              in the meantime.
            </p>
          </div>
        ) : (
          <>
            {/* Said plainly, in the language, rather than shown as an empty grid. */}
            <div className="mt-8 rounded-xl border bg-card p-8 text-center">
              <p className="font-medium">{t.authorNoneYet}</p>
            </div>
            {english.length > 0 ? (
              <div className="mt-12">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">{t.inEnglish}</h2>
                  <Link href={teamAuthorPath("en")} className="text-sm font-medium text-primary hover:underline">
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
