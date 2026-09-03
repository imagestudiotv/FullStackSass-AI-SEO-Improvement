import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCover } from "@/components/post-cover";
import {
  getPost,
  listPosts,
  relatedPosts,
  tableOfContents,
  withHeadingIds,
} from "@/lib/blog/posts";

/**
 * Every post is known at build time, so all of them are prerendered as static
 * HTML. A marketing page that waits on a server render is slower for the
 * reader and slower for the crawler, and page speed is a ranking factor we
 * would look silly ignoring on our own blog.
 */
export function generateStaticParams() {
  return listPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);

  // A missing slug is a genuine 404, not an empty page: a soft 404 keeps a
  // dead URL in the index indefinitely.
  if (!post) notFound();

  const related = relatedPosts(post.slug);
  const toc = tableOfContents(post.body);
  const body = withHeadingIds(post.body);

  /**
   * Article structured data. This is what lets a post appear as a rich result
   * rather than a plain blue link, and omitting it on an SEO product's own
   * blog would be hard to defend.
   */
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      articleSection: post.category,
      author: { "@type": "Organization", name: post.author },
    },
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
          // Structured data wants text, not markup.
          text: faq.answer.replace(/<[^>]+>/g, ""),
        },
      })),
    });
  }

  return (
    <div>
      <script
        type="application/ld+json"
        // Serialised from our own constants, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/" className="text-primary hover:underline">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog" className="text-primary hover:underline">
            Blog
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/blog/category/${post.category.toLowerCase()}`}
            className="text-primary hover:underline"
          >
            {post.category}
          </Link>
          <span aria-hidden="true">/</span>
          {/* Truncates rather than wrapping to three lines on a phone. */}
          <span className="max-w-full truncate text-foreground">
            {post.title}
          </span>
        </nav>

        <article>
          <header>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {post.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{post.author}</span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                <time dateTime={post.publishedAt}>
                  {formatDate(post.publishedAt)}
                </time>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                {post.readingMinutes} min read
              </span>
              {post.updatedAt ? (
                <span>Updated {formatDate(post.updatedAt)}</span>
              ) : null}
            </div>

            <PostCover
              slug={post.slug}
              title={post.title}
              category={post.category}
              className="mt-8 aspect-[100/56] w-full overflow-hidden rounded-xl border"
            />
          </header>

          {/*
            The short answer, first. Someone who reads nothing else should
            still leave with the point, and this is the block an assistant can
            quote whole.
          */}
          {post.shortAnswer ? (
            <div className="mt-8 rounded-xl border bg-card p-5">
              <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Short answer
              </p>
              <p className="mt-2 leading-7">{post.shortAnswer}</p>
            </div>
          ) : null}

          {/* Contents. Skipped on a short post, where it is just noise. */}
          {toc.length >= 3 ? (
            <nav
              aria-label="In this article"
              className="mt-6 rounded-xl border bg-primary/[0.04] p-5"
            >
              <p className="font-semibold">In this article</p>
              <ul className="mt-3 space-y-2">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="flex items-start gap-2 text-sm text-primary hover:underline"
                    >
                      <ArrowRight
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {/*
            Body is a constant in our own source, not user input, so rendering
            it as HTML carries none of the usual injection risk.

            Styled with explicit child selectors rather than @tailwindcss/
            typography, which this project does not install — the `prose` class
            elsewhere in the app is inert, and adding a dependency for a few
            pages is not worth it.

            scroll-mt on headings keeps an anchored heading clear of the fixed
            nav, which would otherwise cover the thing you just jumped to.
          */}
          <div
            className="mt-10 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_em]:italic [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:my-1.5 [&_p]:my-4 [&_p]:leading-7 [&_strong]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: body }}
          />

          {/*
            FAQ. Native <details> rather than a JS accordion: it works before
            hydration, it is keyboard accessible for free, and its content is
            in the HTML for anything reading the page without running scripts.
          */}
          {post.faqs && post.faqs.length > 0 ? (
            <section className="mt-14">
              <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
              <ul className="mt-5 space-y-3">
                {post.faqs.map((faq) => (
                  <li key={faq.question}>
                    <details className="group rounded-xl border bg-card px-5 py-4 [&[open]]:pb-5">
                      <summary className="cursor-pointer list-none font-semibold marker:content-none">
                        <span className="flex items-start justify-between gap-4">
                          {faq.question}
                          <ArrowRight
                            className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                            aria-hidden="true"
                          />
                        </span>
                      </summary>
                      <div
                        className="mt-3 leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4"
                        dangerouslySetInnerHTML={{ __html: faq.answer }}
                      />
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Sources, when the post makes claims worth backing. */}
          {post.sources && post.sources.length > 0 ? (
            <section className="mt-10 rounded-xl border bg-card p-5">
              <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Sources
              </h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
                {post.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </article>

        {related.length > 0 ? (
          <nav className="mt-12 rounded-xl border bg-card p-5" aria-label="More posts">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Keep reading
            </p>
            <ul className="mt-3 divide-y">
              {related.map((other) => (
                <li key={other.slug} className="py-3 first:pt-1 last:pb-1">
                  <Link
                    href={`/blog/${other.slug}`}
                    className="font-medium hover:text-primary"
                  >
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* The blog exists to bring people into the product, so it says so. */}
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl bg-foreground px-6 py-12 text-center text-background">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            See how your own site is doing
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty opacity-80">
            We read your pages and show you what is holding you back — on Google
            and with AI assistants. Free, no account needed.
          </p>
          <Link
            href="/audit"
            className="mt-7 inline-flex h-11 items-center rounded-full bg-primary px-7 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Check my website
          </Link>
        </div>
      </div>
    </div>
  );
}
