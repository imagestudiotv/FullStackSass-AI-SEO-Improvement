import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import { businessInitial } from "@/lib/blog/business";
import { BLOG_CHROME, homePath } from "@/lib/blog/locale";
import { jsonLdScript } from "@/lib/blog/shared";
import { blogSiteHosts } from "@/lib/blog/site-hosts";
import { discoverPath } from "@/lib/discover/paths";
import { CUSTOMER_STORIES_COPY } from "@/lib/i18n/blog-engagement";
import { localePath, type Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";
import { SUCCESS_STORY_COPY } from "@/lib/i18n/success-stories";
import { TRIAL_DAYS } from "@/lib/plans/features";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList, organizationRef } from "@/lib/structured-data";
import { successStoryPath } from "@/lib/success-stories/fields";
import type { SuccessStoryPage } from "@/lib/success-stories/stories";

/**
 * A success story from Admin -> Success stories (client, 2026-11-19), at
 * /success-stories/<slug> and /it/success-stories/<slug>: the Image Studio
 * case study's design (success-stories/image-studio/case-study.tsx) as a
 * template - the header with the business's logo, title and summary, the key
 * figures in the same grid, the story's own sections, then the same
 * invitation. Image Studio keeps its hand-built page.
 *
 * The story is in the language it was written in; the words around it are
 * the reader's. Every language's page names the English address as its
 * canonical, so the one text is one page to search engines.
 */

/** The story's own title and description where the administrator gave them, else its title and summary. */
export function storyMetadata(story: SuccessStoryPage, locale: Locale): Metadata {
  return {
    title: story.seoTitle ?? story.title,
    description: story.seoDescription ?? story.summary,
    // Not in TRANSLATED_PATHS: the canonical is the English address in every language.
    ...publicPageMetadata(successStoryPath("en", story.slug), { locale, openGraph: { type: "article" } }),
  };
}

export function SuccessStoryView({ story, locale, preview = false }: { story: SuccessStoryPage; locale: Locale; preview?: boolean }) {
  const copy = SUCCESS_STORY_COPY[locale];
  const t = getMessages(locale);
  const stories = CUSTOMER_STORIES_COPY[locale];
  const site = siteUrl();
  const path = successStoryPath(locale, story.slug);
  const listPath = localePath(locale, "/success-stories");
  const trail = [
    { name: BLOG_CHROME[locale].home, path: homePath(locale) },
    { name: t.successStories.eyebrow, path: listPath },
    { name: story.name, path },
  ];
  const published = story.publishedAt
    ? formatDate(story.publishedAt, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: story.title,
      description: story.seoDescription ?? story.summary,
      url: `${site}${successStoryPath("en", story.slug)}`,
      mainEntityOfPage: `${site}${successStoryPath("en", story.slug)}`,
      ...(story.publishedAt ? { datePublished: story.publishedAt.toISOString() } : {}),
      dateModified: story.updatedAt.toISOString(),
      author: organizationRef(site),
      publisher: organizationRef(site),
      about: { "@type": "Organization", name: story.name, ...(story.websiteUrl ? { url: story.websiteUrl } : {}) },
      ...(story.logoUrl ? { image: story.logoUrl.startsWith("/") ? `${site}${story.logoUrl}` : story.logoUrl } : {}),
    },
    breadcrumbList(site, trail),
  ];
  // Sanitised on save; again here, as every blog page's body is, so a row written another way cannot carry a script.
  const body = sanitizeHtml(story.bodyHtml, { siteHosts: blogSiteHosts() });
  const host = story.websiteUrl ? new URL(story.websiteUrl).hostname.replace(/^www\./, "") : null;

  return (
    <div className="px-4 py-14 sm:py-16">
      {preview ? null : (
        <script
          type="application/ld+json"
          // Escaped like every blog page's.
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}
      <article className="mx-auto flex max-w-3xl flex-col gap-14">
        <header className="flex flex-col gap-5">
          <nav aria-label={t.app.editor.breadcrumbLabel} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {trail.slice(0, -1).map((step) => (
              <span key={step.path} className="flex items-center gap-1.5">
                <Link href={step.path} className="text-primary hover:underline">
                  {step.name}
                </Link>
                <span aria-hidden="true">/</span>
              </span>
            ))}
            <span className="text-foreground">{story.name}</span>
          </nav>
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-card">
              {story.logoUrl ? (
                <Image src={story.logoUrl} alt={format(stories.logoLabel, { name: story.name })} width={56} height={56} sizes="56px" className="size-full object-cover" />
              ) : (
                <span className="text-xl font-semibold text-primary" role="img" aria-label={format(stories.logoLabel, { name: story.name })}>
                  {businessInitial(story.name)}
                </span>
              )}
            </span>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {story.name} · {story.categoryLabel ?? stories.byline}
            </p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{story.title}</h1>
          <p className="text-lg text-pretty text-muted-foreground">{story.summary}</p>
          {published ? <p className="text-sm text-muted-foreground">{format(copy.published, { date: published })}</p> : null}
        </header>

        {story.metrics.length > 0 ? (
          <section aria-label={copy.figuresLabel}>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              {story.metrics.map((metric) => (
                <div key={`${metric.value} ${metric.label}`} className="flex flex-col-reverse gap-1 bg-background p-4">
                  <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                  <dd className="font-mono text-2xl font-medium tracking-tight tabular-nums">{metric.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {body ? (
          <div
            className={`${ARTICLE_TABLE_CLASSES} [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_em]:italic [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:my-1.5 [&_p]:my-4 [&_p]:leading-7 [&_strong]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-4 [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:text-lg [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&>:first-child]:mt-0`}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : null}

        <section aria-labelledby="cta" className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-6 sm:p-8">
          <h2 id="cta" className="text-2xl font-semibold tracking-tight text-balance">
            {t.successStories.ctaTitle}
          </h2>
          <p className="text-muted-foreground">{format(t.successStories.ctaBody, { days: TRIAL_DAYS })}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={localePath(locale, "/audit")}>
                {t.successStories.ctaPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={localePath(locale, "/pricing")}>{t.successStories.ctaSecondary}</Link>
            </Button>
          </div>
        </section>

        {story.websiteUrl || story.discoverSlug ? (
          <footer className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground">
            {story.websiteUrl ? (
              <p>
                <a href={story.websiteUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  {host}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">
                    {format(copy.visitWebsite, { name: story.name })} {t.home.opensInNewTab}
                  </span>
                </a>
              </p>
            ) : null}
            {story.discoverSlug ? (
              <p>
                <Link href={discoverPath(locale, story.discoverSlug)} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  {format(copy.discoverProfile, { name: story.name })}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </p>
            ) : null}
          </footer>
        ) : null}
      </article>
    </div>
  );
}
