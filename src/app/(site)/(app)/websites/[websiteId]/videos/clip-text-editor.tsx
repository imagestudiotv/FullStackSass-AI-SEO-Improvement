"use client";

import { AlignCenter, AlignLeft, AlignRight, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import {
  boundClipText,
  CLIP_ALIGNS,
  CLIP_CASES,
  CLIP_FONT_KEYS,
  CLIP_FONTS,
  CLIP_FRAME,
  CLIP_PRESETS,
  CLIP_SIZE,
  CLIP_STROKE_MAX,
  CLIP_WIDTH,
  clipPresetOf,
  clipTextLayout,
  nearestWeight,
  withClipPreset,
  type ClipFont,
  type ClipPreset,
  type ClipTextStyle,
} from "@/remotion/clip-text";
import { ClipText } from "@/remotion/components/ClipText";
import { safeArea } from "@/remotion/production";

import { Field, selectClass, type T } from "./shared";

/**
 * The text of a Viral clip in the editor (client, 2026-11-24; his mockup
 * repget_video_editor_no_scenes.html): the box to drag on the preview and the
 * controls of the Style tab. The style shown is always a full one - the look
 * picked for the video until something is changed - so every control says
 * what the video has now.
 */

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

/**
 * The text's box over the preview: dragged, or moved with the arrow keys. It
 * lies on the text itself - the same component, drawn unseen at the preview's
 * scale - so it is as large as the words are.
 */
export function ClipTextBox({ text, style, story, onChange, c }: { text: string; style: ClipTextStyle; story: boolean; onChange: (style: ClipTextStyle) => void; c: T["viral"]["editor"]["clip"] }) {
  const layer = useRef<HTMLDivElement>(null);
  const grip = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(0);
  const safe = safeArea(story);

  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Where the box is on the frame now, in percent: a tall text may sit higher than its saved place. */
  const placeOf = (box: HTMLElement) => {
    const frame = layer.current!.getBoundingClientRect();
    const at = box.getBoundingClientRect();
    return { frame, x: ((at.left - frame.left) / frame.width) * 100, y: ((at.top - frame.top) / frame.height) * 100 };
  };

  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !layer.current) return;
    event.preventDefault();
    const at = event.currentTarget.getBoundingClientRect();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    grip.current = { x: event.clientX - at.left, y: event.clientY - at.top };
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!grip.current || !layer.current) return;
    // Against the frame as it is now: the first change adds a button over it, which moves it down on a phone.
    const frame = layer.current.getBoundingClientRect();
    if (!frame.width || !frame.height) return;
    onChange(boundClipText({ ...style, x: ((event.clientX - grip.current.x - frame.left) / frame.width) * 100, y: ((event.clientY - grip.current.y - frame.top) / frame.height) * 100 }));
  };
  const end = () => {
    grip.current = null;
    setDragging(false);
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 5 : 1;
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!by) return;
    event.preventDefault();
    onChange(boundClipText({ ...style, x: style.x + by[0], y: placeOf(event.currentTarget).y + by[1] }));
  };

  const scale = width / CLIP_FRAME.width;
  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {dragging ? (
        // What the platforms' own buttons and captions cover.
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 bg-red-500/20" style={{ height: percent(safe.top, CLIP_FRAME.height) }} />
          <div className="absolute inset-x-0 bottom-0 bg-red-500/20" style={{ height: percent(CLIP_FRAME.height - safe.bottom, CLIP_FRAME.height) }} />
          <div className="absolute right-0 bg-red-500/20" style={{ width: percent(CLIP_FRAME.width - safe.right, CLIP_FRAME.width), top: percent(safe.top, CLIP_FRAME.height), bottom: percent(CLIP_FRAME.height - safe.bottom, CLIP_FRAME.height) }} />
        </div>
      ) : null}
      {scale > 0 ? (
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: CLIP_FRAME.width, height: CLIP_FRAME.height, transform: `scale(${scale})`, visibility: "hidden" }}>
          <ClipText text={text} style={style}>
            <button
              type="button"
              aria-label={c.drag}
              title={c.drag}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={key}
              data-clip-text-box=""
              className={`pointer-events-auto visible absolute inset-0 touch-none border-dashed transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none ${dragging ? "cursor-grabbing border-primary" : "cursor-grab border-white/80"}`}
              style={{ borderWidth: 2 / scale, borderRadius: 6 / scale, boxShadow: `0 0 0 ${1 / scale}px rgba(0,0,0,0.35)` }}
            />
          </ClipText>
        </div>
      ) : null}
    </div>
  );
}

/** The Style tab's controls for the text. `custom`: the customer changed it, so there is something to reset. */
export function ClipTextControls({ text, style, custom, onChange, onReset, c }: { text: string; style: ClipTextStyle; custom: boolean; onChange: (style: ClipTextStyle) => void; onReset: () => void; c: T["viral"]["editor"]["clip"] }) {
  const set = (change: Partial<ClipTextStyle>) => onChange(boundClipText({ ...style, ...change }));
  const preset = custom ? clipPresetOf(style) : null;
  const weights = CLIP_FONTS[style.font].weights as readonly number[];
  const limited = clipTextLayout(text, style).size < style.size;
  return (
    <section aria-label={c.title} className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{c.title}</h3>
          <p className="text-xs text-muted-foreground">{custom ? c.hint : c.auto}</p>
        </div>
        {custom ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            {c.reset}
          </Button>
        ) : null}
      </div>

      <div role="group" aria-label={c.quick} className="grid grid-cols-4 gap-2">
        {CLIP_PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            onClick={() => onChange(withClipPreset(style, value))}
            className="flex h-12 items-center justify-center overflow-hidden rounded-lg border bg-neutral-800 px-1 text-center text-[11px] leading-tight transition hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/40"
          >
            <span className={PRESET_SAMPLE[value]}>{c.presets[value]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={c.font}>
          <NativeLikeSelect className={selectClass} value={style.font} onChange={(event) => set({ font: event.target.value as ClipFont, weight: nearestWeight(event.target.value as ClipFont, style.weight) })}>
            {CLIP_FONT_KEYS.map((value) => (
              <option key={value} value={value}>
                {c.fonts[value]}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
        <Field label={c.weight}>
          <NativeLikeSelect className={selectClass} value={String(style.weight)} disabled={weights.length < 2} onChange={(event) => set({ weight: Number(event.target.value) })}>
            {weights.map((value) => (
              <option key={value} value={String(value)}>
                {c.weights[String(value) as keyof typeof c.weights]}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
      </div>

      <Range label={c.size} value={style.size} min={CLIP_SIZE.min} max={CLIP_SIZE.max} unit="px" note={limited ? c.limited : undefined} onChange={(size) => set({ size })} />
      <Color label={c.color} value={style.color} onChange={(color) => set({ color })} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Segments label={c.align} value={style.align} options={CLIP_ALIGNS.map((value) => ({ value, label: c.aligns[value], icon: value === "left" ? <AlignLeft className="size-4" /> : value === "center" ? <AlignCenter className="size-4" /> : <AlignRight className="size-4" /> }))} onChange={(align) => set({ align })} />
        <Segments label={c.case} value={style.case} options={CLIP_CASES.map((value) => ({ value, label: c.cases[value] }))} onChange={(value) => set({ case: value })} />
      </div>

      <details className="rounded-xl border">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">{c.more}</summary>
        <div className="space-y-4 border-t p-3">
          <Range label={c.width} value={Math.round(style.w)} min={CLIP_WIDTH.min} max={CLIP_WIDTH.max} unit="%" onChange={(w) => set({ w })} />
          <Range label={c.stroke} value={style.stroke} min={0} max={CLIP_STROKE_MAX} unit="" onChange={(stroke) => set({ stroke })} />
          {style.stroke > 0 ? <Color label={c.strokeColor} value={style.strokeColor} onChange={(strokeColor) => set({ strokeColor })} /> : null}
          <Segments
            label={c.background}
            value={style.bg}
            options={(["none", "dark", "light", "orange", "highlight"] as const).map((value) => ({ value, label: c.backgrounds[value] }))}
            onChange={(bg) => set({ bg })}
          />
        </div>
      </details>

      <p className="text-xs text-muted-foreground">{c.tip}</p>
    </section>
  );
}

const PRESET_SAMPLE: Record<ClipPreset, string> = {
  clean: "font-medium text-white",
  bold: "font-black text-white",
  outline: "font-black text-white [text-shadow:-1px_-1px_0_#17212c,1px_-1px_0_#17212c,-1px_1px_0_#17212c,1px_1px_0_#17212c]",
  highlight: "font-extrabold text-white [background:linear-gradient(transparent_55%,rgba(255,144,69,0.75)_55%)]",
  box: "rounded bg-black/80 px-1.5 py-0.5 font-extrabold text-white",
  whitebox: "rounded bg-white px-1.5 py-0.5 font-extrabold text-neutral-800",
  orange: "rounded bg-[#eb651e] px-1.5 py-0.5 font-black text-white",
  subtitle: "self-end pb-1 text-[10px] font-bold text-white",
};

function Range({ label, value, min, max, unit, note, onChange }: { label: string; value: number; min: number; max: number; unit: string; note?: string; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <label htmlFor={id}>{label}</label>
        <span className="text-muted-foreground tabular-nums">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-5 w-full cursor-pointer accent-primary" />
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** A colour: the picker and its hex code, taken once it is a whole code. */
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value.toLowerCase())} className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-background p-1" />
        <Input
          aria-label={`${label} (hex)`}
          value={typed ?? value}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.trim();
            setTyped(next);
            const code = next.startsWith("#") ? next : `#${next}`;
            if (/^#[0-9a-f]{6}$/i.test(code)) onChange(code.toLowerCase());
          }}
          onBlur={() => setTyped(null)}
        />
      </div>
    </div>
  );
}

function Segments<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: { value: V; label: string; icon?: ReactNode }[]; onChange: (value: V) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-label={option.icon ? option.label : undefined}
            title={option.icon ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
          >
            {option.icon ?? option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
