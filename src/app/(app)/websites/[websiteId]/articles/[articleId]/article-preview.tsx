import { PARTNER_LINK_SCOPE } from "@/components/partner-link-styles";
import { Notice } from "@/components/workspace/notice";
import { ARTICLE_TABLE_CLASSES } from "@/lib/articles/table-styles";
import { previewHtml } from "@/lib/articles/use-draft";
import type { Messages } from "@/lib/i18n/messages";

/**
 * How the article body reads in Preview.
 *
 * Explicit descendant selectors (the typography plugin is not installed, so
 * `prose` did nothing): every element the sanitiser keeps - h2 to h6, lists,
 * quotes, code, rules, tables, images - is styled, matching the editor's own
 * styles so the two tabs agree. Headings keep their ids (the contents list
 * links to them) and clear the sticky app header when jumped to. Wide tables
 * and code scroll inside their own box; long words and URLs wrap; the page
 * itself never scrolls sideways.
 */
export const ARTICLE_BODY_CLASSES = [
  ARTICLE_TABLE_CLASSES,
  "min-w-0 text-[15px] leading-7 text-foreground wrap-anywhere",
  "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:scroll-mt-20 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:scroll-mt-20 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:scroll-mt-20 [&_h4]:text-base [&_h4]:font-semibold",
  "[&_h5]:mt-4 [&_h5]:scroll-mt-20 [&_h5]:font-semibold [&_h6]:mt-4 [&_h6]:scroll-mt-20 [&_h6]:font-semibold",
  "[&_p]:my-4",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]",
  "[&_pre]:my-5 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4",
  "[&_hr]:my-8",
  "[&_img]:mx-auto [&_img]:my-6 [&_img]:block [&_img]:h-auto [&_img]:max-h-[30rem] [&_img]:w-auto [&_img]:max-w-[min(100%,36rem)] [&_img]:rounded-lg [&_img]:border [&_img]:object-contain",
].join(" ");

/**
 * Links to the customer's own site by path ("/services") lead there once
 * published, but inside this app the same path is a RepGet page. In Preview
 * they point at the customer's site instead, in a new tab, as the published
 * article's would. Section links ("#…") stay, so the contents list still
 * jumps within the preview; absolute links - partner links included, whose
 * highlight matches their exact address - are left exactly as they are.
 *
 * Runs on sanitised HTML only, whose attributes are always name="value"
 * with quotes escaped, which is what the pattern relies on.
 */
export function resolveSiteLinks(html: string, siteOrigin: string | null): string {
  if (!siteOrigin) return html;
  return html.replace(
    /<a((?:\s[a-z-]+="[^"]*")*?)\shref="(\/(?!\/)[^"]*)"((?:\s[a-z-]+="[^"]*")*)>/g,
    (_match, before: string, path: string, after: string) =>
      `<a${before} href="${siteOrigin}${path}"${after} target="_blank" rel="noopener">`,
  );
}

/** What the violet highlight on some links means - in Preview and above the editor alike. */
export function PartnerLegend({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      {/* The swatch repeats the highlight; the sentence says what it means. */}
      <span
        className="mt-1 inline-block size-3 shrink-0 rounded-sm bg-violet-500/25 ring-1 ring-violet-500/60"
        aria-hidden="true"
      />
      <span>{text}</span>
    </p>
  );
}

/**
 * The article as it will read: the working title, the featured picture
 * where the published page puts it, and the working text - unsaved edits
 * included, run through the same sanitiser as a save, so nothing pasted
 * into "Edit HTML" runs here before a save would have removed it.
 */
export function ArticlePreview({
  title,
  bodyHtml,
  imageUrl,
  imageAlt,
  unsaved,
  partnerInText,
  siteOrigin,
  t,
}: {
  title: string;
  bodyHtml: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** The preview shows edits that are not saved yet. */
  unsaved: boolean;
  partnerInText: boolean;
  /** The customer's site (https://example.com), for links written as a path. */
  siteOrigin: string | null;
  t: Messages["app"]["editor"];
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card">
      <article aria-label={t.previewLabel} className="mx-auto max-w-3xl space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {unsaved ? (
          <Notice tone="warning" role="status">
            {t.previewUnsavedNow}
          </Notice>
        ) : null}

        {partnerInText ? <PartnerLegend text={t.partnerLinksNote} /> : null}

        <h2 className="text-2xl font-semibold tracking-tight text-foreground wrap-anywhere sm:text-3xl">
          {title}
        </h2>

        {imageUrl ? (
          /*
            A plain <img>: the file lives on the customer's own CMS once
            published, so next/image would need every customer domain in
            remotePatterns.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={imageAlt ?? title} className="w-full rounded-lg border object-cover" />
        ) : null}

        <div
          className={`${PARTNER_LINK_SCOPE} ${ARTICLE_BODY_CLASSES}`}
          dangerouslySetInnerHTML={{ __html: resolveSiteLinks(previewHtml(bodyHtml), siteOrigin) }}
        />
      </article>
    </div>
  );
}
