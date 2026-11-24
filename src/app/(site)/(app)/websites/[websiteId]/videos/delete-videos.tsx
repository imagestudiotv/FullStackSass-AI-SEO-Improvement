"use client";

import { ListChecks, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, plural } from "@/lib/i18n/format";
import { deleteVideoIdeas } from "@/lib/video/library-actions";

import { errorText, type IdeaView, type T } from "./shared";

/**
 * Deleting videos (Daniel, 2026-11-24: "delete the video they want, in order
 * to having their dashboard clean"): one from its card, or several from the
 * list's Select. Always asked first, with what the deletion means for what
 * was chosen (lib/video/delete.ts). A deleted video leaves the list at once.
 */
export function useDeletion({ websiteId, ideas, t }: { websiteId: string; ideas: IdeaView[]; t: T }) {
  const router = useRouter();
  const selectId = useId();
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [asking, setAsking] = useState<IdeaView[] | null>(null);
  const [working, start] = useTransition();
  const r = t.flow.library.remove;

  const left = ideas.filter((idea) => !gone.has(idea.id));
  const selected = left.filter((idea) => chosen.has(idea.id));

  const toggle = (id: string) =>
    setChosen((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const stop = () => {
    setSelecting(false);
    setChosen(new Set());
  };
  const confirm = () => {
    if (!asking) return;
    const ids = asking.map((idea) => idea.id);
    start(async () => {
      const result = await deleteVideoIdeas(websiteId, ids).catch(() => null);
      if (!result || !result.ok) return void toast.error(result ? errorText(t, result, "") : t.errors.generic);
      const { deleted, busy } = result.data;
      setGone((set) => new Set([...set, ...deleted]));
      setAsking(null);
      stop();
      if (deleted.length > 0) toast.success(plural(r.deleted, deleted.length));
      if (busy > 0) toast(plural(r.stayed, busy));
      router.refresh();
    });
  };

  return { left, selecting, selected, asking, working, selectId, chosen, toggle, ask: setAsking, start: () => setSelecting(true), stop, all: (list: IdeaView[]) => setChosen(new Set(list.map((idea) => idea.id))), confirm };
}

export type Deletion = ReturnType<typeof useDeletion>;

/** The list's Select: then Select all, Delete and Done. `shown`: what Select all takes (the filtered list). */
export function SelectBar({ deletion, shown, t }: { deletion: Deletion; shown: IdeaView[]; t: T }) {
  const r = t.flow.library.remove;
  if (!deletion.selecting) {
    return (
      <Button id={deletion.selectId} variant="outline" size="lg" onClick={deletion.start}>
        <ListChecks aria-hidden="true" />
        {r.select}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
        {format(r.selected, { count: String(deletion.selected.length) })}
      </span>
      <Button variant="outline" size="lg" disabled={shown.length === 0} onClick={() => deletion.all(shown)}>
        {r.selectAll}
      </Button>
      <Button variant="destructive" size="lg" disabled={deletion.selected.length === 0} onClick={() => deletion.ask(deletion.selected)}>
        <Trash2 aria-hidden="true" />
        {r.button}
      </Button>
      <Button id={deletion.selectId} variant="ghost" size="lg" onClick={deletion.stop}>
        {r.done}
      </Button>
    </div>
  );
}

/** A card's checkbox while selecting. */
export function SelectBox({ idea, deletion, t, className = "" }: { idea: IdeaView; deletion: Deletion; t: T; className?: string }) {
  if (!deletion.selecting) return null;
  return (
    <label className={`flex size-9 cursor-pointer items-center justify-center rounded-lg border bg-background/95 shadow-sm has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 ${className}`}>
      <input
        type="checkbox"
        aria-label={format(t.flow.library.remove.selectFor, { title: idea.title })}
        checked={deletion.chosen.has(idea.id)}
        onChange={() => deletion.toggle(idea.id)}
        className="size-4 cursor-pointer accent-primary outline-none"
      />
    </label>
  );
}

/** "Delete this video?", with what it means for what was chosen: in the making, scheduled, posted. */
export function DeleteDialog({ deletion, t }: { deletion: Deletion; t: T }) {
  const r = t.flow.library.remove;
  const ideas = deletion.asking;
  if (!ideas) return null;
  const has = (...statuses: string[]) => ideas.some((idea) => statuses.includes(idea.status));
  const posted = has("posted") || ideas.some((idea) => Object.values(idea.destinations).some((state) => state.status === "posted"));
  const notes = [
    has("approved", "making") ? r.making : null,
    has("ready", "draft", "scheduled", "posted") ? r.made : null,
    has("scheduled") ? r.scheduled : null,
    posted ? r.posted : null,
    has("posting") ? r.posting : null,
  ].filter((note): note is string => note !== null);
  return (
    <Dialog open onOpenChange={(open) => !open && !deletion.working && deletion.ask(null)}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        // The card it came from may be gone: the list's Select takes the focus instead of nothing.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(deletion.selectId)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="leading-snug">{plural(r.title, ideas.length)}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              {ideas.length === 1 ? <p className="font-medium break-words text-foreground">{ideas[0].title}</p> : null}
              <p>{r.body}</p>
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={deletion.working} onClick={() => deletion.ask(null)}>
            {r.cancel}
          </Button>
          <Button variant="destructive" disabled={deletion.working} onClick={deletion.confirm}>
            {deletion.working ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {deletion.working ? r.working : r.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
