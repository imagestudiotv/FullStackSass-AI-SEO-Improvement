import { headers } from "next/headers";
import { AlertTriangle, Check, Info } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { checkRobots } from "@/lib/tools/robots";
import { visitorKey } from "@/lib/visitor-key";

import { ROBOTS_COPY } from "./copy";

const HREF = "/tools/robots-checker";

export const robotsMetadata = (locale: Locale) => toolMetadata(HREF, locale, ROBOTS_COPY[locale].metaDescription);

/** The Robots.txt Checker in any of the five languages (/tools/robots-checker, /[locale]/tools/robots-checker). */
export async function RobotsTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = ROBOTS_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const domain = domainParam(searchParams);

  const outcome = domain ? await checkRobots(domain, visitorKey(await headers())) : null;

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
            {/*
              The headline verdict. "Disallow: /" for all crawlers is the one
              finding that matters more than everything else on the page, so it
              is stated first and unmistakably.
            */}
            {outcome.result.blocksEverything ? (
              <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium">{t.blocksAllTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.blocksAllBefore} <code>Disallow: /</code> {t.blocksAllAfter}
                  </p>
                </div>
              </div>
            ) : !outcome.result.found ? (
              <div className="flex gap-3 rounded-xl border bg-card p-5">
                <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium">{t.notFoundTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.notFoundBody}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-xl border bg-card p-5">
                <Check className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <div>
                  <p className="font-medium">{t.okTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.okBody}</p>
                </div>
              </div>
            )}

            <div className="space-y-4 rounded-xl border bg-card p-5 text-sm">
              <div>
                <p className="font-medium">{t.sitemap}</p>
                {outcome.result.sitemaps.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {outcome.result.sitemaps.map((sitemap) => (
                      <li key={sitemap} className="truncate text-muted-foreground">
                        {sitemap}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">{t.noSitemap}</p>
                )}
              </div>

              {outcome.result.disallowed.length > 0 ? (
                <div>
                  <p className="font-medium">{t.blocked}</p>
                  <ul className="mt-1 space-y-1">
                    {outcome.result.disallowed.slice(0, 10).map((rule, i) => (
                      <li key={`${rule}-${i}`} className="truncate font-mono text-xs text-muted-foreground">
                        {rule}
                      </li>
                    ))}
                  </ul>
                  {outcome.result.disallowed.length > 10 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {common.andMore.replace("{count}", String(outcome.result.disallowed.length - 10))}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                {common.readItAt}{" "}
                <a href={outcome.result.robotsUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                  {outcome.result.robotsUrl}
                </a>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ToolExplainer columns={t.explainer} />

      <MoreTools currentHref={HREF} locale={locale} />

      <ToolCta headline={t.ctaHeadline} body={t.ctaBody} locale={locale} />
    </div>
  );
}
