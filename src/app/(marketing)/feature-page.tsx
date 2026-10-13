import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  FileText,
  Link2,
  Network,
  Plus,
  Radar,
  ShieldCheck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";
import type { FeatureExample, FeaturePage } from "@/lib/marketing/feature-pages";

import { SectionHeading } from "./home-sections";

/**
 * The layout of the two footer product pages, /backlinks and
 * /rank-on-chatgpt (lib/marketing/feature-pages.ts holds their words and
 * says why every claim is one the product backs): a headline, what you get,
 * before and after, three steps, a real example article, an optional
 * comparison table, questions, and a closing call to sign up.
 *
 * Server-rendered and static. The questions are native <details> (as on the
 * homepage), so answers are in the HTML whether or not they are open, and
 * the same list is published as FAQPage structured data.
 */

const CTA = "h-12 rounded-full px-7 text-base";

/** Benefit icons, in the order of each page's `benefits`. */
const ICONS: Record<FeaturePage["path"], LucideIcon[]> = {
  "/backlinks": [FileText, Network, Link2, Wallet],
  "/rank-on-chatgpt": [Bot, FileText, Link2, Radar],
};

export function FeaturePageContent({ page, example, locale = "en" }: { page: FeaturePage; example: FeatureExample; locale?: Locale }) {
  const icons = ICONS[page.path];
  // English paths in the copy; the visitor's language where that page exists.
  const href = (path: string) => localePath(locale, path);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from our own copy (lib/marketing/feature-pages.ts), never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="px-4 pt-16 pb-14 text-center sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{page.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {page.title} <span className="text-primary">{page.accent}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{page.intro}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className={CTA}>
              <Link href="/sign-up">
                {page.primaryCta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className={CTA}>
              <Link href={href(page.secondaryCta.href)}>{page.secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title={page.benefitsTitle} center />
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {page.benefits.map((benefit, index) => {
              const Icon = icons[index] ?? ShieldCheck;
              return (
                <li key={benefit.title} className="rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title={page.compare.title} center />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold text-muted-foreground">{page.compare.without.label}</h3>
              <ul className="mt-4 space-y-3">
                {page.compare.without.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm">
                    <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="font-semibold text-primary">{page.compare.with.label}</h3>
              <ul className="mt-4 space-y-3">
                {page.compare.with.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title={page.stepsTitle} center />
          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {page.steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border bg-card p-6">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ExampleSection page={page} example={example} locale={locale} />

      {page.table ? (
        <section className="border-t px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHeading title={page.table.title} center />
            {/* relative: an sr-only cell inside an overflow scroller is placed against it, not the page. */}
            <div className="relative mt-10 overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="p-4">
                      <span className="sr-only">{page.ui.compared}</span>
                    </th>
                    {page.table.columns.map((column, index) => (
                      <th
                        key={column}
                        scope="col"
                        className={`p-4 font-semibold ${index === page.table!.columns.length - 1 ? "bg-primary/5 text-primary" : ""}`}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.table.rows.map((row) => (
                    <tr key={row.label} className="border-b last:border-b-0">
                      <th scope="row" className="p-4 font-medium">
                        {row.label}
                      </th>
                      {row.cells.map((cell, index) => (
                        <td
                          key={`${row.label}-${index}`}
                          className={`p-4 ${index === row.cells.length - 1 ? "bg-primary/5 font-medium" : "text-muted-foreground"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={page.faqTitle} center />
          <div className="mt-10 divide-y rounded-2xl border bg-card px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6">
            {page.faq.map((item) => (
              <details key={item.question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 font-medium focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors group-open:border-primary/30 group-open:bg-primary/10 group-open:text-primary"
                  >
                    <Plus className="size-4 motion-safe:transition-transform group-open:rotate-45" />
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
          {page.related ? (
            <p className="mt-6 text-center text-sm">
              <Link href={href(page.related.href)} className="font-medium underline underline-offset-4 hover:text-primary">
                {page.related.label}
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-t px-4 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{page.closingTitle}</h2>
          <p className="mt-4 text-muted-foreground sm:text-lg">{page.closingBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className={CTA}>
              <Link href="/sign-up">
                {page.primaryCta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className={CTA}>
              <Link href={href(page.secondaryCta.href)}>{page.secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/** The real article: its picture, where it is published, and what to notice in it. */
function ExampleSection({ page, example, locale }: { page: FeaturePage; example: FeatureExample; locale: Locale }) {
  const published = formatDate(new Date(`${example.published}T12:00:00Z`), locale, { day: "numeric", month: "long", year: "numeric" });
  return (
    <section className="border-t bg-muted/30 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={page.example.eyebrow} title={page.example.title} sub={page.example.body} center />
        <article className="mt-10 grid grid-cols-1 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:grid-cols-2">
          <div className="relative aspect-[3/2] bg-muted lg:aspect-auto lg:min-h-full">
            <Image
              src={example.image.src}
              alt={example.image.alt}
              fill
              sizes="(min-width: 1024px) 36rem, 100vw"
              loading="lazy"
              className="object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-col p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border px-2.5 py-1 font-medium">{example.site}</span>
              <span className="rounded-full bg-success-soft px-2.5 py-1 font-medium text-success">{page.ui.published}</span>
              {example.domainAuthority !== null ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {`${page.example.daLabel} ${example.domainAuthority}`}
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance sm:text-2xl">{example.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {example.siteName}, {example.about}
              {" · "}
              {example.category}
              {" · "}
              <time dateTime={example.published}>{published}</time>
              {example.minutes ? ` · ${page.ui.minRead.replace("{n}", String(example.minutes))}` : ""}
            </p>
            <p className="mt-4 leading-relaxed">{example.description}</p>
            {example.highlights.length > 0 ? (
              <ul className="mt-5 space-y-2.5">
                {example.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {example.placedLink ? (
              <p className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                <span className="font-medium">{page.example.placedLabel}:</span>{" "}
                <a href={example.placedLink.url} target="_blank" rel="noopener" className="font-medium text-primary underline underline-offset-4">
                  {example.placedLink.anchor}
                </a>
              </p>
            ) : null}
            <div className="mt-auto pt-6">
              <Button variant="outline" asChild>
                <a href={example.href} target="_blank" rel="noopener">
                  {page.example.readLabel}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  <span className="sr-only">{page.ui.newTab}</span>
                </a>
              </Button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
