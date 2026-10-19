import { headers } from "next/headers";
import { AlertTriangle, Check, FileCode, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { checkSitemap } from "@/lib/tools/sitemap";
import { visitorKey } from "@/lib/visitor-key";

import { SITEMAP_COPY } from "./copy";

const HREF = "/tools/sitemap-checker";

export const sitemapMetadata = (locale: Locale) => toolMetadata(HREF, locale, SITEMAP_COPY[locale].metaDescription);

/** The Sitemap Checker & Finder in any of the five languages. */
export async function SitemapTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = SITEMAP_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const n = (value: number) => formatNumber(value, locale);
  const domain = domainParam(searchParams);
  const outcome = domain ? await checkSitemap(domain, visitorKey(await headers())) : null;

  return (
    <div>
      <ToolHero title={common.tools[HREF].title} description={t.description} locale={locale}>
        <DomainToolForm
          key={domain}
          action={localePath(locale, HREF)}
          defaultValue={domain}
          submitLabel={t.submit}
          pendingLabel={common.checking}
          placeholder={common.placeholder}
          label={common.fieldLabel}
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">{common.couldNotCheck}</p>
            <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error, locale)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-4">
            {/* Headline numbers first. */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t.statFound, value: n(outcome.result.found.filter((f) => f.ok).length) },
                { label: t.statPages, value: n(outcome.result.totalUrls) },
                { label: t.statRobots, value: outcome.result.declaredInRobots.length > 0 ? t.yes : t.no },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* A large index is read in part; the page count says so rather than looking complete. */}
            {outcome.result.childSitemaps > outcome.result.childSitemapsRead ? (
              <p className="text-sm text-muted-foreground">
                {t.partialRead.replace("{read}", n(outcome.result.childSitemapsRead)).replace("{total}", n(outcome.result.childSitemaps))}
              </p>
            ) : null}

            {/*
              Not being declared in robots.txt is the single most common real
              problem here, and it is invisible from the site itself.
            */}
            {outcome.result.declaredInRobots.length === 0 ? (
              <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium">{t.notListedTitle}</p>
                  <p className="mt-1 text-muted-foreground">
                    {t.notListedBefore}{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      Sitemap: {outcome.result.found[0]?.url ?? `https://${outcome.result.domain}/sitemap.xml`}
                    </code>{" "}
                    {t.notListedMiddle} {outcome.result.robotsUrl} {t.notListedAfter}
                  </p>
                </div>
              </div>
            ) : null}

            {outcome.result.found.length === 0 ? (
              <div className="rounded-xl border bg-card p-6">
                <p className="font-medium">{t.noneTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.noneBody}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {outcome.result.found.map((finding) => (
                  <li key={finding.url} className="rounded-xl border bg-card p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {finding.ok ? (
                        <Check className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                      ) : (
                        <X className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                      )}
                      <a
                        href={finding.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="min-w-0 truncate font-mono text-sm hover:underline"
                      >
                        {finding.url}
                      </a>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.sources[finding.source]}</span>
                      {finding.isIndex ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary-strong">{t.indexBadge}</span>
                      ) : null}
                    </div>

                    {finding.problem ? (
                      <p className="mt-2 text-sm text-destructive">{localizeToolMessage(finding.problem, locale)}</p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {(finding.isIndex ? t.listedSitemaps : t.listedPages)[finding.entryCount === 1 ? 0 : 1].replace(
                            "{count}",
                            n(finding.entryCount),
                          )}
                        </p>
                        {finding.entries.length > 0 ? (
                          <ul className="mt-2 space-y-0.5">
                            {finding.entries.slice(0, 5).map((entry) => (
                              <li key={entry} className="truncate font-mono text-xs text-muted-foreground">
                                {entry}
                              </li>
                            ))}
                            {finding.entryCount > 5 ? (
                              <li className="text-xs text-muted-foreground">{common.andMore.replace("{count}", n(finding.entryCount - 5))}</li>
                            ) : null}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <FileCode className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
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
