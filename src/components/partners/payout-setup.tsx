"use client";

import { AlertTriangle, CheckCircle2, Clock, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { openPayoutDashboardAction, refreshPayoutStatusAction, startPayoutSetupAction } from "@/lib/partners/presentation/actions";
import type { PartnerCopy } from "@/lib/partners/presentation/copy";

type Copy = PartnerCopy["portal"]["setup"];
export type SetupState = keyof Copy["states"];

const ICONS: Record<SetupState, typeof Landmark> = {
  not_started: Landmark,
  setup_required: Landmark,
  verification_pending: Clock,
  restricted: AlertTriangle,
  ready: CheckCircle2,
  unavailable: Clock,
};

/**
 * Payout setup with Stripe. The buttons only ask the server for a
 * short-lived Stripe link and follow it; whether setup is complete is never
 * decided here - the state shown is what RepGet last read from Stripe.
 */
export function PayoutSetup({
  state,
  copy,
  canAct,
  countryLine,
  requirements,
}: {
  state: SetupState;
  copy: Copy;
  canAct: boolean;
  countryLine: string | null;
  requirements: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const Icon = ICONS[state];
  const tone = state === "ready" ? "text-success" : state === "restricted" ? "text-warning" : "text-muted-foreground";

  function follow(action: () => Promise<{ ok: true; data: { url: string } } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const result = await action().catch(() => null);
      if (result?.ok) {
        window.location.assign(result.data.url);
        return;
      }
      const key = (result && result.error in copy.errors ? result.error : "generic") as keyof Copy["errors"];
      setError(copy.errors[key]);
    });
  }

  function refresh() {
    setError(null);
    start(async () => {
      const result = await refreshPayoutStatusAction().catch(() => null);
      if (!result || !result.ok) setError(copy.errors.generic);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border bg-card p-6" aria-labelledby="payout-setup-title">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="payout-setup-title" className="font-semibold">{copy.states[state].title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.states[state].body}</p>
          {countryLine ? <p className="mt-2 text-sm">{countryLine}</p> : null}
          {requirements.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {requirements.slice(0, 6).map((requirement) => (
                <li key={requirement} className="break-all">{requirement}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {canAct && state !== "unavailable" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {state === "not_started" ? (
            <Button onClick={() => follow(startPayoutSetupAction)} disabled={pending}>
              {copy.start}
            </Button>
          ) : null}
          {state === "setup_required" || state === "restricted" ? (
            <Button onClick={() => follow(startPayoutSetupAction)} disabled={pending}>
              {copy.continue}
            </Button>
          ) : null}
          {state === "ready" || state === "verification_pending" || state === "restricted" ? (
            <Button variant="outline" onClick={() => follow(openPayoutDashboardAction)} disabled={pending}>
              {copy.dashboard}
            </Button>
          ) : null}
          {state !== "not_started" ? (
            <Button variant="ghost" onClick={refresh} disabled={pending}>
              {copy.refresh}
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
