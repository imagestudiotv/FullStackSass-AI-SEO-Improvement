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
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPrice,
  isEntitled,
  type CurrentSubscription,
  type PlanRow,
} from "@/lib/billing-shared";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { createPortalSession } from "@/lib/stripe/portal";

type BillingClientProps = {
  plans: PlanRow[];
  subscription: CurrentSubscription | null;
  entitled: boolean;
  /** False until PayPal credentials exist; the button is hidden entirely. */
  paypalAvailable: boolean;
  checkout?: string;
};

function planFeatures(plan: PlanRow): string[] {
  const unlimited = (n: number) => (n < 0 ? "Unlimited" : n.toLocaleString());
  /**
   * Pluralised per count. Starter has a limit of one for three of these, and
   * "1 articles written each month" on the entry plan is the first thing a
   * prospective customer reads.
   */
  const plural = (n: number, one: string, many: string) =>
    n === 1 ? one : many;

  return [
    `${unlimited(plan.articleLimit)} ${plural(plan.articleLimit, "article", "articles")} written each month`,
    `${unlimited(plan.keywordLimit)} ${plural(plan.keywordLimit, "search term", "search terms")} tracked`,
    `${unlimited(plan.siteLimit)} ${plural(plan.siteLimit, "website", "websites")}`,
    `${unlimited(plan.monthlyCredits)} ${plural(plan.monthlyCredits, "link credit", "link credits")} each month`,
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
  paypalAvailable,
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

  async function handlePayPal(planId: string) {
    setPendingPlanId(planId);
    try {
      const result = await createPayPalCheckout(planId);
      if ("error" in result) {
        toast.error(result.error);
        setPendingPlanId(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error("Could not start PayPal checkout. Please try again.");
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
  /**
   * Tiers that exist only monthly — Starter — still show on the annual tab.
   *
   * Filtering strictly by interval would make the cheapest plan vanish the
   * moment someone clicks "Annual", with no explanation. Falling back to the
   * monthly row keeps the full line-up visible; the card shows its real
   * monthly price, which is the only price it has.
   */
  const annualTiers = new Set(
    plans.filter((p) => p.interval === "year").map((p) => p.tier),
  );
  const visible = plans.filter((p) =>
    interval === "year"
      ? p.interval === "year" ||
        (p.interval === "month" && !annualTiers.has(p.tier))
      : p.interval === "month",
  );
  const hasAnnual = plans.some((p) => p.interval === "year");

  return (
    <PageShell>
      <PageHeader
        title="Billing"
        description="Your plan, and what it includes."
      />

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
        ) : subscription?.provider === "paypal" ? (
          /**
           * PayPal has no portal API we can open on the customer's behalf, so
           * this points at where their subscription and receipts actually live.
           * Without it a PayPal subscriber has no route to an invoice or a
           * cancellation at all: the Stripe button above never applies to them,
           * because they have no Stripe customer.
           */
          <CardFooter className="flex-col items-start gap-2">
            <Button variant="outline" asChild>
              <a
                href="https://www.paypal.com/myaccount/autopay/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage in PayPal
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Your receipts and cancellation live in your PayPal account.
            </p>
          </CardFooter>
        ) : subscription && isEntitled(subscription.status) ? (
          /**
           * Entitled, but with no processor record to send them to — a
           * subscription granted by hand, or one whose webhook never linked a
           * customer. Rare, but silence here reads as "there is no way to
           * cancel", so it points at a human instead of showing nothing.
           */
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              This subscription is managed for you. Contact{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              for receipts or to make a change.
            </p>
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

      {/* Four tiers since Starter: two up at tablet width, four across on desktop. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="w-full space-y-2">
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
                          : "Pay by card"}
                  </Button>

                  {/* Only rendered once PayPal credentials exist, so the
                      customer is never offered a route that cannot complete. */}
                  {paypalAvailable && !isCurrent ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={pendingPlanId !== null}
                      onClick={() => handlePayPal(plan.id)}
                    >
                      Pay with PayPal
                    </Button>
                  ) : null}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {paypalAvailable ? (
        <p className="text-center text-xs text-muted-foreground">
          Promo codes can be entered at card checkout. PayPal does not support
          discount codes.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plans are available yet.
        </p>
      ) : null}
    </PageShell>
  );
}
