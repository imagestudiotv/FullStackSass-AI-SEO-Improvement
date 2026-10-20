"use client";

import { useId, useState } from "react";

export type CalculatorPlan = { id: string; name: string; priceCents: number; currency: string };
export type CalculatorTier = { name: string; rateBasisPoints: number; minCustomers: number };
export type CalculatorCopy = { title: string; intro: string; plan: string; customers: string; level: string; monthly: string; yearly: string; note: string; perMonth: string };

const MAX_CUSTOMERS = 100;

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/**
 * The commission on one payment of `priceCents` at `rateBasisPoints`, rounded
 * half up at the minor unit - the same rule as the real calculation
 * (lib/partners/domain/policies/commission.ts), so the estimate never shows a
 * cent the program would not pay.
 */
export function commissionPerPayment(priceCents: number, rateBasisPoints: number): number {
  return Math.floor((priceCents * rateBasisPoints + 5_000) / 10_000);
}

/** The level for a number of paying customers: the highest whose threshold is reached. */
export function levelFor(tiers: CalculatorTier[], customers: number): CalculatorTier {
  const sorted = [...tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  return sorted.filter((tier) => tier.minCustomers <= customers).at(-1) ?? sorted[0];
}

/**
 * "Estimate your earnings" on /partners: a monthly plan and a number of
 * paying customers give the level, the commission per month and over the
 * commission period. Plans, levels and the period come from the server (the
 * plans table and the program policy in force), never from this file.
 */
export function EarningsCalculator({
  plans,
  tiers,
  months,
  copy,
  intlLocale,
}: {
  plans: CalculatorPlan[];
  tiers: CalculatorTier[];
  months: number;
  copy: CalculatorCopy;
  /** A BCP 47 tag for number formatting (en-IE, es-ES, ...). */
  intlLocale: string;
}) {
  const id = useId();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [customers, setCustomers] = useState(10);
  const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0];
  if (!plan || tiers.length === 0) return null;

  const money = (cents: number) =>
    new Intl.NumberFormat(intlLocale, { style: "currency", currency: plan.currency.toUpperCase(), minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
  const level = levelFor(tiers, customers);
  const rate = new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 2 }).format(level.rateBasisPoints / 10_000);
  const monthly = customers * commissionPerPayment(plan.priceCents, level.rateBasisPoints);
  const setCount = (value: number) => setCustomers(Math.min(MAX_CUSTOMERS, Math.max(1, Math.round(Number.isFinite(value) ? value : 1))));

  return (
    <section className="mt-16 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-plan`} className="text-sm font-medium">{copy.plan}</label>
          <select
            id={`${id}-plan`}
            value={plan.id}
            onChange={(event) => setPlanId(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            {plans.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {fill(copy.perMonth, { price: new Intl.NumberFormat(intlLocale, { style: "currency", currency: option.currency.toUpperCase(), minimumFractionDigits: option.priceCents % 100 === 0 ? 0 : 2 }).format(option.priceCents / 100) })}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-count`} className="text-sm font-medium">{copy.customers}</label>
          <div className="flex items-center gap-3">
            <input
              id={`${id}-range`}
              type="range"
              min={1}
              max={MAX_CUSTOMERS}
              value={customers}
              onChange={(event) => setCount(Number(event.target.value))}
              aria-label={copy.customers}
              className="min-w-0 flex-1 accent-primary"
            />
            <input
              id={`${id}-count`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CUSTOMERS}
              value={customers}
              onChange={(event) => setCount(Number(event.target.value))}
              className="h-10 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        </div>
      </div>

      <output htmlFor={`${id}-plan ${id}-count ${id}-range`} aria-live="polite" className="mt-6 block">
        <p className="text-sm">{fill(copy.level, { count: customers, tier: level.name, rate })}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-background p-4">
            <dt className="text-sm text-muted-foreground">{copy.monthly}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(monthly)}</dd>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <dt className="text-sm text-muted-foreground">{fill(copy.yearly, { months })}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(monthly * months)}</dd>
          </div>
        </dl>
      </output>
      <p className="mt-3 text-xs text-muted-foreground">{fill(copy.note, { months })}</p>
    </section>
  );
}
