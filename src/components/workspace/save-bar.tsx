"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export type SaveBarState =
  | { kind: "clean" }
  | { kind: "dirty"; count: number }
  | { kind: "saving"; count: number }
  | { kind: "saved" }
  | { kind: "failed"; error: string; count: number };

/**
 * True while an on-screen keyboard is up. A fixed bar at the bottom would
 * otherwise ride up over the field being typed into on a phone.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const coarse = window.matchMedia("(pointer: coarse)");
    const update = () => setOpen(coarse.matches && viewport.height < window.innerHeight * 0.75);
    viewport.addEventListener("resize", update);
    update();
    return () => viewport.removeEventListener("resize", update);
  }, []);
  return open;
}

/**
 * The one Save for a form, fixed to the bottom of the viewport so it is in
 * reach however far down the form someone is.
 *
 * GEOMETRY, because several things share this edge:
 *  - md:left-60 clears the app sidebar (w-60 from md).
 *  - z-40 keeps it under dialogs, menus and sheets (z-50).
 *  - The buttons stay out of the chat launcher's corner (Crisp sits 14-68px
 *    from the bottom right at every width, phones included): from sm the
 *    whole bar keeps 6rem clear on the right; on phones the status gets the
 *    full width on its own row and the buttons sit below it, left-aligned
 *    and allowed to wrap, so long German or Spanish labels never squeeze
 *    the status into a sliver or run under the launcher. The setup panel
 *    floats at bottom-28, above this bar.
 *  - Hidden while a phone keyboard is open, so it never covers the field.
 *  - Pages put <SaveBarSpacer/> after their last section so the bar never
 *    covers the end of the form.
 *
 * It states what is pending, saving, saved or failed in words (and to screen
 * readers through a polite live region) - never only by colour - and Save is
 * disabled while a save is in flight.
 */
export function SaveBar({
  state,
  onSave,
  onDiscard,
  t,
  saveLabel,
  note,
  disabled,
}: {
  state: SaveBarState;
  onSave: () => void;
  onDiscard?: () => void;
  t: Messages["app"]["workspace"];
  /** Defaults to t.save; e.g. "Save article settings". */
  saveLabel?: string;
  /** A short line about scope, e.g. which settings this Save covers. */
  note?: ReactNode;
  disabled?: boolean;
}) {
  const keyboardOpen = useKeyboardOpen();
  const pending = state.kind === "dirty" || state.kind === "saving" || state.kind === "failed";
  const saving = state.kind === "saving";

  let status: ReactNode;
  if (state.kind === "saving") {
    status = (
      <span className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {t.saving}
      </span>
    );
  } else if (state.kind === "failed") {
    status = (
      <span className="flex items-start gap-2 text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{format(t.saveFailed, { error: state.error })}</span>
      </span>
    );
  } else if (state.kind === "dirty") {
    status = (
      <span className="flex items-center gap-2 font-medium text-foreground">
        <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        {plural(t.unsaved, state.count)}
      </span>
    );
  } else if (state.kind === "saved") {
    status = (
      <span className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t.saved}
      </span>
    );
  } else {
    status = <span className="text-muted-foreground">{t.noChanges}</span>;
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pr-4 backdrop-blur transition-transform supports-[backdrop-filter]:bg-background/85 motion-reduce:transition-none sm:pr-24 md:left-60",
        keyboardOpen && "pointer-events-none translate-y-full",
        pending && "border-t-primary/40",
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 py-3 pl-4 sm:flex-row sm:items-center sm:gap-4 md:pl-8">
        <div className="min-w-0 text-sm sm:flex-1" role="status" aria-live="polite">
          {status}
          {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 pr-16 sm:shrink-0 sm:flex-nowrap sm:pr-0">
          {onDiscard && pending && !saving ? (
            <Button type="button" variant="ghost" onClick={onDiscard}>
              {t.discard}
            </Button>
          ) : null}
          <Button type="button" onClick={onSave} disabled={disabled || saving || !pending}>
            {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {saveLabel ?? t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Room at the end of a page so the fixed bar never covers the last section. */
export function SaveBarSpacer() {
  return <div className="h-24" aria-hidden="true" />;
}
