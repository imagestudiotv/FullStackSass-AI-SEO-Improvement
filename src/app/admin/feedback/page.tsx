import { ImageIcon, MessageSquare, Reply } from "lucide-react";
import Link from "next/link";

import { listFeedbackAdmin } from "@/lib/admin/feedback";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { FEEDBACK_ADMIN_PAGE_SIZE, FEEDBACK_KINDS, FEEDBACK_STATUSES } from "@/lib/feedback/shared";
import { isLocale } from "@/lib/i18n/config";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { Pagination } from "../pagination";
import { KIND_LABEL, SOURCE_LABEL, STATUS_LABEL } from "./labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feedback" };

const when = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** A filter chip: the status tabs and the kind filter. */
function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
      )}
    >
      {label}
      {count !== undefined ? <span className={cn("tabular-nums", active ? "text-background/75" : "text-muted-foreground")}>{formatNumber(count, "en")}</span> : null}
    </Link>
  );
}

/**
 * Admin -> Feedback (client, 2026-10-19): ideas and problems from customers
 * (the dashboard's Feedback button) and visitors (the Contact page's form),
 * newest first, by status. New is where unread ones wait.
 */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ view?: string; kind?: string; page?: string }> }) {
  const params = await searchParams;
  const view = params.view && (params.view === "all" || (FEEDBACK_STATUSES as readonly string[]).includes(params.view)) ? params.view : "new";
  const kind = params.kind && (FEEDBACK_KINDS as readonly string[]).includes(params.kind) ? params.kind : undefined;
  const { rows, total, counts, page } = await listFeedbackAdmin({ view, kind: kind ?? "all", page: Number(params.page) || 1 });
  const all = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const href = (next: { view?: string; kind?: string }) => {
    const query = new URLSearchParams();
    const v = next.view ?? view;
    const k = "kind" in next ? next.kind : kind;
    if (v !== "new") query.set("view", v);
    if (k) query.set("kind", k);
    const text = query.toString();
    return text ? `/admin/feedback?${text}` : "/admin/feedback";
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Feedback"
        description="Ideas and problems sent from the dashboard's Feedback button and the Contact page's form. Open one to see it in full, change its status, or reply to the sender by email in their language."
      />

      <div className="space-y-3">
        <nav aria-label="Status" className="flex flex-wrap gap-2">
          {FEEDBACK_STATUSES.map((status) => (
            <Chip key={status} href={href({ view: status })} active={view === status} label={STATUS_LABEL[status].label} count={counts[status]} />
          ))}
          <Chip href={href({ view: "all" })} active={view === "all"} label="All" count={all} />
        </nav>
        <nav aria-label="Type" className="flex flex-wrap gap-2">
          <Chip href={href({ kind: undefined })} active={!kind} label="Every type" />
          {FEEDBACK_KINDS.map((option) => (
            <Chip key={option} href={href({ kind: option })} active={kind === option} label={`${KIND_LABEL[option]}s`} />
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty
            filtering={Boolean(kind)}
            icon={MessageSquare}
            noun="messages"
            title={view === "new" ? "No new feedback" : "No messages here"}
            description={
              view === "new"
                ? "New messages appear here, and every administrator gets an email when one arrives."
                : "Messages appear here when customers or visitors use the feedback form."
            }
          />
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((row) => {
            const status = STATUS_LABEL[row.status];
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/feedback/${row.id}`}
                  className="block px-4 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <AdminStatus tone={status.tone} label={status.label} />
                    <span className="rounded-full border px-2 py-0.5 font-medium">{KIND_LABEL[row.kind]}</span>
                    <span className="text-muted-foreground">{SOURCE_LABEL[row.source] ?? row.source}</span>
                    {isLocale(row.locale) && row.locale !== "en" ? <span className="text-muted-foreground">{LANGUAGE_NAMES_EN[row.locale]}</span> : null}
                    {row.screenshots > 0 ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ImageIcon className="size-3.5" aria-hidden="true" />
                        {row.screenshots === 1 ? "Screenshot" : `${row.screenshots} screenshots`}
                      </span>
                    ) : null}
                    {row.replies > 0 ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Reply className="size-3.5" aria-hidden="true" />
                        {row.replies === 1 ? "Replied" : `${row.replies} replies`}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm wrap-anywhere">{row.excerpt}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground wrap-anywhere">
                    {row.name ? `${row.name} · ` : ""}
                    {row.email} · <span className="tabular-nums">{when(row.createdAt)} UTC</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={FEEDBACK_ADMIN_PAGE_SIZE} total={total} basePath="/admin/feedback" params={{ view: view === "new" ? undefined : view, kind }} />
    </AdminPage>
  );
}
