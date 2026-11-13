"use client";

import { Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { PromoBannerView } from "@/components/promo-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Switch } from "@/components/ui/switch";
import { saveSiteBanner } from "@/lib/admin/site-banner";
import { DEFAULT_LOCALE, LOCALE_NAMES, LOCALES, PREFIXED_LOCALES, type Locale } from "@/lib/i18n/config";
import {
  BANNER_LIMITS,
  BANNER_MAX_DAYS,
  BANNER_TONE_NAMES,
  BANNER_TONES,
  BANNER_WORDS,
  resolveBannerCopy,
  type BannerCopy,
  type BannerCopyByLocale,
  type BannerTone,
} from "@/lib/promo-banner/banner";

import { useUnsavedChanges } from "../_ui/use-unsaved-changes";

type Words = Record<Locale, BannerCopy>;

const FIELDS = [
  { key: "label", name: "Label", hint: "Bold, first. Optional, e.g. BLACK FRIDAY" },
  { key: "message", name: "Message", hint: "The offer, e.g. Lifetime Premium 67% off · TikTok & Blog 80% off" },
  { key: "linkText", name: "Link text", hint: "Optional. Empty shows the default" },
] as const;

function wordsFrom(copy: BannerCopyByLocale): Words {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, { label: copy[locale]?.label ?? "", message: copy[locale]?.message ?? "", linkText: copy[locale]?.linkText ?? "" }]),
  ) as Words;
}

/** "2026-11-28T23:59" in this browser's time zone, as a datetime-local input wants it. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const subscribeNothing = () => () => {};

/**
 * The banner's switch, colour, countdown and words, with a preview. The
 * countdown is entered in the administrator's own time zone and saved as an
 * exact moment, so every visitor sees the same end. The server checks
 * everything again (lib/promo-banner/banner.ts cleanBanner).
 */
export function BannerForm({
  enabled: savedEnabled,
  tone: savedTone,
  endsAt: savedEndsAt,
  copy: savedCopy,
}: {
  enabled: boolean;
  tone: BannerTone;
  /** ISO 8601, or null for no countdown. */
  endsAt: string | null;
  copy: BannerCopyByLocale;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  // The time zone exists only in the browser: the server renders the countdown field empty.
  const inBrowser = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const savedWords = wordsFrom(savedCopy);
  const [enabled, setEnabled] = useState(savedEnabled);
  const [tone, setTone] = useState<BannerTone>(savedTone);
  /** undefined until edited: the saved end, shown in this browser's time zone. */
  const [endsInput, setEndsInput] = useState<string | undefined>(undefined);
  const [words, setWords] = useState<Words>(savedWords);
  const [previewLocale, setPreviewLocale] = useState<Locale>(DEFAULT_LOCALE);

  const savedEndsInput = savedEndsAt && inBrowser ? toLocalInput(savedEndsAt) : "";
  const ends = endsInput ?? savedEndsInput;
  // A half-typed date goes as it is, for the server to refuse with a message.
  const endsDate = ends ? new Date(ends) : null;
  const endsIso = endsDate ? (Number.isNaN(endsDate.getTime()) ? ends : endsDate.toISOString()) : null;

  const changed =
    enabled !== savedEnabled ||
    tone !== savedTone ||
    (endsInput !== undefined && endsInput !== savedEndsInput) ||
    JSON.stringify(words) !== JSON.stringify(savedWords);
  useUnsavedChanges(changed);

  const setWord = (locale: Locale, key: keyof BannerCopy, value: string) =>
    setWords((current) => ({ ...current, [locale]: { ...current[locale], [key]: value } }));

  function save() {
    start(async () => {
      const result = await saveSiteBanner({ enabled, tone, endsAt: endsIso, copy: words }).catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEndsInput(undefined);
      toast.success(result.data.enabled ? "Banner saved: it is on the site now" : "Banner saved: it is not shown");
      router.refresh();
    });
  }

  const timeZone = inBrowser ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  const preview = resolveBannerCopy(
    Object.fromEntries(LOCALES.filter((locale) => words[locale].message.trim()).map((locale) => [locale, words[locale]])),
  )[previewLocale];

  const wordFields = (locale: Locale) => (
    <div className="grid gap-4">
      {FIELDS.map((field) => {
        const fieldId = `${id}-${locale}-${field.key}`;
        const hint =
          field.key === "linkText" ? `${field.hint} (${BANNER_WORDS[locale].link}).` : locale === DEFAULT_LOCALE ? field.hint : "";
        return (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={fieldId} className="text-sm font-medium">
              {field.name}
              {field.key === "message" && locale === DEFAULT_LOCALE ? " (required to show the banner)" : ""}
            </label>
            <Input
              id={fieldId}
              value={words[locale][field.key]}
              maxLength={BANNER_LIMITS[field.key]}
              onChange={(event) => setWord(locale, field.key, event.target.value)}
              aria-describedby={hint ? `${fieldId}-help` : undefined}
            />
            {hint ? (
              <p id={`${fieldId}-help`} className="text-xs text-muted-foreground">
                {hint}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="font-medium">
            Banner
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {enabled ? "On: shown on every public page once saved." : "Off: no banner is shown."}
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-describedby={`${id}-heading`} />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      <div className="space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Preview</span>
          <NativeLikeSelect
            aria-label="Preview language"
            value={previewLocale}
            onChange={(event) => setPreviewLocale(event.target.value as Locale)}
            className="w-40 data-[size=default]:h-8"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {LOCALE_NAMES[locale]}
              </option>
            ))}
          </NativeLikeSelect>
        </div>
        <div className="overflow-hidden rounded-lg border">
          {preview.message.trim() ? (
            <PromoBannerView
              tone={tone}
              endsAt={endsIso}
              words={preview}
              units={BANNER_WORDS[preview.lang].units}
              href={null}
              hideWhenOver={false}
            />
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">Write the English message to see the banner.</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-tone`} className="text-sm font-medium">
            Colour
          </label>
          <NativeLikeSelect
            id={`${id}-tone`}
            value={tone}
            onChange={(event) => setTone(event.target.value as BannerTone)}
            className="data-[size=default]:h-9"
          >
            {BANNER_TONES.map((value) => (
              <option key={value} value={value}>
                {BANNER_TONE_NAMES[value]}
              </option>
            ))}
          </NativeLikeSelect>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-ends`} className="text-sm font-medium">
            Countdown ends
          </label>
          <div className="flex gap-2">
            <Input
              id={`${id}-ends`}
              type="datetime-local"
              value={ends}
              disabled={!inBrowser}
              onChange={(event) => setEndsInput(event.target.value)}
              aria-describedby={`${id}-ends-help`}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setEndsInput("")} disabled={!ends} aria-label="No countdown">
              <X aria-hidden="true" />
            </Button>
          </div>
          <p id={`${id}-ends-help`} className="text-xs text-muted-foreground">
            {timeZone ? `Your time (${timeZone}). ` : ""}The banner hides itself at this moment. Empty: no countdown, shown until you
            turn it off. At most {BANNER_MAX_DAYS} days ahead.
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t px-4 py-4 sm:px-5">
        <h3 className="text-sm font-medium">English</h3>
        {wordFields(DEFAULT_LOCALE)}
      </div>

      <div className="border-t px-4 py-4 sm:px-5">
        <h3 className="text-sm font-medium">Other languages</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A language without its own message shows the English words on its pages (/es, /fr, /it, /de).
        </p>
        <div className="mt-3 divide-y rounded-lg border">
          {PREFIXED_LOCALES.map((locale) => (
            <details key={locale} className="group px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                {LOCALE_NAMES[locale]}
                <span className="ml-2 font-normal text-muted-foreground">
                  {words[locale].message.trim() ? "its own words" : "shows English"}
                </span>
              </summary>
              <div className="pt-4">{wordFields(locale)}</div>
            </details>
          ))}
        </div>
      </div>

      <div className="flex justify-end border-t px-4 py-3 sm:px-5">
        <Button onClick={save} disabled={pending || !changed}>
          <Save aria-hidden="true" />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
