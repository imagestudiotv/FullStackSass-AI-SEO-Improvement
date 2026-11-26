"use client";

import { Player, Thumbnail, type PlayerRef } from "@remotion/player";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Plus, RotateCcw, Wand2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import { format } from "@/lib/i18n/format";
import { addMediaToIdea, editVideoIdea, removeMediaFromIdea, rewriteVideoIdea, type IdeaEdit } from "@/lib/video/actions";
import { compatibility } from "@/lib/video/destinations";
import {
  CREATIVE_DIRECTIONS,
  DURATION_RANGES,
  IDEA_CATEGORIES,
  isVideoFormat,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  REEL,
  SLIDE,
  TONE_PRESETS,
  VIDEO_FORMATS,
  VOICES,
  type CreativeDirection,
  type IdeaCategory,
  type ProductionChoices,
  type TonePreset,
  type VideoPoint,
} from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";
import type { ProductionReelProps } from "@/remotion/props";
import type { ClipTextStyle } from "@/remotion/clip-text";
import { Reel } from "@/remotion/Reel";
import { carouselSlideCount, Slide } from "@/remotion/Slide";
import { pointTitleMax } from "@/remotion/editorial";

import {
  audioLock,
  clipTextApplies,
  clipTextOf,
  clipTextPart,
  canEditIdea,
  captionsApply,
  ctaSwitchApplies,
  editFromForm,
  editorialLimited,
  editorialText,
  editorProblems,
  effectiveAudio,
  figuresApply,
  formFromIdea,
  hookSwitchApplies,
  isDirty,
  maxPoints,
  MIN_POINTS,
  musicChoice,
  partFrame,
  partSlide,
  previewMusic,
  previewProps,
  textStyles,
  textStyleValue,
  visibleParts,
  VOICE_OFF,
  voiceChoice,
  withMusicChoice,
  withTextStyle,
  withVoiceChoice,
  type EditorForm,
  type PartKey,
} from "./editor-logic";
import { ClipTextBox, ClipTextControls } from "./clip-text-editor";
import { reelFrames } from "./preview";
import { Field, MediaThumb, platformName, selectClass, type IdeaView, type MediaView, type Run, type T, type TrackView } from "./shared";

const cap = (value: string) => value[0].toUpperCase() + value.slice(1);
type EditorTab = "script" | "style" | "video";
const RATIO: Record<(typeof VIDEO_FORMATS)[number], string> = { reel: "9:16", story: "9:16", carousel: "4:5" };

/**
 * The video editor (client, 2026-11-21: "more simple and focused", the
 * no-scenes reference). A large panel: the live preview on the left - the
 * real template, following the format and showing the text being edited -
 * and three tabs on the right: Script (the texts on screen, the voiceover
 * lines, the post's caption), Style (the look and the text styles the
 * renderer really has) and Video (format, length, voice, captions, music,
 * pictures). Only what the video uses is offered (editor-logic.ts); the
 * per-video audience/tone and the AI rewrite sit under More options.
 *
 * Same contract as the dialog it replaces: Save (editVideoIdea, free, new and
 * failed ideas only), Save & approve (onApprove with the edit). Escape or
 * Cancel with unsaved changes asks before closing.
 */
export function EditDialog(props: {
  idea: IdeaView;
  websiteId: string;
  media: MediaView[];
  tracks: TrackView[];
  settings: VideoSettings;
  /** Whether X takes videos now (videoPublishingStatus). */
  xAvailable: boolean;
  priceLabel: string;
  onClose: () => void;
  onApprove: (edit: IdeaEdit) => void;
  run: Run;
  pending: boolean;
  t: T;
}) {
  const { t, idea } = props;
  const v = t.viral;
  const e = v.edit;
  const c = v.editor;
  const editable = canEditIdea(idea.status);
  const [initial] = useState<EditorForm>(() => formFromIdea(idea, idea.voice ?? props.settings.voice ?? VOICES[0]));
  const [form, setForm] = useState<EditorForm>(initial);
  const [media, setMedia] = useState(idea.props.media);
  const [tab, setTab] = useState<EditorTab>("script");
  const [selected, setSelected] = useState<PartKey>(0);
  const [confirming, setConfirming] = useState(false);

  const dirty = editable && isDirty(initial, form);
  const edit = editFromForm(form);
  const problems = editable ? editorProblems(form) : [];
  const preview = useMemo(() => {
    const base = idea.props as ProductionReelProps;
    return { ...previewProps(base, form, media), music: previewMusic(idea.id, base, initial, form) };
  }, [idea.id, idea.props, initial, form, media]);
  const video = form.format !== "carousel";
  const audio = effectiveAudio(form);
  const narrated = video && audio === "voiceover";
  const lock = audioLock(form.direction, form.format);
  const max = maxPoints(form);
  const styles = textStyles(form);
  const update = (change: Partial<EditorForm>) => setForm((value) => ({ ...value, ...change }));
  const choose = <K extends keyof ProductionChoices>(key: K, value: ProductionChoices[K]) => setForm((value0) => ({ ...value0, production: { ...value0.production, [key]: value } }));
  const setScript = (change: Partial<EditorForm["script"]>) => setForm((value) => ({ ...value, script: { ...value.script, ...change } }));
  const setPoint = (index: number, change: Partial<VideoPoint>) =>
    setForm((value) => ({ ...value, script: { ...value.script, points: value.script.points.map((point, at) => (at === index ? { ...point, ...change } : point)) } }));

  const check = compatibility({
    format: isVideoFormat(form.format) ? form.format : "reel",
    duration: form.format === "carousel" ? null : form.production.duration,
    platforms: props.settings.platforms,
    xAvailable: props.xAvailable,
  });
  const platformProblems = Object.entries(check.problems) as [string, string][];

  const requestClose = () => (dirty ? setConfirming(true) : props.onClose());
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

  const n = form.script.points.length;
  // The text on a Viral clip (client, 2026-11-24), and on every slide of an editorial video (2026-11-26): its style now, and dragging it on the preview.
  const plan = (idea.props as ProductionReelProps).plan;
  const editorial = editorialText(form);
  const textStyle = clipTextApplies(form) ? clipTextOf(form, plan, idea.props.brand) : null;
  const setTextStyle = (style: ClipTextStyle | null) => choose("textStyle", style);
  const draggable = clipTextPart(form, selected);
  const clipText: ClipTextEdit | null = editable && textStyle && draggable ? { text: draggable, style: textStyle, onChange: setTextStyle, ...(editorial ? { editorial: { props: preview, part: selected } } : {}) } : null;
  const onScreen = (part: PartKey) => ({ onFocus: () => setSelected(part) });

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        closeLabel={c.close}
        onEscapeKeyDown={(event) => {
          // Escape on the question keeps editing; with changes it asks first.
          if (confirming) {
            event.preventDefault();
            setConfirming(false);
          } else if (dirty) {
            event.preventDefault();
            setConfirming(true);
          }
        }}
        className="inset-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:inset-4 sm:h-auto sm:w-auto sm:max-w-none sm:rounded-xl"
      >
        <header className="flex items-start gap-3 border-b px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-semibold">{form.format === "carousel" ? c.carousel.heading : c.heading}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{form.format === "carousel" ? c.carousel.intro : c.intro}</DialogDescription>
          </div>
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setForm(initial)}>
              <RotateCcw aria-hidden="true" />
              {c.reset}
            </Button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <section aria-label={form.format === "carousel" ? c.carousel.preview : c.preview} className="flex flex-col items-center gap-3 bg-muted/40 px-4 py-4 md:justify-center md:overflow-y-auto">
            <EditorPreview props={preview} part={selected} onPart={setSelected} clipText={clipText} t={t} />
            <p className="max-w-sm text-center text-xs text-muted-foreground">{form.direction === "animated" ? t.previewNote : (preview.music && video ? v.previewMusic : v.previewConcept)}</p>
          </section>

          <div className="min-w-0 border-t md:overflow-y-auto md:border-t-0 md:border-l">
            <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)} className="gap-0">
              <div className="sticky top-0 z-10 border-b bg-popover px-4 py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="script">{c.tabs.script}</TabsTrigger>
                  <TabsTrigger value="style">{c.tabs.style}</TabsTrigger>
                  <TabsTrigger value="video">{c.tabs.video}</TabsTrigger>
                </TabsList>
              </div>
              {editable ? null : (
                <div className="px-4 pt-4">
                  <Notice tone="info" title={c.readOnly.title}>
                    {c.readOnly.body}
                  </Notice>
                </div>
              )}
              <fieldset disabled={!editable} className="min-w-0">
                <TabsContent value="script" className="space-y-5 p-4">
                  <Field label={c.videoTitle} hint={c.titlePrivate}>
                    <Input value={form.title} maxLength={90} aria-invalid={problems.includes("title") || undefined} onChange={(event) => update({ title: event.target.value })} />
                  </Field>

                  <section className="space-y-3" aria-label={c.onScreen}>
                    <div>
                      <h3 className="text-sm font-semibold">{c.onScreen}</h3>
                      <p className="text-xs text-muted-foreground">{c.onScreenHint}</p>
                    </div>
                    <TextRow selected={selected === 0} note={hookSwitchApplies(form) && !form.production.showHook ? c.hookOff : null}>
                      <Field label={t.hook}>
                        <Input value={form.script.hook} maxLength={form.pov ? 90 /* strategy/pov.ts POV_LINE_MAX */ : 80} aria-invalid={problems.includes("hook") || undefined} {...onScreen(0)} onChange={(event) => setScript({ hook: event.target.value })} />
                      </Field>
                    </TextRow>
                    {/* A POV clip video is its one line (client, 2026-11-21). */}
                    {!form.pov ? (
                      <>
                        {form.script.points.map((point, index) => (
                          <TextRow key={index} selected={selected === index + 1} muted={index >= max}>
                            <div className="flex items-end gap-2">
                              <div className="min-w-0 flex-1">
                                <Field label={format(t.point, { index: String(index + 1) })}>
                                  <Input
                                    value={point.title}
                                    maxLength={pointTitleMax(form.direction)}
                                    aria-invalid={(index < max && problems.includes("point") && !point.title.trim()) || undefined}
                                    {...onScreen(index + 1)}
                                    onChange={(event) => setPoint(index, { title: event.target.value })}
                                  />
                                </Field>
                              </div>
                              {n > MIN_POINTS ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={format(c.removePoint, { index: String(index + 1) })}
                                  onClick={() => {
                                    setScript({ points: form.script.points.filter((_, at) => at !== index) });
                                    setSelected(0);
                                  }}
                                >
                                  <X aria-hidden="true" />
                                </Button>
                              ) : null}
                            </div>
                            {figuresApply(form) ? <FigureFields point={point} onChange={(change) => setPoint(index, change)} onFocus={() => setSelected(index + 1)} t={t} /> : null}
                          </TextRow>
                        ))}
                        {n > max ? <p className="text-xs text-muted-foreground">{format(c.tooManyPoints, { max: String(max) })}</p> : null}
                        {n < max ? (
                          <Button variant="outline" size="sm" onClick={() => setScript({ points: [...form.script.points, { title: "", detail: "", stat: null }] })}>
                            <Plus aria-hidden="true" />
                            {t.addPoint}
                          </Button>
                        ) : null}
                        <TextRow selected={selected === n + 1}>
                          <Field label={t.proof}>
                            <Input value={form.script.proof} maxLength={160} {...onScreen(n + 1)} onChange={(event) => setScript({ proof: event.target.value })} />
                          </Field>
                        </TextRow>
                      </>
                    ) : null}
                    {!form.clipOnly ? (
                      <>
                        <TextRow
                          selected={selected === n + 2}
                          note={ctaSwitchApplies(form) ? (!form.production.includeCta ? c.ctaOff : form.production.ctaText?.trim() ? c.ctaReplaced : null) : null}
                        >
                          <Field label={t.cta}>
                            <Input value={form.script.cta} maxLength={80} {...onScreen(n + 2)} onChange={(event) => setScript({ cta: event.target.value })} />
                          </Field>
                        </TextRow>
                      </>
                    ) : null}
                  </section>

                  {!form.pov ? (
                    <Accordion title={c.voiceoverScript} badge={c.optional}>
                      <p className="text-xs text-muted-foreground">{narrated ? c.voiceoverHint : c.voiceoverSilent}</p>
                      {form.script.points.slice(0, max).map((point, index) => (
                        <Field key={index} label={format(c.pointAdds, { index: String(index + 1) })}>
                          <Textarea rows={2} maxLength={180} value={point.detail} onFocus={() => setSelected(index + 1)} onChange={(event) => setPoint(index, { detail: event.target.value })} />
                        </Field>
                      ))}
                    </Accordion>
                  ) : null}

                  <Accordion title={c.socialCaption} open={problems.includes("caption")}>
                    <Field label={t.caption} hint={c.captionHint}>
                      <Textarea rows={5} maxLength={2200} value={form.caption} aria-invalid={problems.includes("caption") || undefined} onChange={(event) => update({ caption: event.target.value })} />
                    </Field>
                  </Accordion>

                  <Callout>{c.profileCallout}</Callout>

                  <Accordion title={c.more}>
                    <p className="text-xs text-muted-foreground">{c.moreHint}</p>
                    <Field label={e.category}>
                      <NativeLikeSelect className={selectClass} value={form.category} onChange={(event) => update({ category: event.target.value as IdeaCategory })}>
                        {IDEA_CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {v.categories[value]}
                          </option>
                        ))}
                      </NativeLikeSelect>
                    </Field>
                    <Field label={e.audience}>
                      <Textarea
                        rows={2}
                        maxLength={300}
                        value={form.overrides.audience ?? ""}
                        placeholder={e.samePlaceholder}
                        onChange={(event) => update({ overrides: { ...form.overrides, audience: event.target.value } })}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={e.tonePreset}>
                        <NativeLikeSelect
                          className={selectClass}
                          value={form.overrides.tonePreset ?? ""}
                          onChange={(event) => update({ overrides: { ...form.overrides, tonePreset: (event.target.value || undefined) as TonePreset | undefined } })}
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
                        <Input
                          value={form.overrides.tone ?? ""}
                          maxLength={300}
                          placeholder={e.samePlaceholder}
                          onChange={(event) => update({ overrides: { ...form.overrides, tone: event.target.value } })}
                        />
                      </Field>
                    </div>
                    <Field label={e.avoid}>
                      <Input
                        value={form.overrides.avoid ?? ""}
                        maxLength={300}
                        placeholder={e.samePlaceholder}
                        onChange={(event) => update({ overrides: { ...form.overrides, avoid: event.target.value } })}
                      />
                    </Field>
                    <div className="space-y-1">
                      <Button variant="outline" size="sm" disabled={props.pending || problems.length > 0} onClick={rewrite}>
                        <Wand2 aria-hidden="true" />
                        {c.rewrite}
                      </Button>
                      <p className="text-xs text-muted-foreground">{e.rewriteHelp}</p>
                    </div>
                  </Accordion>
                </TabsContent>

                <TabsContent value="style" className="space-y-5 p-4">
                  {/* A POV clip video has one look: its clip. */}
                  {form.pov ? null : (
                  <Field label={c.look} hint={c.lookHint}>
                    <NativeLikeSelect className={selectClass} value={form.direction} onChange={(event) => update({ direction: event.target.value as CreativeDirection })}>
                      {CREATIVE_DIRECTIONS.map((value) => (
                        <option key={value} value={value}>
                          {v.directions[value]}
                        </option>
                      ))}
                    </NativeLikeSelect>
                  </Field>
                  )}

                  {textStyle ? (
                    <ClipTextControls
                      text={draggable ?? form.script.hook}
                      style={textStyle}
                      custom={Boolean(form.production.textStyle)}
                      onChange={setTextStyle}
                      onReset={() => setTextStyle(null)}
                      c={c.clip}
                      editorial={editorial}
                      limited={editorial ? editorialLimited(form, textStyle, draggable ?? form.script.hook) : undefined}
                    />
                  ) : null}

                  {/* A POV clip and an editorial video style their text with the controls above. */}
                  {form.pov || editorial ? null : (
                  <fieldset className="min-w-0 space-y-2">
                    <legend className="text-sm font-semibold">{c.textStyle}</legend>
                    {styles.kind === "fixed" ? (
                      <p className="text-xs text-muted-foreground">{c.textStyleFixed}</p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">{styles.kind === "template" ? c.textStyleTemplate : c.textStyleCaptions}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {styles.options.map((value) => (
                            <StyleTile
                              key={value}
                              value={value}
                              kind={styles.kind}
                              label={styles.kind === "template" ? t.styles[value as keyof T["styles"]] : v.captionStyles[value as keyof T["viral"]["captionStyles"]]}
                              help={styles.kind === "template" ? t.styleHelp[value as keyof T["styleHelp"]] : undefined}
                              pressed={textStyleValue(form) === value}
                              onPress={() => setForm((value0) => withTextStyle(value0, value))}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </fieldset>
                  )}

                  <div className="space-y-3 border-t pt-4">
                    {hookSwitchApplies(form) ? (
                      <SwitchRow label={e.showHook} checked={form.production.showHook} onChange={(on) => choose("showHook", on)} />
                    ) : null}
                    {ctaSwitchApplies(form) ? (
                      <>
                        <SwitchRow label={e.includeCta} checked={form.production.includeCta} onChange={(on) => choose("includeCta", on)} />
                        {form.production.includeCta ? (
                          <Field label={e.ctaText} hint={e.ctaHint}>
                            <Input value={form.production.ctaText ?? ""} maxLength={150} placeholder={form.script.cta} onFocus={() => setSelected(n + 2)} onChange={(event) => choose("ctaText", event.target.value)} />
                          </Field>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">{form.clipOnly ? c.clipEnds : c.templateAlways}</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="video" className="space-y-5 p-4">
                  <fieldset className="min-w-0 space-y-2">
                    <legend className="text-sm font-semibold">{c.videoFormat}</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {/* A POV clip video is never a carousel (cleanEdit). */}
                      {VIDEO_FORMATS.filter((value) => !form.pov || value !== "carousel").map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={form.format === value}
                          onClick={() => update({ format: value })}
                          className="flex flex-col items-center gap-2 rounded-xl border bg-background px-2 py-3 text-xs font-medium transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-foreground"
                        >
                          <span aria-hidden="true" className={`block rounded-[3px] border-2 border-current ${value === "carousel" ? "h-5 w-4" : "h-6 w-3.5"}`} />
                          {format(c.formatOption, { ratio: RATIO[value], name: v.formats[value] })}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {video ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* A POV clip video lasts as long as its clip and has no voice. */}
                      {form.pov ? null : (
                      <>
                      <Field label={e.duration}>
                        <NativeLikeSelect className={selectClass} value={form.production.duration} onChange={(event) => choose("duration", event.target.value as ProductionChoices["duration"])}>
                          {DURATION_RANGES.map((value) => (
                            <option key={value} value={value}>
                              {v.durations[value]}
                            </option>
                          ))}
                        </NativeLikeSelect>
                      </Field>
                      <Field label={c.voiceover} hint={lock ? c.voiceLocked[lock] : undefined}>
                        <NativeLikeSelect className={selectClass} value={voiceChoice(form)} disabled={lock === "text_music"} onChange={(event) => setForm((value) => withVoiceChoice(value, event.target.value))}>
                          {lock === "voiceover" ? null : <option value={VOICE_OFF}>{t.voiceOff}</option>}
                          {VOICES.map((value) => (
                            <option key={value} value={value}>
                              {cap(value)}
                            </option>
                          ))}
                        </NativeLikeSelect>
                      </Field>
                      </>
                      )}
                      {narrated && !form.pov ? (
                        <Field label={e.narration}>
                          <NativeLikeSelect className={selectClass} value={form.production.narration} onChange={(event) => choose("narration", event.target.value as ProductionChoices["narration"])}>
                            {NARRATION_STYLES.map((value) => (
                              <option key={value} value={value}>
                                {v.narration[value]}
                              </option>
                            ))}
                          </NativeLikeSelect>
                        </Field>
                      ) : null}
                      <Field label={t.music}>
                        <NativeLikeSelect className={selectClass} value={musicChoice(form)} onChange={(event) => setForm((value) => withMusicChoice(value, event.target.value))}>
                          <optgroup label={c.musicMoods}>
                            {MUSIC_DIRECTIONS.map((value) => (
                              <option key={value} value={`mood:${value}`}>
                                {v.music[value]}
                              </option>
                            ))}
                          </optgroup>
                          {props.tracks.length > 0 ? (
                            <optgroup label={c.musicTracks}>
                              {props.tracks.map((track) => (
                                <option key={track.id} value={`track:${track.id}`}>
                                  {track.title}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </NativeLikeSelect>
                      </Field>
                    </div>
                  ) : null}

                  {captionsApply(form) ? (
                    <SwitchRow label={c.captionsOnVideo} hint={c.captionsHint} checked={form.captions} onChange={(on) => update({ captions: on })} />
                  ) : null}

                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-semibold">{t.pictures}</p>
                    <p className="text-xs text-muted-foreground">{media.length === 0 ? t.noPictures : c.picturesHint}</p>
                    <div className="flex flex-wrap gap-2">
                      {media.map((item) => (
                        <MediaThumb
                          key={item.url}
                          url={item.url}
                          kind={item.kind}
                          removeLabel={t.remove}
                          onRemove={
                            editable
                              ? () =>
                                  props.run(() => removeMediaFromIdea(props.websiteId, idea.id, item.url), undefined, () =>
                                    setMedia((list) => list.filter((entry) => entry.url !== item.url)),
                                  )
                              : undefined
                          }
                        />
                      ))}
                    </div>
                    {editable && props.media.length > 0 ? (
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

                  {platformProblems.length > 0 ? (
                    <Notice tone="warning" title={v.compat.title}>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {platformProblems.map(([platform, code]) => (
                          <li key={platform}>{compatText(t, { platform, code }, form.production.duration)}</li>
                        ))}
                      </ul>
                    </Notice>
                  ) : null}

                  <Callout>{c.videoCallout}</Callout>
                </TabsContent>
              </fieldset>
            </Tabs>
          </div>
        </div>

        <footer className="border-t bg-muted/50 px-4 py-3">
          {confirming ? (
            <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label={c.unsaved}>
              <p className="mr-auto text-sm font-medium" aria-live="assertive">
                {c.unsaved}
              </p>
              <Button variant="outline" autoFocus onClick={() => setConfirming(false)}>
                {c.keepEditing}
              </Button>
              <Button variant="destructive" onClick={props.onClose}>
                {c.discard}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {problems.length > 0 ? (
                <p className="mr-auto text-xs text-destructive" aria-live="polite">
                  {problems.map((problem) => c.problems[problem]).join(" ")}
                </p>
              ) : null}
              <Button variant="outline" onClick={requestClose}>
                {editable ? t.cancel : c.close}
              </Button>
              {editable ? (
                <>
                  <Button variant="outline" disabled={props.pending || !dirty || problems.length > 0} onClick={save}>
                    {t.save}
                  </Button>
                  <Button disabled={props.pending || problems.length > 0} onClick={() => props.onApprove(edit)}>
                    <Check aria-hidden="true" />
                    {c.saveApprove} · {props.priceLabel}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** The text being styled and dragged on the preview; an editorial video's lies on the part shown (clip-text-editor.tsx). */
type ClipTextEdit = { text: string; style: ClipTextStyle; onChange: (style: ClipTextStyle) => void; editorial?: { props: ProductionReelProps; part: PartKey } };

/**
 * The live preview: the reel's real template paused on the text being edited
 * (9:16 for a reel or a Story), or the carousel's slide for it (4:5); the
 * chips under it show each text the video has.
 */
function EditorPreview({ props, part, onPart, clipText, t }: { props: ProductionReelProps; part: PartKey; onPart: (part: PartKey) => void; clipText: ClipTextEdit | null; t: T }) {
  const c = t.viral.editor;
  const player = useRef<PlayerRef>(null);
  const carousel = props.format === "carousel";
  const frame = carousel ? 0 : partFrame(props, part);
  const parts = visibleParts(props);
  const n = props.script.points.length;
  const label = (key: PartKey) => (key === 0 ? c.parts.hook : key <= n ? format(c.parts.point, { index: String(key) }) : key === n + 1 ? c.parts.proof : c.parts.cta);
  // The part shown: the one asked for, or the next one the video has (a hook or CTA switched off).
  const slide = partSlide(props, part);
  const slides = carousel ? carouselSlideCount(props) : 0;

  // The text's box is for the paused preview: while it plays the text comes and goes.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const current = player.current;
    if (!current) return;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    current.addEventListener("play", on);
    current.addEventListener("pause", off);
    return () => {
      current.removeEventListener("play", on);
      current.removeEventListener("pause", off);
    };
  }, [carousel]);

  // The words being edited stay on screen while they are typed.
  useEffect(() => {
    const current = player.current;
    if (!current) return;
    current.pause();
    current.seekTo(frame);
  }, [frame, props]);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {carousel ? (
        <div className="w-full max-w-[260px] space-y-2 md:max-w-[min(360px,calc((100dvh_-_15rem)*0.8))]">
          <div className="relative">
          <Thumbnail
            component={Slide}
            inputProps={{ ...props, index: slide }}
            compositionWidth={SLIDE.width}
            compositionHeight={SLIDE.height}
            frameToDisplay={0}
            durationInFrames={1}
            fps={30}
            style={{ width: "100%", aspectRatio: `${SLIDE.width} / ${SLIDE.height}`, borderRadius: 12, overflow: "hidden" }}
          />
          {/* An editorial carousel's text is dragged on the slide itself (client, 2026-11-26). */}
          {clipText?.editorial ? <ClipTextBox {...clipText} story={false} c={c.clip} /> : null}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon-sm" aria-label={c.previousSlide} disabled={slide <= 0} onClick={() => onPart(parts[slide - 1])}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">{format(c.slideOf, { index: String(slide + 1), total: String(slides) })}</span>
            <Button variant="ghost" size="icon-sm" aria-label={c.nextSlide} disabled={slide >= parts.length - 1} onClick={() => onPart(parts[slide + 1])}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-[220px] md:max-w-[min(340px,calc((100dvh_-_15rem)*0.5625))]">
          <Player
            ref={player}
            component={Reel}
            inputProps={props}
            durationInFrames={reelFrames(props)}
            compositionWidth={REEL.width}
            compositionHeight={REEL.height}
            fps={REEL.fps}
            initialFrame={frame}
            initiallyMuted
            // Unmuting resets the shared audio tags of the player, and the music would stay silent: each sound has its own tag.
            numberOfSharedAudioTags={0}
            loop
            controls
            clickToPlay
            acknowledgeRemotionLicense
            style={{ width: "100%", aspectRatio: `${REEL.width} / ${REEL.height}`, borderRadius: 16, overflow: "hidden" }}
          />
          {clipText && !playing ? <ClipTextBox {...clipText} story={props.format === "story"} c={c.clip} /> : null}
        </div>
      )}
      <div role="group" aria-label={c.showPart} className="flex max-w-full flex-wrap justify-center gap-1.5">
        {parts.map((key, index) => (
          <button
            key={key}
            type="button"
            aria-pressed={slide === index}
            onClick={() => onPart(key)}
            className="h-7 rounded-full border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {label(key)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One text on screen: highlighted while it is the one in the preview, a note when the video leaves it out. */
function TextRow({ selected, muted, note, children }: { selected: boolean; muted?: boolean; note?: string | null; children: ReactNode }) {
  return (
    <div className={`space-y-2 rounded-xl border p-3 transition-colors ${selected ? "border-primary/60 bg-primary/5" : ""} ${muted || note ? "opacity-70" : ""}`}>
      {children}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** The Numbers template's figure for a point: number, unit, label. */
function FigureFields({ point, onChange, onFocus, t }: { point: VideoPoint; onChange: (change: Partial<VideoPoint>) => void; onFocus: () => void; t: T }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field label={t.statValue}>
        <Input
          type="number"
          value={point.stat?.value ?? ""}
          onFocus={onFocus}
          onChange={(event) => onChange({ stat: event.target.value === "" ? null : { value: Number(event.target.value), suffix: point.stat?.suffix ?? "", label: point.stat?.label ?? "" } })}
        />
      </Field>
      <Field label={t.statSuffix}>
        <Input value={point.stat?.suffix ?? ""} maxLength={6} disabled={!point.stat} onFocus={onFocus} onChange={(event) => point.stat && onChange({ stat: { ...point.stat, suffix: event.target.value } })} />
      </Field>
      <Field label={t.statLabel}>
        <Input value={point.stat?.label ?? ""} maxLength={40} disabled={!point.stat} onFocus={onFocus} onChange={(event) => point.stat && onChange({ stat: { ...point.stat, label: event.target.value } })} />
      </Field>
    </div>
  );
}

/** A closed-by-default section (native details: keyboard and screen readers for free). */
function Accordion({ title, badge, open, children }: { title: string; badge?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="group rounded-xl border" open={open || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        {title}
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {badge}
          <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3">{children}</div>
    </details>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** A text style as a small sample of how it reads on the video. */
function StyleTile({ value, kind, label, help, pressed, onPress }: { value: string; kind: "template" | "captions"; label: string; help?: string; pressed: boolean; onPress: () => void }) {
  const sample: Record<string, ReactNode> = {
    "template:bold": <span className="text-lg leading-none font-black text-white uppercase">Aa</span>,
    "template:numbers": <span className="text-lg leading-none font-black text-amber-300 tabular-nums">42%</span>,
    "template:story": <span className="bg-white px-1.5 py-0.5 text-sm leading-none font-extrabold text-neutral-900">Aa</span>,
    "captions:bold": <span className="rounded bg-white px-1.5 py-0.5 text-sm leading-none font-extrabold text-neutral-900">Aa</span>,
    "captions:editorial": <span className="text-sm leading-none font-semibold text-white">Aa bb</span>,
    "captions:minimal": <span className="text-[10px] leading-none font-medium text-white/85 lowercase">aa bb</span>,
  };
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={help}
      onClick={onPress}
      className="flex flex-col overflow-hidden rounded-xl border bg-background text-left text-xs font-medium transition hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/30"
    >
      <span aria-hidden="true" className="flex h-12 items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
        {sample[`${kind}:${value}`]}
      </span>
      <span className="px-2 py-1.5 leading-tight">{label}</span>
    </button>
  );
}

/** One platform check in words: a Story where there are none, a video too long, a carousel where it cannot go. */
export function compatText(t: T, problem: { platform: string; code: string }, duration: ProductionChoices["duration"]): string {
  const c = t.viral.compat;
  const platform = platformName(problem.platform);
  const words = c[problem.code as keyof Omit<T["viral"]["compat"], "title">] ?? c.other;
  return format(words, { platform, length: t.viral.durations[duration] });
}
