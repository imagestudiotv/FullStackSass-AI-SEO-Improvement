import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SetupSteps } from "@/components/setup-steps";
import { requireSession } from "@/lib/auth-guard";
import { plural } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getLaunchState } from "@/lib/onboarding/launch";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Set up" };

export const dynamic = "force-dynamic";

/**
 * The launch checklist, inside the dashboard.
 *
 * The client asked for the end of signup to land here rather than on a
 * celebration screen: "Right after this 5 step, can the next one be directly
 * the integration part. We start seeing the dashboard on the left, similar
 * nice design on the center… On this step people can also already navigate the
 * dashboard, but it will still continue to appear thoose setup steps is
 * missing to complete the integration and activation."
 *
 * So this page lives in the (app) group — full sidebar, full navigation — and
 * nothing on it blocks anything. It is a list of what is not switched on yet,
 * not a gate.
 */
export default async function SetupPage({ searchParams }: PageProps<"/setup">) {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const { t } = await getAppMessages(session.user.id);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : null;

  const owned = await db
    .select({ id: websites.id, domain: websites.domain })
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(websites.createdAt);

  /**
   * No website at all means signup never finished, so this page has nothing
   * to describe. The wizard is where that is fixed.
   */
  if (owned.length === 0) redirect("/onboarding/website");

  const remembered = await readSelectedWebsite();
  const websiteId =
    resolveWebsiteId(
      siteParam,
      remembered,
      owned.map((site) => site.id),
    ) ?? owned[0].id;
  const site = owned.find((s) => s.id === websiteId) ?? owned[0];

  /**
   * Signup itself is still unfinished — no plan, say. Send them back to it:
   * a launch checklist for a website that cannot generate anything would list
   * seven things none of which can be done.
   */
  const signup = await getOnboardingState(orgId, site.id);
  if (!signup.hasPlan) redirect("/onboarding/plan");

  const launch = await getLaunchState(site.id);
  const total = launch.steps.length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.app.common.setUp}{" "}
          <span className="text-muted-foreground">{site.domain}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.app.common.setUpHelp}
        </p>
      </div>

      {/*
        The header card from the design: a progress dial on the left, a
        headline and segmented bar on the right.
      */}
      <div className="mt-6 rounded-2xl border bg-gradient-to-br from-primary/[0.07] via-card to-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative shrink-0">
            <svg viewBox="0 0 96 96" className="size-24" aria-hidden="true">
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="currentColor"
                className="text-muted"
                strokeWidth="7"
              />
              {/*
                264 is the circumference at r=42. The dash offset is the
                unfinished remainder, so the ring is the progress itself
                rather than a decoration sized by hand.
              */}
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="currentColor"
                className="text-primary transition-[stroke-dashoffset]"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * launch.doneCount) / total}
                transform="rotate(-90 48 48)"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">
                {launch.doneCount}/{total}
              </span>
              <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t.app.common.done}
              </span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {t.app.setup.launchChecklist}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {launch.live ? t.app.setup.allLive : t.app.setup.finishSetup}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {launch.live
                ? t.app.setup.allLiveHelp
                : plural(t.app.setup.stepsLeft, launch.requiredRemaining, {
                    n: launch.requiredRemaining,
                  })}
            </p>

            {/* Segmented bar, one block per step, as drawn. */}
            <div className="mt-4 flex gap-1.5">
              {launch.steps.map((step) => (
                <span
                  key={step.id}
                  title={step.title}
                  className={`h-1.5 flex-1 rounded-full ${
                    step.done ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {launch.live ? (
              <Button asChild className="mt-5 rounded-full">
                <Link href="/dashboard">
                  {t.app.common.goToDashboard}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <SetupSteps steps={launch.steps} t={t.app.common} />
    </div>
  );
}
