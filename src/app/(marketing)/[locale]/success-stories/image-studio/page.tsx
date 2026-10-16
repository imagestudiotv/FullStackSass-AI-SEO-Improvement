import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { CaseStudyPage, caseStudyMetadata } from "../../../success-stories/image-studio/case-study";

type Props = { params: Promise<{ locale: string }> };

/** The Image Studio case study in the other languages: /it/success-stories/image-studio and the rest. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return caseStudyMetadata(locale);
}

export default async function LocalisedImageStudioCaseStudyPage({ params }: Props) {
  const { locale } = await params;
  // English lives at /success-stories/image-studio; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();
  return <CaseStudyPage locale={locale} />;
}
