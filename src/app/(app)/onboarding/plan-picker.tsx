"use client";

import { Check, Loader2, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/billing-shared";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { planFeatures, STARTER_TIER, type PickerPlan } from "@/lib/plans/features";

export type { PickerPlan };

/**
 * Choosing a plan, following the reference design.
 *
 * The brief renames the in-app pricing page to /onboarding and adds a Starter
 * package "where onboardings is receiving one article and one backlink, to
 * attrack to subscribe, and later upgrade the plans".
 *
 * Starter is a EUR 1/month subscription like every other tier, so it needs no
 * special path through checkout — it is simply the cheapest row, marked so it
 * reads as the try-it-first option rather than a worse plan.
 */
export function PlanPicker({
  monthlyPlans,
  annualPlans,
  paypalAvailable,
}: {
  monthlyPlans: PickerPlan[];
  annualPlans: PickerPlan[];
  paypalAvailable: boolean;
}) {
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<string>(
    // Defaults to the tier most people should be on, not the cheapest.
    monthlyPlans.find((plan) => plan.tier === "grow")?.id ??
      monthlyPlans[0]?.id ??
      "",
  );
  const [pending, setPending] = useState<string | null>(null);

  const plans = annual && annualPlans.length > 0 ? annualPlans : monthlyPlans;
  const selectedPlan = plans.find((plan) => plan.id === selected) ?? null;

  /**
   * The real saving from paying annually, worked out from the two prices we
   * actually charge rather than a round number written on the button.
   */
  const annualSaving = (() => {
    if (monthlyPlans.length === 0 || annualPlans.length === 0) return null;
    const monthly =
      monthlyPlans.find((p) => p.tier === "grow") ?? monthlyPlans[0];
    const yearly = annualPlans.find((p) => p.tier === monthly.tier);
    if (!yearly) return null;
    const full = monthly.priceCents * 12;
    if (full <= yearly.priceCents) return null;
    return Math.round(((full - yearly.priceCents) / full) * 100);
  })();

  async function handleCheckout(provider: "stripe" | "paypal") {
    if (!selectedPlan) return;
    setPending(provider);

    const result =
      provider === "paypal"
        ? await createPayPalCheckout(selectedPlan.id)
        : await createCheckoutSession(selectedPlan.id);

    if ("error" in result) {
      setPending(null);
      toast.error(result.error);
      return;
    }
    // assign() rather than `location.href = ...`: the React Compiler treats
    // the latter as mutating a value it does not own.
    window.location.assign(result.url);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div>
        {/*
          Billing interval. Hidden when there are no annual plans, rather than
          shown as a toggle that changes nothing.
        */}
        {annualPlans.length > 0 ? (
          <div className="flex justify-center">
            <div
              role="radiogroup"
              aria-label="Billing interval"
              className="inline-flex rounded-full border bg-card p-1"
            >
              {[
                { label: "Monthly", value: false },
                {
                  label: annualSaving ? `Yearly −${annualSaving}%` : "Yearly",
                  value: true,
                },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={annual === option.value}
                  onClick={() => {
                    setAnnual(option.value);
                    /**
                     * Selection follows the switch by tier, so flipping to
                     * yearly keeps the plan you were looking at rather than
                     * silently resetting to the first one.
                     *
                     * Starter is monthly-only, so switching to yearly while it
                     * is selected falls back to the cheapest annual plan
                     * instead of leaving nothing selected.
                     */
                    const current = plans.find((p) => p.id === selected);
                    const target = option.value ? annualPlans : monthlyPlans;
                    const next =
                      target.find((p) => p.tier === current?.tier) ?? target[0];
                    if (next) setSelected(next.id);
                  }}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                    annual === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {plans.map((plan) => {
            const isSelected = plan.id === selected;
            const isStarter = plan.tier === STARTER_TIER;
            // The mid tier is the one most people should be on.
            const popular = plan.tier === "grow";
            const features = planFeatures(plan);

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={isSelected}
                className={`w-full rounded-2xl border-2 p-5 text-left transition-colors ${
                  isSelected
                    ? isStarter
                      ? "border-emerald-500 bg-emerald-500/[0.06]"
                      : "border-primary bg-primary/[0.05]"
                    : `border-border bg-card ${
                        isStarter
                          ? "hover:border-emerald-500/40"
                          : "hover:border-primary/40"
                      }`
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? isStarter
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : null}
                    </span>
                    {isStarter ? (
                      <Rocket
                        className="size-5 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="text-lg font-semibold">{plan.name}</span>
                    {isStarter ? (
                      <span className="rounded-full border border-emerald-500/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        TRY IT FIRST
                      </span>
                    ) : null}
                    {popular ? (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                        MOST POPULAR
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-baseline gap-2 text-right">
                    {/*
                      The struck-through figure is the real cost of twelve
                      monthly payments, shown only on the annual option. An
                      invented "was" price would be a misleading pricing claim.
                    */}
                    {annual ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(
                          (monthlyPlans.find((p) => p.tier === plan.tier)
                            ?.priceCents ?? 0) * 12,
                          plan.currency,
                        )}
                      </span>
                    ) : null}
                    <div>
                      <span className="text-3xl font-semibold">
                        {formatPrice(plan.priceCents, plan.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {annual ? "/yr" : "/mo"}
                      </span>
                    </div>
                  </div>
                </div>

                {isStarter ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Try us with a real article and a real backlink before moving
                    up. Cancel any time.
                  </p>
                ) : null}

                <ul className="mt-4 flex flex-wrap gap-2">
                  {features.slice(0, 3).map((feature) => (
                    <li
                      key={feature}
                      className="rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                    >
                      {feature}
                    </li>
                  ))}
                  {features.length > 3 ? (
                    <li className="px-1 py-1.5 text-xs font-medium text-primary">
                      +{features.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* Order summary. */}
      <aside className="rounded-2xl border bg-card p-5 lg:sticky lg:top-6">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Order summary
        </p>

        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <p className="font-semibold">
            {selectedPlan?.name ?? "Choose a plan"}
          </p>
          <p className="text-sm text-muted-foreground">
            {annual ? "Billed yearly" : "Billed monthly"}
          </p>

          <ul className="mt-4 space-y-2">
            {(selectedPlan ? planFeatures(selectedPlan) : []).map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t pt-4">
          <span className="font-medium">Total today</span>
          <span className="text-2xl font-semibold">
            {selectedPlan
              ? formatPrice(selectedPlan.priceCents, selectedPlan.currency)
              : "—"}
          </span>
        </div>

        <Button
          className="mt-4 h-11 w-full rounded-full"
          disabled={pending !== null || !selectedPlan}
          onClick={() => handleCheckout("stripe")}
        >
          {pending === "stripe" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting checkout…
            </>
          ) : (
            "Pay by card"
          )}
        </Button>

        {/*
          PayPal, per the brief: "We include also PayPal payments, not just
          Cards". Shown only when it is actually configured — a button that
          returns "not configured" is worse than no button.
        */}
        {paypalAvailable ? (
          <Button
            variant="outline"
            className="mt-2 h-11 w-full rounded-full"
            disabled={pending !== null || !selectedPlan}
            onClick={() => handleCheckout("paypal")}
          >
            {pending === "paypal" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Redirecting to PayPal…
              </>
            ) : (
              "Pay with PayPal"
            )}
          </Button>
        ) : null}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Secure checkout. Cancel any time.
        </p>
      </aside>
    </div>
  );
}
