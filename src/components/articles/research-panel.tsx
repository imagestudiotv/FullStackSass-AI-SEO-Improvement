import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { readResearch } from "@/lib/articles/research-types";
import { reviewHash } from "@/lib/articles/review";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import type { Locale } from "@/lib/i18n/config";
import { ResearchApproval } from "./research-approval";

export async function ResearchPanel({ websiteId, articleId, locale }: { websiteId: string; articleId: string; locale: Locale }) {
  const { site, access } = await requireWebsite(websiteId);
  const [article] = await db.select().from(articles)
    .where(and(eq(articles.websiteId, site.id), eq(articles.id, articleId))).limit(1);
  if (!article) return null;
  const research = readResearch(article.research);
  if (!research && !article.researchReviewRequired) return null;
  const t = CONTENT_COPY[locale];
  const revision = reviewHash(article);
  const held = article.researchReviewRequired && article.researchApprovedHash !== revision;
  return <section className="mb-6 rounded-xl border bg-card p-5 text-card-foreground" aria-label={t.sources}>
    <h2 className="font-semibold">{t.sources}</h2>
    <p className="mt-1 text-sm font-medium">{held ? t.held : article.researchApprovedHash ? t.approved : research?.status === "ready" ? t.ready : t.incomplete}</p>
    {research && <details className="mt-3 text-sm">
      <summary className="cursor-pointer py-2 text-primary">{t.sources} ({research.sources.length})</summary>
      <p className="mt-2"><strong>{t.question}:</strong> {research.question}</p>
      {research.businessAngle && <p className="mt-2"><strong>{t.angle}:</strong> {research.businessAngle}</p>}
      {research.claims.length > 0 && <ul className="mt-3 space-y-3">
        {research.claims.map((claim, i) => {
          const source = research.sources.find(source => source.id === claim.sourceId);
          return <li key={i} className="rounded-md border p-3">
            <p>{claim.text}</p>
            <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground">{claim.quote}</blockquote>
            {source && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-words text-xs text-primary underline">{source.title}</a>}
          </li>;
        })}
      </ul>}
      <ul className="mt-3 space-y-2">
        {research.sources.map(source => <li key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline">{source.title}</a>
          <span className="ml-2 text-xs text-muted-foreground">{source.retrievedAt.slice(0, 10)}</span>
        </li>)}
      </ul>
      {[...research.warnings, ...(research.quality?.issues ?? [])].map((warning, i) => <p key={i} className="mt-2 text-sm">{warning}</p>)}
      <p className="mt-3 text-xs text-muted-foreground">{t.limitations}</p>
    </details>}
    {held && <p className="mt-3 text-sm text-muted-foreground">{t.reviewHelp}</p>}
    {held && article.status === "draft" && access !== "viewer" &&
      <ResearchApproval websiteId={site.id} articleId={articleId} revision={revision} locale={locale} />}
  </section>;
}
