import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { AuditPageContent, auditMetadata } from "../../audit/audit-page";

// Per request, like the English page: it crawls a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/audit">) {
  const { locale } = await params;
  return isLocale(locale) ? auditMetadata(locale) : {};
}

/** The free website check in Spanish, French, Italian and German. */
export default async function LocalisedAuditPage({ params, searchParams }: PageProps<"/[locale]/audit">) {
  const { locale } = await params;
  // English lives at /audit.
  if (!isLocale(locale) || locale === "en") notFound();
  return <AuditPageContent locale={locale} searchParams={await searchParams} />;
}
