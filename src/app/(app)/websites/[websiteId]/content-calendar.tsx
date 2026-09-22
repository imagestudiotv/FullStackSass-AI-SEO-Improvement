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
import type { Messages } from "@/lib/i18n/messages";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
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
/** Reads a dayKey back as a local date and names it for the panel heading. */
function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

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
/**
 * Dot colour per status, so a month can be read without opening a day.
 *
 * Deliberately the same five tones StatusBadge uses, rather than a second
 * palette: a green dot and a green badge have to mean the same thing or the
 * calendar teaches the customer something the cards then contradict.
 */
const DOT_TONE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  draft: "bg-emerald-50/70 text-emerald-700/80 dark:bg-emerald-950/30 dark:text-emerald-300/80",
  generating: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  planned: "bg-muted text-muted-foreground",
};

/**
 * The statuses present on one day, with how many of each, most finished
 * first.
 *
 * Grouped rather than listed per article so a day with four planned items
 * reads "4 Planned" instead of repeating the same word four times. Ordered so
 * the work that is done appears before the work that is not, which is the
 * order a customer scans for.
 */
const STATUS_ORDER = ["published", "draft", "generating", "failed", "planned"];

function groupByStatus(
  items: CalendarRow[],
  articles: Map<string, ArticleRow>,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const status = statusFor(articles.get(item.id));
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    (a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]),
  );
}

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
  t,
  tCommon,
  tStatus,
}: {
  websiteId: string;
  calendar: CalendarRow[];
  articles: ArticleRow[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["calendar"];
  /** The status vocabulary, shared with the badges. */
  tStatus: Messages["app"]["status"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Which item has its instructions box open, and what is typed in it. */
  const [notesId, setNotesId] = useState<string | null>(null);
  /**
   * The day whose articles are listed beside the calendar. Null until a day is
   * clicked, so the panel starts on today rather than an arbitrary date.
   */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

  /**
   * The three states the header reports, counted across the whole plan rather
   * than the visible month: "27 queued" means the pipeline is full, which is
   * not a fact about September.
   *
   * Drafted is counted with published under "written", because from the
   * customer's side both mean the article exists and can be read. The box
   * itself still distinguishes them.
   */
  const counts = useMemo(() => {
    let published = 0;
    let generating = 0;
    let queued = 0;
    for (const item of calendar) {
      const article = articleByItem.get(item.id);
      if (article?.status === "published" || article?.status === "draft") {
        published += 1;
      } else if (
        article?.status === "generating" ||
        article?.status === "queued"
      ) {
        generating += 1;
      } else {
        queued += 1;
      }
    }
    return { published, generating, queued };
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
      toast.success(t.savedInstructions);
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
      toast.success(t.removedFromPlan);
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
      toast.success(t.writingStarted);
      router.refresh();
    });
  }

  function renderItem(item: CalendarRow) {
    const article = articleByItem.get(item.id);
    const status = statusFor(article);
    const busy = busyId === item.id;

    /**
     * Writing has started, so the topic is settled.
     *
     * A model is already part-way through an outline against this title; a
     * rename or a reschedule now would produce an article that does not match
     * its own calendar entry, and cancelling would bill for work thrown away.
     * The card says so rather than offering controls that would fail.
     */
    const inProgress =
      article?.status === "generating" || article?.status === "queued";
    /** Nothing written yet: still fully editable. */
    const editable = !article;

    return (
      <div
        key={item.id}
        className="group/item rounded-md border bg-card p-2 text-left"
      >
        <StatusBadge status={status} t={tStatus} />

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
        ) : inProgress ? (
          /**
           * The topic, not the title. The headline is part of what is being
           * written, so presenting the planned one as final would show the
           * customer something that is about to change.
           */
          <p className="mt-1 line-clamp-2 text-xs font-medium">
            {item.targetKeyword ?? item.title}
          </p>
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
        {inProgress ? (
          <p className="mt-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[0.65rem] leading-snug text-muted-foreground">
            This article can no longer be rescheduled or edited as it is in
            progress.
          </p>
        ) : null}

        {/*
          Actions are always visible now the cards sit in a side panel with
          room for them. Hiding them until hover suited a cramped date cell
          and suited a touch screen not at all — there is no hover there, so
          they were simply unreachable.
        */}
        {editable ? (
          <div className="mt-1.5 flex items-center gap-1">
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
              aria-label={t.changeTopic}
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
              aria-label={t.addInstructions}
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
              aria-label={t.removeFromPlan}
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
            placeholder={t.instructionsPlaceholder}
            className="mt-1.5 w-full rounded border border-input bg-transparent p-1.5 text-[0.65rem] outline-none focus-visible:border-ring"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Count then word, built from the status vocabulary rather than
            written in English here — these three read "3 Published" in every
            language otherwise.
          */}
          <StatusBadge
            status="published"
            label={`${counts.published} ${tStatus.published}`}
          />
          <StatusBadge
            status="generating"
            label={`${counts.generating} ${tStatus.generating}`}
          />
          <StatusBadge
            status="planned"
            label={`${counts.queued} ${tStatus.planned}`}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t.previousMonth}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
            {month.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t.nextMonth}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/*
        Calendar and day list side by side.
        
        Every article used to render inside its own date cell, so a day with
        four of them stretched that row and left the rest of the week mostly
        empty. The grid now shows only how many are due on each day; picking a
        day lists them in full beside it, which keeps the month readable at a
        glance and gives the articles room to be read.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-x-auto">
          <div className="min-w-[34rem]">
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
                const key = dayKey(date);
                const items = byDay.get(key) ?? [];
                const inMonth = date.getMonth() === month.getMonth();
                const isToday = sameDay(date, today);
                const isSelected = selectedDay
                  ? selectedDay === key
                  : isToday;

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    aria-pressed={isSelected}
                    aria-label={`${date.toDateString()}, ${items.length} article${items.length === 1 ? "" : "s"}`}
                    className={cn(
                      "flex min-h-20 flex-col items-center gap-1 border-b border-r p-2 text-left transition-colors",
                      "hover:bg-accent/60 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring",
                      !inMonth && "bg-muted/30",
                      /*
                        The selected day is a filled block rather than a tinted
                        one: it has to be findable at a glance in a grid of
                        forty-two cells, which a faint background is not.
                      */
                      isSelected && "bg-primary/10 ring-2 ring-inset ring-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs",
                        isToday
                          ? "bg-primary font-semibold text-primary-foreground"
                          : isSelected
                            ? "font-semibold text-primary"
                            : inMonth
                              ? "text-foreground"
                              : "text-muted-foreground",
                      )}
                    >
                      {date.getDate()}
                    </span>

                    {/*
                      A count, not the articles. Dots up to three so the shape
                      of the month reads without counting, with the number for
                      anything busier.
                    */}
                    {/*
                      The statuses on this day, in words.
                      
                      One label per KIND rather than per article: four
                      articles on a day is four "Planned" chips that say the
                      same thing four times and overflow the cell. Grouped,
                      a busy day reads "3 Planned · 1 Published", which is
                      the useful sentence.
                    */}
                    {items.length > 0 ? (
                      <span className="flex flex-wrap justify-center gap-1">
                        {groupByStatus(items, articleByItem).map(
                          ([status, n]) => (
                            <span
                              key={status}
                              className={cn(
                                "rounded px-1 py-0.5 text-[0.6rem] font-medium leading-none",
                                DOT_TONE[status],
                              )}
                            >
                              {n > 1 ? `${n} ` : ""}
                              {statusLabel(status, tStatus)}
                            </span>
                          ),
                        )}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/*
          The chosen day, in full.
          
          Header carries the count as well as the date, so the panel says what
          it is showing even when a day holds several articles and the list
          runs past the fold.
        */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 border-b pb-2">
            <p className="text-sm font-medium">
            {/*
              Parsed part by part, not with new Date(key). A bare "YYYY-MM-DD"
              is read as UTC, so west of Greenwich the heading would name the
              previous day while the grid highlighted the right one.
            */}
              {dayLabel(selectedDay ?? dayKey(today))}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {(byDay.get(selectedDay ?? dayKey(today)) ?? []).length} article
              {(byDay.get(selectedDay ?? dayKey(today)) ?? []).length === 1
                ? ""
                : "s"}
            </span>
          </div>
          {(byDay.get(selectedDay ?? dayKey(today)) ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {tCommon.nothingPlanned}
            </p>
          ) : (
            <div className="space-y-2">
              {(byDay.get(selectedDay ?? dayKey(today)) ?? []).map(renderItem)}
            </div>
          )}
        </div>
      </div>

      {undated.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{tCommon.notScheduled}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {undated.map(renderItem)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
