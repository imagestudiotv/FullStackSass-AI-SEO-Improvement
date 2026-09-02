import { ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth-guard";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";

export const metadata = { title: "Get started" };

// Reads live setup state, so it can never be cached.
export const dynamic = "force-dynamic";

/**
 * Guided setup.
 *
 * The brief renames the in-app pricing page to /onboarding and describes a
 * sequence: choose a plan, add the website, check what we extracted, add the
 * AI visibility questions, then content. Every one of those already worked —
 * what was missing was anything telling a new customer the order, or that
 * there was an order at all. They landed on an empty dashboard.
 *
 * Every step is a link to where that work already happens rather than a
 * wrapper around it. A parallel set of onboarding-only forms would be a second
 * copy of the same logic, and the two would drift.
 */
export default async function OnboardingPage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const state = await getOnboardingState(orgId);
  const doneCount = state.steps.filter((step) => step.done).length;

  return (
    <PageShell>
      <PageHeader
        title={state.complete ? "You are all set" : "Get started"}
        description={
          state.complete
            ? "Everything is set up. This page stays here if you want to check."
            : "Five steps, and we do most of the work."
        }
      />

      <div className="flex items-center gap-3">
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
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>
              We are reading your website now. This usually takes a minute or
              two — the next steps open up when it finishes.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <ol className="space-y-3">
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
        <div className="text-center">
          <Button asChild>
            <Link href="/dashboard">
              Go to your dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}
