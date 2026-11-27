import Link from "next/link";

import { BlogWriter } from "@/components/blog-writer/blog-writer";
import { MoreTools, ToolExplainer } from "@/components/tool-page";
import { blogWriterCopy } from "@/lib/i18n/blog-writer";
import { localePath, type Locale } from "@/lib/i18n/config";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { toolMetadata } from "@/lib/tools/i18n/meta";

const HREF = "/tools/blog-writer";

/**
 * Where "Write the full article in RepGet" and the sign-up prompt lead: the
 * sign-up page (English-only, like the header's link). The sign-up is
 * counted for this tool by the tool cookie set when the opening was written
 * (lib/tools/tool-tracking.ts) - not by a ?ref=, which is the affiliate
 * partners' parameter.
 */
const SIGN_UP_HREF = "/sign-up";

export function blogWriterMetadata(locale: Locale) {
  return toolMetadata(HREF, locale, blogWriterCopy(locale).metaDescription);
}

/**
 * The free AI Blog Writer (owner, 2026-11-27, repget-blog-writer-free-preview.html)
 * in any of the five languages, on the site's own header, footer and theme.
 * Prerendered: nothing here reads the request; the browser writes the
 * opening or asks the server (lib/tools/blog-writer-actions.ts).
 */
export function BlogWriterTool({ locale }: { locale: Locale }) {
  const copy = blogWriterCopy(locale);
  const title = TOOLS_COMMON[locale].tools[HREF].title;

  return (
    <div>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:pb-16">
          <Link prefetch={false} href={localePath(locale, "/tools")} className="text-sm font-medium text-primary-strong hover:underline">
            {copy.backLink}
          </Link>
          <div className="mx-auto mt-8 max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">{copy.description}</p>
          </div>

          <div className="mt-10">
            <BlogWriter copy={copy} locale={locale} signUpHref={SIGN_UP_HREF} />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm text-muted-foreground">
            <span>{copy.footer.name}</span>
            <Link prefetch={false} href={localePath(locale, "/tools")} className="font-medium text-primary-strong hover:underline">
              {copy.footer.explore} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>

      <ToolExplainer columns={copy.explainer} />
      <MoreTools currentHref={HREF} locale={locale} />
    </div>
  );
}
