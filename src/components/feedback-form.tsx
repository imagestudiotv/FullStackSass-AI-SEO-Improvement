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

/**
 * Shrinks a screenshot in the browser to what the server takes: a server
 * action receives 1 MB in all, and a full-screen PNG is often several. Drawn
 * at most FEEDBACK_LIMITS.screenshotWidth wide and saved as WebP (JPEG where
 * the browser cannot write WebP), smaller each try until it fits. The server
 * re-encodes it anyway (lib/feedback/send.ts).
 */
export async function shrinkScreenshot(file: Blob): Promise<Blob | FeedbackErrorCode> {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(file.type)) return "screenshot_type";
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "screenshot_unreadable";
  }
  const scale = Math.min(1, FEEDBACK_LIMITS.screenshotWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const [type, quality] of [
    ["image/webp", 0.85],
    ["image/webp", 0.7],
    ["image/jpeg", 0.6],
  ] as const) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob && (SCREENSHOT_TYPES as readonly string[]).includes(blob.type) && blob.size <= FEEDBACK_LIMITS.screenshotBytes) return blob;
  }
  return "screenshot_size";
}

/**
 * The feedback form (client, 2026-10-19), the same in the dashboard's dialog
 * and on the public Contact page: what it is about, the message, an address
 * to reply to (not asked of a signed-in customer), and an optional
 * screenshot - chosen, or pasted into the message.
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
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [shot, setShot] = useState<{ blob: Blob; preview: string } | null>(null);
  const [error, setError] = useState<FeedbackErrorCode | "failed" | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    opened.current = Date.now();
  }, []);

  // The preview's object URL is released when it is replaced or the form goes.
  useEffect(() => () => (shot ? URL.revokeObjectURL(shot.preview) : undefined), [shot]);

  async function attach(file: Blob) {
    setError(null);
    const shrunk = await shrinkScreenshot(file);
    if (typeof shrunk === "string") {
      setError(shrunk);
      return;
    }
    setShot({ blob: shrunk, preview: URL.createObjectURL(shrunk) });
  }

  function onPaste(event: React.ClipboardEvent) {
    const pasted = [...event.clipboardData.items].find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
    if (!pasted) return;
    event.preventDefault();
    void attach(pasted);
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
    if (shot) form.set("screenshot", shot.blob, "screenshot");
    start(async () => {
      const result = await sendFeedback(form).catch(() => null);
      if (!result) setError("failed");
      else if (!result.ok) setError(result.code);
      else {
        setSent(true);
        setError(null);
        setMessage("");
        setShot(null);
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

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{copy.screenshotLabel}</p>
        {shot ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of an unsent file */}
            <img src={shot.preview} alt="" className="max-h-28 max-w-48 rounded-md border object-contain" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShot(null)}>
              <X aria-hidden />
              {copy.screenshotRemove}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <ImagePlus aria-hidden />
            {copy.screenshotAdd}
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={SCREENSHOT_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void attach(file);
          }}
        />
        <p className="text-xs text-muted-foreground">{copy.screenshotHint}</p>
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
          {copy.errors[error]}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? copy.sending : copy.send}
      </Button>
    </form>
  );
}
