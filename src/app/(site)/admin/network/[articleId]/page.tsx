import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getReviewArticle } from "@/lib/admin/network";
import { readResearch } from "@/lib/articles/research-types";
import { reviewHash } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ReviewWorkspace } from "./review-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Article review" };

/**
 * Article ids are UUIDs. Anything else cannot be an article, and handing it
 * to the loader makes Postgres reject the comparison with the uuid column -
 * which surfaced as the global error page instead of "not found".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminNetworkArticlePage({ params }: PageProps<"/admin/network/[articleId]">) {
  const { articleId } = await params;
  if (!UUID.test(articleId)) notFound();
  const review = await getReviewArticle(articleId);
  if (!review) notFound();
  return (
    <>
      <ReviewWorkspace review={review} />
      <ResearchCheck articleId={articleId} />
    </>
  );
}

/**
 * The article's sources and their warnings, for the team to check before
 * approving. Under the two-step flow their approval covers the sources -
 * the customer is no longer asked to approve them (approveArticle in
 * lib/backlinks/managed.ts) - so what the customer's page used to ask the
 * customer to check is shown here. Admin-only: getReviewArticle above has
 * already required an administrator.
 */
async function ResearchCheck({ articleId }: { articleId: string }) {
  const [article] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article) return null;
  const research = readResearch(article.research);
  if (!research && !article.researchReviewRequired) return null;
  const held = article.researchReviewRequired && article.researchApprovedHash !== reviewHash(article);
  const warnings = [...(research?.warnings ?? []), ...(research?.quality?.issues ?? [])];

  return (
    <section className="mx-auto mt-6 w-full max-w-6xl rounded-xl border bg-card p-5 text-card-foreground" aria-labelledby="research-check">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="research-check" className="font-semibold">
          Sources
        </h2>
        <span className={held ? "text-sm font-medium text-amber-700 dark:text-amber-400" : "text-sm text-muted-foreground"}>
          {held ? "Flagged - check before approving" : article.researchApprovedHash ? "Checked" : "Not flagged"}
        </span>
      </div>
      {warnings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {research ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer py-2 text-primary">
            {research.sources.length} source{research.sources.length === 1 ? "" : "s"} and {research.claims.length} claim
            {research.claims.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-3">
            {research.claims.map((claim, i) => {
              const source = research.sources.find((s) => s.id === claim.sourceId);
              return (
                <li key={i} className="rounded-md border p-3">
                  <p>{claim.text}</p>
                  <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground">{claim.quote}</blockquote>
                  {source ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-words text-xs text-primary underline">
                      {source.title}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
