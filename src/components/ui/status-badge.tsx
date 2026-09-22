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
import { getMessages, type Messages } from "@/lib/i18n/messages";

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
  /**
   * A key into the `status` dictionary, not the text.
   *
   * This map is module-level, built before any request and so before any
   * locale is known. Holding English here is what kept every badge in the
   * app English while the pages around them translated.
   */
  label: keyof Messages["app"]["status"];
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
  pending: { label: "pending", tone: "neutral", icon: CircleDashed },
  crawling: { label: "crawling", tone: "active", icon: Loader2 },
  researching: { label: "researching", tone: "active", icon: Search },
  generated: { label: "generated", tone: "positive", icon: Check },
  ready: { label: "ready", tone: "positive", icon: Check },

  /* crawls / jobs */
  queued: { label: "queued", tone: "neutral", icon: CircleDashed },
  running: { label: "running", tone: "active", icon: Loader2 },
  completed: { label: "completed", tone: "positive", icon: Check },

  /* calendar items */
  planned: { label: "planned", tone: "neutral", icon: CalendarClock },

  /* articles: draft → generating → published | failed */
  draft: { label: "draft", tone: "neutral", icon: CircleDashed },
  generating: { label: "generating", tone: "active", icon: Loader2 },
  published: { label: "published", tone: "positive", icon: Check },
  publish: { label: "publish", tone: "active", icon: Send },
  scheduled: { label: "scheduled", tone: "neutral", icon: CalendarClock },

  /* integrations */
  connected: { label: "connected", tone: "positive", icon: Link2 },
  disconnected: { label: "disconnected", tone: "warning", icon: Link2Off },

  /* backlink placements */
  live: { label: "live", tone: "positive", icon: Check },
  removed: { label: "removed", tone: "warning", icon: CircleSlash },
  matched: { label: "matched", tone: "active", icon: Link2 },

  /* billing + referrals */
  active: { label: "active", tone: "positive", icon: Check },
  inactive: { label: "inactive", tone: "neutral", icon: Pause },
  cancelled: { label: "cancelled", tone: "neutral", icon: X },
  expired: { label: "expired", tone: "warning", icon: AlertTriangle },
  paid: { label: "paid", tone: "positive", icon: Check },
  rewarded: { label: "rewarded", tone: "positive", icon: Check },
  refunded: { label: "refunded", tone: "neutral", icon: CircleSlash },
  fulfilled: { label: "fulfilled", tone: "positive", icon: Check },

  /**
   * Shared failure across every table that has one.
   *
   * "Needs attention" rather than "Failed": every screen that shows this also
   * offers a retry, so the useful thing to say is that a person has to act,
   * not that a worker threw. Pass `label="Failed"` where the distinction
   * genuinely matters, such as a publish log recording what happened.
   */
  failed: { label: "failed", tone: "critical", icon: AlertTriangle },
  rejected: { label: "rejected", tone: "critical", icon: X },
  missing: { label: "missing", tone: "warning", icon: AlertTriangle },
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
  /**
   * Work in progress reads in the brand's own orange rather than a blue that
   * belongs to no other part of the product. It was the only blue left in the
   * app, and next to the warm palette it looked like a component borrowed from
   * somewhere else. Uses the theme token, so it follows --primary if the brand
   * colour ever moves.
   */
  active: "border-primary/25 bg-primary/10 text-primary",
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

/**
 * English, for a caller that has not been wired to the dictionary yet.
 *
 * Read from the catalogue rather than written again here, so the fallback
 * cannot drift from the translated wording it stands in for.
 */
const ENGLISH_FALLBACK = getMessages("en").app.status;

/**
 * Everything known about a status, for callers that need the parts.
 *
 * Returns the KEY, not the wording. Callers that render it pass the
 * dictionary to statusLabel below; callers that only want the tone or the
 * icon need no dictionary at all.
 */
export function statusMeta(status: string): StatusMeta | null {
  return STATUS[status.toLowerCase()] ?? null;
}

/**
 * The words for a status.
 *
 * `t` is optional and defaults to English. Twenty call sites render this
 * badge, most of them deep inside client trees that have no dictionary of
 * their own; making it required would mean threading a prop through all of
 * them at once. Optional lets each screen start passing it as it is reached,
 * and an unpassed one keeps working rather than rendering blank.
 */
export function statusLabel(
  status: string,
  t?: Messages["app"]["status"],
): string {
  const meta = statusMeta(status);
  if (!meta) return fallbackLabel(status);
  return t ? t[meta.label] : ENGLISH_FALLBACK[meta.label];
}

export function StatusBadge({
  status,
  /** Overrides the mapped wording where a page needs to be more specific. */
  label,
  /** The status vocabulary. English when a caller has not been wired yet. */
  t,
  /**
   * Spinning icon for work in progress. On by default for `active` statuses
   * because a still icon on "Writing article" reads as stalled.
   */
  animate,
  className,
}: {
  status: string;
  label?: string;
  t?: Messages["app"]["status"];
  animate?: boolean;
  className?: string;
}) {
  const meta = statusMeta(status);
  const tone = meta?.tone ?? "neutral";
  const Icon = meta?.icon ?? CircleDashed;
  const spin = (animate ?? tone === "active") && Icon === Loader2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon
        className={cn("size-3 shrink-0", spin && "animate-spin")}
        aria-hidden="true"
      />
      {label ?? statusLabel(status, t)}
    </span>
  );
}
