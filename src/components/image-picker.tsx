"use client";

import { ImageIcon, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
 */

export type PickerImage = { url: string; name: string };

export function ImagePicker({
  images,
  loading,
  selected: initial = null,
  onSearch,
  onUpload,
  onInsert,
  onRemove,
  onClose,
}: {
  images: PickerImage[];
  loading: boolean;
  /**
   * The image already in place, when the panel was opened by clicking one.
   * It starts selected so the preview shows what is being replaced.
   */
  selected?: string | null;
  onSearch: (term: string) => void;
  /** Stores a file and returns its URL, or null when it failed. */
  onUpload: (file: File) => Promise<string | null>;
  onInsert: (url: string) => void;
  /** Deletes the image being edited. Absent when inserting a new one. */
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
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

  function choose(file: File) {
    startUpload(async () => {
      const url = await onUpload(file);
      // Selected rather than inserted: the customer still confirms, which is
      // the whole point of showing a preview.
      if (url) setSelected(url);
    });
  }

  return (
    <div className="relative my-4 rounded-lg border bg-card p-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Close image picker"
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
            alt=""
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
          <p className="mt-3 font-medium">No image selected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick one below, or upload your own.
          </p>
        </div>
      )}

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search your images"
          aria-label="Search your images"
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
          <span className="text-xs">Upload</span>
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
            {term
              ? "Nothing matches that."
              : "No pictures yet — upload one to start."}
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
            Remove
          </Button>
        ) : null}

        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!selected || selected === initial}
          onClick={() => selected && onInsert(selected)}
        >
          {initial ? "Replace image" : "Insert image"}
        </Button>
      </div>
    </div>
  );
}
