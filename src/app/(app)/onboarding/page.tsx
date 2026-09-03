import { ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth-guard";
import { listPlans, getSubscription } from "@/lib/billing";
import { isEntitled } from "@/lib/billing-shared";
import { db } from "@/lib/db";
import { addons } from "@/lib/db/schema";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { hasStarterTrial, STARTER_TRIAL_SLUG } from "@/lib/onboarding/shared";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { requireOrg } from "@/lib/tenant";
import { PlanPicker, type PickerPlan } from "./plan-picker";

export const metadata = { title: "Get started" };

// Reads live setup state, so it can never be cached.
export const dynamic = "force-dynamic";

/**
 * Guided setup.
 *
 * The brief renames the in-app pricing page to /onboarding: "We will rename the
 * link to /onboarding, because we will have a separate pricing page. But this
 * will be the design functionalities."
 *
 * So this page is two things in sequence. Someone with no plan sees the plan
 * picker, because nothing else can happen until they choose one. Once they
 * have a plan — or the one-off Starter — it becomes the setup checklist, where
 * every step links to where that work already happens rather than wrapping it.
 * A parallel set of onboarding-only forms would be a second copy of the same
 * logic, and the two would drift.
 */
export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  await requireSession();
  const { orgId } = await requireOrg();
  const params = await searchParams;

  const [state, subscription, trialUsed, paypalAvailable, allPlans, starterRow] =
    await Promise.all([
      getOnboardingState(orgId),
      getSubscription(orgId),
      hasStarterTrial(orgId),
      isPayPalAvailable(),
      listPlans(),
      db
        .select({
          priceCents: addons.priceCents,
          currency: addons.currency,
          isActive: addons.isActive,
          stripePriceId: addons.stripePriceId,
        })
        .from(addons)
        .where(eq(addons.slug, STARTER_TRIAL_SLUG))
        .limit(1),
    ]);

  /**
   * Whether this workspace can do anything yet.
   *
   * A used Starter trial counts: they have paid for an article, so sending
   * them back to the plan picker would be asking them to buy what they already
   * own. The checklist below then walks them through spending it.
   */
  const hasAccess = isEntitled(subscription?.status) || trialUsed;

  if (!hasAccess) {
    const monthlyPlans = allPlans
      .filter((plan) => plan.interval === "month")
      .map(toPickerPlan);
    const annualPlans = allPlans
      .filter((plan) => plan.interval === "year")
      .map(toPickerPlan);

    const starter = starterRow[0];

    return (
      <PageShell>
        <PageHeader
          title="Select your plan"
          description="Pick a plan and we start working on your site today."
        />

        {params.starter === "cancelled" ? (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Checkout was cancelled — nothing has been charged. Pick an option
              whenever you are ready.
            </CardContent>
          </Card>
        ) : null}

        {monthlyPlans.length === 0 ? (
          // Real state, not a placeholder: with no plans configured we say so
          // rather than showing prices checkout would not honour.
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Plans are not available right now. Please check back shortly.
            </CardContent>
          </Card>
        ) : (
          <PlanPicker
            monthlyPlans={monthlyPlans}
            annualPlans={annualPlans}
            starter={
              // Offered only when it is genuinely purchasable: active, priced
              // in Stripe, and not already used by this workspace.
              starter?.isActive && starter.stripePriceId && !trialUsed
                ? {
                    priceCents: starter.priceCents,
                    currency: starter.currency,
                    available: true,
                  }
                : null
            }
            paypalAvailable={paypalAvailable}
          />
        )}
      </PageShell>
    );
  }

  const doneCount = state.steps.filter((step) => step.done).length;

  return (
    <PageShell>
      <PageHeader
        title={state.complete ? "You are all set" : "Get started"}
        description={
          state.complete
            ? "Everything is set up. This page stays here if you want to check."
            : "A few steps, and we do most of the work."
        }
      />

      {/*
        Confirms the one-off purchase landed. The webhook grants it, so by the
        time this renders the trial row already exists.
      */}
      {params.starter === "success" ? (
        <Card className="border-primary/40">
          <CardContent className="py-4 text-sm">
            <p className="font-medium">Your Starter article is paid for.</p>
            <p className="mt-1 text-muted-foreground">
              Add your website below and we will write it, then place your
              backlink.
            </p>
          </CardContent>
        </Card>
      ) : null}

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

      {/*
        A trial customer has one article and no renewal. Saying so here, where
        they can see how far they have got, is the moment the upgrade actually
        makes sense to them.
      */}
      {trialUsed && !isEntitled(subscription?.status) ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="font-medium">You are on the Starter offer</p>
              <p className="mt-1 text-sm text-muted-foreground">
                One article and one backlink, no subscription. Choose a plan
                when you want us to keep writing every month.
              </p>
            </div>
            <Button asChild>
              <Link href="/billing">
                See plans
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

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

/** Narrows a plan row to what the picker needs, keeping it a server concern. */
function toPickerPlan(plan: {
  id: string;
  tier: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  articleLimit: number;
  keywordLimit: number;
  siteLimit: number;
  monthlyCredits: number;
}): PickerPlan {
  return {
    id: plan.id,
    tier: plan.tier,
    // Annual rows are named "Grow (Annual)"; the interval is already shown.
    name: plan.name.replace(/\s*\(Annual\)\s*$/i, ""),
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
    articleLimit: plan.articleLimit,
    keywordLimit: plan.keywordLimit,
    siteLimit: plan.siteLimit,
    monthlyCredits: plan.monthlyCredits,
  };
}
