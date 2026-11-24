import { AlertTriangle, CheckCircle2, Clock, Info, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { payoutStatusView } from "@/lib/partners/presentation/views";

type View = ReturnType<typeof payoutStatusView>;

const TONE: Record<View["tone"], { icon: LucideIcon; className: string }> = {
  ready: { icon: CheckCircle2, className: "text-success" },
  todo: { icon: AlertTriangle, className: "text-warning" },
  waiting: { icon: Clock, className: "text-muted-foreground" },
  info: { icon: Info, className: "text-muted-foreground" },
};

/**
 * "How and when you are paid" (application/queries/payout-status.ts): the
 * partner's status in words, the one thing to do next, and the rules that
 * decide when the money comes. Layout only.
 */
export function PayoutStatus({ view, settingsHref = "/partner/settings", contactHref }: { view: View; settingsHref?: string; contactHref: string }) {
  const { icon: Icon, className } = TONE[view.tone];
  const link = "text-sm font-medium text-primary-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="payout-status-title" data-payout-step={view.step}>
      <h2 id="payout-status-title" className="text-sm font-medium text-muted-foreground">
        {view.heading}
      </h2>
      <div className="mt-2 flex items-start gap-3" role="status">
        <Icon className={`mt-0.5 size-5 shrink-0 ${className}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{view.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{view.body}</p>
          {view.paused ? <p className="mt-2 text-sm font-medium">{view.paused}</p> : null}
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-muted-foreground">{view.factsTitle}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {view.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {view.action || view.contact ? (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {view.action ? (
            <Link href={settingsHref} className={link}>
              {view.action}
            </Link>
          ) : null}
          {view.contact ? (
            <Link href={contactHref} className={link}>
              {view.contact}
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
