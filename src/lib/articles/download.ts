import { sanitizeHtml } from "@/lib/articles/sanitize";
import { escapeHtml } from "@/lib/email/layout";

/**
 * "The client is having the article ready to publish or download" (ticket
 * 2026-11-19, item 4): the article as one standalone HTML file - title, meta
 * description, featured image and body - which pastes into any CMS, opens in
 * a browser and imports into Google Docs or Word. The route
 * (websites/[websiteId]/articles/[articleId]/download) serves only what
 * getArticle shows the customer and only what may be released
 * (checkReleasable): never a draft the team has not approved.
 */
export type DownloadableArticle = {
  title: string;
  slug: string | null;
  metaDescription: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  bodyHtml: string;
};

/** `lang`: a language code when the site has one (websites.language may hold a name such as "English", which is left out). */
export function articleDownloadHtml(article: DownloadableArticle, lang?: string | null): string {
  const langAttr = lang && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(lang) ? ` lang="${lang}"` : "";
  const title = escapeHtml(article.title);
  const meta = article.metaDescription ? `\n<meta name="description" content="${escapeHtml(article.metaDescription)}">` : "";
  const image = article.imageUrl && /^https?:\/\//i.test(article.imageUrl)
    ? `\n<p><img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.imageAlt ?? "")}"></p>`
    : "";
  return `<!doctype html>
<html${langAttr}>
<head>
<meta charset="utf-8">
<title>${title}</title>${meta}
</head>
<body>
<h1>${title}</h1>${image}
${sanitizeHtml(article.bodyHtml)}
</body>
</html>
`;
}

/** "my-article.html": the slug, or a safe form of the title. */
export function articleDownloadName(article: Pick<DownloadableArticle, "slug" | "title">): string {
  const base = (article.slug || article.title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "article"}.html`;
}
