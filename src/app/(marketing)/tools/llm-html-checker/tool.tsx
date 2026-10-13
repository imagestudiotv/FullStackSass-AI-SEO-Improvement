import { headers } from "next/headers";
import { AlertTriangle, Check, Eye, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatNumber, intlTag } from "@/lib/i18n/format";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { checkReadability } from "@/lib/tools/readability";
import { visitorKey } from "@/lib/visitor-key";

import { LLM_HTML_COPY } from "./copy";

const HREF = "/tools/llm-html-checker";

export const llmHtmlMetadata = (locale: Locale) => toolMetadata(HREF, locale, LLM_HTML_COPY[locale].metaDescription);

function formatBytes(bytes: number, locale: Locale): string {
  const number = new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${number.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${number.format(Math.round(bytes / 1024))} KB`;
  return `${number.format(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`;
}

/** The LLM HTML Visibility Checker in any of the five languages. */
export async function LlmHtmlTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = LLM_HTML_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const n = (value: number) => formatNumber(value, locale);
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
            <p className="font-medium">{t.couldNotCheck}</p>
            <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error, locale)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            {/* The verdict, stated before any numbers. */}
            <div className={`flex gap-3 rounded-xl border p-5 ${outcome.result.needsJavaScript ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
              {outcome.result.needsJavaScript ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <Check className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              )}
              <div>
                <p className="font-medium">{outcome.result.needsJavaScript ? t.emptyTitle : t.okTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(outcome.result.needsJavaScript ? t.emptyBody : t.okBody).replace("{count}", n(outcome.result.wordCount))}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t.words, value: n(outcome.result.wordCount) },
                { label: t.ratio, value: `${n(outcome.result.textRatio)} %`.replace(" %", locale === "en" ? "%" : " %") },
                { label: t.weight, value: formatBytes(outcome.result.htmlBytes, locale) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Structure: what an assistant uses to make sense of the page. */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">{t.understand}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: t.pageTitle, ok: Boolean(outcome.result.structure.title), detail: outcome.result.structure.title ?? t.notSet },
                  { label: t.mainHeading, ok: Boolean(outcome.result.structure.h1), detail: outcome.result.structure.h1 ?? t.notSet },
                  { label: t.headings, ok: outcome.result.structure.headings > 0, detail: t.found.replace("{count}", n(outcome.result.structure.headings)) },
                  { label: t.paragraphs, ok: outcome.result.structure.paragraphs > 0, detail: t.found.replace("{count}", n(outcome.result.structure.paragraphs)) },
                  {
                    label: t.structured,
                    ok: outcome.result.structure.structuredData > 0,
                    detail:
                      outcome.result.structure.structuredData > 0
                        ? t.jsonLd[outcome.result.structure.structuredData === 1 ? 0 : 1].replace("{count}", n(outcome.result.structure.structuredData))
                        : t.noJsonLd,
                  },
                  {
                    label: t.images,
                    ok: outcome.result.structure.images === 0 || outcome.result.structure.imagesWithAlt === outcome.result.structure.images,
                    detail: t.imagesDescribed
                      .replace("{described}", n(outcome.result.structure.imagesWithAlt))
                      .replace("{total}", n(outcome.result.structure.images)),
                  },
                ].map((row) => (
                  <li key={row.label} className="flex items-start gap-2.5">
                    {row.ok ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="truncate text-sm text-muted-foreground">{row.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <Eye className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
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
