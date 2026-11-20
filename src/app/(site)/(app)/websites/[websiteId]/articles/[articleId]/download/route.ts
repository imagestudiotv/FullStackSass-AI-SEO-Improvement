import { notFound } from "next/navigation";

import { getArticle } from "@/lib/articles/actions";
import { articleDownloadHtml, articleDownloadName } from "@/lib/articles/download";
import { checkReleasable } from "@/lib/articles/review";
import { requireSession } from "@/lib/auth-guard";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { requireWebsitePage } from "@/lib/tenant";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Download the article as an HTML file (ticket 2026-11-19, item 4; lib/
 * articles/download.ts). The same gates as the article page - signed in,
 * access to the site, its plan - then the two that keep an unapproved draft
 * inside RepGet: getArticle's view (the two-step flow empties a held
 * article; a revision the team is still working on is served as the last
 * approved one) and checkReleasable, the gate every publishing path uses.
 * Anything else is a 404, never a hint that a draft exists.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ websiteId: string; articleId: string }> }) {
  await requireSession();
  const { websiteId, articleId } = await params;
  const gate = await requireWebsitePage(websiteId);
  await requireWebsitePlan(gate);
  if (!UUID_RE.test(articleId)) notFound();

  const article = await getArticle(websiteId, articleId);
  if (!article || article.preparing || !article.bodyHtml || article.status === "failed") notFound();
  if (!(await checkReleasable(article.id)).ok) notFound();

  const html = articleDownloadHtml({ ...article, bodyHtml: article.bodyHtml }, gate.site.language);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${articleDownloadName(article)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
