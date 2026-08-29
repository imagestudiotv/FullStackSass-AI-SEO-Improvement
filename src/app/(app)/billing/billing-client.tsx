"use client";

import { Check, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPrice,
  type CurrentSubscription,
  type PlanRow,
} from "@/lib/billing-shared";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { createPortalSession } from "@/lib/stripe/portal";

type BillingClientProps = {
  plans: PlanRow[];
  subscription: CurrentSubscription | null;
  entitled: boolean;
  checkout?: string;
};

function planFeatures(plan: PlanRow): string[] {
  const unlimited = (n: number) => (n < 0 ? "Unlimited" : n.toLocaleString());
  return [
    `${unlimited(plan.articleLimit)} articles per month`,
    `${unlimited(plan.keywordLimit)} tracked keywords`,
    `${unlimited(plan.siteLimit)} ${plan.siteLimit === 1 ? "website" : "websites"}`,
    `${unlimited(plan.monthlyCredits)} backlink credits per month`,
  ];
}

/** Annual saving vs paying the monthly price twelve times. */
function annualSaving(monthly: PlanRow | undefined, annual: PlanRow): number {
  if (!monthly) return 0;
  const full = monthly.priceCents * 12;
  if (full <= 0) return 0;
  return Math.round(((full - annual.priceCents) / full) * 100);
}

export function BillingClient({
  plans,
  subscription,
  entitled,
  checkout,
}: BillingClientProps) {
  const [interval, setInterval] = useState<"month" | "year">(
    subscription?.interval === "year" ? "year" : "month",
  );
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState(false);

  /**
   * The redirect only reports what the user did; entitlement always comes from
   * the webhook. The success copy therefore says "confirming", never "active".
   */
  useEffect(() => {
    if (checkout === "success") {
      toast.success("Payment received - confirming your subscription…");
    } else if (checkout === "cancelled") {
      toast("Checkout cancelled.");
    }
  }, [checkout]);

  async function handleSelect(planId: string) {
    setPendingPlanId(planId);
    try {
      const result = await createCheckoutSession(planId);
      if ("error" in result) {
        toast.error(result.error);
        setPendingPlanId(null);
        return;
      }
      // assign() rather than `location.href = ...`: the React Compiler
      // treats assigning to a value defined outside the component as a
      // mutation, while a method call is allowed.
      window.location.assign(result.url);
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setPendingPlanId(null);
    }
  }

  async function handlePortal() {
    setPortalPending(true);
    try {
      const result = await createPortalSession();
      if ("error" in result) {
        toast.error(result.error);
        setPortalPending(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error("Could not open the billing portal.");
      setPortalPending(false);
    }
  }

  const monthlyByTier = new Map(
    plans.filter((p) => p.interval === "month").map((p) => [p.tier, p]),
  );
  const visible = plans.filter((p) => p.interval === interval);
  const hasAnnual = plans.some((p) => p.interval === "year");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and plan limits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Current plan
            {subscription?.status ? (
              <Badge variant={entitled ? "default" : "destructive"}>
                {subscription.status.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {subscription?.planName
              ? `You are on the ${subscription.planName} plan.`
              : "No active subscription yet. Choose a plan below to get started."}
          </CardDescription>
        </CardHeader>

        {subscription?.currentPeriodEnd ? (
          <CardContent className="text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? `Access ends on ${subscription.currentPeriodEnd.toLocaleDateString()}.`
              : `Renews on ${subscription.currentPeriodEnd.toLocaleDateString()}.`}
          </CardContent>
        ) : null}

        {subscription?.hasCustomer ? (
          <CardFooter>
            <Button
              variant="outline"
              onClick={handlePortal}
              disabled={portalPending}
            >
              {portalPending ? "Opening…" : "Manage billing"}
              <ExternalLink className="size-4" />
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      {hasAnnual ? (
        <Tabs
          value={interval}
          onValueChange={(v) => setInterval(v as "month" | "year")}
        >
          <TabsList>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="year">Annual</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {visible.map((plan) => {
          const isCurrent = subscription?.planId === plan.id && entitled;
          const saving =
            plan.interval === "year"
              ? annualSaving(monthlyByTier.get(plan.tier), plan)
              : 0;

          return (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.name}
                  {saving > 0 ? (
                    <Badge variant="secondary">Save {saving}%</Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground">
                    {formatPrice(plan.priceCents, plan.currency)}
                  </span>
                  <span className="text-muted-foreground">
                    {plan.interval === "year" ? " / year" : " / month"}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                  {planFeatures(plan).map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-muted-foreground" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || pendingPlanId !== null}
                  onClick={() => handleSelect(plan.id)}
                >
                  {isCurrent
                    ? "Current plan"
                    : pendingPlanId === plan.id
                      ? "Redirecting…"
                      : entitled
                        ? "Switch to this plan"
                        : "Choose plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plans are available yet.
        </p>
      ) : null}
    </div>
  );
}
