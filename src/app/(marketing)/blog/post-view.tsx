import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BlogArticle } from "@/components/blog-article";
import { BLOG_CHROME, blogPath, categoryPath, homePath, LANGUAGE_NAMES } from "@/lib/blog/locale";
import type { PostVersion } from "@/lib/blog/posts";
import { isTeamAuthor, TEAM_AUTHOR_PATH, jsonLdScript, plainText, type BlogPost } from "@/lib/blog/shared";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList, entityIds } from "@/lib/structured-data";

import { ClosingCta } from "../home-sections";

/**
 * One blog post's page, in any language: /blog/<slug> for English and
 * /<locale>/blog/<slug> for the others (lib/blog/locale.ts). The routes
 * find the post; this draws it, with its structured data, and links its
 * other published languages to it (hreflang in the metadata, and a visible
 * "Also in" line) so search engines read them as one article.
 */

/** hreflang for a post: each published language, plus x-default (English when there is one). */
function languages(versions: PostVersion[]): Record<string, string> | undefined {
  if (versions.length < 2) return undefined;
  const map: Record<string, string> = Object.fromEntries(versions.map((version) => [version.locale, version.path]));
  map["x-default"] = map[DEFAULT_LOCALE] ?? versions[0].path;
  return map;
}

export function postMetadata(post: BlogPost, versions: PostVersion[]): Metadata {
  const locale = post.locale ?? DEFAULT_LOCALE;
  /*
    The SEO title, when the post has one, is the whole <title>, exactly as
    written (client, 2026-10-08). Without one the title is the article's,
    with "| RepGet" added by the root layout, as every post has always had.
    The visible H1 is the article title either way.
  */
  const searchTitle = post.seoTitle || post.title;
  const base = publicPageMetadata(blogPath(locale, post.slug), {
    openGraph: {
      type: "article",
      title: searchTitle,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
    },
  });
  const alternates = languages(versions);
  return {
    title: post.seoTitle ? { absolute: post.seoTitle } : post.title,
    description: post.description,
    /*
      An article rather than a website, titled without the "| RepGet" suffix.
      The helper keeps the site picture (posts have none of their own) and
      sets og:url to the canonical.
    */
    ...base,
    alternates: alternates ? { ...base.alternates, languages: alternates } : base.alternates,
    twitter: {
      card: "summary_large_image",
      title: searchTitle,
      description: post.description,
      images: [SHARE_IMAGE],
    },
  };
}

export function BlogPostView({
  post,
  versions,
  related,
  sponsorship,
}: {
  post: BlogPost;
  versions: PostVersion[];
  related: BlogPost[];
  /** English posts only (lib/blog/sponsorship.ts is keyed by the English slug). */
  sponsorship?: ReactNode;
}) {
  const locale: Locale = post.locale ?? DEFAULT_LOCALE;
  const t = BLOG_CHROME[locale];

  /**
   * Article structured data. This is what lets a post appear as a rich result
   * rather than a plain blue link, and omitting it on an SEO product's own
   * blog would be hard to defend.
   */
  const site = siteUrl();
  const address = `${site}${blogPath(locale, post.slug)}`;
  /*
    Home, the blog, the post's category and the post - in the post's language
    (client, 2026-10-15: categories on every language's blog), the category
    under its name there and leading to that language's category page.
  */
  const categoryName = post.categoryLabel ?? post.category;
  const trail = [
    { name: t.home, path: homePath(locale) },
    { name: t.blog, path: blogPath(locale) },
    { name: categoryName, path: categoryPath(locale, post.categorySlug) },
    // The label written for the breadcrumb, when there is one (Admin -> Blog).
    { name: post.breadcrumbLabel || post.title, path: blogPath(locale, post.slug) },
  ];
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url: address,
      mainEntityOfPage: address,
      inLanguage: locale,
      // Posts have no picture of their own; this is the one shared links show.
      image: `${site}${SHARE_IMAGE.url}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      articleSection: categoryName,
      /*
        The post's primary and secondary keywords (Admin -> Blog). Only here:
        they are never written into the page as text (lib/blog/keywords.ts).
      */
      keywords: [post.primaryKeyword, ...(post.secondaryKeywords ?? [])].filter(Boolean).join(", ") || undefined,
      // The team's byline links to its author page; the author names the same page.
      author: {
        "@type": "Organization",
        name: post.author,
        ...(isTeamAuthor(post.author) ? { url: `${site}${TEAM_AUTHOR_PATH}` } : {}),
      },
      // The Organization the homepage defines, by reference rather than again.
      publisher: { "@id": entityIds(site).organization },
    },
    // The same trail as the visible breadcrumb below, in the same order.
    breadcrumbList(site, trail),
  ];

  /**
   * FAQ structured data, only when the post actually carries questions —
   * an empty FAQPage is a structured data error rather than a missed
   * opportunity.
   */
  if (post.faqs && post.faqs.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          // Structured data wants text, not markup: a line per paragraph or list item.
          text: plainText(faq.answer),
        },
      })),
    });
  }

  const others = versions.filter((version) => version.locale !== locale);

  return (
    <div>
      <script
        type="application/ld+json"
        // Escaped for a script block: titles and answers are typed by people.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12">
        <nav aria-label={getMessages(locale).app.editor.breadcrumbLabel} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {trail.slice(0, -1).map((step) => (
            <span key={step.path} className="flex items-center gap-1.5">
              <Link href={step.path} className="text-primary hover:underline">
                {step.name}
              </Link>
              <span aria-hidden="true">/</span>
            </span>
          ))}
          {/* Truncates rather than wrapping to three lines on a phone. */}
          <span className="max-w-full truncate text-foreground">{post.breadcrumbLabel || post.title}</span>
        </nav>

        {/* The same article in the reader's other languages (also in the hreflang). */}
        {others.length > 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t.alsoIn}:{" "}
            {others.map((version, index) => (
              <span key={version.locale}>
                {index > 0 ? " · " : ""}
                <Link href={version.path} hrefLang={version.locale} lang={version.locale} className="font-medium text-primary hover:underline">
                  {LANGUAGE_NAMES[version.locale]}
                </Link>
              </span>
            ))}
          </p>
        ) : null}

        <BlogArticle post={post} sponsorship={sponsorship} />

        {related.length > 0 ? (
          <nav className="mt-12 rounded-xl border bg-card p-5" aria-label={t.keepReading}>
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{t.keepReading}</p>
            <ul className="mt-3 divide-y">
              {related.map((other) => (
                <li key={other.slug} className="py-3 first:pt-1 last:pb-1">
                  <Link href={blogPath(locale, other.slug)} className="font-medium hover:text-primary">
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* The blog exists to bring people into the product: the homepage's closing panel, in the post's language. */}
      <ClosingCta t={getMessages(locale).home} href={(path) => localePath(locale, path)} />
    </div>
  );
}
