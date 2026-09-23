import { ExternalLink, FileText } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TodaysArticle } from "@/lib/dashboard/overview";

/**
 * The article the platform is working on now.
 *
 * The three figures beside it — search volume, difficulty, intent — are the
 * reason this article was chosen rather than another. Showing them turns the
 * panel from an announcement into an explanation, which is what the brief's
 * "why this topic?" asks for.
 */
export function TodaysArticlePanel({
  websiteId,
  article,
  t = getMessages("en").app.dash,
}: {
  websiteId: string;
  article: TodaysArticle | null;
  /** The panel's wording, defaulting to English. */
  t?: Messages["app"]["dash"];
}) {
  if (!article) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t.todaysArticle}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.nothingWrittenYet}
          </p>
          <Link
            href={`/websites/${websiteId}/content`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t.openContentPlan}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t.todaysArticle}
            </p>
            <h2 className="text-xl font-semibold leading-tight">
              <Link
                href={`/websites/${websiteId}/articles/${article.id}`}
                className="hover:underline"
              >
                {article.title}
              </Link>
            </h2>
            {article.publishedUrl ? (
              <a
                href={article.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 truncate text-sm text-muted-foreground hover:underline"
              >
                <span className="truncate">{article.publishedUrl}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <StatusBadge status={article.status} />
            )}
          </div>

          {/*
            A plain <img>: the file is hosted on the customer's own CMS, so
            next/image would need every customer domain in remotePatterns.
          */}
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              className="size-20 shrink-0 rounded-lg border object-cover"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <FileText
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t.searchVolume}</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {article.volume !== null ? `${article.volume}/mo` : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.difficulty}</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {article.difficulty !== null ? `${article.difficulty}/100` : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.articleType}</dt>
            <dd className="mt-1 font-semibold capitalize">
              {article.intent ?? "Guide"}
            </dd>
          </div>
        </dl>

        {article.targetKeyword ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t.whyThisTopic}</span>{" "}
            It targets {article.targetKeyword}
            {article.volume !== null
              ? `, searched about ${article.volume} times a month`
              : ""}
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
