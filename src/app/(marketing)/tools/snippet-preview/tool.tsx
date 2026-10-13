import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import type { Locale } from "@/lib/i18n/config";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { toolMetadata } from "@/lib/tools/i18n/meta";

import { SNIPPET_COPY } from "./copy";
import { SnippetForm } from "./snippet-form";

const HREF = "/tools/snippet-preview";

export const snippetMetadata = (locale: Locale) => toolMetadata(HREF, locale, SNIPPET_COPY[locale].metaDescription);

/** The SEO Title Checker in any of the five languages. Static: the check runs in the browser. */
export function SnippetTool({ locale }: { locale: Locale }) {
  const t = SNIPPET_COPY[locale];
  return (
    <div>
      <ToolHero title={TOOLS_COMMON[locale].tools[HREF].title} description={t.description} locale={locale}>
        {/* Only this language's words reach the browser. */}
        <SnippetForm copy={t.form} />
      </ToolHero>

      <ToolExplainer columns={t.explainer} />

      <MoreTools currentHref={HREF} locale={locale} />

      <ToolCta headline={t.ctaHeadline} body={t.ctaBody} locale={locale} />
    </div>
  );
}
