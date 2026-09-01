import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getPost, listPosts, relatedPosts } from "@/lib/blog/posts";

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

  /**
   * Article structured data. This is what lets a post appear as a rich result
   * rather than a plain blue link, and omitting it on an SEO product's own
   * blog would be hard to defend.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: post.author },
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <script
        type="application/ld+json"
        // Serialised from our own constants, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
        <Link href="/blog">
          <ArrowLeft className="size-4" />
          All posts
        </Link>
      </Button>

      <article>
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>
              {formatDate(post.publishedAt)}
            </time>
            <span className="mx-2">·</span>
            {post.readingMinutes} min read
          </p>
        </header>

        {/*
          Body is a constant in our own source, not user input, so rendering it
          as HTML carries none of the usual injection risk.

          Styled with explicit child selectors rather than @tailwindcss/
          typography, which this project does not install — the `prose` class
          elsewhere in the app is inert, and adding a dependency for three
          pages is not worth it.
        */}
        <div
          className="mt-10 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_li]:my-1.5 [&_p]:my-4 [&_p]:leading-7 [&_strong]:font-medium [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />
      </article>

      {/* The blog exists to bring people into the product, so it says so. */}
      <aside className="mt-14 rounded-lg border bg-muted/30 p-6">
        <p className="font-medium">See how your own site is doing</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your address and we will check your pages for the problems above.
          Free, and no account needed.
        </p>
        <Button asChild className="mt-4">
          <Link href="/audit">
            Check my website
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </aside>

      {related.length > 0 ? (
        <nav className="mt-14 border-t pt-8" aria-label="More posts">
          <p className="text-sm font-medium">Read next</p>
          <ul className="mt-4 space-y-4">
            {related.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/blog/${other.slug}`}
                  className="font-medium hover:underline"
                >
                  {other.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {other.description}
                </p>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
