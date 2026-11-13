import { AdminStatus, type StatusTone } from "../_ui/status";

/**
 * How an article's stored status reads in the admin: one mapping for the list
 * and the editor, so the same article never looks different on the two.
 *
 * "failed" reads "Failed" (generation failed) rather than the customer app's
 * softer "Needs attention". Server-safe: no hooks, usable from either side.
 */
const ARTICLE_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  queued: { tone: "pending", label: "Queued" },
  generating: { tone: "info", label: "Generating" },
  draft: { tone: "neutral", label: "Draft" },
  published: { tone: "success", label: "Published" },
  failed: { tone: "danger", label: "Failed" },
};

/** The Status filter's choices, in lifecycle order. Every stored status is offered, "queued" included. */
export const ARTICLE_STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  ...Object.entries(ARTICLE_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

function fallbackLabel(status: string): string {
  const words = status.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown";
}

export function ArticleStatus({ status, className }: { status: string; className?: string }) {
  const meta = ARTICLE_STATUS[status] ?? { tone: "neutral" as const, label: fallbackLabel(status) };
  return <AdminStatus tone={meta.tone} label={meta.label} className={className} />;
}
