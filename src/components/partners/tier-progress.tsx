/**
 * The partner's level, its rate and progress to the next level - display
 * only. The numbers are computed on the server from the program policy and
 * the partner's qualifying-customer count; nothing is calculated here.
 *
 * Laid out as the client's brief has it: "Your partner level / Growth
 * Partner / 30% recurring commission", the progress ("17 / 25 paying
 * customers", "8 more customers to reach Premier Partner.") and, below, the
 * next level with its rate.
 */
export function TierProgress({
  title,
  tierName,
  rateLine,
  progressLabel,
  remainingLabel,
  current,
  target,
  next,
}: {
  title: string;
  tierName: string;
  /** "30% recurring commission". */
  rateLine: string;
  progressLabel: string;
  remainingLabel: string;
  current: number;
  target: number | null;
  /** The next level, or null on the top one. */
  next: { label: string; name: string; rate: string } | null;
}) {
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 100;
  return (
    <section className="rounded-xl border bg-card p-6" aria-labelledby="tier-title">
      <h2 id="tier-title" className="text-sm font-medium text-muted-foreground">{title}</h2>
      <p className="mt-1 text-xl font-semibold">{tierName}</p>
      <p className="text-sm font-medium text-primary-strong">{rateLine}</p>
      <div className="mt-4">
        <p className="mb-2 text-sm tabular-nums">{progressLabel}</p>
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
        <p className="mt-2 text-sm text-muted-foreground">{remainingLabel}</p>
      </div>
      {next ? (
        <div className="mt-4 rounded-lg border border-dashed p-3">
          <p className="text-xs text-muted-foreground">{next.label}</p>
          <p className="font-medium">{next.name}</p>
          <p className="text-sm text-muted-foreground">{next.rate}</p>
        </div>
      ) : null}
    </section>
  );
}
