import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { BLOG_CHROME, homePath } from "@/lib/blog/locale";
import { jsonLdScript } from "@/lib/blog/shared";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";
import { CASE_STUDY_COPY, CASE_STUDY_PATH, IMAGE_STUDIO } from "@/lib/marketing/case-study-image-studio";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList, entityIds } from "@/lib/structured-data";
import { cn } from "@/lib/utils";

/**
 * The Image Studio case study, in every language (lib/marketing/
 * case-study-image-studio.ts holds the numbers and the words): /success-stories/
 * image-studio and /it/success-stories/image-studio and the rest render this.
 *
 * Every figure is drawn from IMAGE_STUDIO, the chart included, so the monthly
 * update is one file and nothing on the page can disagree with it.
 */

const DAY = 24 * 60 * 60 * 1000;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function dates(locale: Locale) {
  // The first of the month is "1er" in French and "1°" in Italian; Intl writes "1".
  const first = (iso: string, text: string) =>
    utc(iso).getUTCDate() !== 1 ? text : locale === "fr" ? text.replace(/^1(?=\D)/, "1er") : locale === "it" ? text.replace(/^1(?=\D)/, "1°") : text;
  const as = (options: Intl.DateTimeFormatOptions) => (iso: string) => first(iso, formatDate(utc(iso), locale, { ...options, timeZone: "UTC" }));
  return {
    /** 1 October 2026 */
    long: as({ day: "numeric", month: "long", year: "numeric" }),
    /** 1 October */
    dayMonth: as({ day: "numeric", month: "long" }),
    /** 1 Oct */
    short: as({ day: "numeric", month: "short" }),
    /** The chart's labels, on two lines: "5" over "Oct". */
    day: (iso: string) => formatDate(utc(iso), locale, { day: "numeric", timeZone: "UTC" }),
    month: (iso: string) => formatDate(utc(iso), locale, { month: "short", timeZone: "UTC" }),
  };
}

/** Steps the axis can count in: at most four lines above zero, whatever the numbers grow to. */
const STEPS = [10, 20, 25, 40, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

/**
 * The chart, to scale: the axis runs to the step above the best week; a week
 * that began on or after RepGet's first day is highlighted, and the first
 * day is marked where it falls inside its week.
 */
export function clicksChart() {
  const weeks = IMAGE_STUDIO.weeks;
  const top = Math.max(...weeks.map((week) => week.clicks));
  const step = STEPS.find((candidate) => Math.ceil(top / candidate) <= 4) ?? STEPS[STEPS.length - 1];
  const axisMax = Math.ceil(top / step) * step;
  const started = utc(IMAGE_STUDIO.started).getTime();
  const startIndex = weeks.findIndex((week) => started >= utc(week.start).getTime() && started < utc(week.start).getTime() + 7 * DAY);
  const startDay = startIndex >= 0 ? (started - utc(weeks[startIndex].start).getTime()) / DAY : 0;
  const before = weeks.filter((week) => utc(week.start).getTime() + 7 * DAY <= started);
  return {
    axisMax,
    ticks: Array.from({ length: axisMax / step }, (_, index) => (index + 1) * step),
    startAt: startIndex >= 0 ? ((startIndex + startDay / 7) / weeks.length) * 100 : null,
    bars: weeks.map((week, index) => ({
      ...week,
      height: (week.clicks / axisMax) * 100,
      after: utc(week.start).getTime() >= started,
      // The month under its first week only, so narrow columns are not crowded.
      newMonth: index === 0 || utc(week.start).getUTCMonth() !== utc(weeks[index - 1].start).getUTCMonth(),
    })),
    /** The last day the bars cover: the last week's Sunday. */
    end: new Date(utc(weeks[weeks.length - 1].start).getTime() + 6 * DAY).toISOString().slice(0, 10),
    min: Math.min(...before.map((week) => week.clicks)),
    max: Math.max(...before.map((week) => week.clicks)),
  };
}

export function caseStudyMetadata(locale: Locale): Metadata {
  const c = CASE_STUDY_COPY[locale];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    ...publicPageMetadata(CASE_STUDY_PATH, { locale, openGraph: { type: "article" } }),
  };
}

export function CaseStudyPage({ locale }: { locale: Locale }) {
  const c = CASE_STUDY_COPY[locale];
  const t = getMessages(locale);
  const d = dates(locale);
  const n = (value: number) => formatNumber(value, locale);
  const s = IMAGE_STUDIO;
  const chart = clicksChart();
  const live = s.liveArticles.length;
  const scheduled = s.writtenArticles - live;
  const lastWeek = s.weeks[s.weeks.length - 1];
  // The first two to go live, in date order.
  const [first, second] = [...s.liveArticles].sort((a, b) => a.live.localeCompare(b.live));
  // Many weeks make narrow columns: on a phone, only the highlighted weeks keep their value (the table has all).
  const crowded = chart.bars.length > 12;
  // The articles' titles are English, as on imagestudio.com.
  const titleLang = locale === DEFAULT_LOCALE ? undefined : "en";

  const site = siteUrl();
  const path = localePath(locale, CASE_STUDY_PATH);
  const trail = [
    { name: BLOG_CHROME[locale].home, path: homePath(locale) },
    { name: t.successStories.eyebrow, path: localePath(locale, "/success-stories") },
    { name: "Image Studio", path },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: c.title,
      description: c.metaDescription,
      inLanguage: locale,
      url: `${site}${path}`,
      mainEntityOfPage: `${site}${path}`,
      datePublished: s.published,
      dateModified: s.updated,
      author: { "@id": entityIds(site).organization },
      publisher: { "@id": entityIds(site).organization },
      about: { "@type": "Organization", name: "Image Studio", url: s.site },
    },
    breadcrumbList(site, trail),
  ];

  const figures = [
    { value: n(s.dayOne.keywords), label: c.figures.keywords },
    { value: n(s.plannedArticles), label: c.figures.planned },
    { value: n(s.writtenArticles), label: format(c.figures.written, { live, scheduled }) },
    { value: n(s.aiQuestions), label: c.figures.ai },
    { value: `≈ ${n(s.baseline.clicks)}`, label: c.figures.clicks },
    { value: `≈ ${n(s.baseline.position)}`, label: c.figures.position },
  ];

  return (
    <div className="px-4 py-14 sm:py-16">
      <script
        type="application/ld+json"
        // Built from constants here, but escaped like every blog page's.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <article className="mx-auto flex max-w-3xl flex-col gap-14">
        <header className="flex flex-col gap-5">
          <nav aria-label={t.app.editor.breadcrumbLabel} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {trail.slice(0, -1).map((step) => (
              <span key={step.path} className="flex items-center gap-1.5">
                <Link href={step.path} className="text-primary hover:underline">
                  {step.name}
                </Link>
                <span aria-hidden="true">/</span>
              </span>
            ))}
            <span className="text-foreground">Image Studio</span>
          </nav>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{format(c.eyebrow, { date: d.long(s.started) })}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{c.title}</h1>
          <p className="text-lg text-pretty text-muted-foreground">{c.lede}</p>
          <p className="text-sm text-muted-foreground">{format(c.updated, { date: d.long(s.updated), next: d.long(s.nextUpdate) })}</p>
        </header>

        <section>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
            {figures.map((figure) => (
              <div key={figure.label} className="flex flex-col-reverse gap-1 bg-background p-4">
                <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                <dd className="font-mono text-2xl font-medium tracking-tight tabular-nums">{figure.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="client" className="flex flex-col gap-4">
          <h2 id="client" className="text-2xl font-semibold tracking-tight">
            {c.clientTitle}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3 text-pretty">
              {c.client.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{c.servicesLabel}</dt>
                <dd className="mt-1">{c.services}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{c.buyersLabel}</dt>
                <dd className="mt-1">{c.buyers}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-labelledby="start" className="flex flex-col gap-4">
          <h2 id="start" className="text-2xl font-semibold tracking-tight">
            {c.startTitle}
          </h2>
          <p>{format(c.startIntro, { from: d.dayMonth(s.baselineFrom), to: d.long(s.baselineTo) })}</p>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              { value: n(s.baseline.clicks), label: c.baseline.clicks },
              { value: n(s.baseline.impressions), label: c.baseline.impressions },
              { value: n(s.baseline.position), label: c.baseline.position },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse gap-0.5 border-t-2 border-foreground pt-2">
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="font-mono text-xl tabular-nums">≈ {stat.value}</dd>
              </div>
            ))}
          </dl>
          <p>{format(c.auditIntro, { date: d.long(s.started), score: n(s.audit.score), pages: n(s.audit.pagesRead) })}</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {c.auditFindings.map((finding) => (
              <li key={finding}>
                {format(finding, {
                  noindex: n(s.audit.noindex),
                  titles: n(s.audit.longTitles),
                  thin: n(s.audit.thinPages),
                  minor: n(s.audit.minor),
                })}
              </li>
            ))}
          </ul>
          <p>{format(c.aiStart, { questions: n(s.aiQuestions), checks: n(s.aiChecks), from: d.dayMonth(s.started), to: d.long(s.aiTo) })}</p>
        </section>

        <section aria-labelledby="done" className="flex flex-col gap-4">
          <h2 id="done" className="text-2xl font-semibold tracking-tight">
            {c.doneTitle}
          </h2>
          <ol className="flex flex-col border-l-2 border-border">
            <Step when={format(c.steps.plan.when, { date: d.short(s.started) })} title={c.steps.plan.title}>
              <p>{format(c.steps.plan.body, { keywords: n(s.dayOne.keywords), planned: n(s.dayOne.plannedArticles) })}</p>
            </Step>
            <Step
              when={format(c.steps.articles.when, { from: d.short(s.started), to: d.short(s.writtenTo) })}
              title={format(c.steps.articles.title, { written: n(s.writtenArticles) })}
            >
              <p>{format(c.steps.articles.body, { words: n(s.averageWords), live: n(live) })}</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {s.liveArticles.map((article) => (
                  <li key={article.url}>
                    <a href={article.url} target="_blank" rel="noopener" className="text-primary underline-offset-4 hover:underline">
                      <span lang={titleLang}>{article.title}</span>
                      <span className="sr-only"> {t.home.opensInNewTab}</span>
                    </a>{" "}
                    <span className="text-muted-foreground">({d.short(article.live)})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5">{format(c.steps.articles.rest, { scheduled: n(scheduled) })}</p>
            </Step>
            <Step when={format(c.steps.ai.when, { date: d.short(s.started) })} title={c.steps.ai.title}>
              <p>{format(c.steps.ai.body, { questions: n(s.aiQuestions) })}</p>
            </Step>
          </ol>
        </section>

        <section aria-labelledby="results" className="flex flex-col gap-4">
          <h2 id="results" className="text-2xl font-semibold tracking-tight">
            {c.resultsTitle}
          </h2>
          <figure className="flex flex-col gap-3">
            <h3 className="font-semibold">{c.chartTitle}</h3>
            {/* The bars as one image for screen readers; the table under "Show the numbers" has every value. */}
            <div
              role="img"
              aria-label={format(c.chartLabel, {
                from: d.dayMonth(s.weeks[0].start),
                to: d.long(chart.end),
                min: n(chart.min),
                max: n(chart.max),
                last: n(lastWeek.clicks),
                lastWeek: d.dayMonth(lastWeek.start),
              })}
              className="flex flex-col gap-1.5"
            >
            <div aria-hidden="true" className="relative ml-9 h-56 border-b border-foreground">
              {chart.ticks.map((tick) => (
                <div key={tick} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(tick / chart.axisMax) * 100}%` }}>
                  <span className="absolute -left-9 -top-2 w-7 text-right font-mono text-[0.7rem] text-muted-foreground">{n(tick)}</span>
                </div>
              ))}
              {chart.startAt !== null ? (
                // Behind the bars, so their values stay readable.
                <div className="absolute inset-y-0 border-l-2 border-dashed border-primary" style={{ left: `${chart.startAt}%` }}>
                  <span className="absolute right-1.5 -top-0.5 bg-background px-1 text-[0.7rem] font-semibold whitespace-nowrap text-primary">
                    {format(c.startMarker, { date: d.short(s.started) })}
                  </span>
                </div>
              ) : null}
              <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: `repeat(${chart.bars.length}, minmax(0, 1fr))` }}>
                {chart.bars.map((bar) => (
                  <div
                    key={bar.start}
                    data-week={bar.start}
                    className={cn("relative mx-[18%] rounded-t-sm", bar.after ? "bg-primary" : "bg-muted-foreground/30")}
                    style={{ height: `${bar.height}%` }}
                  >
                    <b
                      className={cn(
                        "absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 bg-background px-0.5 font-mono text-[0.7rem] font-medium whitespace-nowrap",
                        bar.after ? "text-primary" : "text-muted-foreground",
                        crowded && !bar.after && "max-sm:hidden",
                      )}
                    >
                      {n(bar.clicks)}
                    </b>
                  </div>
                ))}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="ml-9 grid text-center font-mono text-[0.68rem] leading-tight text-muted-foreground"
              style={{ gridTemplateColumns: `repeat(${chart.bars.length}, minmax(0, 1fr))` }}
            >
              {chart.bars.map((bar) => (
                <span key={bar.start}>
                  {d.day(bar.start)}
                  <br />
                  {bar.newMonth ? d.month(bar.start) : " "}
                </span>
              ))}
            </div>
            </div>
            <figcaption className="text-sm text-muted-foreground">{format(c.chartCaption, { date: d.long(s.dataTo) })}</figcaption>
          </figure>
          <details className="rounded-lg border px-4 py-2.5">
            <summary className="cursor-pointer text-sm font-medium">{c.showNumbers}</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                      {c.columns.week}
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-right font-medium">
                      {c.columns.clicks}
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-right font-medium">
                      {c.columns.impressions}
                    </th>
                    <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                      {c.columns.position}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.weeks.map((week) => (
                    <tr key={week.start} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{d.short(week.start)}</td>
                      <td className="px-3 py-1.5 text-right">{n(week.clicks)}</td>
                      <td className="px-3 py-1.5 text-right">{n(week.impressions)}</td>
                      <td className="py-1.5 pl-3 text-right">{n(week.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="text-pretty">
            {format(c.resultsBody, {
              week: d.dayMonth(lastWeek.start),
              clicks: n(lastWeek.clicks),
              position: n(lastWeek.position),
              before: n(s.baseline.position),
              first: d.dayMonth(first.live),
              second: d.dayMonth(second.live),
              next: d.long(s.nextUpdate),
            })}
          </p>
        </section>

        <section aria-labelledby="quote" className="flex flex-col gap-3">
          <h2 id="quote" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {c.quoteLabel}
          </h2>
          <figure className="flex flex-col gap-3 border-l-[3px] border-primary pl-5">
            <blockquote className="text-lg leading-relaxed text-pretty">
              <p>{format(c.quote, { keywords: n(s.dayOne.keywords), planned: n(s.dayOne.plannedArticles) })}</p>
            </blockquote>
            <figcaption className="text-sm text-muted-foreground">{format(c.quoteBy, { name: s.owner })}</figcaption>
          </figure>
        </section>

        <section aria-labelledby="next" className="flex flex-col gap-4">
          <h2 id="next" className="text-2xl font-semibold tracking-tight">
            {c.nextTitle}
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {c.next.map((item) => (
              <li key={item}>{format(item, { scheduled: n(scheduled), next: d.long(s.nextUpdate) })}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cta" className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-6 sm:p-8">
          <h2 id="cta" className="text-2xl font-semibold tracking-tight text-balance">
            {c.ctaTitle}
          </h2>
          <p className="text-muted-foreground">{c.ctaBody}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={localePath(locale, "/audit")}>
                {c.ctaPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={localePath(locale, "/pricing")}>{c.ctaSecondary}</Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="faq" className="flex flex-col gap-3">
          <h2 id="faq" className="text-2xl font-semibold tracking-tight">
            {c.faqTitle}
          </h2>
          {c.faq.map((item) => (
            <details key={item.q} className="rounded-lg border px-4 py-3">
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="mt-2 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </section>

        <footer className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{c.sourcesTitle}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>{format(c.sources[0], { from: d.dayMonth(s.dataFrom), to: d.long(s.dataTo) })}</li>
            <li>{format(c.sources[1], { date: d.long(s.updated) })}</li>
          </ul>
          <p>
            <a href={s.site} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
              imagestudio.com
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">{t.home.opensInNewTab}</span>
            </a>
          </p>
        </footer>
      </article>
    </div>
  );
}

/** One dated step of the work, on the timeline's line. */
function Step({ when, title, children }: { when: string; title: string; children: ReactNode }) {
  return (
    <li className="relative flex flex-col gap-1 pb-6 pl-6 last:pb-0">
      <span aria-hidden="true" className="absolute -left-1.75 top-1.5 size-3 rounded-full border-2 border-primary bg-background" />
      <span className="font-mono text-xs text-primary tabular-nums">{when}</span>
      <h3 className="font-semibold">{title}</h3>
      <div className="text-muted-foreground">{children}</div>
    </li>
  );
}
