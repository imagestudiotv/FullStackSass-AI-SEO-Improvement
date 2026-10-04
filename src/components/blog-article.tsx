import { ArrowRight, CalendarDays, Clock } from "lucide-react";

import { PostCover } from "@/components/post-cover";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import { tableOfContents, withHeadingIds, type BlogPost } from "@/lib/blog/shared";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One blog post: title, byline, cover, short answer, contents, body, FAQ and
 * sources. Rendered by the public post page and by the admin editor's
 * preview, so what an administrator previews is exactly what goes out.
 *
 * The body and FAQ answers are sanitised HTML (on save, and again by the
 * preview for unsaved text); the short answer, questions and source labels
 * are plain text, which React escapes.
 */
export function BlogArticle({ post }: { post: BlogPost }) {
  const toc = tableOfContents(post.body);
  const body = withHeadingIds(post.body);

  return (
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
        Sanitised HTML (see above).

        Styled with explicit child selectors rather than @tailwindcss/
        typography, which this project does not install — the `prose` class
        elsewhere in the app is inert, and adding a dependency for a few
        pages is not worth it.

        scroll-mt on headings keeps an anchored heading clear of the fixed
        nav, which would otherwise cover the thing you just jumped to.
      */}
      <div
        className={`${ARTICLE_TABLE_CLASSES} mt-10 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_em]:italic [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:my-1.5 [&_p]:my-4 [&_p]:leading-7 [&_strong]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg`}
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
            {post.faqs.map((faq, index) => (
              <li key={`${index}:${faq.question}`}>
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
                  {/*
                    The answer's formatting, from the admin editor's compact
                    toolbar: paragraphs, bold, italic, links and lists, styled
                    as the body styles them (no typography plugin: without
                    these, lists showed no bullets or numbers and paragraphs
                    ran together). space-y spaces the answer's own blocks
                    only, so paragraphs inside list items stay tight.
                  */}
                  <div
                    className="mt-3 space-y-3 leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_em]:italic [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
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
            {post.sources.map((source, index) => (
              <li key={`${index}:${source.url}`}>
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
  );
}
