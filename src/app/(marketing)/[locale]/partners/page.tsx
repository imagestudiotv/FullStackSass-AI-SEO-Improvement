import { notFound } from "next/navigation";

import { listPlans } from "@/lib/billing";
import { isLocale, localePath } from "@/lib/i18n/config";
import { intlTag } from "@/lib/i18n/format";
import { publicProgramSummary } from "@/lib/partners/application/use-cases/manage-program";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { publicPayoutTerms } from "@/lib/partners/presentation/payout-terms";
import { partnerDeps } from "@/lib/partners/server";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { calculatorPlans, PartnersContent } from "../../partners-content";

/** Localised /partners: the same page in the visitor's language. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/partners">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = partnerCopy(locale);
  return {
    title: copy.page.metaTitle,
    description: copy.page.metaDescription,
    ...publicPageMetadata("/partners", { locale }),
  };
}

export default async function Page({ params }: PageProps<"/[locale]/partners">) {
  const { locale } = await params;
  // English lives at /partners; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();
  const deps = partnerDeps();
  // How partners are paid right now: credits or cash (presentation/payout-terms.ts).
  const [summary, plans, payout] = await Promise.all([publicProgramSummary(deps), listPlans(), publicPayoutTerms(deps)]);
  return (
    <PartnersContent
      copy={partnerCopy(locale).page}
      policy={summary.policy}
      open={summary.open}
      locale={locale}
      intlLocale={intlTag(locale)}
      plans={calculatorPlans(plans)}
      payout={payout}
      href={(path) => localePath(locale, path)}
    />
  );
}
