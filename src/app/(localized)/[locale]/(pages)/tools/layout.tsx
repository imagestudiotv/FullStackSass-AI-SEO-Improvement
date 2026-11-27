import { ToolGate } from "@/components/tool-gate";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { disabledTools } from "@/lib/tools/tool-tracking";

/** The free tool pages in the other languages: the same on/off gate as app/(marketing)/tools/layout.tsx. */
export default async function LocalisedToolsLayout({ children, params }: LayoutProps<"/[locale]/tools">) {
  const { locale } = await params;
  return (
    <ToolGate disabled={await disabledTools()} locale={isLocale(locale) ? locale : DEFAULT_LOCALE}>
      {children}
    </ToolGate>
  );
}
