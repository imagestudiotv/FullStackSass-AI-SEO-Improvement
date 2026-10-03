import { Building2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminStatus, type StatusTone } from "../_ui/status";
import type { ToolbarFilter } from "../_ui/toolbar";

/**
 * Small pieces shared by the three customer lists (Organizations, Websites,
 * Users): one wording and one tone for a subscription status wherever it
 * appears, the same date format, and the same quiet link style for the
 * cross-links between the lists. Server-safe.
 */

export const n = (value: number) => formatNumber(value, "en");

/** "1 website" / "3 websites", with separators. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${n(count)} ${count === 1 ? one : many}`;
}

export function DateCell({ value }: { value: Date | string }) {
  const date = value instanceof Date ? value : new Date(value);
  const valid = !Number.isNaN(date.getTime());
  return (
    <time dateTime={valid ? date.toISOString() : undefined} className="tabular-nums">
      {formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
    </time>
  );
}

/**
 * Subscription statuses as stored (Stripe's spelling, plus our local
 * "inactive"). Labels here and in the filter below are the same words, so a
 * filter chip and the badges under it agree.
 */
const SUBSCRIPTION: Record<string, { tone: StatusTone; label: string; title?: string }> = {
  active: { tone: "success", label: "Active" },
  trialing: { tone: "info", label: "Trialing" },
  past_due: { tone: "warning", label: "Past due", title: "A payment is overdue" },
  unpaid: { tone: "warning", label: "Unpaid" },
  incomplete: { tone: "warning", label: "Incomplete", title: "The first payment was not completed" },
  incomplete_expired: { tone: "neutral", label: "Expired", title: "The first payment was never completed" },
  canceled: { tone: "neutral", label: "Canceled" },
  cancelled: { tone: "neutral", label: "Canceled" },
  inactive: {
    tone: "neutral",
    label: "Inactive",
    title: "Suspended by an administrator, or not active with the payment provider",
  },
  paused: { tone: "neutral", label: "Paused" },
};

function titleCase(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function SubscriptionStatus({
  status,
  emptyLabel = "Never subscribed",
}: {
  status: string | null;
  /** Shown when there is no subscription row at all. */
  emptyLabel?: string;
}) {
  if (!status) return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  const known = SUBSCRIPTION[status];
  return <AdminStatus tone={known?.tone ?? "neutral"} label={known?.label ?? titleCase(status)} title={known?.title} />;
}

export const SUBSCRIPTION_FILTER: ToolbarFilter = {
  param: "status",
  label: "Subscription",
  allValue: "all",
  options: [
    { value: "all", label: "Any" },
    { value: "active", label: "Active" },
    { value: "trialing", label: "Trialing" },
    { value: "past_due", label: "Past due" },
    { value: "canceled", label: "Canceled" },
    { value: "inactive", label: "Inactive" },
    /*
      Never subscribed is not a status value - there is no row to match - so
      the query handles it as IS NULL. Without this an operator cannot find
      accounts that never paid.
    */
    { value: "none", label: "Never subscribed" },
  ],
};

/** One of our own workspaces: paid features with no subscription. */
export function AgencyBadge() {
  return (
    <AdminStatus
      tone="info"
      icon={Building2}
      label="Agency"
      title="Agency workspace: paid features without a subscription"
    />
  );
}

/**
 * A quiet in-table link to a related list (a count, a workspace name, an
 * email). Underlined on hover and focus so it reads as a way in without
 * colouring every row.
 */
export function RelatedLink({
  href,
  children,
  label,
  className,
}: {
  href: string;
  children: ReactNode;
  /** The accessible name when the visible text alone (a bare number) does not say where it goes. */
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-sm underline-offset-4 outline-none decoration-foreground/40 hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A page number past the end of the list (a hand-typed ?page=, or the last
 * rows were deleted). Says so instead of "nothing here yet" under a total
 * that says otherwise.
 */
export function PastEndNotice({ page, firstPageHref }: { page: number; firstPageHref: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-sm font-medium">Page {n(page)} is past the end of this list</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">There are rows, just not this many pages of them.</p>
      <Button variant="outline" size="sm" asChild className="mt-4">
        <Link href={firstPageHref}>Go to page 1</Link>
      </Button>
    </div>
  );
}
