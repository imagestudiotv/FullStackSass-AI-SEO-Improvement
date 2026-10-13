import { headers } from "next/headers";
import { AlertTriangle, Check, Tag, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { checkMetaTags, type TagStatus } from "@/lib/tools/meta-tags";
import { visitorKey } from "@/lib/visitor-key";

import { META_TAGS_COPY } from "./copy";

const HREF = "/tools/meta-tag-checker";

export const metaTagsMetadata = (locale: Locale) => toolMetadata(HREF, locale, META_TAGS_COPY[locale].metaDescription);

function StatusIcon({ status }: { status: TagStatus }) {
  if (status === "good") {
    return <Check className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />;
  }
  if (status === "warn") {
    return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />;
  }
  return <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />;
}

/** The Meta Tag Checker in any of the five languages. */
export async function MetaTagsTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = META_TAGS_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const say = (text: string) => localizeToolMessage(text, locale);
  const domain = domainParam(searchParams);
  const outcome = domain ? await checkMetaTags(domain, visitorKey(await headers())) : null;

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
            <p className="mt-1 text-muted-foreground">{say(outcome.error)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t.good, value: outcome.result.counts.good, tone: "text-emerald-700 dark:text-emerald-400" },
                { label: t.warn, value: outcome.result.counts.warn, tone: "text-amber-600 dark:text-amber-400" },
                { label: t.missing, value: outcome.result.counts.missing, tone: "text-destructive" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
                  <p className={`mt-2 text-2xl font-semibold tabular-nums ${stat.value > 0 ? stat.tone : ""}`}>{formatNumber(stat.value, locale)}</p>
                </div>
              ))}
            </div>

            {outcome.result.groups.map((group) => (
              <section key={group.heading}>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{say(group.heading)}</h2>
                <ul className="mt-3 space-y-3">
                  {group.tags.map((tag) => (
                    <li key={tag.name} className="flex gap-3 rounded-xl border bg-card p-4">
                      <StatusIcon status={tag.status} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {say(tag.label)}
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">{tag.name}</code>
                        </p>
                        {tag.value ? (
                          <p className="mt-1 text-sm break-words text-muted-foreground">{tag.value}</p>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground italic">{t.notSet}</p>
                        )}
                        {tag.note ? <p className="mt-2 border-l-2 border-primary/30 pl-2.5 text-sm">{say(tag.note)}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <Tag className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
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
