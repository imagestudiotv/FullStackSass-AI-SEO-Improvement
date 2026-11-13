"use client";

import { Check, ChevronDown, Copy, Download, Globe, Loader2, Lock, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { Locale } from "@/lib/i18n/config";
import type { SocialPostGeneratorCopy } from "@/lib/i18n/social-post-generator";
import { freeSocialPostsStatusAction, generateFreeSocialPostsAction } from "@/lib/tools/social-posts-actions";
import {
  allPostsText,
  countCharacters,
  EXAMPLE_URL,
  FIRST_PLATFORMS,
  FREE_SOCIAL_GOALS,
  FREE_SOCIAL_PLATFORMS,
  FREE_SOCIAL_SPECS,
  FREE_SOCIAL_TONES,
  isFreeSocialPlatform,
  looksLikePublicUrl,
  MAX_URL_CHARS,
  postsCsv,
  type FreeSocialGoal,
  type FreeSocialPlatform,
  type FreeSocialPost,
  type FreeSocialRefusal,
  type FreeSocialSource,
  type FreeSocialTone,
} from "@/lib/tools/social-posts-shared";
import { cn } from "@/lib/utils";

/**
 * The browser's copy of the free batch, so the posts - and the visitor's
 * edits - come back after a reload. Only a convenience: the server keeps the
 * allowance (lib/tools/social-posts.ts), whatever this holds.
 */
const STORAGE_KEY = "repget-free-social-posts-v1";

type Batch = { platform: FreeSocialPlatform; posts: FreeSocialPost[]; source: FreeSocialSource };
type Failure = { reason: FreeSocialRefusal; retryAvailable: boolean };

function readStored(): Batch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Batch> | null;
    if (!value || !isFreeSocialPlatform(value.platform) || !Array.isArray(value.posts) || value.posts.length !== 3) return null;
    const posts = value.posts.map((post) => ({
      angle: typeof post?.angle === "string" ? post.angle.slice(0, 60) : "",
      text: typeof post?.text === "string" ? post.text.slice(0, 20_000) : "",
    }));
    const source = value.source;
    if (!source || typeof source.url !== "string" || typeof source.domain !== "string") return null;
    return { platform: value.platform, posts, source: { url: source.url, domain: source.domain, title: typeof source.title === "string" ? source.title : null } };
  } catch {
    return null;
  }
}

function store(batch: Batch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batch));
  } catch {
    // Storage blocked: the posts stay on this page only.
  }
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The generator's two cards (client's design): the form - address, one
 * platform, options - and the results - three editable posts with
 * platform-aware character counts, copy, copy all and CSV export, then the
 * invitation to sign up. Nothing here publishes anything.
 *
 * States: empty, loading, an invalid address (under the field), a page that
 * could not be read, a model failure (with its one retry while the server
 * still allows it), the free batch already used, and the posts. Once the
 * batch is used, editing, copying and exporting stay available.
 */
export function SocialPostGenerator({
  copy,
  locale,
  signUpHref,
  signInHref,
}: {
  copy: SocialPostGeneratorCopy;
  locale: Locale;
  signUpHref: string;
  signInHref: string;
}) {
  const t = copy.form;
  const r = copy.results;
  const ids = useId();
  const urlId = `${ids}-url`;
  const urlErrorId = `${ids}-url-error`;

  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<FreeSocialPlatform>("instagram");
  const [goal, setGoal] = useState<FreeSocialGoal>("introduce");
  const [tone, setTone] = useState<FreeSocialTone>("natural");
  const [hashtags, setHashtags] = useState(true);
  const [emoji, setEmoji] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  /** From the server; null until it has answered. */
  const [available, setAvailable] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<number | "all" | null>(null);
  const [notice, setNotice] = useState("");

  const generateRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // The batch from an earlier visit, and what the server says is left.
  useEffect(() => {
    const saved = readStored();
    if (saved) {
      setTimeout(() => {
        setBatch(saved);
        setPlatform(saved.platform);
        setUrl(saved.source.url);
      }, 0);
    }
    freeSocialPostsStatusAction()
      .then((status) => setAvailable(status.available))
      .catch(() => {});
  }, []);

  const used = available === false;
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  function flash(message: string, which: number | "all" | null = null) {
    setNotice(message);
    setCopied(which);
    window.setTimeout(() => setCopied((current) => (current === which ? null : current)), 1_800);
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    if (loading || used) return;
    if (!looksLikePublicUrl(url)) {
      setUrlError(copy.errors.invalidUrl);
      document.getElementById(urlId)?.focus();
      return;
    }
    setUrlError("");
    setFailure(null);
    setLoading(true);
    if (window.matchMedia?.("(max-width: 1023px)").matches) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const outcome = await generateFreeSocialPostsAction({ url: url.trim(), platform, goal, tone, hashtags, emoji, locale });
      if (outcome.ok) {
        const next = { platform: outcome.platform, posts: outcome.posts, source: outcome.source };
        setBatch(next);
        store(next);
        setAvailable(false);
      } else if (outcome.reason === "invalid_url") {
        setUrlError(copy.errors.invalidUrl);
      } else {
        const retryAvailable = outcome.reason === "provider_failed" && outcome.retryAvailable === true;
        setFailure({ reason: outcome.reason, retryAvailable });
        if (outcome.reason === "limit" || (outcome.reason === "provider_failed" && !retryAvailable)) setAvailable(false);
      }
    } catch {
      setFailure({ reason: "unavailable", retryAvailable: false });
    } finally {
      setLoading(false);
    }
  }

  function fillExample() {
    setUrl(EXAMPLE_URL);
    setUrlError("");
    generateRef.current?.focus();
  }

  function edit(index: number, text: string) {
    setBatch((current) => {
      if (!current) return current;
      const next = { ...current, posts: current.posts.map((post, i) => (i === index ? { ...post, text } : post)) };
      store(next);
      return next;
    });
  }

  async function copyOne(index: number) {
    if (!batch) return;
    flash((await copyToClipboard(batch.posts[index].text)) ? r.copied : r.copyFailed, index);
  }

  async function copyAll() {
    if (!batch) return;
    const text = allPostsText(batch.posts, (n) => fill(r.postHeading, { n }));
    flash((await copyToClipboard(text)) ? r.copied : r.copyFailed, "all");
  }

  function exportCsv() {
    if (!batch) return;
    const csv = postsCsv(r.csvHeader, batch.platform, batch.posts, batch.source.url);
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `repget-social-posts-${batch.platform}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 3_000);
    flash(r.exported);
  }

  function errorText(reason: FreeSocialRefusal, retryAvailable: boolean): string {
    switch (reason) {
      case "extraction_failed":
        return copy.errors.extraction;
      case "provider_failed":
        return retryAvailable ? copy.errors.provider : copy.errors.providerFinal;
      case "limit":
        return copy.errors.limit;
      case "rate_limited":
        return copy.errors.rateLimited;
      case "busy":
        return copy.errors.busy;
      case "invalid_url":
        return copy.errors.invalidUrl;
      default:
        return copy.errors.unavailable;
    }
  }

  const visiblePlatforms =
    showMore || FREE_SOCIAL_PLATFORMS.indexOf(platform) >= FIRST_PLATFORMS ? FREE_SOCIAL_PLATFORMS : FREE_SOCIAL_PLATFORMS.slice(0, FIRST_PLATFORMS);
  const spec = batch ? FREE_SOCIAL_SPECS[batch.platform] : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* ---------- The form ---------- */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby={`${ids}-form-title`}>
        <form onSubmit={generate} noValidate className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id={`${ids}-form-title`} className="text-xl font-semibold tracking-tight">
              {t.title}
            </h2>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                used ? "border-primary/30 bg-primary/5 text-primary" : "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {used ? t.usedBadge : t.freeBadge}
            </span>
          </div>

          <fieldset disabled={used || loading} className="min-w-0 space-y-0">
            <Step n={1} title={t.stepWebsite} />
            <label htmlFor={urlId} className="mb-2 block text-xs font-medium text-muted-foreground">
              {t.urlLabel}
            </label>
            <div
              className={cn(
                "flex h-12 items-center gap-2.5 rounded-xl border bg-background px-3.5 transition-shadow focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-primary/15",
                urlError && "border-destructive",
              )}
            >
              <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id={urlId}
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                maxLength={MAX_URL_CHARS}
                placeholder={t.urlPlaceholder}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (urlError) setUrlError("");
                }}
                aria-invalid={urlError ? true : undefined}
                aria-describedby={urlError ? `${ids}-url-help ${urlErrorId}` : `${ids}-url-help`}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span id={`${ids}-url-help`} className="text-xs text-muted-foreground">
                {t.urlHelp}
              </span>
              <button type="button" onClick={fillExample} className="text-xs font-semibold whitespace-nowrap text-primary hover:underline">
                {t.example}
              </button>
            </div>
            {urlError ? (
              <p id={urlErrorId} role="alert" className="mt-2 text-xs text-destructive">
                {urlError}
              </p>
            ) : null}

            <div className="my-6 h-px bg-border" />

            <Step n={2} title={t.stepPlatform} note={t.selectOne} />
            <div role="group" aria-label={t.platformsLabel} className="grid grid-cols-3 gap-2">
              {visiblePlatforms.map((id) => {
                const selected = id === platform;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPlatform(id)}
                    className={cn(
                      "relative flex min-h-11 items-center justify-center gap-1.5 rounded-lg border bg-background px-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:border-primary/40",
                      selected && "border-primary/60 bg-primary/5 text-foreground ring-1 ring-primary/30",
                    )}
                  >
                    <span className="w-4 text-center text-sm font-bold" aria-hidden="true">
                      {FREE_SOCIAL_SPECS[id].symbol}
                    </span>
                    <span>{FREE_SOCIAL_SPECS[id].name}</span>
                    {selected ? <Check className="absolute top-1 right-1 size-3 text-primary" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            {FREE_SOCIAL_PLATFORMS.indexOf(platform) < FIRST_PLATFORMS ? (
              <button type="button" onClick={() => setShowMore((open) => !open)} className="mx-auto mt-3 block text-xs font-semibold text-primary hover:underline">
                {showMore ? t.showFewer : t.showMore}
              </button>
            ) : null}

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <strong className="text-foreground">{t.quotaStrong}</strong> {t.quotaRest}
              </span>
            </p>

            <details className="group mt-5 border-t pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
                {t.customize} <span className="font-normal opacity-80">{t.optional}</span>
                <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Select label={t.goal} value={goal} onChange={(value) => setGoal(value as FreeSocialGoal)} options={FREE_SOCIAL_GOALS.map((id): [string, string] => [id, t.goals[id]])} />
                <Select label={t.tone} value={tone} onChange={(value) => setTone(value as FreeSocialTone)} options={FREE_SOCIAL_TONES.map((id): [string, string] => [id, t.tones[id]])} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={hashtags} onChange={(event) => setHashtags(event.target.checked)} className="accent-primary" />
                  {t.hashtags}
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={emoji} onChange={(event) => setEmoji(event.target.checked)} className="accent-primary" />
                  {t.emoji}
                </label>
              </div>
            </details>
          </fieldset>

          {used ? (
            <Link
              prefetch={false}
              href={signUpHref}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
            >
              <Lock className="size-4" aria-hidden="true" />
              {t.unlock} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <button
              ref={generateRef}
              type="submit"
              disabled={loading}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {loading ? t.generating : failure?.retryAvailable ? t.retry : t.generate}
              {loading ? null : <span aria-hidden="true">→</span>}
            </button>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Check className="mr-1 inline size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {used ? t.helperUsed : t.helper}
          </p>
        </form>
        <p className="border-t bg-muted/40 px-5 py-3 text-center text-[11px] leading-relaxed text-muted-foreground">{t.foot}</p>
      </section>

      {/* ---------- The results ---------- */}
      <section ref={resultsRef} className="flex min-h-[560px] min-w-0 scroll-mt-6 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby={`${ids}-results-title`} aria-busy={loading}>
        <div className="flex items-center justify-between gap-4 border-b px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-primary uppercase">{r.eyebrow}</p>
            <h2 id={`${ids}-results-title`} className="mt-1.5 text-xl font-semibold tracking-tight">
              {batch ? r.readyTitle : r.emptyTitle}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{batch ? r.readySub : r.emptySub}</p>
          </div>
          <span className="shrink-0 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{batch ? r.readyBadge : r.preview}</span>
        </div>

        <div aria-live="polite" className="flex flex-1 flex-col">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
              <p className="font-medium">{r.loadingTitle}</p>
              <p className="text-sm text-muted-foreground">{r.loadingText}</p>
            </div>
          ) : batch && spec ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary" aria-hidden="true">
                    {(batch.source.domain[0] ?? "R").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{batch.source.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      <span aria-hidden="true">{spec.symbol} </span>
                      {fill(r.sourceLine, { platform: spec.name })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ActionButton onClick={copyAll} icon={copied === "all" ? Check : Copy} label={copied === "all" ? r.copied : r.copyAll} />
                  <ActionButton onClick={exportCsv} icon={Download} label={r.exportCsv} />
                </div>
              </div>

              <ol className="grid gap-3 px-4 pb-5 sm:px-6">
                {batch.posts.map((post, index) => {
                  const count = countCharacters(batch.platform, post.text);
                  const over = count > spec.max;
                  const countId = `${ids}-count-${index}`;
                  return (
                    <li key={index} className="rounded-xl border bg-background p-4 focus-within:border-primary/40">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                          {fill(r.postHeading, { n: index + 1 })}
                        </span>
                        {post.angle ? <span className="truncate rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{post.angle}</span> : null}
                      </div>
                      <textarea
                        value={post.text}
                        onChange={(event) => edit(index, event.target.value)}
                        aria-label={fill(r.postLabel, { platform: spec.name, n: index + 1 })}
                        aria-describedby={countId}
                        rows={6}
                        className="field-sizing-content block max-h-96 min-h-28 w-full resize-y bg-transparent text-sm leading-relaxed whitespace-pre-wrap outline-none"
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
                        <span id={countId} className={cn("text-xs tabular-nums", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
                          {fill(r.chars, { count: number(count), max: number(spec.max) })}
                          {over ? ` · ${fill(r.over, { platform: spec.name })}` : ""}
                        </span>
                        <ActionButton onClick={() => copyOne(index)} icon={copied === index ? Check : Copy} label={copied === index ? r.copied : r.copy} />
                      </div>
                    </li>
                  );
                })}
              </ol>

              <Unlock copy={copy} signUpHref={signUpHref} signInHref={signInHref} />

              <p className="px-5 pb-5 text-center text-xs text-muted-foreground sm:px-6">{r.review}</p>
            </div>
          ) : failure ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div role="alert" className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
                <p className="font-medium">{r.errorTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{errorText(failure.reason, failure.retryAvailable)}</p>
              </div>
              {failure.reason === "limit" || (failure.reason === "provider_failed" && !failure.retryAvailable) ? (
                <Link prefetch={false} href={signUpHref} className="mt-5 inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
                  {copy.unlock.button} <span aria-hidden="true">&nbsp;→</span>
                </Link>
              ) : null}
            </div>
          ) : used ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <Lock className="size-8 text-primary" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold tracking-tight">{r.usedTitle}</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{r.usedText}</p>
              <Link prefetch={false} href={signUpHref} className="mt-5 inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
                {copy.unlock.button} <span aria-hidden="true">&nbsp;→</span>
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">
                {copy.unlock.signInLead}{" "}
                <Link prefetch={false} href={signInHref} className="font-medium text-primary underline-offset-4 hover:underline">
                  {copy.unlock.signIn}
                </Link>
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="relative mb-6 h-28 w-48" aria-hidden="true">
                <div className="absolute top-2 left-2 h-24 w-40 -rotate-12 rounded-xl border bg-muted/60" />
                <div className="absolute top-3 left-7 h-24 w-40 rotate-3 rounded-xl border bg-background p-3 shadow-sm">
                  <div className="mb-2 size-5 rounded-md bg-primary/15" />
                  <div className="mb-1.5 h-1.5 w-4/5 rounded-full bg-muted" />
                  <div className="mb-1.5 h-1.5 w-full rounded-full bg-muted" />
                  <div className="h-1.5 w-1/2 rounded-full bg-muted" />
                </div>
                <Sparkles className="absolute -top-1 right-0 size-5 text-primary" />
              </div>
              <p className="text-lg font-semibold tracking-tight">{r.emptyHeading}</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">{r.emptyText}</p>
              <p className="mt-5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                <span aria-hidden="true" className="lg:inline hidden">← </span>
                {r.emptyHint}
              </p>
            </div>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {notice}
        </p>
      </section>
    </div>
  );
}

function Step({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 text-sm font-semibold">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
        {n}
      </span>
      {title}
      {note ? <span className="ml-auto text-xs font-normal text-muted-foreground">{note}</span> : null}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-background px-2.5 text-xs">
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function Unlock({ copy, signUpHref, signInHref }: { copy: SocialPostGeneratorCopy; signUpHref: string; signInHref: string }) {
  const u = copy.unlock;
  return (
    <div className="mx-4 mb-5 rounded-2xl bg-foreground px-5 py-6 text-background sm:mx-6 sm:px-7">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase opacity-80">
        <Sparkles className="size-4" aria-hidden="true" />
        {u.pill}
      </p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{u.title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed opacity-80">{u.text}</p>
      <Link prefetch={false} href={signUpHref} className="mt-4 inline-flex h-10 items-center rounded-lg bg-background px-4 text-sm font-semibold text-foreground hover:opacity-90">
        {u.button} <span aria-hidden="true">&nbsp;→</span>
      </Link>
      <p className="mt-3 text-xs opacity-80">
        {u.signInLead}{" "}
        <Link prefetch={false} href={signInHref} className="underline underline-offset-4">
          {u.signIn}
        </Link>
      </p>
    </div>
  );
}
