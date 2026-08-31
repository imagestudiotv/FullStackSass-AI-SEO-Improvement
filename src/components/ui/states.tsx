import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared empty, loading and error states.
 *
 * Each page previously wrote its own, so the same situation looked different
 * depending on where you hit it. These three cover every case in the app.
 *
 * The copy rule throughout: say what is happening in the customer's language,
 * never in SEO jargon, and never promise an action that does not exist.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  /** What is missing and why it matters — not just "no data". */
  description?: string;
  /** Omit entirely when there is no real action to offer. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Loading state that says what is actually happening.
 *
 * "Loading…" tells the customer nothing. "Reading your website…" tells them
 * the product is working and roughly what on. The label must describe the real
 * operation — never invented progress.
 */
export function LoadingState({
  label,
  hint,
  className,
}: {
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
      // Announced to screen readers, since the only visual cue is a spinner.
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      {hint ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Error state.
 *
 * `message` is shown to a small-business owner, so it must be readable. Raw
 * provider errors and stack traces belong in logs, not here.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  action,
  className,
}: {
  title?: string;
  message?: string;
  /** Only pass a retry when retrying is genuinely possible. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3",
        className,
      )}
      role="alert"
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message ? (
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/**
 * A single headline number with its label.
 *
 * Used wherever the product reports a result. The number leads; the label
 * explains it in plain words.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    critical: "text-red-600 dark:text-red-400",
  }[tone];

  return (
    <div className="space-y-0.5">
      <div className={cn("text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground/80">{hint}</div>
      ) : null}
    </div>
  );
}
