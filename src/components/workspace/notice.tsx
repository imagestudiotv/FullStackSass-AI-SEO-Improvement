import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * An inline notice inside a page or section.
 *
 * Colours are the ones the customer app already uses for these meanings -
 * the amber of the Backlink issue banner, the emerald of positive pills, the
 * destructive red - and every notice carries an icon and words, never colour
 * alone. "info" stays neutral so it does not compete with the orange brand.
 */
const TONE = {
  info: { className: "border-border bg-muted/40 text-foreground", icon: Info, iconClass: "text-muted-foreground" },
  warning: { className: "border-amber-200 bg-amber-50 text-amber-950", icon: AlertTriangle, iconClass: "text-amber-700" },
  success: { className: "border-emerald-200 bg-emerald-50 text-emerald-950", icon: CheckCircle2, iconClass: "text-emerald-700" },
  danger: { className: "border-destructive/30 bg-destructive/5 text-foreground", icon: XCircle, iconClass: "text-destructive" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  role,
}: {
  tone?: keyof typeof TONE;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** "status" for news that arrives while the page is open, "alert" for failures. */
  role?: "status" | "alert";
}) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", t.className, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "text-foreground/80")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
