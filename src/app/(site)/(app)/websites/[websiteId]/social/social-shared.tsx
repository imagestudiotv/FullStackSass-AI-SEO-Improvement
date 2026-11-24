"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { copyTextNow } from "@/lib/copy-text";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, intlTag } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { postSocialSuggestion, type SocialError, type SocialResult } from "@/lib/social/actions";
import { isSocialPlatform, type SocialPlatform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

import { platformName, type Stage, type SuggestionView } from "./opportunities";

/** The Opportunities page's small shared pieces: tiles, chips, times, copy and the action runner. */

export type T = Messages["app"]["social"];
export type Refusal = Extract<SocialResult<unknown>, { ok: false }>;

export function errorText(t: T, result: Refusal, price: string): string {
  const key: SocialError = result.error;
  if (key === "not_enough_credits") {
    return format(t.errors.not_enough_credits, { price, available: String(result.available ?? 0) });
  }
  return t.errors[key] ?? t.errors.generic;
}

/**
 * Runs a server action, says what went wrong in the reader's language and
 * refreshes the page. Not enough credits carries a Buy credits button.
 */
export function useSocialAction(t: T, priceLabel: string) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function refuse(result: Refusal | null) {
    if (!result) return void toast.error(t.errors.generic);
    toast.error(
      errorText(t, result, priceLabel),
      result.error === "not_enough_credits" ? { action: { label: t.buyCredits, onClick: () => router.push("/credits/buy") } } : undefined,
    );
  }

  function run(action: () => Promise<SocialResult<unknown>>, options: { success?: string; then?: () => void } = {}) {
    start(async () => {
      const result = await action().catch(() => null);
      if (!result?.ok) return refuse(result && !result.ok ? result : null);
      if (options.success) toast.success(options.success);
      options.then?.();
      router.refresh();
    });
  }

  return { pending, start, run, refuse, router };
}

/**
 * The one-click post, from a row or from the review drawer: copies the text,
 * opens the discussion or the platform's page for a new post, and records it
 * (its credit is charged once, lib/social/actions.ts postSocialSuggestion).
 */
export function useOneClickPost(websiteId: string, t: T, priceLabel: string) {
  const { pending, start, refuse, router } = useSocialAction(t, priceLabel);

  function post(row: Pick<SuggestionView, "id" | "platform">, text: string, edit: { body: string; title?: string | null }, onDone?: () => void) {
    const name = platformName(row.platform);
    // Both in the click itself: browsers allow neither once the click has passed. The copy goes
    // first, while this page still has the focus the new tab is about to take (lib/copy-text.ts).
    const copying = copyTextNow(text);
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    start(async () => {
      const copied = await copying;
      const result = await postSocialSuggestion(websiteId, row.id, edit).catch(() => null);
      if (!result?.ok) {
        win?.close();
        refuse(result && !result.ok ? result : null);
        return;
      }
      if (win) win.location.href = result.data.url;
      // Quora and replies on Reddit and Bluesky only have the clipboard: never say "copied" when it is not.
      if (!copied && (!win || !result.data.filled)) toast.error(format(t.copyFailed, { platform: name }));
      else if (!win) toast.message(format(t.popupBlocked, { platform: name }));
      else if (copied) toast.success(format(t.copied, { platform: name }));
      onDone?.();
      router.refresh();
    });
  }

  return { pending, post };
}

/* Brand tints for the platform marks, each with its night-mode pair. */
const TILE: Record<SocialPlatform, string> = {
  reddit: "bg-orange-50 text-[#ff4500] dark:bg-orange-500/15 dark:text-orange-400",
  quora: "bg-red-50 text-[#b92b27] dark:bg-red-500/15 dark:text-red-400",
  x: "bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-neutral-100",
  threads: "bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-neutral-100",
  pinterest: "bg-rose-50 text-[#e60023] dark:bg-rose-500/15 dark:text-rose-400",
  bluesky: "bg-sky-50 text-[#1185fe] dark:bg-sky-500/15 dark:text-sky-400",
};
const TILE_SIZE = { sm: "size-6 rounded-md", md: "size-8 rounded-lg", lg: "size-9 rounded-lg", xl: "size-10 rounded-xl sm:size-11" } as const;
const ICON_SIZE = { sm: "size-3.5", md: "size-4", lg: "size-[1.15rem]", xl: "size-5 sm:size-6" } as const;

/** A platform's mark on its tint. Decorative: the platform's name is always written beside it. */
export function PlatformTile({
  platform,
  size = "md",
  muted = false,
  className,
}: {
  platform: string;
  size?: keyof typeof TILE_SIZE;
  muted?: boolean;
  className?: string;
}) {
  const known = isSocialPlatform(platform) ? platform : null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center",
        TILE_SIZE[size],
        known ? TILE[known] : "bg-muted text-muted-foreground",
        muted && "opacity-50 grayscale",
        className,
      )}
    >
      {known ? <BrandIcon name={known} className={ICON_SIZE[size]} /> : null}
    </span>
  );
}

const CHIP: Record<Stage, string> = {
  suggested: "bg-primary/10 text-primary-strong",
  draft: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  scheduled: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  publishing: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  failed: "bg-destructive/10 text-destructive",
  published: "bg-muted text-muted-foreground",
};

export function StageChip({ stage, t }: { stage: Stage; t: T }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide", CHIP[stage])}>
      {t.stage[stage]}
    </span>
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relative(value: string, locale: Locale): string {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(intlTag(locale), { numeric: "auto" });
  if (abs < MINUTE) return rtf.format(0, "second");
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 7 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  return formatDate(value, locale, { day: "numeric", month: "short" });
}

/** A scheduled post's time: "Mon 14:23". */
export const atTime = (value: string, locale: Locale) => formatDate(value, locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });

/**
 * "12 minutes ago", with the full date on hover. The server renders it in
 * its own clock and time zone, the browser in the reader's: the two may
 * differ by a minute or an hour, which is not a hydration error worth having.
 */
export function Ago({ value, locale }: { value: string; locale: Locale }) {
  return (
    <time
      dateTime={value}
      title={formatDate(value, locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      suppressHydrationWarning
    >
      {relative(value, locale)}
    </time>
  );
}

/** Copies a suggestion's text without posting it, or a posted one's again (client, 2026-10-29: "a copy button"). */
export function CopyTextButton({
  text,
  label,
  variant = "outline",
  t,
}: {
  text: string;
  label?: string;
  variant?: "outline" | "ghost";
  t: T;
}) {
  const [done, setDone] = useState(false);
  async function copy() {
    if (!(await copyTextNow(text))) return void toast.error(t.errors.generic);
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  }
  return (
    <Button type="button" size="sm" variant={variant} onClick={copy}>
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {done ? t.copyDone : (label ?? t.copy)}
    </Button>
  );
}
