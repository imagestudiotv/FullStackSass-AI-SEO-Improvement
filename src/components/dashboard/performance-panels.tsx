import { ArrowUpRight, Sparkles } from "lucide-react";
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
}: {
  websiteId: string;
  articles: BestArticle[];
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Best articles</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your pages that bring the most people from Google.
            </p>
          </div>
          <Link
            href={`/websites/${websiteId}/google`}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Open Google results
          </Link>
        </div>

        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Connect Google Search Console to see which of your pages people
            find, and how that changes as we publish.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 text-left font-medium">
                    Articles ({articles.length})
                  </th>
                  <th className="pb-2 text-right font-medium">Clicks</th>
                  <th className="pb-2 text-right font-medium">Impressions</th>
                  <th className="pb-2 text-right font-medium">Position</th>
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
}: {
  websiteId: string;
  performance: SearchPerformance;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Search performance
          </p>
          <h2 className="mt-1 text-lg font-semibold">Website traffic</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              AI search traffic
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
              <p className="text-sm font-medium">Google traffic</p>
              <Link
                href={`/websites/${websiteId}/google`}
                aria-label="Open Google results"
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            {performance.hasGoogle ? (
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Clicks</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {compact(performance.clicks)}
                  </dd>
                  <Delta value={performance.clicksDelta} format={compact} label="vs last month" />
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Impressions</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {compact(performance.impressions)}
                  </dd>
                  <Delta value={performance.impressionsDelta} format={compact} label="vs last month" />
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Average position
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {performance.position || "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Connect Google Search Console to see clicks, impressions and
                where you rank.
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
}: {
  achievements: Achievements;
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
            Achievements
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {totalValue > 0
              ? `We have built ${money(totalValue)} of value for you`
              : "What we have built for you"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All of this happened automatically since you joined.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            Last 30 days
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
            <dt className="text-xs text-muted-foreground">Ad spend saved</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {money(adSpendSaved)}
            </dd>
            <p className="text-xs text-muted-foreground">
              What this traffic would cost in Google Ads.
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Backlink cost saved
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {money(backlinkCostSaved)}
            </dd>
            <p className="text-xs text-muted-foreground">
              For getting {backlinks} backlinks.
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Impressions</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {compact(impressions)}
            </dd>
            <p className="text-xs text-muted-foreground">
              How often you showed up in Google.
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Visitors from articles
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
              Your site&apos;s health
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {authority ?? "—"}
            </dd>
            <p className="text-xs text-muted-foreground">
              Out of 100, from your latest check.
            </p>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
