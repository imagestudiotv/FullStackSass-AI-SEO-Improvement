import { PenLine } from "lucide-react";
import { headers } from "next/headers";

import { CopyButton } from "@/components/copy-button";
import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { visitorKey, writeDescriptions } from "@/lib/tools/description-writer";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { SNIPPET_LIMITS } from "@/lib/tools/snippet";

import { META_DESCRIPTION_COPY } from "./copy";

const HREF = "/tools/meta-description-generator";

export const metaDescriptionMetadata = (locale: Locale) => toolMetadata(HREF, locale, META_DESCRIPTION_COPY[locale].metaDescription);

/** The Meta Description Generator in any of the five languages. */
export async function MetaDescriptionTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = META_DESCRIPTION_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const chars = (count: number) => t.chars[count === 1 ? 0 : 1].replace("{count}", formatNumber(count, locale));
  const limits = (text: string) => text.replace("{min}", String(SNIPPET_LIMITS.metaMin)).replace("{max}", String(SNIPPET_LIMITS.metaMax));
  const domain = domainParam(searchParams);
  // Each lookup may be a paid model call, so it is counted per visitor.
  const outcome = domain ? await writeDescriptions(domain, visitorKey(await headers())) : null;

  return (
    <div>
      <ToolHero title={common.tools[HREF].title} description={t.description} locale={locale}>
        <DomainToolForm
          key={domain}
          action={localePath(locale, HREF)}
          defaultValue={domain}
          submitLabel={t.submit}
          pendingLabel={t.pending}
          label={t.fieldLabel}
          placeholder={t.placeholder}
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">{t.couldNotWrite}</p>
            <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error, locale)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            {/* What the page has now, so the suggestions can be judged against it. */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.currently}</p>
              {outcome.result.currentDescription ? (
                <>
                  <p className="mt-2 text-sm">{outcome.result.currentDescription}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">{chars(outcome.result.currentDescription.length)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t.noDescription}</p>
              )}
            </div>

            <div>
              <h2 className="font-medium">{t.suggestions}</h2>
              <ul className="mt-3 space-y-3">
                {outcome.result.descriptions.map((description) => (
                  <li key={description.text} className="rounded-xl border bg-card p-5">
                    <p className="text-sm">{description.text}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span className={`text-xs tabular-nums ${description.fits ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
                        {chars(description.length)}
                        {description.fits ? "" : limits(t.outsideRange)}
                      </span>
                      <CopyButton text={description.text} label={t.copy} copiedLabel={common.copied} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <PenLine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t.intro}</p>
          </div>
        ) : null}
      </div>

      <ToolExplainer columns={t.explainer.map((column) => ({ heading: column.heading, body: limits(column.body) }))} />

      <MoreTools currentHref={HREF} locale={locale} />

      <ToolCta headline={t.ctaHeadline} body={t.ctaBody} locale={locale} />
    </div>
  );
}
