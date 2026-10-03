import { ExternalLink, History } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { WorkspaceSection } from "@/components/workspace/section";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import type { HistoryRow } from "./article-data";
import { publishFailureText } from "./failure-copy";

/**
 * Every attempt to send this article, newest first: what the website
 * reported it stored (live, draft, scheduled - or only "delivered" when it
 * did not say), when, a link to the real post, and for a failure what it
 * means and what to do. Holds that sent nothing are not attempts and are
 * not listed; the Publishing panel says when something is waiting.
 */
function rowLabel(row: HistoryRow, t: Messages["app"]["editor"]): { label: string; tone: StatusTone; status: string } {
  if (row.status === "failed") return { label: t.failed, tone: "critical", status: "failed" };
  if (row.remoteStatus === "publish") return { label: t.logLive, tone: "positive", status: "published" };
  if (row.remoteStatus === "draft") return { label: t.logDraft, tone: "neutral", status: "draft" };
  if (row.remoteStatus === "future") return { label: t.logScheduled, tone: "neutral", status: "scheduled" };
  return { label: t.logDelivered, tone: "neutral", status: "completed" };
}

export function PublishHistory({
  rows,
  limit,
  t,
}: {
  rows: HistoryRow[];
  limit: number;
  t: Messages["app"]["editor"];
}) {
  return (
    <WorkspaceSection
      id="article-history"
      icon={History}
      title={t.publishingHistory}
      description={rows.length >= limit ? `${t.historyHelp} ${format(t.historyLatest, { count: limit })}` : t.historyHelp}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row) => {
            const { label, tone, status } = rowLabel(row, t);
            return (
              <li key={row.id} className="min-w-0 space-y-1.5 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge status={status} label={label} tone={tone} />
                  <time dateTime={row.at} className="text-xs text-muted-foreground">
                    {row.when}
                  </time>
                </div>
                {row.errorKind ? <p className="text-sm text-foreground">{publishFailureText(row.errorKind, t)}</p> : null}
                {/* Only a real address: a provider that reports a bare path would link into this app. */}
                {row.remoteUrl && /^https?:\/\//i.test(row.remoteUrl) ? (
                  <a
                    href={row.remoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {t.viewPost}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </WorkspaceSection>
  );
}
