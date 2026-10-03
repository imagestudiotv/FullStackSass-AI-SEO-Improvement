"use client";

import { ImageIcon, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Choosing a picture to put in an article.
 *
 * Inserting an image used to be a toolbar button that opened the operating
 * system's file dialog. That works if you have the file to hand and nothing
 * else does: no way to see what you picked before committing to it, and no way
 * to reuse a picture already in the article you wrote last week.
 *
 * The panel opens inside the document, where the image is going to land, so
 * the preview sits in roughly the place the picture will occupy.
 *
 * Suggestions are the website's own images rather than a stock library. That
 * is the set a customer actually wants — a photographer reuses venue shots, a
 * dentist the same surgery — and it costs nothing. A stock provider would be a
 * better search and is a separate decision; this panel would not change shape
 * to accommodate one.
 *
 * ALT TEXT. The description is written here, under the preview, because this
 * is where an image is chosen and where clicking one in the text lands
 * (client, 2026-10-01: "I don't find an option" to add alt text on blog
 * images). Search engines read it and screen readers say it aloud. Changing
 * only the description of an image already in place is a Save on its own.
 */

/** Longest description kept - the featured image's limit (lib/articles/image-actions.ts). */
const ALT_MAX = 300;

export type PickerImage = { url: string; name: string };

export function ImagePicker({
  images,
  loading,
  selected: initial = null,
  alt: initialAlt = null,
  onSearch,
  onUpload,
  onInsert,
  onRemove,
  onClose,
  t = getMessages("en").app.editorUi,
  tCommon = getMessages("en").app.common,
  className,
}: {
  /** The picker's wording, defaulting to English. */
  t?: Messages["app"]["editorUi"];
  /** Shared words: Cancel, Remove, Upload. */
  tCommon?: Messages["app"]["common"];
  images: PickerImage[];
  loading: boolean;
  /**
   * The image already in place, when the panel was opened by clicking one.
   * It starts selected so the preview shows what is being replaced.
   */
  selected?: string | null;
  /** The description of the image already in place, when there is one. */
  alt?: string | null;
  onSearch: (term: string) => void;
  /** Stores a file and returns its URL, or null when it failed. */
  onUpload: (file: File) => Promise<string | null>;
  /** Puts the chosen picture in place, with its description ("" for none). */
  onInsert: (url: string, alt: string) => void;
  /** Deletes the image being edited. Absent when inserting a new one. */
  onRemove?: () => void;
  onClose: () => void;
  /**
   * Extra classes on the panel. Opt-in: the editor's workspace variant puts
   * the panel in a dialog and drops its outer margin ("my-0"); without it the
   * panel is exactly as before.
   */
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [altText, setAltText] = useState(initialAlt ?? "");
  const [term, setTerm] = useState("");
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Debounced, so typing does not fire a request per keystroke. 300ms is long
   * enough to finish a word and short enough not to feel laggy.
   *
   * Keyed on the term alone. Including onSearch in the dependencies meant a
   * caller who passed an inline function reset the timer on every render, and
   * the search never ran — a mistake the picker should not be able to be
   * broken by, so the latest callback is read through a ref instead.
   */
  const searchRef = useRef(onSearch);
  useEffect(() => {
    searchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const timer = setTimeout(() => searchRef.current(term), 300);
    return () => clearTimeout(timer);
  }, [term]);

  /*
    Confirmable when there is a picture and something changed: a different
    picture, or a new description for the same one. It used to require a
    different picture, so a description alone could not be saved.
  */
  const altChanged = altText.trim() !== (initialAlt ?? "").trim();
  const canConfirm = Boolean(selected) && (selected !== initial || altChanged);
  function confirm() {
    if (selected && canConfirm) onInsert(selected, altText.trim());
  }

  function choose(file: File) {
    startUpload(async () => {
      const url = await onUpload(file);
      // Selected rather than inserted: the customer still confirms, which is
      // the whole point of showing a preview.
      if (url) setSelected(url);
    });
  }

  return (
    <div className={cn("relative my-4 rounded-lg border bg-card p-4", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t.closeImagePicker}
        onClick={onClose}
        className="absolute right-2 top-2 size-7 p-0"
      >
        <X className="size-4" />
      </Button>

      {/* The preview, where the picture will sit in the article. */}
      {selected ? (
        <div className="flex justify-center">
          {/*
            A plain <img>: these are customer uploads on a storage domain, so
            next/image would need every such host in remotePatterns.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected}
            alt={altText}
            className="max-h-80 rounded-md border object-contain"
          />
        </div>
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <ImageIcon
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <p className="mt-3 font-medium">{t.noImageSelected}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.pickOneBelow}
          </p>
        </div>
      )}

      {selected ? (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="image-picker-alt">{t.imageAlt}</Label>
          <Input
            id="image-picker-alt"
            value={altText}
            maxLength={ALT_MAX}
            onChange={(event) => setAltText(event.target.value)}
            onKeyDown={(event) => {
              // Enter saves, as in any one-line form; it must not reach the article behind.
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
            }}
            placeholder={t.imageAltPlaceholder}
          />
          <p className="text-xs text-muted-foreground">{tCommon.altHelp}</p>
        </div>
      ) : null}

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={tCommon.searchYourImages}
          aria-label={tCommon.searchYourImages}
          className="h-10 w-full rounded-full border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-5" aria-hidden="true" />
          )}
          <span className="text-xs">{tCommon.uploadLabel}</span>
        </button>

        {loading ? (
          <div className="flex size-20 items-center justify-center">
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : null}

        {images.map((image) => (
          <button
            key={image.url}
            type="button"
            onClick={() => setSelected(image.url)}
            aria-pressed={selected === image.url}
            className={cn(
              "size-20 shrink-0 overflow-hidden rounded-md border transition-all",
              selected === image.url
                ? "ring-2 ring-primary ring-offset-2"
                : "hover:opacity-80",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          </button>
        ))}

        {!loading && images.length === 0 ? (
          <p className="self-center text-sm text-muted-foreground">
            {term ? t.noMatches : t.noPicturesYet}
          </p>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared, or picking the same file twice fires no change event.
          event.target.value = "";
          if (file) choose(file);
        }}
      />

      <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="mr-auto text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
            {tCommon.remove}
          </Button>
        ) : null}

        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {tCommon.cancel}
        </Button>
        <Button type="button" size="sm" disabled={!canConfirm} onClick={confirm}>
          {!initial ? t.insertImage : selected === initial ? t.saveImage : t.replaceImage}
        </Button>
      </div>
    </div>
  );
}
