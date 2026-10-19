/**
 * Tier, rate and progress to the next tier - display only. The numbers are
 * computed on the server from the program policy and the partner's
 * qualifying-customer count; nothing is calculated here.
 */
export function TierProgress({
  title,
  tierName,
  rate,
  progressLabel,
  remainingLabel,
  current,
  target,
}: {
  title: string;
  tierName: string;
  rate: string;
  progressLabel: string;
  remainingLabel: string;
  current: number;
  target: number | null;
}) {
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 100;
  return (
    <section className="rounded-xl border bg-card p-6" aria-labelledby="tier-title">
      <h2 id="tier-title" className="text-sm font-medium text-muted-foreground">{title}</h2>
      <p className="mt-1 text-xl font-semibold">
        {tierName} <span className="text-primary-strong">- {rate}</span>
      </p>
      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target ?? current}
          aria-valuenow={current}
          aria-valuetext={progressLabel}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-sm tabular-nums">{progressLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">{remainingLabel}</p>
      </div>
    </section>
  );
}
