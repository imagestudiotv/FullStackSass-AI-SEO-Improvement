import { headers } from "next/headers";
import { FileText } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { localePath, type Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { generateLlmsTxt } from "@/lib/tools/llms-txt";
import { visitorKey } from "@/lib/visitor-key";

import { LLMS_TXT_COPY } from "./copy";

const HREF = "/tools/llms-txt-generator";

export const llmsTxtMetadata = (locale: Locale) => toolMetadata(HREF, locale, LLMS_TXT_COPY[locale].metaDescription);

/** The llms.txt Generator in any of the five languages. */
export async function LlmsTxtTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = LLMS_TXT_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const domain = domainParam(searchParams);
  const outcome = domain ? await generateLlmsTxt(domain, visitorKey(await headers())) : null;

  return (
    <div>
      <ToolHero title={common.tools[HREF].title} description={t.description} locale={locale}>
        <DomainToolForm
          key={domain}
          action={localePath(locale, HREF)}
          defaultValue={domain}
          submitLabel={t.submit}
          pendingLabel={t.pending}
          placeholder={common.placeholder}
          label={common.fieldLabel}
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">{t.couldNotRead}</p>
            <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error, locale)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{t.yourFile}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.builtFrom[outcome.result.pagesRead === 1 ? 0 : 1].replace("{count}", formatNumber(outcome.result.pagesRead, locale))}{" "}
                  {t.saveAsBefore} <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/llms.txt</code> {t.saveAsAfter}
                </p>
              </div>
              <CopyButton text={outcome.result.content} label={t.copyFile} copiedLabel={common.copied} />
            </div>

            <pre className="overflow-x-auto rounded-xl border bg-card p-5 font-mono text-xs leading-relaxed">{outcome.result.content}</pre>

            <div className="rounded-xl border bg-card p-5">
              <p className="font-medium">{t.whereTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.whereBefore} <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{outcome.result.path}</code>
                {t.whereAfter}
              </p>
            </div>
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
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
