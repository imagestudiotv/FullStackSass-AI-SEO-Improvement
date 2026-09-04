import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { competitors, websites } from "@/lib/db/schema";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { ProfileStep } from "./profile-step";

export const metadata = { title: "Brand profile" };

export const dynamic = "force-dynamic";

/**
 * Step two: what the audit found.
 *
 * The brief: "Here will starts an audit automation, and will provide: Url,
 * Brand Name, Industry, Primary Market Country, Main Language, Description,
 * Services, Competitors, Suggested Competitors" — and, importantly, "All this
 * fields can also manually be edited, in cases the automation is not providing
 * accurate result for some queries".
 *
 * So every field is shown as extracted and every field is editable. Nothing
 * here is a read-only summary: a wrong industry propagates into keywords and
 * articles, and the moment to fix it is while the customer is looking at it.
 */
export default async function OnboardingProfilePage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const state = await getOnboardingState(orgId);
  if (!state.websiteId) redirect("/onboarding/website");

  const [site] = await db
    .select()
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!site) redirect("/onboarding/website");

  const rivals = await db
    .select({ domain: competitors.domain, source: competitors.source })
    .from(competitors)
    .where(eq(competitors.websiteId, site.id));

  return (
    <div>
      <WizardProgress current="profile" />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Brand profile</h1>
        <p className="mt-2 text-muted-foreground">
          Review what we found and correct anything we got wrong. This shapes
          every article and every keyword we go after, so it is worth a minute.
        </p>

        <div className="mt-8">
          <ProfileStep
            website={{
              id: site.id,
              url: site.url,
              domain: site.domain,
              brandName: site.brandName,
              industry: site.industry,
              country: site.country,
              language: site.language,
              description: site.description,
              services: Array.isArray(site.services)
                ? (site.services as string[])
                : [],
              status: site.status,
            }}
            competitors={rivals}
            analysing={state.analysing}
          />
        </div>
      </div>
    </div>
  );
}
