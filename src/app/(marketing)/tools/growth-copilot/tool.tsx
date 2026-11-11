import { GUEST_COPILOT_TOOL, GuestCopilot } from "@/components/guest-copilot/guest-copilot";
import { MoreTools, ToolBreadcrumb, ToolExplainer } from "@/components/tool-page";
import type { Locale } from "@/lib/i18n/config";
import { guestCopilotCopy } from "@/lib/i18n/guest-copilot";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { toolMetadata } from "@/lib/tools/i18n/meta";

export function growthCopilotMetadata(locale: Locale) {
  return toolMetadata(GUEST_COPILOT_TOOL, locale, guestCopilotCopy(locale).tool.metaDescription);
}

/**
 * The free AI Growth Copilot (client, 2026-11-11): the guest copilot as a
 * free tool, three questions a day without an account. The homepage's and
 * the hub's "Try the AI copilot free" lead here; here the section's title is
 * the page's h1.
 */
export function GrowthCopilotTool({ locale }: { locale: Locale }) {
  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <ToolBreadcrumb title={TOOLS_COMMON[locale].tools[GUEST_COPILOT_TOOL].title} locale={locale} />
      </div>
      <GuestCopilot locale={locale} onToolPage />
      <ToolExplainer columns={guestCopilotCopy(locale).tool.explainer} />
      <MoreTools currentHref={GUEST_COPILOT_TOOL} locale={locale} />
    </div>
  );
}
