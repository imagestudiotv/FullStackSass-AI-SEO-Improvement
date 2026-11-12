"use client";

import { Lock, RotateCcw, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icons";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { addVideoMedia, removeVideoMedia, resetVideoSettingsAction, saveVideoProfileAction, saveVideoSettingsAction } from "@/lib/video/actions";
import {
  AUDIO_MODES,
  CAPTION_STYLES,
  CONTENT_GOALS,
  DURATION_RANGES,
  HUMOR_LEVELS,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  POSTING_FREQUENCIES,
  PUBLISH_MODES,
  TONE_PRESETS,
  VIDEO_FORMATS,
  VIDEO_PLATFORM_SPECS,
  VIDEO_PLATFORMS,
  VIDEO_STYLES,
  VIRAL_TECHNIQUES,
  VOICES,
  type BrandLook,
  type PostingFrequency,
  type VideoPlatform,
} from "@/lib/video/formats";
import { connectVideoPlatform, disconnectVideoPlatform, resumeVideoPlatform, type VideoPublishingStatus } from "@/lib/video/publish-actions";
import type { VideoSettings } from "@/lib/video/settings";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";
import { MARKET_GLOBAL, MARKETS } from "@/lib/websites/markets";

import { profileChanged, profileChanges, settingsChanges, settingsProblems, viralSplit, type ProfileForm } from "./logic";
import { errorText, Field, MediaThumb, opportunitiesHref, selectClass, upload, type MediaView, type Run, type T, type VideoAccountView, xWords } from "./shared";

export const SETTINGS_PANES = ["strategy", "audience", "video", "publishing", "safety", "brand"] as const;
export type SettingsPane = (typeof SETTINGS_PANES)[number];

const cap = (value: string) => value[0].toUpperCase() + value.slice(1);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The Settings tab (client's mockup, 2026-11-12): "Preferences" with a pane
 * each for the content strategy, audience and topics, video and audio,
 * publishing, brand safety - and the brand's logo and media, kept from
 * before. One Save settings for the form (saved per website on the server;
 * the audience fields are the business profile and Brand Voice, saved
 * there), Reset to the suggested defaults. Accounts, the logo and uploads
 * act at once, as before.
 */
export function SettingsPanel(props: {
  websiteId: string;
  canEdit: boolean;
  bundle: boolean;
  settings: VideoSettings;
  profile: ProfileForm;
  publishing: VideoPublishingStatus;
  brand: BrandLook;
  media: MediaView[];
  accounts: VideoAccountView[];
  pane: SettingsPane;
  onPane: (pane: SettingsPane) => void;
  run: Run;
  pending: boolean;
  locale: Locale;
  t: T;
}) {
  const { t, websiteId } = props;
  const s = t.viral.settings;
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [form, setForm] = useState<VideoSettings>(props.settings);
  const [profile, setProfile] = useState<ProfileForm>(props.profile);
  const [seen, setSeen] = useState({ settings: props.settings, profile: props.profile });
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // New values from the server (a save, a reset, a logo upload) come into the form; changes not saved yet stay on top.
  // A refresh with the same values (the page's polling) changes nothing.
  if (!same(seen.settings, props.settings) || !same(seen.profile, props.profile)) {
    setSeen({ settings: props.settings, profile: props.profile });
    if (!same(seen.settings, props.settings)) setForm({ ...props.settings, ...settingsChanges(seen.settings, form) });
    if (!same(seen.profile, props.profile)) setProfile(profileChanged(seen.profile, profile) ? profile : props.profile);
  }

  const disabled = !props.canEdit || saving;
  const set = <K extends keyof VideoSettings>(key: K, value: VideoSettings[K]) => setForm((value0) => ({ ...value0, [key]: value }));
  const toggle = <V extends string>(list: V[], value: V, on: boolean): V[] => (on ? [...new Set([...list, value])] : list.filter((entry) => entry !== value));
  const changes = settingsChanges(props.settings, form);
  const profileDirty = profileChanged(props.profile, profile);
  const dirty = Object.keys(changes).length > 0 || profileDirty;
  const problems = settingsProblems(form, profile);

  // A refusal that names its field says which one, and opens the pane it is on.
  function refused(result: { ok: false; error: string; field?: string }) {
    const place = result.field ? fieldPlace(t, result.field) : result.error === "bad_language" ? fieldPlace(t, "language") : null;
    if (!place) return setError(errorText(t, result, ""));
    props.onPane(place.pane);
    setError(`${format(s.fieldProblem, { field: place.label, pane: s.panes[place.pane] })} ${errorText(t, result, "")}`);
  }

  function save() {
    setError(null);
    if (problems.length > 0) return setError(problems.map((problem) => s.problems[problem]).join(" "));
    startSaving(async () => {
      try {
        if (Object.keys(changes).length > 0) {
          const saved = await saveVideoSettingsAction(websiteId, changes);
          if (!saved.ok) return refused(saved);
        }
        if (profileDirty) {
          const saved = await saveVideoProfileAction(websiteId, profileChanges(props.profile, profile));
          if (!saved.ok) return refused(saved);
        }
        toast.success(t.saved);
        router.refresh();
      } catch {
        setError(t.errors.generic);
      }
    });
  }

  function reset() {
    setConfirmReset(false);
    setError(null);
    startSaving(async () => {
      const result = await resetVideoSettingsAction(websiteId).catch(() => null);
      if (!result) return setError(t.errors.generic);
      if (!result.ok) return setError(errorText(t, result, ""));
      // The defaults replace the form, unsaved changes included.
      setForm(result.data ?? props.settings);
      toast.success(s.resetDone);
      router.refresh();
    });
  }

  const panes: Record<SettingsPane, string> = s.panes;
  const paneId = (pane: SettingsPane) => `video-settings-${pane}`;
  const formPane = props.pane !== "brand";

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
      <nav aria-label={s.sidebar} className="min-w-0">
        <h2 className="mb-2 hidden px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">{s.sidebar}</h2>
        <div
          role="tablist"
          aria-orientation="vertical"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
          onKeyDown={(event) => {
            // Arrow keys move between the panes, as in any tab list.
            const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            const next = SETTINGS_PANES[(SETTINGS_PANES.indexOf(props.pane) + step + SETTINGS_PANES.length) % SETTINGS_PANES.length];
            props.onPane(next);
            tabRefs.current[next]?.focus();
          }}
        >
          {SETTINGS_PANES.map((pane) => (
            <button
              key={pane}
              ref={(el) => {
                tabRefs.current[pane] = el;
              }}
              role="tab"
              type="button"
              id={`${paneId(pane)}-tab`}
              aria-selected={props.pane === pane}
              aria-controls={paneId(pane)}
              tabIndex={props.pane === pane ? 0 : -1}
              onClick={() => props.onPane(pane)}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                props.pane === pane ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {panes[pane]}
            </button>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-4">
        <section role="tabpanel" id={paneId(props.pane)} aria-labelledby={`${paneId(props.pane)}-tab`} className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
          {props.pane === "strategy" ? <StrategyPane form={form} set={set} toggle={toggle} disabled={disabled} t={t} /> : null}
          {props.pane === "audience" ? <AudiencePane profile={profile} setProfile={setProfile} disabled={disabled} t={t} /> : null}
          {props.pane === "video" ? <VideoPane form={form} set={set} toggle={toggle} disabled={disabled} t={t} /> : null}
          {props.pane === "publishing" ? (
            <PublishingPane {...props} form={form} set={set} toggle={toggle} disabled={disabled} />
          ) : null}
          {props.pane === "safety" ? <SafetyPane form={form} set={set} disabled={disabled} t={t} /> : null}
          {props.pane === "brand" ? <BrandPane {...props} /> : null}
        </section>

        {props.canEdit ? (
          <div className="sticky bottom-2 z-10 flex flex-col gap-3 rounded-2xl border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-xs text-muted-foreground" aria-live="polite">
              {error ? <p className="text-sm text-destructive">{error}</p> : dirty ? <p>{s.unsaved}</p> : <p>{formPane ? s.savedNote : s.brandNote}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" disabled={disabled} onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden="true" />
                {s.reset}
              </Button>
              <Button disabled={disabled || !dirty} onClick={save}>
                <Save aria-hidden="true" />
                {s.save}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {confirmReset ? (
        <Dialog open onOpenChange={(open) => !open && setConfirmReset(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{s.resetTitle}</DialogTitle>
              <DialogDescription>{s.resetBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmReset(false)}>
                {t.cancel}
              </Button>
              <Button variant="destructive" onClick={reset}>
                {s.reset}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

type Setter = <K extends keyof VideoSettings>(key: K, value: VideoSettings[K]) => void;
type Toggle = <V extends string>(list: V[], value: V, on: boolean) => V[];

function PaneHeader({ title, body, badge }: { title: string; body: string; badge?: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2 border-b pb-4">
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {badge ? <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{badge}</span> : null}
    </header>
  );
}

function Block({ title, body, children }: { title?: string; body?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {title ? (
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {body ? <p className="text-xs text-muted-foreground">{body}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** A switch with its title and help, the mockup's "between" row; locked ones are shown on and explained. */
function SwitchRow(props: { title: string; help: string; checked: boolean; onChange?: (on: boolean) => void; disabled?: boolean; locked?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {props.title}
        </label>
        <p className="text-xs text-muted-foreground">{props.help}</p>
        {props.locked ? (
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Lock className="size-3" aria-hidden="true" />
            {props.locked}
          </p>
        ) : null}
      </div>
      <Switch id={id} checked={props.checked} disabled={props.disabled || Boolean(props.locked)} onCheckedChange={props.onChange} />
    </div>
  );
}

function ChoiceGrid<V extends string>(props: { name: string; value: V; options: readonly V[]; label: (value: V) => { title: string; body: string }; onChange: (value: V) => void; disabled: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {props.options.map((option) => {
        const words = props.label(option);
        return (
          <label
            key={option}
            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 ${props.value === option ? "border-primary bg-primary/5" : "hover:border-foreground/30"}`}
          >
            <input type="radio" name={props.name} className="mt-1" disabled={props.disabled} checked={props.value === option} onChange={() => props.onChange(option)} />
            <span>
              <span className="font-medium">{words.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{words.body}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Checks<V extends string>(props: { options: readonly V[]; checked: V[]; label: (value: V) => string; onChange: (value: V, on: boolean) => void; disabled: boolean | ((value: V) => boolean); legend: string }) {
  return (
    <fieldset>
      <legend className="sr-only">{props.legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {props.options.map((option) => {
          const off = typeof props.disabled === "function" ? props.disabled(option) : props.disabled;
          return (
            <label key={option} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${off ? "opacity-60" : ""}`}>
              <input type="checkbox" disabled={off} checked={props.checked.includes(option)} onChange={(event) => props.onChange(option, event.target.checked)} />
              {props.label(option)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- panes

function StrategyPane({ form, set, toggle, disabled, t }: { form: VideoSettings; set: Setter; toggle: Toggle; disabled: boolean; t: T }) {
  const v = t.viral;
  const s = v.settings.strategy;
  const split = viralSplit(form.viralMix);
  const sliderId = useId();
  return (
    <>
      <PaneHeader title={s.title} body={s.body} badge={s.badge} />
      <Block>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5">
            <label htmlFor={sliderId} className="text-sm font-semibold">
              {s.mix}
            </label>
            <p className="text-xs text-muted-foreground">{s.mixHelp}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">{format(s.mixBadge, { value: String(form.viralMix) })}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={10}
            value={form.viralMix}
            disabled={disabled}
            aria-valuetext={format(s.mixBadge, { value: String(form.viralMix) })}
            onChange={(event) => set("viralMix", Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-primary"
          />
          <output htmlFor={sliderId} className="w-12 text-right text-sm font-semibold tabular-nums">
            {form.viralMix}%
          </output>
        </div>
        <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{s.mixLow}</span>
          <span className="text-center">{s.mixMid}</span>
          <span className="text-right">{s.mixHigh}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="bg-primary transition-all" style={{ width: `${form.viralMix}%` }} />
          <span className="bg-foreground/20 transition-all" style={{ width: `${100 - form.viralMix}%` }} />
        </div>
        <div className="flex justify-between gap-2 text-xs font-medium tabular-nums" aria-live="polite">
          <span>{format(s.viralCount, { count: String(split.viral), total: "20" })}</span>
          <span className="text-muted-foreground">{format(s.otherCount, { count: String(split.other) })}</span>
        </div>
      </Block>

      <Block title={s.goal} body={s.goalBody}>
        <ChoiceGrid name="video-goal" value={form.goal} options={CONTENT_GOALS} label={(goal) => s.goals[goal]} onChange={(goal) => set("goal", goal)} disabled={disabled} />
      </Block>

      <Block title={s.techniques} body={s.techniquesBody}>
        <Checks
          legend={s.techniques}
          options={VIRAL_TECHNIQUES}
          checked={form.techniques}
          label={(technique) => v.techniques[technique]}
          onChange={(technique, on) => set("techniques", toggle(form.techniques, technique, on))}
          disabled={disabled}
        />
      </Block>

      <SwitchRow title={s.trends} help={s.trendsHelp} checked={form.trendInspired} disabled={disabled} onChange={(on) => set("trendInspired", on)} />
      <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">{s.disclaimer}</p>
    </>
  );
}

function AudiencePane({ profile, setProfile, disabled, t }: { profile: ProfileForm; setProfile: React.Dispatch<React.SetStateAction<ProfileForm>>; disabled: boolean; t: T }) {
  const a = t.viral.settings.audience;
  const set = (key: keyof ProfileForm, value: string) => setProfile((value0) => ({ ...value0, [key]: value }));
  // A stored language or market outside the lists is kept as it is, never replaced by the first option.
  const languages = SUPPORTED_LANGUAGES.some((lang) => lang.value === profile.language) || !profile.language ? SUPPORTED_LANGUAGES : [...SUPPORTED_LANGUAGES, { value: profile.language, label: profile.language }];
  const market = profile.country || MARKET_GLOBAL;
  const markets = MARKETS.some((entry) => entry.value === market) ? MARKETS : [...MARKETS, { value: market, label: market, flag: "" }];
  return (
    <>
      <PaneHeader title={a.title} body={a.body} />
      <Notice>{a.shared}</Notice>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={a.targetAudience}>
          <Textarea rows={3} maxLength={500} disabled={disabled} value={profile.targetAudience} onChange={(event) => set("targetAudience", event.target.value)} />
        </Field>
        <Field label={a.topics}>
          <Textarea rows={3} maxLength={500} disabled={disabled} value={profile.priorityTopics} onChange={(event) => set("priorityTopics", event.target.value)} />
        </Field>
        <Field label={a.language} hint={a.languageHint}>
          <NativeLikeSelect className={selectClass} disabled={disabled} value={profile.language} onChange={(event) => set("language", event.target.value)}>
            {profile.language ? null : <option value="">{a.languageAuto}</option>}
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
        <Field label={a.market}>
          <NativeLikeSelect className={selectClass} disabled={disabled} value={market} onChange={(event) => set("country", event.target.value === MARKET_GLOBAL ? "" : event.target.value)}>
            {markets.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.value === MARKET_GLOBAL ? a.global : `${entry.flag} ${entry.label}`.trim()}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
      </div>
      <Block title={a.voice} body={a.voiceBody}>
        <ChoiceGrid
          name="video-tone"
          value={profile.tonePreset}
          options={TONE_PRESETS}
          label={(tone) => t.viral.tonePresets[tone]}
          onChange={(tone) => setProfile((value0) => ({ ...value0, tonePreset: tone }))}
          disabled={disabled}
        />
        <Field label={a.toneNotes} hint={a.toneNotesHint}>
          <Textarea rows={2} maxLength={500} disabled={disabled} value={profile.tone} onChange={(event) => set("tone", event.target.value)} />
        </Field>
      </Block>
      <Field label={a.avoid}>
        <Textarea rows={3} maxLength={500} disabled={disabled} placeholder={a.avoidPlaceholder} value={profile.avoid} onChange={(event) => set("avoid", event.target.value)} />
      </Field>
    </>
  );
}

function VideoPane({ form, set, toggle, disabled, t }: { form: VideoSettings; set: Setter; toggle: Toggle; disabled: boolean; t: T }) {
  const v = t.viral;
  const s = v.settings.video;
  return (
    <>
      <PaneHeader title={s.title} body={s.body} />
      <Block title={s.formats} body={s.formatsBody}>
        <Checks
          legend={s.formats}
          options={VIDEO_FORMATS}
          checked={form.formats}
          label={(value) => s.formatNames[value]}
          onChange={(value, on) => set("formats", toggle(form.formats, value, on))}
          disabled={disabled}
        />
      </Block>
      <Block title={s.audio} body={s.audioBody}>
        <ChoiceGrid name="video-audio" value={form.audioMode} options={AUDIO_MODES} label={(mode) => s.audioModes[mode]} onChange={(mode) => set("audioMode", mode)} disabled={disabled} />
      </Block>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={s.duration}>
          <NativeLikeSelect className={selectClass} disabled={disabled} value={form.duration} onChange={(event) => set("duration", event.target.value as VideoSettings["duration"])}>
            {DURATION_RANGES.map((value) => (
              <option key={value} value={value}>
                {v.durations[value]}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
        {form.audioMode !== "text_music" ? (
          <>
            <Field label={s.narration}>
              <NativeLikeSelect className={selectClass} disabled={disabled} value={form.narration} onChange={(event) => set("narration", event.target.value as VideoSettings["narration"])}>
                {NARRATION_STYLES.map((value) => (
                  <option key={value} value={value}>
                    {v.narration[value]}
                  </option>
                ))}
              </NativeLikeSelect>
            </Field>
            <Field label={t.defaultVoice}>
              <NativeLikeSelect className={selectClass} disabled={disabled} value={form.voice ?? ""} onChange={(event) => set("voice", (event.target.value || null) as VideoSettings["voice"])}>
                <option value="">{t.voiceOff}</option>
                {VOICES.map((value) => (
                  <option key={value} value={value}>
                    {cap(value)}
                  </option>
                ))}
              </NativeLikeSelect>
            </Field>
          </>
        ) : null}
        <Field label={s.captions}>
          <NativeLikeSelect className={selectClass} disabled={disabled || !form.captions} value={form.captionStyle} onChange={(event) => set("captionStyle", event.target.value as VideoSettings["captionStyle"])}>
            {CAPTION_STYLES.map((value) => (
              <option key={value} value={value}>
                {v.captionStyles[value]}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
        <Field label={s.music}>
          <NativeLikeSelect className={selectClass} disabled={disabled} value={form.musicDirection} onChange={(event) => set("musicDirection", event.target.value as VideoSettings["musicDirection"])}>
            {MUSIC_DIRECTIONS.map((value) => (
              <option key={value} value={value}>
                {v.music[value]}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{s.musicNote}</p>
      <SwitchRow title={t.captionsOn} help={s.captionsHelp} checked={form.captions} disabled={disabled} onChange={(on) => set("captions", on)} />
      <SwitchRow title={s.hook} help={s.hookHelp} checked={form.showHook} disabled={disabled} onChange={(on) => set("showHook", on)} />
      <SwitchRow title={s.cta} help={s.ctaHelp} checked={form.includeCta} disabled={disabled} onChange={(on) => set("includeCta", on)} />
      {form.includeCta ? (
        <Field label={s.defaultCta} hint={s.defaultCtaHint}>
          <Input maxLength={150} disabled={disabled} value={form.defaultCta ?? ""} placeholder={s.defaultCtaPlaceholder} onChange={(event) => set("defaultCta", event.target.value)} />
        </Field>
      ) : null}
      <Block title={s.animated} body={s.animatedBody}>
        <div className="grid gap-2 sm:grid-cols-3">
          {VIDEO_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              disabled={disabled}
              aria-pressed={form.style === style}
              onClick={() => set("style", style)}
              className={`rounded-xl border p-3 text-left text-sm transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${form.style === style ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30"}`}
            >
              <span className="font-medium">{t.styles[style]}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t.styleHelp[style]}</span>
            </button>
          ))}
        </div>
      </Block>
    </>
  );
}

function PublishingPane(props: {
  websiteId: string;
  canEdit: boolean;
  bundle: boolean;
  settings: VideoSettings;
  publishing: VideoPublishingStatus;
  accounts: VideoAccountView[];
  run: Run;
  pending: boolean;
  locale: Locale;
  form: VideoSettings;
  set: Setter;
  toggle: Toggle;
  disabled: boolean;
  t: T;
}) {
  const { t, websiteId, form, set } = props;
  const v = t.viral;
  const s = v.settings.publishing;
  const busy = !props.canEdit || props.pending;
  // X is set up when it takes videos now, or only its spending limit is used up for the moment.
  const xReady = props.publishing.x.available || props.publishing.x.reason === "limit_reached";
  const xMessage = props.publishing.x.available ? null : xWords(t, props.publishing);
  const linkedinNoTarget = props.publishing.linkedin.connected && !props.publishing.linkedin.target;
  // Frequency: a customer on automatic posting from before 2026-11-12 keeps "as videos are made" until they choose.
  const legacy = props.settings.frequency === null;

  return (
    <>
      <PaneHeader title={s.title} body={s.body} />
      <Block title={t.accounts} body={t.accountsBody}>
        {!props.bundle ? <Notice tone="warning">{t.notConfigured}</Notice> : null}
        <ul className="divide-y">
          {VIDEO_PLATFORMS.map((platform) => {
            const account = props.accounts.find((row) => row.platform === platform);
            const paused = account?.pausedReason !== null && account?.pausedReason !== undefined;
            const board = VIDEO_PLATFORM_SPECS[platform].board;
            const x = platform === "x";
            return (
              <li key={platform} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                    <BrandIcon name={platform} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{VIDEO_PLATFORM_SPECS[platform].name}</p>
                    {account?.connected ? (
                      <p className="text-xs break-all text-muted-foreground">
                        {t.connected} · {account.username}
                      </p>
                    ) : null}
                    {paused ? <p className="text-xs text-amber-700 dark:text-amber-400">{format(t.paused, { reason: account?.pausedReason ?? "" })}</p> : null}
                    {x && xMessage ? <p className="text-xs text-amber-700 dark:text-amber-400">{xMessage}</p> : null}
                    {board && account?.connected ? (
                      account.board ? (
                        <p className="text-xs text-muted-foreground">
                          {format(t.pinterest.board, { board: account.board })} ·{" "}
                          <Link href={opportunitiesHref(websiteId)} className="text-primary hover:underline">
                            {t.pinterest.chooseBoard}
                          </Link>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {t.pinterest.noBoard}{" "}
                          <Link href={opportunitiesHref(websiteId)} className="font-medium underline underline-offset-2">
                            {t.pinterest.chooseBoard}
                          </Link>
                        </p>
                      )
                    ) : null}
                    {board ? <p className="mt-0.5 text-xs text-muted-foreground">{t.pinterest.shared}</p> : null}
                    {platform === "linkedin" ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {account?.connected && props.publishing.linkedin.target ? linkedinTargetWords(t, props.publishing.linkedin.target) : v.linkedin.help}
                      </p>
                    ) : null}
                    {platform === "linkedin" && linkedinNoTarget ? <p className="text-xs text-amber-700 dark:text-amber-400">{v.linkedin.noTarget}</p> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  {paused ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => props.run(() => resumeVideoPlatform(websiteId, platform), t.saved)}>
                      {t.resume}
                    </Button>
                  ) : null}
                  {account?.connected ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.run(() => disconnectVideoPlatform(websiteId, platform))}>
                      {t.disconnect}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy || !props.bundle || (x && !xReady)}
                      title={x && !xReady ? v.x.needsSetup : undefined}
                      onClick={() =>
                        props.run(async () => {
                          const result = await connectVideoPlatform(websiteId, platform, props.locale);
                          if (result.ok) window.location.assign(result.data.url);
                          return result;
                        })
                      }
                    >
                      {t.connect}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Block>

      <Block title={t.platforms} body={s.platformsBody}>
        <Checks<VideoPlatform>
          legend={t.platforms}
          options={VIDEO_PLATFORMS}
          checked={form.platforms}
          label={(platform) => VIDEO_PLATFORM_SPECS[platform].name}
          onChange={(platform, on) => set("platforms", props.toggle(form.platforms, platform, on))}
          // X can be unticked, never ticked before it is set up.
          disabled={(platform) => props.disabled || (platform === "x" && !xReady && !form.platforms.includes("x"))}
        />
        <p className="text-xs text-muted-foreground">{t.carouselNote}</p>
      </Block>

      <Block title={t.publishMode}>
        <fieldset className="space-y-2">
          <legend className="sr-only">{t.publishMode}</legend>
          {PUBLISH_MODES.map((mode) => (
            <label key={mode} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${form.publishMode === mode ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name="publish-mode" className="mt-1" disabled={props.disabled} checked={form.publishMode === mode} onChange={() => set("publishMode", mode)} />
              <span>
                <span className="font-medium">{s.modes[mode].title}</span>
                <span className="block text-xs text-muted-foreground">{s.modes[mode].body}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {form.publishMode === "auto" ? <Notice>{s.autoNote}</Notice> : null}
      </Block>

      <Field label={s.frequency} hint={s.frequencyHint}>
        <NativeLikeSelect
          className={`${selectClass} sm:max-w-xs`}
          disabled={props.disabled}
          value={form.frequency ?? ""}
          onChange={(event) => set("frequency", (event.target.value || null) as PostingFrequency | null)}
        >
          {legacy ? <option value="">{v.frequencies.legacy}</option> : null}
          {POSTING_FREQUENCIES.map((value) => (
            <option key={value} value={value}>
              {v.frequencies[value]}
            </option>
          ))}
        </NativeLikeSelect>
      </Field>

      <details className="group rounded-2xl border bg-muted/30 p-4">
        <summary className="cursor-pointer font-semibold">{t.safety}</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {t.safetyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

function SafetyPane({ form, set, disabled, t }: { form: VideoSettings; set: Setter; disabled: boolean; t: T }) {
  const s = t.viral.settings.safety;
  return (
    <>
      <PaneHeader title={s.title} body={s.body} />
      <div className="space-y-4">
        <SwitchRow title={s.clickbait} help={s.clickbaitHelp} checked locked={s.always} />
        <SwitchRow title={s.facts} help={s.factsHelp} checked={form.requireFactReview} disabled={disabled} onChange={(on) => set("requireFactReview", on)} />
        <SwitchRow title={s.competitors} help={s.competitorsHelp} checked locked={s.always} />
        <SwitchRow title={s.controversy} help={s.controversyHelp} checked={form.requireControversyReview} disabled={disabled} onChange={(on) => set("requireControversyReview", on)} />
      </div>
      <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">{s.hint}</p>
      <Block title={s.creative} body={s.creativeBody}>
        <ChoiceGrid name="video-humor" value={form.humor} options={HUMOR_LEVELS} label={(level) => s.humor[level]} onChange={(level) => set("humor", level)} disabled={disabled} />
        <SwitchRow title={s.controversial} help={s.controversialHelp} checked={form.allowControversial} disabled={disabled} onChange={(on) => set("allowControversial", on)} />
        <SwitchRow title={s.language} help={s.languageHelp} checked={form.strongLanguage} disabled={disabled} onChange={(on) => set("strongLanguage", on)} />
      </Block>
      <Notice tone="success">{s.core}</Notice>
    </>
  );
}

/** The brand's logo and its pictures and clips (kept from before): they are saved as soon as they are uploaded. */
function BrandPane(props: { websiteId: string; canEdit: boolean; settings: VideoSettings; brand: BrandLook; media: MediaView[]; run: Run; pending: boolean; t: T }) {
  const { t, websiteId, settings } = props;
  const [busyUpload, setBusyUpload] = useState(false);
  const disabled = !props.canEdit || props.pending;

  async function uploadFiles(files: FileList | null, use: "library" | "logo") {
    if (!files?.length) return;
    setBusyUpload(true);
    try {
      for (const file of Array.from(files)) {
        const result = await upload(websiteId, file).catch(() => null);
        if (!result || !result.ok) {
          toast.error(result ? errorText(t, result, "") : t.errors.generic);
          continue;
        }
        if (use === "logo") {
          if (result.data.kind !== "image") {
            toast.error(t.errors.bad_file);
            continue;
          }
          props.run(() => saveVideoSettingsAction(websiteId, { logoUrl: result.data.url }), t.saved);
        } else {
          props.run(() => addVideoMedia(websiteId, result.data.url, result.data.kind, file.name));
        }
      }
    } finally {
      setBusyUpload(false);
    }
  }

  return (
    <>
      <PaneHeader title={t.cards.brand} body={t.cards.brandBody} />
      <Block title={t.logo} body={t.logoHelp}>
        <div className="flex flex-wrap items-center gap-3">
          {/* White on purpose: logos are drawn for a light background, as on the video's closing card. */}
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-white">
            {props.brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.brand.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>
          <UploadButton label={busyUpload ? t.uploading : t.uploadLogo} disabled={disabled || busyUpload} accept="image/png,image/jpeg,image/webp" onFiles={(files) => uploadFiles(files, "logo")} />
          {settings.logoUrl ? (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => props.run(() => saveVideoSettingsAction(websiteId, { logoUrl: null }), t.saved)}>
              {t.removeLogo}
            </Button>
          ) : null}
        </div>
      </Block>
      <Block title={t.library} body={t.libraryHelp}>
        <UploadButton
          label={busyUpload ? t.uploading : t.upload}
          disabled={disabled || busyUpload}
          multiple
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
          onFiles={(files) => uploadFiles(files, "library")}
        />
        <div className="flex flex-wrap gap-2">
          {props.media.map((item) => (
            <MediaThumb key={item.id} url={item.url} kind={item.kind} removeLabel={t.remove} onRemove={props.canEdit ? () => props.run(() => removeVideoMedia(websiteId, item.id)) : undefined} />
          ))}
        </div>
      </Block>
    </>
  );
}

function UploadButton(props: { label: string; disabled: boolean; accept: string; multiple?: boolean; onFiles: (files: FileList | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={props.accept}
        multiple={props.multiple}
        onChange={(event) => {
          props.onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" disabled={props.disabled} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />
        {props.label}
      </Button>
    </>
  );
}

/** Where a settings or profile field is edited: its pane and its label, for a refusal that names it. */
export function fieldPlace(t: T, field: string): { pane: SettingsPane; label: string } | null {
  const s = t.viral.settings;
  const places: Record<string, [SettingsPane, string]> = {
    style: ["video", s.video.animated],
    voice: ["video", t.defaultVoice],
    music: ["video", s.video.music],
    captions: ["video", t.captionsOn],
    formats: ["video", s.video.formats],
    duration: ["video", s.video.duration],
    audioMode: ["video", s.video.audio],
    narration: ["video", s.video.narration],
    captionStyle: ["video", s.video.captions],
    musicDirection: ["video", s.video.music],
    showHook: ["video", s.video.hook],
    includeCta: ["video", s.video.cta],
    defaultCta: ["video", s.video.defaultCta],
    viralMix: ["strategy", s.strategy.mix],
    goal: ["strategy", s.strategy.goal],
    techniques: ["strategy", s.strategy.techniques],
    trendInspired: ["strategy", s.strategy.trends],
    targetAudience: ["audience", s.audience.targetAudience],
    priorityTopics: ["audience", s.audience.topics],
    language: ["audience", s.audience.language],
    country: ["audience", s.audience.market],
    tonePreset: ["audience", s.audience.voice],
    tone: ["audience", s.audience.toneNotes],
    avoid: ["audience", s.audience.avoid],
    publishMode: ["publishing", t.publishMode],
    platforms: ["publishing", t.platforms],
    frequency: ["publishing", s.publishing.frequency],
    humor: ["safety", s.safety.creative],
    allowControversial: ["safety", s.safety.controversial],
    strongLanguage: ["safety", s.safety.language],
    requireFactReview: ["safety", s.safety.facts],
    requireControversyReview: ["safety", s.safety.controversy],
    logoUrl: ["brand", t.logo],
  };
  const place = places[field];
  return place ? { pane: place[0], label: place[1] } : null;
}

/** Where LinkedIn posts go (social_accounts.target, lib/social/accounts.ts): the profile, a company page, or the destination chosen. */
function linkedinTargetWords(t: T, target: string): string {
  const targets = t.viral.linkedin.targets;
  return target === "profile" ? targets.profile : target === "organization" ? targets.organization : targets.selected;
}
