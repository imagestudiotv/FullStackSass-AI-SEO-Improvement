import { ArrowUpRight, Sparkles } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Delta } from "@/components/ui/trend";
import type {
  Achievements,
  BestArticle,
  SearchPerformance,
} from "@/lib/dashboard/overview";

/**
 * The three reporting panels: best articles, search performance, achievements.
 *
 * All three depend on Search Console data, so each says plainly when it is not
 * connected rather than rendering zeros. A dashboard full of zeros reads as a
 * broken product; "connect Google to see this" reads as a next step.
 */

function compact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

function money(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(value < 100 ? 2 : 0)}`;
}

export function BestArticlesPanel({
  websiteId,
  articles,
  t = getMessages("en").app.dash,
}: {
  websiteId: string;
  articles: BestArticle[];
  /** The panel's wording, defaulting to English. */
  t?: Messages["app"]["dash"];
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t.bestArticles}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.bestArticlesHelp}
            </p>
          </div>
          <Link
            href={`/websites/${websiteId}/google`}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {t.openGoogleResults}
          </Link>
        </div>

        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.connectForPages}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 text-left font-medium">
                    Articles ({articles.length})
                  </th>
                  <th className="pb-2 text-right font-medium">{t.clicks}</th>
                  <th className="pb-2 text-right font-medium">{t.impressions}</th>
                  <th className="pb-2 text-right font-medium">{t.position}</th>
                </tr>
              </thead>
              <tbody>
                {articles.slice(0, 8).map((article) => (
                  <tr key={article.url} className="border-b last:border-0">
                    <td className="max-w-0 py-2 pr-3">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-medium text-primary hover:underline"
                      >
                        {article.title}
                      </a>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {article.clicks}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {compact(article.impressions)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {article.position}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export function SearchPerformancePanel({
  websiteId,
  performance,
  t = getMessages("en").app.dash,
}: {
  websiteId: string;
  performance: SearchPerformance;
  t?: Messages["app"]["dash"];
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t.searchPerformance}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{t.websiteTraffic}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              {t.aiSearchTraffic}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {!performance.hasAnalytics
                ? "Connect Google Analytics to see visits that came from AI assistants."
                : performance.aiSessions > 0
                  ? `${compact(performance.aiSessions)} visits in the last 30 days.`
                  : "No visits from AI search in the last 30 days."}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t.googleTraffic}</p>
              <Link
                href={`/websites/${websiteId}/google`}
                aria-label={t.openGoogleResults}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            {performance.hasGoogle ? (
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">{t.clicks}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {compact(performance.clicks)}
                  </dd>
                  <Delta value={performance.clicksDelta} format={compact} label={t.vsLastMonth} />
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t.impressions}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {compact(performance.impressions)}
                  </dd>
                  <Delta value={performance.impressionsDelta} format={compact} label={t.vsLastMonth} />
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t.averagePosition}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {performance.position || "-"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {t.connectForClicks}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AchievementsPanel({
  achievements,
  t = getMessages("en").app.dash,
}: {
  achievements: Achievements;
  t?: Messages["app"]["dash"];
}) {
  const {
    articles,
    backlinks,
    impressions,
    visitors,
    authority,
    adSpendSaved,
    backlinkCostSaved,
    totalValue,
  } = achievements;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t.achievements}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {totalValue > 0
              ? `We have built ${money(totalValue)} of value for you`
              : "What we have built for you"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.achievementsHelp}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            {t.last30Days}
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
            +{articles} articles
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
            +{backlinks} backlinks
          </span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="text-xs text-muted-foreground">{t.adSpendSaved}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {money(adSpendSaved)}
            </dd>
            <p className="text-xs text-muted-foreground">
              {t.adSpendHelp}
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t.backlinkCostSaved}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {money(backlinkCostSaved)}
            </dd>
            <p className="text-xs text-muted-foreground">
              For getting {backlinks} backlinks.
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.impressions}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {compact(impressions)}
            </dd>
            <p className="text-xs text-muted-foreground">
              {t.showedUpHelp}
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t.visitorsFromArticles}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {compact(visitors)}
            </dd>
            <p className="text-xs text-muted-foreground">
              Across {articles} published articles.
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t.siteHealth}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {authority ?? "-"}
            </dd>
            <p className="text-xs text-muted-foreground">
              {t.siteHealthHelp}
            </p>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
