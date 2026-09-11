import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleDashed,
  CircleSlash,
  Link2,
  Link2Off,
  Loader2,
  Pause,
  Search,
  Send,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The single place a stored status becomes something a customer reads.
 *
 * Status strings were rendered ad hoc across the app: the same value appeared
 * as "generating" on one page and "Generating…" on another, and the colour was
 * hand-written each time — 68 hardcoded emerald/amber/red utilities across
 * app/ and components/ before this existed. Worse, colour was usually the only
 * signal, which says nothing to a colour-blind user or a screen reader.
 *
 * DISPLAY ONLY. The database keeps its own vocabulary and no migration is
 * implied by anything here: `planned`, `queued` and `draft` stay exactly as
 * they are on disk. This maps them to words a small-business owner
 * understands, which is a different problem from what the column stores.
 *
 * Every key below was taken from a real write path in inngest/ or lib/ — none
 * are speculative. A value that reaches this component without a mapping is
 * rendered in title case with neutral styling rather than being hidden, so an
 * unmapped status looks plain instead of looking broken.
 */

/**
 * How a status reads, not what it is.
 *
 * - `neutral`   nothing is happening and nothing is wrong
 * - `active`    the platform is working right now
 * - `positive`  finished, and the outcome is good
 * - `warning`   needs a person to do something
 * - `critical`  it failed
 */
export type StatusTone =
  | "neutral"
  | "active"
  | "positive"
  | "warning"
  | "critical";

type StatusMeta = {
  /** What the customer reads. Plain words, never the raw column value. */
  label: string;
  tone: StatusTone;
  /**
   * Carries the same meaning as the colour, so status survives greyscale,
   * colour blindness and a screen reader. Never decorative.
   */
  icon: LucideIcon;
};

/**
 * Stored value → how it is shown.
 *
 * Grouped by the table the value comes from. Several tables share a value
 * (`pending`, `failed`), which is why this is one flat map rather than one per
 * table: the customer-facing meaning is the same wherever it appears.
 */
const STATUS: Record<string, StatusMeta> = {
  /* websites: pending → crawling → researching → generated → ready | failed */
  pending: { label: "Waiting to start", tone: "neutral", icon: CircleDashed },
  crawling: { label: "Reading your site", tone: "active", icon: Loader2 },
  researching: { label: "Finding opportunities", tone: "active", icon: Search },
  generated: { label: "Content planned", tone: "positive", icon: Check },
  ready: { label: "Ready", tone: "positive", icon: Check },

  /* crawls / jobs */
  queued: { label: "Waiting", tone: "neutral", icon: CircleDashed },
  running: { label: "Running", tone: "active", icon: Loader2 },
  completed: { label: "Completed", tone: "positive", icon: Check },

  /* calendar items */
  planned: { label: "Planned", tone: "neutral", icon: CalendarClock },

  /* articles: draft → generating → published | failed */
  draft: { label: "Draft", tone: "neutral", icon: CircleDashed },
  generating: { label: "Writing", tone: "active", icon: Loader2 },
  published: { label: "Published", tone: "positive", icon: Check },
  publish: { label: "Publishing", tone: "active", icon: Send },
  scheduled: { label: "Scheduled", tone: "neutral", icon: CalendarClock },

  /* integrations */
  connected: { label: "Connected", tone: "positive", icon: Link2 },
  disconnected: { label: "Not connected", tone: "warning", icon: Link2Off },

  /* backlink placements */
  live: { label: "Live", tone: "positive", icon: Check },
  removed: { label: "Removed", tone: "warning", icon: CircleSlash },
  matched: { label: "Matched", tone: "active", icon: Link2 },

  /* billing + referrals */
  active: { label: "Active", tone: "positive", icon: Check },
  inactive: { label: "Inactive", tone: "neutral", icon: Pause },
  cancelled: { label: "Cancelled", tone: "neutral", icon: X },
  expired: { label: "Expired", tone: "warning", icon: AlertTriangle },
  paid: { label: "Paid", tone: "positive", icon: Check },
  rewarded: { label: "Rewarded", tone: "positive", icon: Check },
  refunded: { label: "Refunded", tone: "neutral", icon: CircleSlash },
  fulfilled: { label: "Fulfilled", tone: "positive", icon: Check },

  /**
   * Shared failure across every table that has one.
   *
   * "Needs attention" rather than "Failed": every screen that shows this also
   * offers a retry, so the useful thing to say is that a person has to act,
   * not that a worker threw. Pass `label="Failed"` where the distinction
   * genuinely matters, such as a publish log recording what happened.
   */
  failed: { label: "Needs attention", tone: "critical", icon: AlertTriangle },
  rejected: { label: "Rejected", tone: "critical", icon: X },
  missing: { label: "Missing", tone: "warning", icon: AlertTriangle },
};

/**
 * Tone → classes.
 *
 * Kept apart from the vocabulary so a colour decision is made once for all
 * statuses that share a meaning, rather than per status. Each pairs a tinted
 * ground with a readable foreground in both themes.
 */
const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  active:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  positive:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  critical:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

/** Title-cases an unmapped value so it reads as a word, not a column value. */
function fallbackLabel(status: string): string {
  const words = status.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Everything known about a status, for callers that need the parts. */
export function statusMeta(status: string): StatusMeta {
  return (
    STATUS[status.toLowerCase()] ?? {
      label: fallbackLabel(status),
      tone: "neutral" as const,
      icon: CircleDashed,
    }
  );
}

export function StatusBadge({
  status,
  /** Overrides the mapped wording where a page needs to be more specific. */
  label,
  /**
   * Spinning icon for work in progress. On by default for `active` statuses
   * because a still icon on "Writing article" reads as stalled.
   */
  animate,
  className,
}: {
  status: string;
  label?: string;
  animate?: boolean;
  className?: string;
}) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  const spin = (animate ?? meta.tone === "active") && Icon === Loader2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <Icon
        className={cn("size-3 shrink-0", spin && "animate-spin")}
        aria-hidden="true"
      />
      {label ?? meta.label}
    </span>
  );
}
