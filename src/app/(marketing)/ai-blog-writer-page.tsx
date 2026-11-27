import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  FileText,
  HeartPulse,
  Link2,
  ListChecks,
  MessageSquareText,
  Plus,
  Radar,
  Share2,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import { planDisplayPrice } from "@/lib/billing/display-prices";
import { aiBlogWriterCopy, type AiBlogWriterCopy } from "@/lib/i18n/ai-blog-writer";
import { localePath, type Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { AI_BLOG_WRITER_SAMPLE, sampleStats, type AiBlogWriterSample } from "@/lib/marketing/ai-blog-writer-sample";
import { CASE_STUDY_PATH } from "@/lib/marketing/case-study-image-studio";
import { FREE_PLAN, isRetiredFromSale } from "@/lib/plans/free-plan";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";

import { SectionHeading } from "./home-sections";

/**
 * /ai-blog-writer, the AI Blog Writer product page (client ticket,
 * 2026-11-27), in every language. Its words, and what each claim rests on,
 * are lib/i18n/ai-blog-writer.ts; the writing sample is
 * lib/marketing/ai-blog-writer-sample.ts.
 *
 * The sections follow the reference page's order with what RepGet can show
 * honestly: no logo strip, rating badge or testimonials (the brand block links
 * to the real Image Studio case study instead), and no figure the product does
 * not supply. The prices are the plan rows' through planDisplayPrice, the one
 * function /pricing and checkout read, for the plans /pricing sells (Free,
 * Grow, Scale) - so the Grow + Visibility bundle and its struck-through list
 * price are never shown here.
 *
 * Server-rendered and static: no script, no video, the one picture lazy. The
 * questions are native <details>, published as FAQPage data with the same
 * words.
 */

const CTA = "h-12 rounded-full px-7 text-base";
const CARD = "rounded-2xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

/** The paid plans /pricing sells, in its order (pricing-view.tsx TIERS). */
const PAID_TIERS = ["grow", "scale"] as const;

/** RepGet's article languages (lib/websites/languages.ts) as language codes, for their names in the reader's language. */
const LANGUAGE_CODES: Record<string, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
  Italian: "it",
  German: "de",
  Portuguese: "pt",
  Dutch: "nl",
  Polish: "pl",
  Romanian: "ro",
};

export type TeaserPlan = { id: string; name: string; price: string; launch: boolean; articles: number };

/** The paid plans on sale, priced as /pricing prices them (lib/billing/display-prices.ts). */
export function teaserPlans(plans: PlanRow[], offer: boolean): TeaserPlan[] {
  return PAID_TIERS.flatMap((tier) => {
    const plan = plans.find((row) => row.interval === "month" && row.tier === tier && !isRetiredFromSale(row.tier));
    if (!plan) return [];
    const shown = planDisplayPrice(plan, offer);
    return [{ id: plan.id, name: plan.name, price: formatPrice(shown.chargedCents, plan.currency), launch: shown.discount === "repget", articles: plan.articleLimit }];
  });
}

/** "English, Spanish, ... and Romanian", in the reader's language. */
export function languageList(locale: Locale): string {
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const list = SUPPORTED_LANGUAGES.map(({ value }) => {
    const code = LANGUAGE_CODES[value];
    return (code && names.of(code)) || value;
  });
  const text = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(list);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** The questions with their holes filled: the languages, and the articles each plan includes. */
export function faqItems(t: AiBlogWriterCopy, locale: Locale, paid: TeaserPlan[]): { question: string; answer: string }[] {
  const number = (n: number) => n.toLocaleString(locale === "en" ? "en-IE" : locale);
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    paid.map((plan) => format(t.faq.paidItem, { n: number(plan.articles), name: plan.name })),
  );
  const values = {
    languages: languageList(locale),
    free: number(FREE_PLAN.articlesPerMonth),
    paid: paid.length > 0 ? format(t.faq.paid, { list }) : "",
  };
  return t.faq.items.map((item) => ({ question: item.question, answer: format(item.answer, values) }));
}

const VALUE_ICONS: LucideIcon[] = [FileText, Sparkles, ListChecks];
/** Backlinks, AI Visibility, Social, Website Health: the copy's order. */
const TOOL_ICONS: LucideIcon[] = [Link2, Radar, Share2, HeartPulse];
const TOOL_PATHS = ["/backlinks", "/rank-on-chatgpt", "/#features", "/audit"];

export function AiBlogWriterPageContent({ locale = "en", plans, offer }: { locale?: Locale; plans: PlanRow[]; offer: boolean }) {
  const t = aiBlogWriterCopy(locale);
  const href = (path: string) => localePath(locale, path);
  const paid = teaserPlans(plans, offer);
  const faq = faqItems(t, locale, paid);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from our own copy (lib/i18n/ai-blog-writer.ts) and plan rows, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
      />

      {/* Hero */}
      <section className="px-4 pt-16 pb-14 text-center sm:pt-24" data-section="hero">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.hero.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t.hero.title} <span className="text-primary">{t.hero.accent}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{t.hero.intro}</p>
          <CtaPair primary={t.hero.primaryCta} secondary={t.hero.secondaryCta} secondaryHref={href("/tools/blog-writer")} />
          <p className="mt-4 text-sm text-muted-foreground">{t.hero.note}</p>
        </div>
      </section>

      {/* What you get, how it stays yours, what you do */}
      <section className="border-t px-4 py-16 sm:py-20" data-section="values">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title={t.values.title} center />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {t.values.items.map((item, index) => {
              const Icon = VALUE_ICONS[index] ?? FileText;
              return (
                <li key={item.title} className={`${CARD} p-6`}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{item.kicker}</p>
                  <h3 className="mt-1 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Yourself vs RepGet */}
      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20" data-section="compare">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title={t.compare.title} sub={t.compare.sub} center />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold text-muted-foreground">{t.compare.yourself.label}</h3>
              <ul className="mt-4 space-y-3">
                {t.compare.yourself.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm">
                    <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${CARD} border-primary/30 p-6`}>
              <h3 className="font-semibold text-primary">{t.compare.repget.label}</h3>
              <ul className="mt-4 space-y-3">
                {t.compare.repget.points.map((point) => (
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

      {/* How it works */}
      <section className="border-t px-4 py-16 sm:py-20" data-section="steps">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow={t.steps.eyebrow} title={t.steps.title} sub={t.steps.sub} center />
          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {t.steps.items.map((step, index) => (
              <li key={step.title} className={`${CARD} flex flex-col p-6`}>
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                <ul className="mt-auto flex flex-wrap gap-2 pt-5">
                  {step.tags.map((tag) => (
                    <li key={tag} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
                      {tag}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Quality criteria */}
      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20" data-section="quality">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow={t.quality.eyebrow} title={t.quality.title} sub={t.quality.sub} center />
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.quality.items.map((item) => (
              <li key={item.title} className={`${CARD} p-6`}>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Brand alignment */}
      <section className="border-t px-4 py-16 sm:py-20" data-section="brand">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow={t.brand.eyebrow} title={t.brand.title} sub={t.brand.body} />
            <p className="mt-6">
              <Link href={href(CASE_STUDY_PATH)} className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4 hover:text-primary">
                {t.brand.storyLink}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </p>
          </div>
          <ul className={`${CARD} space-y-4 p-6 sm:p-8`}>
            {t.brand.points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SampleSection t={t} locale={locale} sample={AI_BLOG_WRITER_SAMPLE} />

      {/* The five tools */}
      <section className="border-t px-4 py-16 sm:py-20" data-section="platform">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow={t.platform.eyebrow} title={t.platform.title} sub={t.platform.sub} center />
          <div className={`${CARD} mx-auto mt-10 flex max-w-3xl gap-4 border-primary/30 p-6`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-semibold">{t.platform.copilot.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.platform.copilot.body}</p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.platform.tools.map((tool, index) => {
              const Icon = TOOL_ICONS[index] ?? FileText;
              return (
                <li key={tool.title} className={`${CARD} flex flex-col p-6`}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{tool.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.body}</p>
                  <p className="mt-auto pt-4 text-sm">
                    <Link href={href(TOOL_PATHS[index] ?? "/")} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                      {tool.link}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="border-t bg-primary/[0.04] px-4 py-14 text-center" data-section="mid-cta">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{t.midCta.title}</h2>
          <p className="mt-3 text-muted-foreground">{t.midCta.body}</p>
          <div className="mt-6">
            <Button size="lg" asChild className={CTA}>
              <Link href="/sign-up">
                {t.midCta.cta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-t px-4 py-16 sm:py-20" data-section="pricing">
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow={t.pricing.eyebrow} title={t.pricing.title} sub={t.pricing.sub} center />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <li className={`${CARD} flex flex-col border-success/30 p-6`} data-plan="free">
              <h3 className="font-semibold">Free</h3>
              <p className="mt-3">
                <strong className="text-3xl font-semibold tracking-tight">{formatPrice(0, "eur")}</strong>{" "}
                <span className="text-sm text-muted-foreground">{t.pricing.perMonth}</span>
              </p>
              <p className="mt-3 text-sm">{format(t.pricing.articles, { n: FREE_PLAN.articlesPerMonth })}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.pricing.freeNote}</p>
            </li>
            {paid.map((plan) => (
              <li key={plan.id} className={`${CARD} flex flex-col p-6`} data-plan={plan.name}>
                <h3 className="flex items-center gap-2 font-semibold">
                  {plan.name}
                  {plan.launch ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t.pricing.launchPrice}</span>
                  ) : null}
                </h3>
                <p className="mt-3">
                  <strong className="text-3xl font-semibold tracking-tight">{plan.price}</strong>{" "}
                  <span className="text-sm text-muted-foreground">{t.pricing.perMonth}</span>
                </p>
                <p className="mt-3 text-sm">{format(t.pricing.articles, { n: plan.articles })}</p>
              </li>
            ))}
          </ul>
          {paid.length === 0 ? <p className="mt-6 text-center text-sm text-muted-foreground">{t.pricing.unavailable}</p> : null}
          <CtaPair primary={t.pricing.cta} secondary={t.pricing.seeAll} secondaryHref={href("/pricing")} />
        </div>
      </section>

      {/* Several websites */}
      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20" data-section="agency">
        <div className={`${CARD} mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8`}>
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.agency.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{t.agency.title}</h2>
            <p className="mt-3 text-muted-foreground">{t.agency.body}</p>
          </div>
          <Button size="lg" variant="outline" asChild className={`${CTA} shrink-0`}>
            <Link href={href("/contact")}>{t.agency.cta}</Link>
          </Button>
        </div>
      </section>

      {/* Questions */}
      <section className="border-t px-4 py-16 sm:py-20" data-section="faq">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={t.faq.title} center />
          <div className={`${CARD} mt-10 divide-y px-5 sm:px-6`}>
            {faq.map((item) => (
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
        </div>
      </section>

      {/* Closing */}
      <section className="border-t px-4 py-16 text-center sm:py-20" data-section="closing">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.closing.title}</h2>
          <p className="mt-4 text-muted-foreground sm:text-lg">{t.closing.body}</p>
          <CtaPair primary={t.hero.primaryCta} secondary={t.hero.secondaryCta} secondaryHref={href("/tools/blog-writer")} />
        </div>
      </section>
    </>
  );
}

/** The heading's level in the published article, as a small tag: the page itself nests the sample under its own headings. */
function Level({ n }: { n: 2 | 3 }) {
  return (
    <span aria-hidden="true" className="rounded bg-muted px-1.5 py-0.5 font-sans text-[0.65rem] font-semibold text-muted-foreground">
      {`H${n}`}
    </span>
  );
}

function CtaPair({ primary, secondary, secondaryHref }: { primary: string; secondary: string; secondaryHref: string }) {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Button size="lg" asChild className={CTA}>
        <Link href="/sign-up">
          {primary}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild className={CTA}>
        <Link href={secondaryHref}>{secondary}</Link>
      </Button>
    </div>
  );
}

/** The writing sample as an article, with what makes it ready for search beside it. */
function SampleSection({ t, locale, sample }: { t: AiBlogWriterCopy; locale: Locale; sample: AiBlogWriterSample }) {
  const stats = sampleStats(sample);
  const number = (n: number) => n.toLocaleString(locale === "en" ? "en-IE" : locale);
  const faqId = "sample-faq";
  const rows: [string, number][] = [
    [t.sample.stats.words, stats.words],
    [t.sample.stats.sections, stats.sections],
    [t.sample.stats.subheadings, stats.subheadings],
    [t.sample.stats.questions, stats.questions],
    [t.sample.stats.picturesWithAlt, stats.picturesWithAlt],
    [t.sample.stats.outsideLinks, stats.outsideLinks],
  ];

  return (
    <section className="border-t bg-muted/30 px-4 py-16 sm:py-20" data-section="sample">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.sample.eyebrow} title={t.sample.title} sub={t.sample.sub} center />
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article lang={sample.lang} className={`${CARD} min-w-0 p-6 font-serif sm:p-10`} aria-labelledby="sample-title">
            <p lang={locale} className="flex flex-wrap items-center gap-2 font-sans text-xs">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{t.sample.badge}</span>
              <span className="text-muted-foreground">{sample.credit}</span>
            </p>
            <h3 id="sample-title" className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {sample.title}
            </h3>

            <div className="mt-6 rounded-xl border-l-4 border-primary bg-primary/5 p-4">
              <p lang={locale} className="font-sans text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                {t.sample.tldr}
              </p>
              <p className="mt-1 leading-relaxed">{sample.tldr}</p>
            </div>

            <p className="mt-6 text-lg leading-relaxed">{sample.intro}</p>

            <nav lang={locale} aria-label={t.sample.contents} className="mt-6 rounded-xl border bg-muted/30 p-4 font-sans text-sm">
              <p className="font-semibold">{t.sample.contents}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5" lang={sample.lang}>
                {sample.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="underline-offset-4 hover:underline">
                      {section.heading}
                    </a>
                    {section.subsections.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {section.subsections.map((sub) => (
                          <li key={sub.id}>
                            <a href={`#${sub.id}`} className="underline-offset-4 hover:underline">
                              {sub.heading}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
                <li>
                  <a href={`#${faqId}`} className="underline-offset-4 hover:underline">
                    {sample.faqHeading}
                  </a>
                </li>
              </ol>
            </nav>

            <figure className="mt-8">
              <Image
                src={sample.image.src}
                alt={sample.image.alt}
                width={sample.image.width}
                height={sample.image.height}
                sizes="(min-width: 1024px) 44rem, 100vw"
                loading="lazy"
                className="h-auto w-full rounded-xl object-cover"
              />
            </figure>

            {sample.sections.map((section) => (
              <div key={section.id}>
                {/* h4/h5: inside this page they sit under the section's h2 and the article's h3; in the article they are its H2s and H3s. */}
                <h4 id={section.id} className="mt-8 flex scroll-mt-28 items-baseline gap-2 text-xl font-semibold tracking-tight">
                  <Level n={2} />
                  {section.heading}
                </h4>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-3 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                {section.subsections.map((sub) => (
                  <div key={sub.id}>
                    <h5 id={sub.id} className="mt-6 flex scroll-mt-28 items-baseline gap-2 text-lg font-semibold">
                      <Level n={3} />
                      {sub.heading}
                    </h5>
                    <p className="mt-2 leading-relaxed">{sub.paragraphs.join(" ")}</p>
                  </div>
                ))}
              </div>
            ))}

            <h4 id={faqId} className="mt-8 flex scroll-mt-28 items-baseline gap-2 text-xl font-semibold tracking-tight">
              <Level n={2} />
              {sample.faqHeading}
            </h4>
            <dl className="mt-3 space-y-4">
              {sample.faq.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold">{item.question}</dt>
                  <dd className="mt-1 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>

            <p lang={locale} className="mt-8 border-t pt-4 font-sans text-xs text-muted-foreground">
              {t.sample.disclaimer}
              {t.sample.englishNote ? ` ${t.sample.englishNote}` : ""}
            </p>
          </article>

          <aside className="space-y-4" aria-label={t.sample.checklistTitle}>
            <div className={`${CARD} p-6`}>
              <h3 className="flex items-center gap-2 font-semibold">
                <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
                {t.sample.checklistTitle}
              </h3>
              <ul className="mt-4 space-y-4">
                {t.sample.checklist.map((item) => (
                  <li key={item.title} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-muted-foreground">{item.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${CARD} p-6`}>
              <h3 className="font-semibold">{t.sample.statsTitle}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {rows.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{number(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Button variant="outline" asChild className="w-full rounded-full">
              <Link href={localePath(locale, "/tools/blog-writer")}>
                {t.hero.secondaryCta}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </aside>
        </div>
      </div>
    </section>
  );
}
