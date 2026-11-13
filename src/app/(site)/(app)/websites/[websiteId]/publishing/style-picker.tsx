"use client";

import { Check, Expand } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export type StyleCard = {
  /** The stored id. */
  id: string;
  label: string;
  hint: string;
  /** Card image (the 640 x 360 thumbnail), or null when there is no example. */
  thumb: string | null;
  /** Enlarged image (1280 x 720) for the preview, or null for no preview. */
  large: string | null;
  /** One more line under the hint, e.g. which style "Match" currently follows. */
  caption?: string;
  /** The preview dialog's title when it differs from "{style} example". */
  previewTitle?: string;
  /** The style the example shows, when it is not the card's own (e.g. what "Match" follows). */
  sampleStyle?: string;
};

/**
 * One row of image-style cards: a real radio group.
 *
 *  - Clicking a card (or Space/Enter on it) selects it.
 *  - Arrow keys move between cards and select, Home/End jump to the ends -
 *    a roving tabindex, so the group is one Tab stop (on the selected card).
 *    Choosing here only changes the form; nothing is saved until Save.
 *  - The expand button on each card opens a larger example in a dialog
 *    (Escape closes it and focus returns to the button) WITHOUT changing the
 *    selection: looking is not choosing.
 *  - The chosen card says "Selected" with a check, not only a coloured border.
 *
 * Images are the small 16:9 thumbnails in cards and the large file in the
 * preview, so a thumbnail is never stretched.
 */
export function StylePicker({
  id,
  label,
  hint,
  cards,
  value,
  onChange,
  disabled,
  note,
  t,
  tWorkspace,
}: {
  id: string;
  label: string;
  hint: string;
  cards: StyleCard[];
  value: string;
  onChange: (id: string) => void;
  /** Read-only (viewer): the choice is shown, previews still open. */
  disabled?: boolean;
  /** Shown under the cards, e.g. when the stored value is not among them. */
  note?: string;
  t: Messages["app"]["article"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const [preview, setPreview] = useState<StyleCard | null>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  /*
    The preview button that opened the dialog. Radix returns focus on close
    only to a DialogTrigger, and one dialog serves every card here, so
    without this focus would drop to the page body after Escape.
  */
  const opener = useRef<HTMLButtonElement | null>(null);
  const selectedIndex = cards.findIndex((card) => card.id === value);
  // With no card selected (a legacy value), the first card takes the Tab stop.
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = cards.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    onChange(cards[next].id);
    radios.current[next]?.focus();
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-1">
        <h3 id={labelId} className="text-sm font-medium text-foreground">
          {label}
        </h3>
        <p id={hintId} className="max-w-3xl text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        aria-disabled={disabled || undefined}
        className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
      >
        {cards.map((card, index) => {
          const checked = card.id === value;
          return (
            <div
              key={card.id}
              className={cn(
                "relative min-w-0 overflow-hidden rounded-lg border bg-card transition-colors motion-reduce:transition-none",
                checked ? "border-primary ring-2 ring-primary/25" : "hover:border-foreground/25",
              )}
            >
              <button
                ref={(node) => {
                  radios.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={index === tabStop ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(card.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="block w-full rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-default"
              >
                <span className="block aspect-video w-full overflow-hidden bg-muted">
                  {card.thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- a fixed-size local example; the radio's text names it, so the image is decorative here */
                    <img
                      src={card.thumb}
                      alt=""
                      width={640}
                      height={360}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="block space-y-1 p-2.5 sm:p-3">
                  <span className="block text-sm font-medium wrap-break-word text-foreground">{card.label}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">{card.hint}</span>
                  {card.caption ? (
                    <span className="block text-xs leading-5 font-medium text-foreground">{card.caption}</span>
                  ) : null}
                  {checked ? (
                    // Visible words and a check, so the choice never rests on the border colour.
                    // Hidden from screen readers, which already hear aria-checked.
                    <span className="inline-flex items-center gap-1 pt-0.5 text-xs font-medium text-primary" aria-hidden="true">
                      <Check className="size-3.5" />
                      {tWorkspace.selected}
                    </span>
                  ) : null}
                </span>
              </button>

              {card.large ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5 bg-background/90 shadow-sm backdrop-blur-sm"
                  aria-label={format(t.previewStyle, { style: card.label })}
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    setPreview(card);
                  }}
                >
                  <Expand aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {note ? <p className="text-xs leading-5 text-muted-foreground">{note}</p> : null}

      <Dialog open={preview !== null} onOpenChange={(open) => (open ? null : setPreview(null))}>
        {preview?.large ? (
          <DialogContent
            // No zoom for people who asked for reduced motion (the shared dialog always animates),
            // and scrollable rather than cut off on a phone held sideways.
            className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto sm:max-w-3xl motion-reduce:animate-none!"
            closeLabel={tWorkspace.close}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
          >
            <DialogHeader className="pr-8">
              <DialogTitle>{preview.previewTitle ?? format(t.previewTitle, { style: preview.label })}</DialogTitle>
              <DialogDescription>{t.previewHelp}</DialogDescription>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element -- the 1280 x 720 example, shown at its own size or smaller */}
            <img
              src={preview.large}
              alt={format(t.sampleAlt, { style: preview.sampleStyle ?? preview.label })}
              width={1280}
              height={720}
              className="aspect-video h-auto w-full rounded-lg bg-muted object-cover"
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
