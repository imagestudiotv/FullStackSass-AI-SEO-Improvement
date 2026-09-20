import { ArrowRight, Check, SkipForward } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth-guard";
import { getLaunchState } from "@/lib/onboarding/launch";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  await requireSession();
  const { orgId } = await requireOrg();

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
          Set up <span className="text-muted-foreground">{site.domain}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Walk through the launch flow step by step.
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
                Done
              </span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Launch checklist
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {launch.live ? "All systems live" : "Finish setting up"}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {launch.live
                ? "Every required system is active. Head to the dashboard for your live stats."
                : `${launch.requiredRemaining} ${
                    launch.requiredRemaining === 1 ? "step" : "steps"
                  } left before everything runs on its own.`}
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
                  Go to dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/*
        The steps. A connector line runs down the left through the markers,
        as the design has it — drawn on each row rather than as one absolute
        element, so it cannot fall out of step with the list.
      */}
      <ol className="mt-5 space-y-2">
        {launch.steps.map((step, index) => {
          const last = index === launch.steps.length - 1;

          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-emerald-500 text-white"
                      : step.optional
                        ? "border border-dashed border-muted-foreground/40 text-muted-foreground"
                        : "border-2 border-muted bg-card text-muted-foreground"
                  }`}
                >
                  {step.done ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : step.optional ? (
                    <SkipForward className="size-3.5" aria-hidden="true" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </span>
                {last ? null : (
                  <span
                    className="mt-1 w-px flex-1 border-l border-dashed border-muted-foreground/25"
                    aria-hidden="true"
                  />
                )}
              </div>

              <Link
                href={step.href}
                className={`mb-2 flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                  step.done
                    ? "border-emerald-500/25 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                    : "bg-card hover:bg-accent/50"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {step.description}
                  </span>
                </span>

                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    step.done
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : step.optional
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {step.done ? (
                    <>
                      <Check className="size-3" aria-hidden="true" />
                      Done
                    </>
                  ) : step.optional ? (
                    "Optional"
                  ) : (
                    "To do"
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
