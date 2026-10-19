import { localePath } from "@/lib/i18n/config";
import { publicProgramSummary } from "@/lib/partners/application/use-cases/manage-program";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { partnerDeps } from "@/lib/partners/server";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { PartnersContent } from "../partners-content";

const copy = partnerCopy("en");

export const metadata = {
  title: copy.page.metaTitle,
  description: copy.page.metaDescription,
  ...publicPageMetadata("/partners"),
};

/**
 * The partner program, in English. Dynamic, like /pricing: the rates and
 * periods come from the policy in force, and whether applications are open
 * from the partner_program switch.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const summary = await publicProgramSummary(partnerDeps());
  return (
    <PartnersContent
      copy={copy.page}
      policy={summary.policy}
      open={summary.open}
      locale="en"
      href={(path) => localePath("en", path)}
    />
  );
}
