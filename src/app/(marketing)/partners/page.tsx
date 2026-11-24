import { listPlans } from "@/lib/billing";
import { localePath } from "@/lib/i18n/config";
import { intlTag } from "@/lib/i18n/format";
import { publicProgramSummary } from "@/lib/partners/application/use-cases/manage-program";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { PAYOUT_STATUS_COPY } from "@/lib/partners/presentation/payout-status-copy";
import { publicPayoutTerms } from "@/lib/partners/presentation/payout-terms";
import { partnerDeps } from "@/lib/partners/server";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { calculatorPlans, PartnersContent } from "../partners-content";

const copy = partnerCopy("en");

/** The description promises cash only while partners are paid in cash. */
export async function generateMetadata() {
  const credits = (partnerDeps().settings.payoutForm?.() ?? "cash") === "credits";
  return {
    title: copy.page.metaTitle,
    description: credits ? PAYOUT_STATUS_COPY.en.creditsMetaDescription : copy.page.metaDescription,
    ...publicPageMetadata("/partners"),
  };
}

/**
 * The partner program, in English. Dynamic, like /pricing: the rates and
 * periods come from the policy in force, and whether applications are open
 * from the partner_program switch.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const deps = partnerDeps();
  // How partners are paid right now: credits or cash (presentation/payout-terms.ts).
  const [summary, plans, payout] = await Promise.all([publicProgramSummary(deps), listPlans(), publicPayoutTerms(deps)]);
  return (
    <PartnersContent
      copy={copy.page}
      policy={summary.policy}
      open={summary.open}
      locale="en"
      intlLocale={intlTag("en")}
      plans={calculatorPlans(plans)}
      payout={payout}
      href={(path) => localePath("en", path)}
    />
  );
}
