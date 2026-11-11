import { ExternalLink, MessageSquare } from "lucide-react";
import Link from "next/link";

import { listCommentsAdmin, type CommentView } from "@/lib/admin/blog-comments";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus } from "../../_ui/status";
import { CommentActions } from "./comment-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog comments" };

const when = (date: Date) =>
  `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

const VIEWS: { value: CommentView; label: string }[] = [
  { value: "shown", label: "On the blog" },
  { value: "removed", label: "Removed or deleted" },
  { value: "all", label: "All" },
];

/**
 * Admin -> Blog -> Comments (client, 2026-11-11): readers' comments, newest
 * first. They go live at once; remove one here (it can be restored), and
 * see the ones removed or deleted by their authors (lib/admin/blog-comments.ts).
 */
export default async function BlogCommentsPage({ searchParams }: { searchParams: Promise<{ view?: string; before?: string }> }) {
  const params = await searchParams;
  const view = VIEWS.some((option) => option.value === params.view) ? (params.view as CommentView) : "shown";
  const { rows, counts, more } = await listCommentsAdmin(view, typeof params.before === "string" ? params.before : undefined);
  const href = (value: CommentView, before?: string) => {
    const query = new URLSearchParams();
    if (value !== "shown") query.set("view", value);
    if (before) query.set("before", before);
    const text = query.toString();
    return text ? `/admin/blog/comments?${text}` : "/admin/blog/comments";
  };

  return (
    <AdminPage>
      <AdminPageHeader
        back={{ href: "/admin/blog", label: "Blog" }}
        title="Comments"
        description="Readers' comments on the blog, newest first. Any signed-in user can comment and comments are live at once: remove one that should not be there. A removed comment can be restored."
      />

      <nav aria-label="Comment status" className="flex flex-wrap gap-2">
        {VIEWS.map((option) => {
          const active = option.value === view;
          return (
            <Link
              key={option.value}
              href={href(option.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {option.label}
              <span className={cn("tabular-nums", active ? "text-background/75" : "text-muted-foreground")}>{formatNumber(counts[option.value], "en")}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty
            filtering={false}
            icon={MessageSquare}
            noun="comments"
            title="No comments here"
            description="Comments appear here as soon as readers post them under a blog post."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const status = row.deletedAt
              ? { tone: "neutral" as const, label: "Deleted by its author" }
              : row.removedAt
                ? { tone: "neutral" as const, label: `Removed by ${row.removedBy ?? "an administrator"}` }
                : { tone: "success" as const, label: "On the blog" };
            return (
              <li key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1 text-sm">
                    <AdminStatus tone={status.tone} label={status.label} />
                    <p className="pt-1 font-medium wrap-anywhere">
                      {row.authorName || "(no name)"} <span className="font-normal text-muted-foreground">· {row.authorEmail} · {when(row.createdAt)}</span>
                    </p>
                    <p className="text-muted-foreground wrap-anywhere">
                      On{" "}
                      <a
                        href={row.postPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.postTitle}
                        <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      {row.postLocale !== "en" ? ` (${LANGUAGE_NAMES_EN[row.postLocale]})` : null}
                    </p>
                  </div>
                  {row.deletedAt ? null : <CommentActions id={row.id} removed={row.removedAt !== null} />}
                </div>
                {/* Typed by a reader: plain text, shown as text. */}
                <p className="mt-3 text-sm whitespace-pre-wrap wrap-anywhere">{row.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      {more ? (
        <div>
          <Link href={href(view, rows[rows.length - 1].createdAt.toISOString())} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Older comments
          </Link>
        </div>
      ) : null}
    </AdminPage>
  );
}
