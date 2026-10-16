import {
  ArrowRight,
  BarChart3,
  Bot,
  FileText,
  Link2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { localePath, type Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { CASE_STUDY_COPY, CASE_STUDY_PATH, IMAGE_STUDIO } from "@/lib/marketing/case-study-image-studio";
import { FREE_ARTICLES } from "@/lib/plans/features";

/**
 * Success stories.
 *
 * Case studies with real numbers, never invented ones: a fabricated testimonial
 * is the fastest way to lose the first real customer, and the first person to
 * recognise a made-up business is usually the one you most wanted to keep.
 *
 * The first is Image Studio (client, 2026-10-15), a live case study that says
 * it shares an owner with RepGet (lib/marketing/case-study-image-studio.ts):
 * its card leads the page. Below it, what every case study reports - things
 * the product genuinely measures and shows in a dashboard - and what the first
 * months honestly look like, then the invitation to be the next one.
 *
 * Copy comes from the dictionary, like the about and FAQ pages, so /es, /fr,
 * /it and /de render this same component in their own language rather than
 * drifting into five separate pages.
 */

/**
 * Icons stay in code while the words live in the dictionary: an icon is not
 * translatable, and putting a component name in a messages file would mean a
 * translator could break the build with a typo.
 *
 * Order matches `results` in the dictionary. A missing icon falls back rather
 * than throwing, so adding a fifth result cannot take the page down.
 */
const RESULT_ICONS: LucideIcon[] = [BarChart3, Bot, FileText, Link2];

export function SuccessStoriesContent({ t, locale }: { t: Messages; locale: Locale }) {
  const copy = t.successStories;
  const study = CASE_STUDY_COPY[locale];
  const n = (value: number) => formatNumber(value, locale);
  const day = (iso: string) =>
    formatDate(new Date(`${iso}T00:00:00Z`), locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">{copy.intro}</p>

        {/* The case studies; one so far. */}
        <article className="mt-12 rounded-2xl border bg-card p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{study.card.label}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Image Studio</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{study.card.summary}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { value: n(IMAGE_STUDIO.dayOne.keywords), label: study.figures.keywords },
              {
                value: n(IMAGE_STUDIO.writtenArticles),
                label: format(study.figures.written, {
                  live: n(IMAGE_STUDIO.liveArticles.length),
                  scheduled: n(IMAGE_STUDIO.writtenArticles - IMAGE_STUDIO.liveArticles.length),
                }),
              },
              { value: `≈ ${n(IMAGE_STUDIO.baseline.clicks)}`, label: study.figures.clicks },
            ].map((figure) => (
              <div key={figure.label} className="flex flex-col-reverse gap-0.5">
                <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                <dd className="font-mono text-2xl font-medium tabular-nums">{figure.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {format(study.card.meta, { start: day(IMAGE_STUDIO.started), updated: day(IMAGE_STUDIO.updated) })}
            </p>
            <Button asChild>
              <Link href={localePath(locale, CASE_STUDY_PATH)}>
                {study.card.cta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>

        {/* What the dashboard reports. Everything here is a real feature. */}
        <h2 className="mt-16 text-2xl font-semibold tracking-tight">{copy.resultsTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {copy.results.map((result, index) => {
            const Icon = RESULT_ICONS[index] ?? BarChart3;
            return (
              <Card key={result.label}>
                <CardContent className="py-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{result.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {result.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <h2 className="mt-16 text-2xl font-semibold tracking-tight">
          {copy.timelineTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {copy.timelineIntro}
        </p>

        <ol className="mt-8 space-y-4">
          {copy.timeline.map((step) => (
            <li
              key={step.when}
              className="flex flex-col gap-1 rounded-xl border bg-card p-5 sm:flex-row sm:gap-6"
            >
              <span className="shrink-0 text-sm font-semibold text-primary sm:w-40">
                {step.when}
              </span>
              <span className="text-sm text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>

        {/*
          The invitation, which is the point of the page as it stands. Someone
          reading a case-study page is deciding whether to trust us; the honest
          move is to ask them in rather than pretend the section is full.
        */}
        <div className="mt-16 rounded-2xl border bg-muted/40 p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            {copy.ctaTitle}
          </h2>
          {/* The offer checkout applies (lib/plans/features.ts); a price written here outlived its offer (it said EUR 1). */}
          <p className="mt-3 max-w-2xl text-muted-foreground">{format(copy.ctaBody, { count: FREE_ARTICLES })}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={localePath(locale, "/audit")}>
                {copy.ctaPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={localePath(locale, "/pricing")}>{copy.ctaSecondary}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
