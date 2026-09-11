"use client";

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquarePlus,
  Pencil,
  PenLine,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ArticleRow } from "@/lib/articles/actions";
import { generateFromCalendarItem } from "@/lib/articles/actions";
import {
  deleteCalendarItem,
  updateCalendarItem,
  type CalendarRow,
} from "@/lib/keywords/actions";
import { cn } from "@/lib/utils";

/**
 * The content plan as a month calendar.
 *
 * A table answered "what is planned" but not "what is happening this week",
 * which is the question someone actually opens this page with. A date column
 * of thirty rows makes the reader do the work of laying out a month in their
 * head.
 *
 * Weeks start on Monday, matching the reference the client sent and how most
 * of Europe reads a calendar. JavaScript's getDay() puts Sunday at 0, so the
 * offset below is not decorative.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first index: Monday 0 … Sunday 6. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local YYYY-MM-DD, used to bucket items by day. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Six weeks of dates covering the month, padded from the Monday before it
 * starts to the Sunday after it ends, so every grid is the same shape and the
 * page does not jump height between months.
 */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - weekdayIndex(first));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

/**
 * Which status the card shows.
 *
 * Derived from the article when one exists, because that is the newer truth:
 * a calendar item stays "generated" while its article moves on to published.
 * Returns a stored status value rather than a label or colour — StatusBadge
 * owns how every status in the product is worded and coloured.
 */
function statusFor(article: ArticleRow | undefined): string {
  if (article?.status === "published") return "published";
  if (article?.status === "draft") return "draft";
  if (article?.status === "generating" || article?.status === "queued") {
    return "generating";
  }
  if (article?.status === "failed") return "failed";
  return "planned";
}

export function ContentCalendar({
  websiteId,
  calendar,
  articles,
}: {
  websiteId: string;
  calendar: CalendarRow[];
  articles: ArticleRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Which item has its instructions box open, and what is typed in it. */
  const [notesId, setNotesId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");

  const articleByItem = useMemo(
    () =>
      new Map(
        articles
          .filter((article) => article.calendarItemId)
          .map((article) => [article.calendarItemId as string, article]),
      ),
    [articles],
  );

  /**
   * Items bucketed by day. Undated items are collected separately rather than
   * dropped — a topic added by hand has no date and would otherwise vanish
   * from the only view of the plan.
   */
  const { byDay, undated } = useMemo(() => {
    const map = new Map<string, CalendarRow[]>();
    const loose: CalendarRow[] = [];

    for (const item of calendar) {
      if (!item.scheduledFor) {
        loose.push(item);
        continue;
      }
      const key = dayKey(new Date(item.scheduledFor));
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return { byDay: map, undated: loose };
  }, [calendar]);

  const counts = useMemo(() => {
    let published = 0;
    let queued = 0;
    for (const item of calendar) {
      const article = articleByItem.get(item.id);
      if (article?.status === "published") published += 1;
      else queued += 1;
    }
    return { published, queued };
  }, [calendar, articleByItem]);

  const days = useMemo(() => monthGrid(month), [month]);
  const today = new Date();

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + delta);
      return startOfMonth(next);
    });
  }

  function saveTitle(id: string) {
    const title = draft.trim();
    setEditingId(null);
    if (!title) return;

    startTransition(async () => {
      const result = await updateCalendarItem(websiteId, id, { title });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function saveNotes(id: string) {
    const note = draftNotes;
    setNotesId(null);
    startTransition(async () => {
      const result = await updateCalendarItem(websiteId, id, {
        customInstructions: note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved — we will use this when writing");
      router.refresh();
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteCalendarItem(websiteId, id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed from the plan");
      router.refresh();
    });
  }

  function write(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await generateFromCalendarItem(websiteId, id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Writing started — it takes a few minutes");
      router.refresh();
    });
  }

  function renderItem(item: CalendarRow) {
    const article = articleByItem.get(item.id);
    const status = statusFor(article);
    const busy = busyId === item.id;

    return (
      <div
        key={item.id}
        className="group/item rounded-md border bg-card p-2 text-left"
      >
        <StatusBadge status={status} />

        {editingId === item.id ? (
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => saveTitle(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveTitle(item.id);
              if (event.key === "Escape") setEditingId(null);
            }}
            className="mt-1 h-7 text-xs"
          />
        ) : article ? (
          <Link
            href={`/websites/${websiteId}/articles/${article.id}`}
            className="mt-1 line-clamp-3 block text-xs font-medium hover:underline"
          >
            {item.title}
          </Link>
        ) : (
          <p className="mt-1 line-clamp-3 text-xs font-medium">{item.title}</p>
        )}

        {/* Metrics only where they mean something: a written article's
            difficulty is history, not a decision to make. */}
        {!article && (item.difficulty !== null || item.volume !== null) ? (
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            {item.difficulty !== null ? `Difficulty ${item.difficulty}` : null}
            {item.difficulty !== null && item.volume !== null ? " · " : null}
            {item.volume !== null ? `Volume ${item.volume}` : null}
          </p>
        ) : null}

        {item.intent ? (
          <p className="mt-1 truncate text-[0.65rem] capitalize text-muted-foreground">
            {item.intent}
          </p>
        ) : null}

        {/*
          Actions appear on hover on a pointer device, and are always present
          for keyboard and touch — focus-within keeps them reachable by Tab,
          which display:none on hover alone would not.
        */}
        {!article ? (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => write(item.id)}
              className="h-6 px-1.5 text-[0.65rem]"
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <PenLine className="size-3" />
              )}
              Write
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Change topic"
              disabled={pending}
              onClick={() => {
                setEditingId(item.id);
                setDraft(item.title);
              }}
              className="h-6 px-1.5"
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Add instructions"
              disabled={pending}
              onClick={() => {
                setNotesId(item.id);
                setDraftNotes(item.customInstructions ?? "");
              }}
              className={cn(
                "h-6 px-1.5",
                // A filled-in note is worth seeing without hovering.
                item.customInstructions && "text-primary opacity-100",
              )}
            >
              <MessageSquarePlus className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove from plan"
              disabled={pending}
              onClick={() => remove(item.id)}
              className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ) : null}

        {notesId === item.id ? (
          <textarea
            autoFocus
            rows={3}
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            onBlur={() => saveNotes(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setNotesId(null);
            }}
            placeholder="Anything this article should cover or avoid."
            className="mt-1.5 w-full rounded border border-input bg-transparent p-1.5 text-[0.65rem] outline-none focus-visible:border-ring"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{counts.published} published</Badge>
          <Badge variant="secondary">{counts.queued} planned</Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
            {month.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((date) => {
              const items = byDay.get(dayKey(date)) ?? [];
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = sameDay(date, today);

              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "min-h-28 space-y-1.5 border-b border-r p-1.5",
                    // Days outside the month are context, not content.
                    !inMonth && "bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      isToday
                        ? "bg-primary font-semibold text-primary-foreground"
                        : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {date.getDate()}
                  </div>
                  {items.map(renderItem)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {undated.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Not scheduled</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {undated.map(renderItem)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
