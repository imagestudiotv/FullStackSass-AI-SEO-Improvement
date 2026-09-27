import { ArrowUpRight, ExternalLink, FileText, Link2, Search, Sparkles, Stethoscope, TrendingUp } from "lucide-react";
import Link from "next/link";

import { AuthorityBadge } from "@/components/reports/authority-badge";
import { LineChart } from "@/components/reports/line-chart";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { DashboardOverview, TodaysArticle, Win } from "@/lib/dashboard/overview";
import { format, formatDate, formatNumber, plural } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Text = Messages["app"]["reports"];

function Unavailable({ t }: { t: Text }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{t.sectionUnavailable}</p>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-primary">{children}</p>;
}

/* ------------------------------------------------------------------------ */

export function AuthorityCard({ overview, t, locale }: { overview: DashboardOverview; t: Text; locale: Locale }) {
  const base = `/websites/${overview.websiteId}/backlinks`;
  const metrics = overview.backlinks.ok ? overview.backlinks.data : null;
  const history = overview.history.ok ? overview.history.data : null;
  return (
    <section aria-labelledby="authority-title" className="min-w-0 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>{t.websiteAuthority}</Eyebrow>
          <h2 id="authority-title" className="text-xl font-semibold">{t.backlinksHeading}</h2>
        </div>
        <div className="flex items-start gap-2">
          {/* Not shown when the section failed: "not set up" would be untrue. */}
          {metrics ? <AuthorityBadge reading={metrics.own} t={t} locale={locale} /> : null}
          <Link href={base} aria-label={t.openBacklinks} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
      {metrics ? (
        <div className="mt-4 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Link2 className="size-3.5" aria-hidden="true" /> {t.partnerNetworkLabel}
            </p>
            <Link href="/billing#addons" className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40">
              {t.getCredits}
            </Link>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted-foreground">{t.verifiedBacklinksLabel}</dt>
              <dd>
                <Link href={`${base}/links?tab=verified`} className="text-3xl font-semibold tabular-nums hover:underline">
                  {formatNumber(metrics.received.verified, locale)}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.availableCredits}</dt>
              <dd className="text-3xl font-semibold tabular-nums">
                {overview.credits ? (
                  <Link href={`${base}/credits`} className="hover:underline">{formatNumber(overview.credits.available, locale)}</Link>
                ) : (
                  <span className="text-base font-normal text-muted-foreground">{t.ownerOnlyShort}</span>
                )}
              </dd>
            </div>
          </dl>
          {history ? (
            <div className="mt-3">
              <LineChart
                points={history.points.map((p) => ({ day: p.day, value: p.active }))}
                label={t.chartActiveLinks}
                unit={{ kind: "count" }}
                unitLabel={t.unitLinks}
                locale={locale}
                noDataLabel={t.noData}
                dayLabel={t.colDate}
                valueLabel={t.unitLinks}
                instructions={t.chartInstructions}
                size="compact"
              />
              {history.undated > 0 ? (
                <p className="text-xs text-muted-foreground">{plural(t.undatedLinks, history.undated, { count: history.undated })}</p>
              ) : null}
            </div>
          ) : (
            <Unavailable t={t} />
          )}
        </div>
      ) : (
        <Unavailable t={t} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const ARTICLE_STATE: Record<TodaysArticle["state"], { status: string; tone: StatusTone; key: keyof Text }> = {
  published: { status: "published", tone: "positive", key: "stPublished" },
  awaiting_review: { status: "pending", tone: "warning", key: "stAwaitingReview" },
  approved: { status: "completed", tone: "positive", key: "stApproved" },
  scheduled: { status: "scheduled", tone: "neutral", key: "stScheduled" },
  draft: { status: "draft", tone: "neutral", key: "stDraft" },
  writing: { status: "generating", tone: "active", key: "stWriting" },
  failed: { status: "failed", tone: "critical", key: "stFailed" },
};

export function TodaysArticleCard({ overview, t, locale }: { overview: DashboardOverview; t: Text; locale: Locale }) {
  if (!overview.todaysArticle.ok) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <Eyebrow>{t.todaysArticle}</Eyebrow>
        <Unavailable t={t} />
      </section>
    );
  }
  const article = overview.todaysArticle.data;
  if (!article) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <Eyebrow>{t.todaysArticle}</Eyebrow>
        <p className="mt-3 text-sm text-muted-foreground">{t.nothingWritten}</p>
        <Link href={`/websites/${overview.websiteId}/content`} className="mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline">
          {t.openContentPlan}
        </Link>
      </section>
    );
  }
  const state = ARTICLE_STATE[article.state];
  const planned = article.plannedFor ? formatDate(article.plannedFor, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
  const stateHelp =
    article.state === "awaiting_review" ? t.stAwaitingReviewHelp
    : article.state === "approved" ? (planned ? format(t.stApprovedHelp, { date: planned }) : t.stApprovedNoDate)
    : article.state === "scheduled" && planned ? format(t.stScheduledHelp, { date: planned })
    : article.state === "draft" ? t.stDraftHelp
    : null;
  return (
    <section aria-labelledby="todays-title" className="min-w-0 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Eyebrow>{t.todaysArticle}</Eyebrow>
          <h2 id="todays-title" className="text-xl font-semibold leading-tight">
            <Link href={`/websites/${overview.websiteId}/articles/${article.id}`} className="hover:underline">
              {article.title}
            </Link>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={state.status} tone={state.tone} label={t[state.key] as string} />
            {article.publishedUrl ? (
              <a href={article.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:underline">
                <span className="truncate">{article.publishedUrl}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">{t.opensNewTab}</span>
              </a>
            ) : null}
          </div>
          {stateHelp ? <p className="text-xs text-muted-foreground">{stateHelp}</p> : null}
        </div>
        {/* A plain <img>: the file may be on the customer's own CMS. */}
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.imageUrl} alt="" className="aspect-video w-28 shrink-0 rounded-lg border object-cover" />
        ) : (
          <div className="flex aspect-video w-28 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4">
        <div>
          <dt className="text-xs text-muted-foreground">{t.searchVolume}</dt>
          <dd className="mt-1 font-semibold tabular-nums">{article.volume !== null ? format(t.perMonth, { n: formatNumber(article.volume, locale) }) : "-"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t.difficulty}</dt>
          <dd className="mt-1 font-semibold tabular-nums">{article.difficulty !== null ? `${article.difficulty}/100` : "-"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t.articleType}</dt>
          <dd className="mt-1 font-semibold">{article.intent ? intentLabel(article.intent, t) : "-"}</dd>
        </div>
      </dl>
      {article.targetKeyword ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t.whyThisTopic}</span>{" "}
          {article.volume !== null
            ? format(t.whyWithVolume, { keyword: article.targetKeyword, volume: formatNumber(article.volume, locale) })
            : format(t.whyKeyword, { keyword: article.targetKeyword })}
        </p>
      ) : null}
    </section>
  );
}

function intentLabel(intent: string, t: Text): string {
  switch (intent) {
    case "commercial":
      return t.intentCommercial;
    case "transactional":
      return t.intentTransactional;
    case "informational":
      return t.intentInformational;
    case "navigational":
      return t.intentNavigational;
    default:
      return intent;
  }
}

/* ------------------------------------------------------------------------ */

export function WinsCard({ overview, t, locale }: { overview: DashboardOverview; t: Text; locale: Locale }) {
  if (!overview.wins.ok) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">{t.winsTitle}</h2>
        <Unavailable t={t} />
      </section>
    );
  }
  const { items, from, to } = overview.wins.data;
  const last = new Date(to.getTime() - 86_400_000);
  const range = `${formatDate(from, locale, { day: "numeric", month: "short", timeZone: "UTC" })} - ${formatDate(last, locale, { day: "numeric", month: "short", timeZone: "UTC" })}`;
  const describe = (win: Win): { icon: React.ReactNode; title: string; detail: string } => {
    switch (win.kind) {
      case "published":
        return { icon: <FileText className="size-4" />, title: format(t.winPublished, { title: win.title }), detail: t.winPublishedDetail };
      case "links_received":
        return { icon: <Link2 className="size-4" />, title: plural(t.winLinksReceived, win.count, { count: win.count }), detail: t.winLinksReceivedDetail };
      case "links_given":
        return { icon: <Link2 className="size-4" />, title: plural(t.winLinksGiven, win.count, { count: win.count }), detail: t.winLinksGivenDetail };
      case "audit":
        return { icon: <Stethoscope className="size-4" />, title: format(t.winAudit, { score: win.score }), detail: t.winAuditDetail };
      case "clicks":
        return { icon: <TrendingUp className="size-4" />, title: plural(t.winClicks, win.clicks, { count: formatNumber(win.clicks, locale) }), detail: format(t.winClicksDetail, { date: formatDate(`${win.through}T00:00:00Z`, locale, { day: "numeric", month: "short", timeZone: "UTC" }) }) };
    }
  };
  return (
    <section aria-labelledby="wins-title" className="min-w-0 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="wins-title" className="text-xl font-semibold">{t.winsTitle}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{plural(t.winsCount, items.length, { count: items.length })}</span>
      </div>
      <p className="text-sm text-muted-foreground">{range} <span className="text-xs">(UTC)</span></p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t.noWins}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((win, i) => {
            const d = describe(win);
            return (
              <li key={i} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="mt-0.5 text-primary" aria-hidden="true">{d.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.detail}</p>
                </div>
                <Link href={win.href} className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {t.view}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

export function BestArticlesCard({ overview, t, locale }: { overview: DashboardOverview; t: Text; locale: Locale }) {
  const google = `/websites/${overview.websiteId}/google`;
  return (
    <section aria-labelledby="best-title" className="min-w-0 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="best-title" className="text-xl font-semibold">{t.bestArticles}</h2>
          <p className="text-sm text-muted-foreground">{t.bestArticlesHelp}</p>
        </div>
        <Link href={google} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t.openGoogleResults}</Link>
      </div>
      {!overview.bestArticles.ok ? (
        <Unavailable t={t} />
      ) : !overview.bestArticles.data.connected ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t.connectSearchConsole}{" "}
          <Link href={google} className="font-medium text-foreground underline underline-offset-4">{t.connect}</Link>
        </p>
      ) : overview.bestArticles.data.rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t.noArticleTraffic}</p>
      ) : (
        <>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <caption className="sr-only">{t.bestArticles}</caption>
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-medium">{t.colArticle}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t.colClicks}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t.colImpressions}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t.colPosition}</th>
                </tr>
              </thead>
              <tbody>
                {overview.bestArticles.data.rows.map((row) => (
                  <tr key={row.articleId} className="border-b last:border-b-0">
                    <td className="max-w-56 truncate py-2">
                      <Link href={`/websites/${overview.websiteId}/articles/${row.articleId}`} className="hover:underline">{row.title}</Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(row.clicks, locale)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(row.impressions, locale)}</td>
                    <td className="py-2 text-right tabular-nums">{row.position ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {format(t.searchConsoleThrough, { date: formatDate(`${overview.bestArticles.data.through}T00:00:00Z`, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) })}
          </p>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

export function SearchPanels({ overview, t, locale }: { overview: DashboardOverview; t: Text; locale: Locale }) {
  const base = `/websites/${overview.websiteId}`;
  const change = (value: number | null) =>
    value === null ? null : (
      <span className={cn("text-xs tabular-nums", value > 0 ? "text-emerald-700 dark:text-emerald-400" : value < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
        {value > 0 ? "+" : ""}
        {formatNumber(value, locale)} {t.vsPrevious}
      </span>
    );
  return (
    <section aria-labelledby="search-title" className="rounded-xl border bg-card p-5">
      <Eyebrow>{t.searchPerformance}</Eyebrow>
      <h2 id="search-title" className="text-xl font-semibold">{t.websiteTraffic}</h2>
      {!overview.search.ok ? (
        <Unavailable t={t} />
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden="true" /> {t.aiSearch}
            </h3>
            {overview.search.data.ai.checks === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t.aiNoChecks}{" "}
                <Link href={`${base}/ai-visibility`} className="font-medium text-foreground underline underline-offset-4">{t.openAiVisibility}</Link>
              </p>
            ) : (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.aiChecks}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{overview.search.data.ai.checks}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.aiMentioned}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{overview.search.data.ai.mentioned}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.aiCited}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{overview.search.data.ai.cited}</dd>
                  </div>
                </dl>
                <Link href={`${base}/ai-visibility`} className="mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline">{t.openAiVisibility}</Link>
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t.aiReferralNotMeasured}</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-medium">
                <Search className="size-4 text-primary" aria-hidden="true" /> {t.googleTraffic}
              </h3>
              <Link href={`${base}/google`} aria-label={t.openGoogleResults} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            {!overview.search.data.google.connected ? (
              <p className="mt-2 text-sm text-muted-foreground">{t.connectSearchConsoleTraffic}</p>
            ) : (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.siteClicks}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{formatNumber(overview.search.data.google.clicks, locale)}</dd>
                    <dd>{change(overview.search.data.google.clicksChange)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.siteImpressions}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{formatNumber(overview.search.data.google.impressions, locale)}</dd>
                    <dd>{change(overview.search.data.google.impressionsChange)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.avgPosition}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{overview.search.data.google.position ?? "-"}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  {format(t.siteWideThrough, {
                    days: overview.window.days,
                    date: overview.search.data.google.through
                      ? formatDate(`${overview.search.data.google.through}T00:00:00Z`, locale, { day: "numeric", month: "short", timeZone: "UTC" })
                      : "-",
                  })}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
