"use client";

import { ArrowUpRight, Copy, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { copyTextNow } from "@/lib/copy-text";
import type { BlogWriterCopy } from "@/lib/i18n/blog-writer";
import type { Locale } from "@/lib/i18n/config";
import { recordBlogWriterUseAction, writeBlogOpeningAction } from "@/lib/tools/blog-writer-actions";
import {
  BLOG_FORMATS,
  BRIEF_STORAGE_KEY,
  cleanBrief,
  isBlogFormat,
  MAX_NOTES_CHARS,
  MAX_TOPIC_CHARS,
  onDevicePrompt,
  openingText,
  parseOpeningText,
  saveBrief,
  templateOpening,
  type BlogBrief,
  type BlogOpening,
  type BriefStorage,
} from "@/lib/tools/blog-writer-shared";
import { rememberToolUse, type ToolUsePath } from "@/lib/tools/free-tools";
import { cn } from "@/lib/utils";

/**
 * The free AI Blog Writer's workspace (owner's mockup, 2026-11-27): the
 * samples shelf, the brief form and the reading pane. The opening is written
 * cheapest first - the browser's own AI, then RepGet's server, then the
 * template - and is only ever an opening; after it, a non-blocking panel
 * invites the visitor to sign up for the full article.
 */

/** Chrome's built-in Prompt API, where the browser has it (not in the DOM types yet). */
type LanguageModelSession = { prompt(text: string, options?: { signal?: AbortSignal }): Promise<string>; destroy?: () => void };
type LanguageModelApi = {
  availability(options?: Record<string, unknown>): Promise<string>;
  create(options?: Record<string, unknown>): Promise<LanguageModelSession>;
};

const CREATE_TIMEOUT_MS = 30_000;
const PROMPT_TIMEOUT_MS = 45_000;

/** The browser's own AI, when it is there and speaks the page's language; null otherwise. */
async function onDeviceOpening(brief: BlogBrief, locale: Locale): Promise<BlogOpening | null> {
  const api = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
  if (!api || typeof api.availability !== "function") return null;
  const languages = { expectedInputs: [{ type: "text", languages: [locale] }], expectedOutputs: [{ type: "text", languages: [locale] }] };
  let session: LanguageModelSession | null = null;
  try {
    if ((await api.availability(languages)) !== "available") return null;
    session = await api.create({ ...languages, signal: AbortSignal.timeout(CREATE_TIMEOUT_MS) });
    const answer = await session.prompt(onDevicePrompt(brief, locale), { signal: AbortSignal.timeout(PROMPT_TIMEOUT_MS) });
    return parseOpeningText(answer);
  } catch {
    return null;
  } finally {
    try {
      session?.destroy?.();
    } catch {
      // Nothing to clean up.
    }
  }
}

function readBrief(): BlogBrief | null {
  try {
    const raw = localStorage.getItem(BRIEF_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { version?: unknown; topic?: unknown; format?: unknown; notes?: unknown } | null;
    if (!value || value.version !== 1) return null;
    return {
      topic: typeof value.topic === "string" ? value.topic.slice(0, MAX_TOPIC_CHARS) : "",
      format: isBlogFormat(value.format) ? value.format : "guide",
      notes: typeof value.notes === "string" ? value.notes.slice(0, MAX_NOTES_CHARS) : "",
    };
  } catch {
    return null;
  }
}

function briefText(brief: BlogBrief, copy: BlogWriterCopy): string {
  return [`${copy.form.topicLabel}\n${brief.topic}`, `${copy.form.formatLabel}\n${copy.formats[brief.format]}`, `${copy.form.notesLabel}\n${brief.notes}`].join("\n\n");
}

type Result = { text: string; method: ToolUsePath };

const pill = "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";
const field =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function BlogWriter({ copy, locale, signUpHref }: { copy: BlogWriterCopy; locale: Locale; signUpHref: string }) {
  const id = useId();
  const [brief, setBrief] = useState<BlogBrief>({ topic: "", format: "guide", notes: "" });
  // Where the brief is kept: on the device, or - storage refused - only while this tab is open (the sample's two states).
  const [saved, setSaved] = useState<BriefStorage | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"brief" | "opening" | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The browser's copy, once, after hydration: the server's HTML and the first render agree.
    const stored = readBrief();
    if (stored) setTimeout(() => setBrief(stored), 0);
  }, []);

  function update(change: Partial<BlogBrief>) {
    const next = { ...brief, ...change };
    setBrief(next);
    setSaved(saveBrief(next));
  }

  async function copyOut(text: string, which: "brief" | "opening") {
    setFallback(null);
    if (await copyTextNow(text)) {
      setCopied(which);
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 2000);
    } else {
      setFallback(text);
    }
  }

  function show(opening: BlogOpening, method: ToolUsePath) {
    setResult({ text: openingText(opening), method });
    setEdited(false);
    // A sign-up from this browser is now counted for the Blog Writer (lib/tools/free-tools.ts).
    rememberToolUse("blog-writer");
    if (!dismissed) setPrompt(true);
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  async function write(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = cleanBrief(brief);
    if (!clean || busy) return;
    if (result && edited && !window.confirm(copy.result.replaceConfirm)) return;
    setBusy(true);
    try {
      const device = await onDeviceOpening(clean, locale);
      if (device) {
        show(device, "on_device");
        void recordBlogWriterUseAction({ path: "on_device", locale }).catch(() => {});
        return;
      }
      const server = await writeBlogOpeningAction({ ...clean, locale }).catch(() => null);
      if (server?.ok) {
        show({ title: server.title, opening: server.opening }, "server");
        return;
      }
      show(templateOpening(clean, locale, copy.closings), "template");
      void recordBlogWriterUseAction({ path: "template", locale }).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const sample = copy.samples[brief.format];

  return (
    <div>
      <section aria-labelledby={`${id}-samples`} className="text-center">
        <h2 id={`${id}-samples`} className="text-sm font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {copy.samplesTitle}
        </h2>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {BLOG_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              aria-pressed={brief.format === format}
              onClick={() => update({ format })}
              className={cn(
                pill,
                brief.format === format ? "border-foreground bg-foreground text-background" : "bg-card text-foreground hover:border-primary/50",
              )}
            >
              {copy.formats[format]}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-8 grid overflow-hidden rounded-3xl border bg-card shadow-[0_18px_50px_-30px_rgba(36,38,33,0.35)] min-[720px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <form onSubmit={write} className="space-y-5 border-b bg-muted/30 p-6 min-[720px]:border-r min-[720px]:border-b-0 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">{copy.form.title}</h2>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-topic`} className="text-sm font-medium">
              {copy.form.topicLabel}
            </label>
            <textarea
              id={`${id}-topic`}
              required
              maxLength={MAX_TOPIC_CHARS}
              rows={3}
              value={brief.topic}
              placeholder={copy.form.topicPlaceholder}
              onChange={(event) => update({ topic: event.target.value })}
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-format`} className="text-sm font-medium">
              {copy.form.formatLabel}
            </label>
            <select
              id={`${id}-format`}
              value={brief.format}
              onChange={(event) => update({ format: isBlogFormat(event.target.value) ? event.target.value : "guide" })}
              className={cn(field, "h-10")}
            >
              {BLOG_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {copy.formats[format]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-notes`} className="text-sm font-medium">
              {copy.form.notesLabel}
            </label>
            <textarea
              id={`${id}-notes`}
              required
              maxLength={MAX_NOTES_CHARS}
              rows={4}
              value={brief.notes}
              placeholder={copy.form.notesPlaceholder}
              onChange={(event) => update({ notes: event.target.value })}
              className={field}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center gap-3 rounded-full bg-foreground py-1 pr-1.5 pl-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? copy.form.writing : copy.form.submit}
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
              </span>
            </button>
            <p className="mt-3 text-xs text-muted-foreground">{copy.form.hint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" onClick={() => void copyOut(briefText(brief, copy), "brief")} className="font-medium text-primary-strong underline-offset-4 hover:underline">
              {copied === "brief" ? copy.form.copied : copy.form.copyBrief}
            </button>
            <span role="status" className="text-xs text-muted-foreground">
              {saved === "device" ? copy.form.saved : saved === "tab" ? copy.form.savedTab : ""}
            </span>
          </div>
          {fallback !== null ? (
            <div className="space-y-1.5">
              <textarea readOnly value={fallback} rows={5} className={field} onFocus={(event) => event.currentTarget.select()} aria-label={copy.form.copyFallback} />
              <p className="text-xs text-muted-foreground">{copy.form.copyFallback}</p>
            </div>
          ) : null}
        </form>

        <div className="p-6 sm:p-8">
          {result ? (
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-primary-strong uppercase">{copy.result.methods[result.method]}</p>
              <h2 ref={resultRef} tabIndex={-1} className="mt-2 text-xl font-semibold tracking-tight outline-none">
                {copy.result.heading}
              </h2>
              {result.method === "template" ? <p className="mt-2 text-sm text-muted-foreground">{copy.result.fallbackNote}</p> : null}
              <textarea
                aria-label={copy.result.editLabel}
                value={result.text}
                rows={10}
                onChange={(event) => {
                  setResult({ ...result, text: event.target.value });
                  setEdited(true);
                }}
                className={cn(field, "mt-4 font-serif text-base leading-relaxed")}
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copyOut(result.text, "opening")}
                  className="inline-flex h-10 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:border-primary/50"
                >
                  <Copy className="size-4" aria-hidden="true" />
                  {copied === "opening" ? copy.form.copied : copy.result.copyOpening}
                </button>
                <Link
                  prefetch={false}
                  href={signUpHref}
                  className="inline-flex h-10 items-center gap-3 rounded-full bg-foreground py-1 pr-1 pl-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  {copy.result.cta}
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
                    <ArrowUpRight className="size-4" />
                  </span>
                </Link>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{copy.result.ctaHint}</p>
              <hr className="my-8" />
            </div>
          ) : null}

          <article className="font-serif">
            <p className="font-sans text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{copy.sampleLabel}</p>
            <h2 className="mt-3 text-2xl leading-snug font-semibold text-balance">{sample.title}</h2>
            <p className="mt-2 font-sans text-sm text-muted-foreground">{sample.credit}</p>
            <p className="mt-5 text-lg leading-relaxed">{sample.intro}</p>
            {sample.sections.map((section) => (
              <section key={section.heading} className="mt-6">
                <h3 className="text-lg font-semibold">{section.heading}</h3>
                <p className="mt-2 leading-relaxed">{section.body}</p>
              </section>
            ))}
          </article>
        </div>
      </div>

      {prompt ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-prompt`}
          className="fixed right-4 bottom-4 left-4 z-40 rounded-2xl border bg-card p-5 shadow-xl sm:left-auto sm:w-96"
        >
          <button
            type="button"
            onClick={() => {
              setPrompt(false);
              setDismissed(true);
            }}
            aria-label={copy.prompt.dismiss}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <h2 id={`${id}-prompt`} className="pr-6 text-base font-semibold tracking-tight">
            {copy.prompt.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.prompt.body}</p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              prefetch={false}
              href={signUpHref}
              className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {copy.prompt.button}
            </Link>
            <button
              type="button"
              onClick={() => {
                setPrompt(false);
                setDismissed(true);
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {copy.prompt.dismiss}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

