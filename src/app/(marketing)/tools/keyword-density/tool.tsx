import { headers } from "next/headers";
import { BarChart3 } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatNumber, intlTag } from "@/lib/i18n/format";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { checkReadability, type KeywordCount } from "@/lib/tools/readability";
import { visitorKey } from "@/lib/visitor-key";

import { KEYWORD_DENSITY_COPY } from "./copy";

const HREF = "/tools/keyword-density";

export const keywordDensityMetadata = (locale: Locale) => toolMetadata(HREF, locale, KEYWORD_DENSITY_COPY[locale].metaDescription);

/**
 * A term list as bars.
 *
 * Scaled against the most frequent term rather than the raw percentage, so the
 * shape of the distribution is readable — real densities sit near 1%, and bars
 * drawn to that scale would all be invisible.
 */
function TermList({ terms, locale }: { terms: KeywordCount[]; locale: Locale }) {
  const top = terms[0]?.count ?? 1;
  const percent = new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 2 });

  return (
    <ul className="space-y-2">
      {terms.map((term) => (
        <li key={term.term}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{term.term}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatNumber(term.count, locale)}× · {percent.format(term.density)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((term.count / top) * 100, 4)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The Keyword Density Checker in any of the five languages. */
export async function KeywordDensityTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = KEYWORD_DENSITY_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const domain = domainParam(searchParams);
  const outcome = domain ? await checkReadability(domain, visitorKey(await headers())) : null;

  return (
    <div>
      <ToolHero title={common.tools[HREF].title} description={t.description} locale={locale}>
        <DomainToolForm
          key={domain}
          action={localePath(locale, HREF)}
          defaultValue={domain}
          submitLabel={t.submit}
          pendingLabel={common.checking}
          label={t.fieldLabel}
          placeholder={t.placeholder}
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">{t.couldNotAnalyse}</p>
            <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error, locale)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t.words, value: formatNumber(outcome.result.wordCount, locale) },
                { label: t.distinct, value: formatNumber(outcome.result.topWords.length, locale) },
                { label: t.mainHeading, value: outcome.result.structure.h1 ? t.set : t.missing },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>

            {outcome.result.topWords.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{t.tooThin}</div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border bg-card p-5">
                  <h2 className="font-medium">{t.topWords}</h2>
                  <p className="mt-1 mb-4 text-sm text-muted-foreground">{t.topWordsNote}</p>
                  <TermList terms={outcome.result.topWords} locale={locale} />
                </section>

                <section className="rounded-xl border bg-card p-5">
                  <h2 className="font-medium">{t.topPhrases}</h2>
                  <p className="mt-1 mb-4 text-sm text-muted-foreground">{t.topPhrasesNote}</p>
                  {outcome.result.topPhrases.length > 0 ? (
                    <TermList terms={outcome.result.topPhrases} locale={locale} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.noPhrase}</p>
                  )}
                </section>
              </div>
            )}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <BarChart3 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t.intro}</p>
          </div>
        ) : null}
      </div>

      <ToolExplainer columns={t.explainer} />

      <MoreTools currentHref={HREF} locale={locale} />

      <ToolCta headline={t.ctaHeadline} body={t.ctaBody} locale={locale} />
    </div>
  );
}
