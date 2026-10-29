"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCreditSettings } from "@/lib/admin/credits";

export type PriceField = {
  /** An action key, or an add-on id. */
  key: string;
  label: string;
  help: string;
  value: number;
};

/**
 * The daily credits, the price of each action and the price of each service,
 * saved together. The limits come from the server (lib/credits/prices.ts is
 * server-only).
 */
export function CreditsForm({
  dailyFree,
  trialDailyFree,
  trialDays,
  prices,
  services,
  maxDaily,
  maxPrice,
  maxServicePrice,
}: {
  dailyFree: number;
  trialDailyFree: number;
  /** How many of a trial's first days get trialDailyFree (TRIAL_CREDIT_DAYS). */
  trialDays: number;
  prices: PriceField[];
  services: PriceField[];
  maxDaily: number;
  maxPrice: number;
  maxServicePrice: number;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [daily, setDaily] = useState(String(dailyFree));
  const [trialDaily, setTrialDaily] = useState(String(trialDailyFree));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries([...prices, ...services].map((field) => [field.key, String(field.value)])),
  );
  const changed =
    daily !== String(dailyFree) ||
    trialDaily !== String(trialDailyFree) ||
    [...prices, ...services].some((field) => values[field.key] !== String(field.value));

  function save() {
    start(async () => {
      const result = await saveCreditSettings({
        dailyFree: Number(daily),
        trialDailyFree: Number(trialDaily),
        prices: Object.fromEntries(prices.map((field) => [field.key, Number(values[field.key])])),
        addonPrices: Object.fromEntries(services.map((field) => [field.key, Number(values[field.key])])),
      }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Credit prices saved");
      router.refresh();
    });
  }

  const row = (field: PriceField, max: number) => (
    <div key={field.key} className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_9rem] sm:items-center sm:px-5">
      <div className="min-w-0">
        <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium">
          {field.label}
        </label>
        <p id={`${id}-${field.key}-help`} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      </div>
      <Input
        id={`${id}-${field.key}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={values[field.key] ?? "0"}
        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
        aria-describedby={`${id}-${field.key}-help`}
      />
    </div>
  );

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border bg-card">
      <div className="border-b px-4 py-4 sm:px-5">
        <h2 id={`${id}-heading`} className="font-medium">
          Prices
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          In credits. A change applies to the next purchase at once; nothing already spent changes.
        </p>
      </div>

      <div className="divide-y">
        <div className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_9rem] sm:items-center sm:px-5">
          <div className="min-w-0">
            <label htmlFor={`${id}-daily`} className="text-sm font-medium">
              Daily credits
            </label>
            <p id={`${id}-daily-help`} className="text-xs text-muted-foreground">
              Given to a workspace with a paid plan on each day it opens RepGet. They never expire and can be spent on anything,
              backlinks included. 0 turns them off.
            </p>
          </div>
          <Input
            id={`${id}-daily`}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxDaily}
            step={1}
            value={daily}
            onChange={(event) => setDaily(event.target.value)}
            aria-describedby={`${id}-daily-help`}
          />
        </div>

        <div className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_9rem] sm:items-center sm:px-5">
          <div className="min-w-0">
            <label htmlFor={`${id}-trial-daily`} className="text-sm font-medium">
              Trial daily credits
            </label>
            <p id={`${id}-trial-daily-help`} className="text-xs text-muted-foreground">
              Given to a workspace on its free articles on each of its first {trialDays} days it opens RepGet - nothing from
              day {trialDays + 1} until its plan starts. They never expire. 0 turns them off.
            </p>
          </div>
          <Input
            id={`${id}-trial-daily`}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxDaily}
            step={1}
            value={trialDaily}
            onChange={(event) => setTrialDaily(event.target.value)}
            aria-describedby={`${id}-trial-daily-help`}
          />
        </div>

        {prices.map((field) => row(field, maxPrice))}
        {services.map((field) => row(field, maxServicePrice))}
      </div>

      <div className="flex justify-end border-t px-4 py-3 sm:px-5">
        <Button onClick={save} disabled={pending || !changed}>
          <Save aria-hidden="true" />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
