"use client";

import { Check, Wand2 } from "lucide-react";
import { useState } from "react";

import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import { format } from "@/lib/i18n/format";
import { addMediaToIdea, removeMediaFromIdea } from "@/lib/video/actions";
import {
  CAPTION_STYLES,
  CREATIVE_DIRECTIONS,
  DURATION_RANGES,
  IDEA_CATEGORIES,
  isVideoFormat,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  TONE_PRESETS,
  VIDEO_FORMATS,
  VIDEO_STYLES,
  VOICES,
  type CreativeDirection,
  type IdeaCategory,
  type IdeaOverrides,
  type ProductionChoices,
  type ReelProps,
  type ResolvedAudio,
  type TonePreset,
  type VideoScript,
  type VideoStyle,
} from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

// TODO(viral-integration): editVideoIdea/rewriteVideoIdea from "@/lib/video/actions", compatibility from "@/lib/video/destinations".
import { compatibility, editVideoIdea, rewriteVideoIdea, type ViralIdeaEdit } from "./_pending";
import { CarouselPreview, ReelPreview } from "./preview";
import { Field, MediaThumb, platformName, selectClass, type IdeaView, type MediaView, type Run, type T, type TrackView } from "./shared";

const RESOLVED_AUDIO: ResolvedAudio[] = ["voiceover", "text_music"];
const cap = (value: string) => value[0].toUpperCase() + value.slice(1);

/**
 * The full editor (client, 2026-11-02; extended 2026-11-12). Everything it
 * had - hook, points and figures, proof, closing line, post text, style,
 * format, voice, music, captions, pictures - plus the idea's title,
 * category, creative direction, audio and its styles, length, hook and CTA
 * switches, and this video's own audience/tone/avoid. "Rewrite with these"
 * (free) has the script written again with the choices; the platform checks
 * are shown before saving or creating.
 */
export function EditDialog(props: {
  idea: IdeaView;
  websiteId: string;
  media: MediaView[];
  tracks: TrackView[];
  settings: VideoSettings;
  priceLabel: string;
  onClose: () => void;
  onApprove: (edit: ViralIdeaEdit) => void;
  run: Run;
  pending: boolean;
  t: T;
}) {
  const { t, idea } = props;
  const v = t.viral;
  const e = v.edit;
  const [title, setTitle] = useState(idea.title);
  const [script, setScript] = useState<VideoScript>(idea.props.script);
  const [caption, setCaption] = useState(idea.caption);
  const [style, setStyle] = useState(idea.style);
  const [formatValue, setFormat] = useState(idea.format);
  const [category, setCategory] = useState<IdeaCategory>(idea.category);
  const [direction, setDirection] = useState<CreativeDirection>(idea.direction);
  const [production, setProduction] = useState<ProductionChoices>(() => ({
    ...idea.production,
    // An idea saved with no music reads as the "No music" direction.
    music: idea.musicTrack === "none" ? "none" : idea.production.music,
  }));
  const [voice, setVoice] = useState<string>(idea.voice ?? props.settings.voice ?? VOICES[0]);
  const [music, setMusic] = useState<string | null>(idea.musicTrack === "none" ? null : idea.musicTrack);
  const [captions, setCaptions] = useState(idea.captions);
  const [overrides, setOverrides] = useState<IdeaOverrides>(idea.overrides);
  const [media, setMedia] = useState(idea.props.media);

  const video = formatValue !== "carousel";
  const narrated = video && production.audio === "voiceover";
  const choose = <K extends keyof ProductionChoices>(key: K, value: ProductionChoices[K]) => setProduction((value0) => ({ ...value0, [key]: value }));
  const cleanOverrides: IdeaOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => typeof value === "string" && value.trim() !== ""),
  ) as IdeaOverrides;

  const edit: ViralIdeaEdit = {
    title: title.trim(),
    script,
    caption,
    style,
    format: formatValue,
    category,
    direction,
    production: { ...production, ctaText: production.ctaText?.trim() ? production.ctaText.trim() : null },
    overrides: cleanOverrides,
    // Today's fields follow the new choices, so an older server reads them the same way.
    voice: narrated ? voice : null,
    musicTrack: production.music === "none" ? "none" : music,
    captions,
  };
  const preview: ReelProps = { ...idea.props, script, style: style as VideoStyle, captions, media };
  const check = compatibility({ format: isVideoFormat(formatValue) ? formatValue : "reel", duration: production.duration, platforms: props.settings.platforms });

  const setPoint = (index: number, change: Partial<VideoScript["points"][number]>) =>
    setScript((value) => ({ ...value, points: value.points.map((point, at) => (at === index ? { ...point, ...change } : point)) }));

  const save = () => props.run(() => editVideoIdea(props.websiteId, idea.id, edit), t.saved, props.onClose);
  const rewrite = () =>
    props.run(
      async () => {
        const saved = await editVideoIdea(props.websiteId, idea.id, edit);
        if (!saved.ok) return saved;
        return rewriteVideoIdea(props.websiteId, idea.id);
      },
      e.rewritten,
      props.onClose,
    );

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t.editTitle}</DialogTitle>
          <DialogDescription>{e.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="mx-auto w-full max-w-[260px] space-y-2">
            {formatValue === "carousel" ? <CarouselPreview props={preview} /> : <ReelPreview props={preview} autoPlay={false} />}
            <p className="text-center text-xs text-muted-foreground">{direction === "animated" ? t.previewNote : v.previewConcept}</p>
          </div>
          <div className="min-w-0 space-y-6">
            <section className="space-y-4" aria-label={e.script}>
              <h3 className="text-sm font-semibold">{e.script}</h3>
              <Field label={e.title}>
                <Input value={title} maxLength={130} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field label={t.hook}>
                <Input value={script.hook} maxLength={80} onChange={(event) => setScript({ ...script, hook: event.target.value })} />
              </Field>
              {script.points.map((point, index) => (
                <fieldset key={index} className="space-y-2 rounded-xl border p-3">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">{format(t.point, { index: String(index + 1) })}</legend>
                  <Field label={t.pointTitle}>
                    <Input value={point.title} maxLength={48} onChange={(event) => setPoint(index, { title: event.target.value })} />
                  </Field>
                  <Field label={t.pointDetail}>
                    <Input value={point.detail} maxLength={180} onChange={(event) => setPoint(index, { detail: event.target.value })} />
                  </Field>
                  {style === "numbers" ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Field label={t.statValue}>
                        <Input
                          type="number"
                          value={point.stat?.value ?? ""}
                          onChange={(event) =>
                            setPoint(index, {
                              stat: event.target.value === "" ? null : { value: Number(event.target.value), suffix: point.stat?.suffix ?? "", label: point.stat?.label ?? "" },
                            })
                          }
                        />
                      </Field>
                      <Field label={t.statSuffix}>
                        <Input value={point.stat?.suffix ?? ""} maxLength={6} disabled={!point.stat} onChange={(event) => point.stat && setPoint(index, { stat: { ...point.stat, suffix: event.target.value } })} />
                      </Field>
                      <Field label={t.statLabel}>
                        <Input value={point.stat?.label ?? ""} maxLength={40} disabled={!point.stat} onChange={(event) => point.stat && setPoint(index, { stat: { ...point.stat, label: event.target.value } })} />
                      </Field>
                    </div>
                  ) : null}
                  {script.points.length > 2 ? (
                    <Button variant="ghost" size="sm" onClick={() => setScript({ ...script, points: script.points.filter((_, at) => at !== index) })}>
                      {t.removePoint}
                    </Button>
                  ) : null}
                </fieldset>
              ))}
              {script.points.length < 4 ? (
                <Button variant="outline" size="sm" onClick={() => setScript({ ...script, points: [...script.points, { title: "", detail: "", stat: null }] })}>
                  {t.addPoint}
                </Button>
              ) : null}
              <Field label={t.proof}>
                <Input value={script.proof} maxLength={160} onChange={(event) => setScript({ ...script, proof: event.target.value })} />
              </Field>
              <Field label={t.cta}>
                <Input value={script.cta} maxLength={80} onChange={(event) => setScript({ ...script, cta: event.target.value })} />
              </Field>
              <Field label={t.caption}>
                <Textarea value={caption} rows={4} maxLength={2200} onChange={(event) => setCaption(event.target.value)} />
              </Field>
            </section>

            <section className="space-y-4 border-t pt-4" aria-label={e.making}>
              <h3 className="text-sm font-semibold">{e.making}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={e.category}>
                  <NativeLikeSelect className={selectClass} value={category} onChange={(event) => setCategory(event.target.value as IdeaCategory)}>
                    {IDEA_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {v.categories[value]}
                      </option>
                    ))}
                  </NativeLikeSelect>
                </Field>
                <Field label={e.direction}>
                  <NativeLikeSelect className={selectClass} value={direction} onChange={(event) => setDirection(event.target.value as CreativeDirection)}>
                    {CREATIVE_DIRECTIONS.map((value) => (
                      <option key={value} value={value}>
                        {v.directions[value]}
                      </option>
                    ))}
                  </NativeLikeSelect>
                </Field>
                <Field label={t.format}>
                  <NativeLikeSelect className={selectClass} value={formatValue} onChange={(event) => setFormat(event.target.value)}>
                    {VIDEO_FORMATS.map((value) => (
                      <option key={value} value={value}>
                        {v.formats[value]}
                      </option>
                    ))}
                  </NativeLikeSelect>
                </Field>
                {direction === "animated" ? (
                  <Field label={t.style}>
                    <NativeLikeSelect className={selectClass} value={style} onChange={(event) => setStyle(event.target.value)}>
                      {VIDEO_STYLES.map((value) => (
                        <option key={value} value={value}>
                          {t.styles[value]}
                        </option>
                      ))}
                    </NativeLikeSelect>
                  </Field>
                ) : null}
                {video ? (
                  <>
                    <Field label={e.duration}>
                      <NativeLikeSelect className={selectClass} value={production.duration} onChange={(event) => choose("duration", event.target.value as ProductionChoices["duration"])}>
                        {DURATION_RANGES.map((value) => (
                          <option key={value} value={value}>
                            {v.durations[value]}
                          </option>
                        ))}
                      </NativeLikeSelect>
                    </Field>
                    <Field label={e.audio}>
                      <NativeLikeSelect className={selectClass} value={production.audio} onChange={(event) => choose("audio", event.target.value as ResolvedAudio)}>
                        {RESOLVED_AUDIO.map((value) => (
                          <option key={value} value={value}>
                            {v.audio[value]}
                          </option>
                        ))}
                      </NativeLikeSelect>
                    </Field>
                    {narrated ? (
                      <>
                        <Field label={t.voice}>
                          <NativeLikeSelect className={selectClass} value={voice} onChange={(event) => setVoice(event.target.value)}>
                            {VOICES.map((value) => (
                              <option key={value} value={value}>
                                {cap(value)}
                              </option>
                            ))}
                          </NativeLikeSelect>
                        </Field>
                        <Field label={e.narration}>
                          <NativeLikeSelect className={selectClass} value={production.narration} onChange={(event) => choose("narration", event.target.value as ProductionChoices["narration"])}>
                            {NARRATION_STYLES.map((value) => (
                              <option key={value} value={value}>
                                {v.narration[value]}
                              </option>
                            ))}
                          </NativeLikeSelect>
                        </Field>
                      </>
                    ) : null}
                    <Field label={e.musicDirection}>
                      <NativeLikeSelect className={selectClass} value={production.music} onChange={(event) => choose("music", event.target.value as ProductionChoices["music"])}>
                        {MUSIC_DIRECTIONS.map((value) => (
                          <option key={value} value={value}>
                            {v.music[value]}
                          </option>
                        ))}
                      </NativeLikeSelect>
                    </Field>
                    {production.music !== "none" ? (
                      <Field label={t.music}>
                        <NativeLikeSelect className={selectClass} value={music ?? ""} onChange={(event) => setMusic(event.target.value === "" ? null : event.target.value)}>
                          <option value="">{t.musicAuto}</option>
                          {props.tracks.map((track) => (
                            <option key={track.id} value={track.id}>
                              {track.title}
                            </option>
                          ))}
                        </NativeLikeSelect>
                      </Field>
                    ) : null}
                    {captions ? (
                      <Field label={e.captionStyle}>
                        <NativeLikeSelect className={selectClass} value={production.captionStyle} onChange={(event) => choose("captionStyle", event.target.value as ProductionChoices["captionStyle"])}>
                          {CAPTION_STYLES.map((value) => (
                            <option key={value} value={value}>
                              {v.captionStyles[value]}
                            </option>
                          ))}
                        </NativeLikeSelect>
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="space-y-3">
                {video ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={captions} onCheckedChange={setCaptions} />
                    {t.captions}
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={production.showHook} onCheckedChange={(on) => choose("showHook", on)} />
                  {e.showHook}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={production.includeCta} onCheckedChange={(on) => choose("includeCta", on)} />
                  {e.includeCta}
                </label>
                {production.includeCta ? (
                  <Field label={e.ctaText} hint={e.ctaHint}>
                    <Input value={production.ctaText ?? ""} maxLength={120} placeholder={script.cta} onChange={(event) => choose("ctaText", event.target.value)} />
                  </Field>
                ) : null}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-dashed p-3" aria-label={e.onlyThis}>
              <div>
                <h3 className="text-sm font-semibold">{e.onlyThis}</h3>
                <p className="text-xs text-muted-foreground">{e.onlyThisBody}</p>
              </div>
              <Field label={e.audience}>
                <Textarea rows={2} maxLength={500} value={overrides.audience ?? ""} placeholder={e.samePlaceholder} onChange={(event) => setOverrides({ ...overrides, audience: event.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={e.tonePreset}>
                  <NativeLikeSelect
                    className={selectClass}
                    value={overrides.tonePreset ?? ""}
                    onChange={(event) => setOverrides({ ...overrides, tonePreset: (event.target.value || undefined) as TonePreset | undefined })}
                  >
                    <option value="">{e.sameAsBrand}</option>
                    {TONE_PRESETS.map((value) => (
                      <option key={value} value={value}>
                        {v.tonePresets[value].title}
                      </option>
                    ))}
                  </NativeLikeSelect>
                </Field>
                <Field label={e.tone}>
                  <Input value={overrides.tone ?? ""} maxLength={200} placeholder={e.samePlaceholder} onChange={(event) => setOverrides({ ...overrides, tone: event.target.value })} />
                </Field>
              </div>
              <Field label={e.avoid}>
                <Input value={overrides.avoid ?? ""} maxLength={300} placeholder={e.samePlaceholder} onChange={(event) => setOverrides({ ...overrides, avoid: event.target.value })} />
              </Field>
            </section>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t.pictures}</p>
              {media.length === 0 ? <p className="text-xs text-muted-foreground">{t.noPictures}</p> : null}
              <div className="flex flex-wrap gap-2">
                {media.map((item) => (
                  <MediaThumb
                    key={item.url}
                    url={item.url}
                    kind={item.kind}
                    removeLabel={t.remove}
                    onRemove={() =>
                      props.run(() => removeMediaFromIdea(props.websiteId, idea.id, item.url), undefined, () =>
                        setMedia((list) => list.filter((entry) => entry.url !== item.url)),
                      )
                    }
                  />
                ))}
              </div>
              {props.media.length > 0 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">{t.addPicture}</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {props.media
                      .filter((item) => !media.some((entry) => entry.url === item.url))
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={item.name ?? t.addPicture}
                          className="rounded-lg ring-primary hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
                          onClick={() =>
                            props.run(() => addMediaToIdea(props.websiteId, idea.id, item.url, item.kind), undefined, () =>
                              setMedia((list) => [{ url: item.url, kind: item.kind }, ...list]),
                            )
                          }
                        >
                          <MediaThumb url={item.url} kind={item.kind} />
                        </button>
                      ))}
                  </div>
                </details>
              ) : null}
            </div>

            {!check.ok ? (
              <Notice tone="warning" title={v.compat.title}>
                <ul className="list-disc space-y-0.5 pl-5">
                  {check.problems.map((problem) => (
                    <li key={`${problem.platform}-${problem.code}`}>{compatText(t, problem, production.duration)}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={props.onClose}>
            {t.cancel}
          </Button>
          <Button variant="outline" disabled={props.pending} title={e.rewriteHelp} onClick={rewrite}>
            <Wand2 aria-hidden="true" />
            {e.rewrite}
          </Button>
          <Button variant="outline" disabled={props.pending} onClick={save}>
            {t.save}
          </Button>
          <Button disabled={props.pending} onClick={() => props.onApprove(edit)}>
            <Check aria-hidden="true" />
            {t.saveAndApprove} · {props.priceLabel}
          </Button>
        </DialogFooter>
        <p className="text-right text-xs text-muted-foreground">{e.rewriteHelp}</p>
      </DialogContent>
    </Dialog>
  );
}

/** One platform check in words: a Story where there are none, a video too long, a carousel where it cannot go. */
export function compatText(t: T, problem: { platform: string; code: string }, duration: ProductionChoices["duration"]): string {
  const c = t.viral.compat;
  const platform = platformName(problem.platform);
  const words = c[problem.code as keyof Omit<T["viral"]["compat"], "title">] ?? c.other;
  return format(words, { platform, length: t.viral.durations[duration] });
}

