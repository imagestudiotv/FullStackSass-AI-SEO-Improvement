import { ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth-guard";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";

export const metadata = { title: "Get started" };

// Reads live setup state, so it can never be cached.
export const dynamic = "force-dynamic";

/**
 * The entry point to setup — a router, not a screen.
 *
 * Setup is a flow, not a menu. Someone who has just signed up wants the first
 * question, not a list of the questions, so this forwards to whichever step is
 * actually next. The state already knows, because the sidebar and the step
 * guards read the same value — there is no second definition of "where am I"
 * to drift from this one.
 *
 * It renders for one case only: a customer who has finished and opened the URL
 * again from a bookmark, who gets the completed list rather than being bounced
 * somewhere unexpected.
 *
 * IT NO LONGER SHOWS THE PLAN PICKER. Choosing a plan is its own step at
 * /onboarding/plan now, after the business questions rather than before them —
 * the client moved it there so someone sees us describe their own business
 * before being asked to pay. Two pages offering the same purchase would be two
 * places to keep the prices right.
 */
export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  await requireSession();
  const { orgId } = await requireOrg();

  /**
   * Which website this run of setup is about. Without it the state describes
   * the oldest site, which is right for a returning customer and wrong the
   * moment someone adds another one.
   */
  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : undefined;

  const state = await getOnboardingState(orgId, siteParam);

  const next = state.steps.find(
    (step) => step.id === state.currentId && step.href,
  );
  if (next?.href && next.href !== "/onboarding") {
    redirect(next.href);
  }

  /**
   * Nothing to forward to and nothing finished: the only way here is with no
   * website at all, so start at the beginning rather than showing an empty
   * checklist whose every row is inert.
   */
  if (!state.complete && !state.websiteId) redirect("/onboarding/website");

  const doneCount = state.steps.filter((step) => step.done).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">
        {state.complete ? "You are all set" : "Get started"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {state.complete
          ? "Everything is set up. This page stays here if you want to check."
          : "A few steps, and we do most of the work."}
      </p>

      <div className="mt-8 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={state.steps.length}
          aria-label="Setup progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(doneCount / state.steps.length) * 100}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {doneCount} of {state.steps.length}
        </span>
      </div>

      {/*
        Analysis takes a minute or two. Saying so is better than leaving the
        next step greyed out with no explanation, which reads as broken.
      */}
      {state.analysing ? (
        <Card className="mt-6">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>
              We are reading your website now. This usually takes a minute or
              two — the next steps open up when it finishes.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <ol className="mt-6 space-y-3">
        {state.steps.map((step, index) => {
          const isCurrent = step.id === state.currentId;

          return (
            <li key={step.id}>
              <Card
                className={
                  isCurrent ? "border-primary/40 shadow-sm" : undefined
                }
              >
                <CardContent className="flex flex-wrap items-center gap-4 py-5">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                      step.done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        step.done
                          ? "font-medium text-muted-foreground line-through decoration-muted-foreground/40"
                          : "font-medium"
                      }
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>

                  {/*
                    Only the current step gets a button. Offering one on every
                    step at once turns a sequence back into a list, which is
                    what this page exists to replace.
                  */}
                  {isCurrent && step.href ? (
                    <Button asChild>
                      <Link href={step.href}>
                        Continue
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  ) : step.done && step.href ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={step.href}>View</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      {state.complete ? (
        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/dashboard">
              Go to your dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
