import type { Locale } from "@/lib/i18n/config";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";

/** The page has already checked website access; no configuration leaks to clients. */
export function ResearchStatus({ mode, locale }: { mode: "off" | "pilot" | "on"; locale: Locale }) {
  if (mode === "off") return null;
  const t = CONTENT_COPY[locale];
  return <section className="mb-6 rounded-xl border bg-card p-4 text-card-foreground" aria-label={t.researchEnabled}>
    <h2 className="text-sm font-semibold">{t.researchEnabled}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{mode === "pilot" ? t.pilotHelp : t.enabledHelp}</p>
  </section>;
}
