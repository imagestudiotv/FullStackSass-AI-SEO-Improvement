import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Info,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A status pill: an icon AND a word, never colour alone.
 *
 * Tones are meanings, not colours: "success" is done/healthy, "warning"
 * needs a look, "danger" failed or blocked, "info" in progress or notable,
 * "pending" waiting on someone, "neutral" a plain fact (draft, inactive).
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "pending" | "neutral";

const TONE: Record<StatusTone, { className: string; icon: LucideIcon }> = {
  success: { className: "bg-success-soft text-success border-success/20", icon: CheckCircle2 },
  warning: { className: "bg-warning-soft text-warning border-warning/25", icon: AlertTriangle },
  danger: { className: "bg-danger-soft text-danger border-danger/20", icon: XCircle },
  info: { className: "bg-info-soft text-info border-info/20", icon: Info },
  pending: { className: "bg-muted text-foreground/80 border-border", icon: Clock },
  neutral: { className: "bg-muted text-foreground/75 border-border", icon: CircleDashed },
};

export function AdminStatus({
  tone,
  label,
  icon,
  className,
  title,
}: {
  tone: StatusTone;
  label: string;
  /** Overrides the tone's icon; pass null for none (e.g. inside a dense table cell). */
  icon?: LucideIcon | null;
  className?: string;
  /** Longer explanation on hover; the label must already make sense alone. */
  title?: string;
}) {
  const Icon = icon === undefined ? TONE[tone].icon : icon;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[tone].className,
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

/** For "unknown" outcomes - something that may or may not have happened. */
export const UnknownIcon = MinusCircle;
