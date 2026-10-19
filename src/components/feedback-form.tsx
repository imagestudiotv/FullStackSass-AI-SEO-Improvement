"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedback } from "@/lib/feedback/actions";
import type { FeedbackCopy } from "@/lib/feedback/copy";
import { FEEDBACK_KINDS, FEEDBACK_LIMITS, SCREENSHOT_TYPES, type FeedbackErrorCode, type FeedbackKind } from "@/lib/feedback/shared";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const isPictureType = (type: string) => (SCREENSHOT_TYPES as readonly string[]).includes(type);

/** The most pixels drawn on a canvas: well inside every browser's limit, even for a full-page screenshot. */
const MAX_CANVAS_PIXELS = 8_000_000;

/**
 * Shrinks a picture in the browser to what the server takes: a server action
 * receives 1 MB in all, which a message's pictures share (`budget` is this
 * one's part), and a full-screen PNG is often several. Drawn at most
 * FEEDBACK_LIMITS.screenshotWidth wide and saved as WebP (JPEG where the
 * browser cannot write WebP), smaller each try - lower quality, then
 * narrower - until it fits. The server re-encodes it anyway
 * (lib/feedback/send.ts).
 */
export async function shrinkScreenshot(file: Blob, budget: number = FEEDBACK_LIMITS.screenshotBytes): Promise<Blob | FeedbackErrorCode> {
  if (!isPictureType(file.type)) return "screenshot_type";
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "screenshot_unreadable";
  }
  try {
    let drawnWidth = 0;
    for (const width of [FEEDBACK_LIMITS.screenshotWidth, 1200, 900]) {
      const scale = Math.min(1, width / bitmap.width, Math.sqrt(MAX_CANVAS_PIXELS / (bitmap.width * bitmap.height)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      // A picture already narrower than this step was tried at its own size.
      if (canvas.width === drawnWidth) continue;
      drawnWidth = canvas.width;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const [type, quality] of [
        ["image/webp", 0.85],
        ["image/webp", 0.7],
        ["image/jpeg", 0.6],
      ] as const) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
        if (blob && isPictureType(blob.type) && blob.size <= budget) return blob;
      }
    }
    return "screenshot_size";
  } finally {
    bitmap.close();
  }
}

/** A small preview of a picture, as a data: address (nothing to release later); an error when it is not a picture. */
async function thumbnail(file: Blob): Promise<{ url: string } | FeedbackErrorCode> {
  if (!isPictureType(file.type)) return "screenshot_type";
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 240 / bitmap.width, 240 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { url: canvas.toDataURL("image/webp", 0.8) };
  } catch {
    return "screenshot_unreadable";
  }
}

type Picture = { key: number; file: Blob; preview: string };

/**
 * The feedback form (client, 2026-10-19), the same in the dashboard's dialog
 * and on the public Contact page: what it is about, the message, an address
 * to reply to (not asked of a signed-in customer), and up to five
 * pictures - chosen (several at once), dropped, or pasted into the message.
 *
 * The page it was sent from and the time the form was open go with it; so
 * does a field people never see, which only a bot fills in.
 */
export function FeedbackForm({
  copy,
  locale,
  source,
  accountEmail,
}: {
  copy: FeedbackCopy;
  locale: Locale;
  source: "dashboard" | "website";
  /** A signed-in customer's address: used for the reply, so no address is asked for. */
  accountEmail?: string | null;
}) {
  const id = useId();
  /** When the form appeared: set once it is on screen (a render must not read the clock). */
  const opened = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  /** The pictures as chosen; each is shrunk to its share when the form is sent. */
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [error, setError] = useState<FeedbackErrorCode | "failed" | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const max = FEEDBACK_LIMITS.screenshots;

  useEffect(() => {
    opened.current = Date.now();
  }, []);

  /** Adds pictures up to the limit; the rest are left out, saying so. */
  async function attach(files: Blob[]) {
    setError(null);
    const room = max - pictures.length;
    const added: Picture[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      const preview = await thumbnail(file);
      if (typeof preview === "string") {
        setError(preview);
        continue;
      }
      nextKey.current += 1;
      added.push({ key: nextKey.current, file, preview: preview.url });
    }
    if (files.length > room) setError("screenshot_count");
    if (added.length > 0) setPictures((current) => [...current, ...added].slice(0, max));
  }

  function onPaste(event: React.ClipboardEvent) {
    const pasted = [...event.clipboardData.items]
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (pasted.length === 0) return;
    event.preventDefault();
    void attach(pasted);
  }

  function onDrop(event: React.DragEvent) {
    const dropped = [...event.dataTransfer.files];
    if (dropped.length === 0) return;
    event.preventDefault();
    void attach(dropped);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The form's own fields: the kind and the field only a bot fills in.
    const form = new FormData(event.currentTarget);
    form.set("message", message);
    form.set("email", accountEmail ? "" : email);
    form.set("name", name);
    form.set("page", `${window.location.pathname}${window.location.search}`);
    form.set("locale", locale);
    form.set("source", source);
    form.set("elapsed", String(Date.now() - opened.current));
    const chosen = pictures;
    start(async () => {
      // The pictures share what one request can carry: one may use all of it, five a fifth each.
      const budget = Math.floor(FEEDBACK_LIMITS.screenshotBytes / Math.max(1, chosen.length));
      for (const [index, picture] of chosen.entries()) {
        const shrunk = await shrinkScreenshot(picture.file, budget);
        if (typeof shrunk === "string") {
          setError(shrunk);
          return;
        }
        form.append("screenshot", shrunk, `screenshot-${index + 1}`);
      }
      const result = await sendFeedback(form).catch(() => null);
      if (!result) setError("failed");
      else if (!result.ok) setError(result.code);
      else {
        setSent(true);
        setError(null);
        setMessage("");
        setPictures([]);
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-3" role="status">
        <p className="font-medium">{copy.thanksTitle}</p>
        <p className="text-sm text-muted-foreground">{copy.thanksBody}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            opened.current = Date.now();
            setSent(false);
          }}
        >
          {copy.sendAnother}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{copy.kindLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                kind === option ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => setKind(option)} className="sr-only" />
              {copy.kinds[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={`${id}-message`} className="text-sm font-medium">
          {copy.messageLabel}
        </label>
        <Textarea
          id={`${id}-message`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onPaste={onPaste}
          placeholder={copy.placeholders[kind]}
          rows={5}
          maxLength={FEEDBACK_LIMITS.message}
          required
        />
      </div>

      {accountEmail ? (
        <p className="text-sm text-muted-foreground">{copy.accountEmail.replace("{email}", accountEmail)}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-email`} className="text-sm font-medium">
              {copy.emailLabel}
            </label>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={FEEDBACK_LIMITS.email}
              aria-describedby={`${id}-email-hint`}
              required
            />
            <p id={`${id}-email-hint`} className="text-xs text-muted-foreground">
              {copy.emailHint}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              {copy.nameLabel}
            </label>
            <Input id={`${id}-name`} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={FEEDBACK_LIMITS.name} />
          </div>
        </div>
      )}

      <div className="space-y-2" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <p className="text-sm font-medium">{copy.screenshotLabel}</p>
        {pictures.length > 0 ? (
          <ul className="flex flex-wrap gap-3 pt-1">
            {pictures.map((picture, index) => (
              <li key={picture.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of an unsent file */}
                <img src={picture.preview} alt="" className="h-20 w-28 rounded-md border bg-muted object-cover" />
                <button
                  type="button"
                  onClick={() => setPictures((current) => current.filter((item) => item.key !== picture.key))}
                  aria-label={copy.screenshotRemove.replace("{n}", String(index + 1))}
                  className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {pictures.length < max ? (
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <ImagePlus aria-hidden />
            {copy.screenshotAdd}
          </Button>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept={SCREENSHOT_TYPES.join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length > 0) void attach(files);
          }}
        />
        <p className="text-xs text-muted-foreground">
          {copy.screenshotHint.replace("{max}", String(max))}
          {pictures.length > 0 ? <span className="tabular-nums"> ({pictures.length}/{max})</span> : null}
        </p>
      </div>

      {/* Only a bot fills this in: people never see it, and it is skipped by keyboard and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {copy.errors[error].replace("{max}", String(max))}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? copy.sending : copy.send}
      </Button>
    </form>
  );
}
