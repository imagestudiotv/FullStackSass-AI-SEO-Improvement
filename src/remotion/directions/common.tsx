import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, Sequence, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { CaptionStyle, CaptionWord, Transition } from "../../lib/video/formats";
import { Captions, groupWords } from "../components/Captions";
import { BrandShapes } from "../components/Media";
import { FONT } from "../fonts";
import type { ProductionPart, ProductionTimeline } from "../production";
import { partEnd } from "../production";
import type { ProductionReelProps, SceneMedia } from "../props";
import { fitFontSize } from "../text";
import { alpha, mix, type Palette } from "../theme";

/**
 * Building blocks every production shares: the full-bleed scene visual with a
 * purposeful crop and motion, the entering transitions, the three caption
 * styles, the film texture, and the concept and "illustrative" labels.
 */

export type DirectionProps = ProductionReelProps & { timeline: ProductionTimeline; pal: Palette; safe: { top: number; bottom: number; left: number; right: number } };

/** The scene's media, cycling the resolved ones for scenes without their own (never a blank frame). */
export function mediaFor(props: ProductionReelProps, part: ProductionPart, offset = 0): SceneMedia | null {
  const own = props.sceneMedia?.[part.part] ?? null;
  if (own && offset === 0) return own;
  const all = (props.sceneMedia ?? []).filter((item): item is SceneMedia => Boolean(item));
  if (!all.length) {
    // Before the make (concept preview) or a legacy row: the idea's own media.
    const legacy = props.media ?? [];
    if (!legacy.length) return null;
    const item = legacy[(part.part + offset) % legacy.length];
    return { url: item.url, kind: item.kind, source: "article" };
  }
  const start = own ? all.indexOf(own) : part.part;
  return all[(Math.max(0, start) + offset) % all.length];
}

export type Motion = "push" | "pull" | "punch" | "drift" | "still";

/**
 * A picture or clip filling the 9:16 frame (object-fit cover around its focal
 * point), moving: a slow push-in, a pull-out, a punch-in, a drift. Without
 * media - or when the file fails - the concept placeholder or brand shapes.
 */
export function SceneVisual({
  media,
  duration,
  motion = "push",
  seed = 0,
  pal,
  concept,
  query,
  startFrom = 0,
  extraScale = 1,
  style,
}: {
  media: SceneMedia | null;
  duration: number;
  motion?: Motion;
  seed?: number;
  pal: Palette;
  concept?: boolean;
  query?: string;
  startFrom?: number;
  extraScale?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [failed, setFailed] = useState(false);
  const t = interpolate(frame, [0, Math.max(1, duration)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - (1 - t) * (1 - t);
  let scale = 1.04;
  if (motion === "push") scale = 1.04 + 0.12 * eased;
  else if (motion === "pull") scale = 1.18 - 0.12 * eased;
  else if (motion === "punch") scale = 1.02 + 0.06 * t;
  else if (motion === "drift") scale = 1.1;
  const dx = motion === "drift" ? (random(`drift-x-${seed}`) - 0.5) * 80 * (t - 0.5) : 0;
  const dy = motion === "drift" ? (random(`drift-y-${seed}`) - 0.5) * 60 * (t - 0.5) : 0;
  if (!media || failed) {
    return concept ? <ConceptFrame query={query} seed={seed} pal={pal} /> : <BrandShapes seed={seed} pal={pal} />;
  }
  const position = `${Math.round((media.focalX ?? 0.5) * 100)}% ${Math.round((media.focalY ?? 0.42) * 100)}%`;
  const mediaStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: position,
    transform: `scale(${scale * extraScale}) translate(${dx}px, ${dy}px)`,
    transformOrigin: position,
    ...style,
  };
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      {media.kind === "video" ? (
        loopFrames(media, fps, startFrom, duration) ? (
          <Loop durationInFrames={loopFrames(media, fps, startFrom, duration)!} layout="none">
            <OffthreadVideo src={media.url} muted startFrom={startFrom} style={mediaStyle} onError={() => setFailed(true)} />
          </Loop>
        ) : (
          <OffthreadVideo src={media.url} muted startFrom={startFrom} style={mediaStyle} onError={() => setFailed(true)} />
        )
      ) : (
        <Img src={media.url} style={mediaStyle} onError={() => setFailed(true)} />
      )}
    </AbsoluteFill>
  );
}

/** The frames to loop a clip over, when the scene outlasts it; null = no loop needed (or its length unknown). */
function loopFrames(media: SceneMedia, fps: number, startFrom: number, duration: number): number | null {
  if (!media.durationMs) return null;
  const frames = Math.floor((media.durationMs / 1000) * fps) - startFrom - 1;
  return frames > 10 && frames < duration ? frames : null;
}

/** A neutral frame standing in for footage chosen at make time (concept preview only), labelled as such. */
export function ConceptFrame({ query, seed, pal }: { query?: string; seed: number; pal: Palette }) {
  const frame = useCurrentFrame();
  const shift = (frame * 0.8 + seed * 40) % 120;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${mix(pal.primary, "#1c1c22", 0.82)} 0%, #0c0c10 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 60px)",
          backgroundPosition: `${shift}px 0`,
        }}
      />
      {query ? (
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 140,
            top: 880,
            textAlign: "center",
            fontFamily: FONT,
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.3,
          }}
        >
          <div style={{ fontSize: 26, letterSpacing: "0.18em", fontWeight: 800, marginBottom: 14 }}>FOOTAGE</div>
          {query}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

/** The concept badge: the preview is never presented as the final video. */
export function ConceptBadge({ top, right = false }: { top: number; right?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        ...(right ? { right: 80 } : { left: 80 }),
        padding: "8px 18px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.55)",
        border: "2px solid rgba(255,255,255,0.35)",
        color: "#fff",
        fontFamily: FONT,
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "0.14em",
        zIndex: 50,
      }}
    >
      CONCEPT
    </div>
  );
}

const ILLUSTRATIVE: Record<string, string> = {
  en: "Illustrative footage",
  fr: "Images d'illustration",
  de: "Symbolbild",
  es: "Imágenes ilustrativas",
  it: "Immagini illustrative",
  pt: "Imagens ilustrativas",
  nl: "Beeld ter illustratie",
  pl: "Zdjęcia ilustracyjne",
  ro: "Imagini ilustrative",
};

/** A small mark on stock/AI footage paired with words about people, so stock actors never pass as real clients or staff. */
export function IllustrativeLabel({ language, top }: { language?: string; top: number }) {
  const text = ILLUSTRATIVE[(language ?? "en").slice(0, 2).toLowerCase()] ?? ILLUSTRATIVE.en;
  return (
    <div
      style={{
        position: "absolute",
        top,
        right: 160,
        padding: "6px 14px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.5)",
        color: "rgba(255,255,255,0.85)",
        fontFamily: FONT,
        fontSize: 24,
        fontWeight: 600,
        zIndex: 40,
      }}
    >
      {text}
    </div>
  );
}

/** Film texture: a little grain and a vignette, so stock clips feel shot rather than pasted. */
export function FilmTexture({ strength = 1 }: { strength?: number }) {
  const frame = useCurrentFrame();
  const x = Math.round(random(`grain-x-${frame}`) * 100);
  const y = Math.round(random(`grain-y-${frame}`) * 100);
  return (
    <>
      <AbsoluteFill
        style={{
          opacity: 0.07 * strength,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1.2px)",
          backgroundSize: "5px 5px",
          backgroundPosition: `${x}px ${y}px`,
          mixBlendMode: "overlay",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 70% at 50% 45%, transparent 55%, rgba(0,0,0,${0.55 * strength}) 100%)` }} />
    </>
  );
}

/** A dark wash that keeps white words legible on any picture, stronger where the captions sit. */
export function LegibilityShade({ strength = 1, top = 0.35 }: { strength?: number; top?: number }) {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, rgba(0,0,0,${top * strength}) 0%, rgba(0,0,0,${0.05 * strength}) 28%, rgba(0,0,0,${0.12 * strength}) 52%, rgba(0,0,0,${0.62 * strength}) 78%, rgba(0,0,0,${0.75 * strength}) 100%)`,
      }}
    />
  );
}

/** Frames a transition into a scene takes. */
export const ENTER_FRAMES: Record<Transition, number> = { cut: 0, zoom: 8, whip: 7, slide: 9, flash: 6, glitch: 7, fade: 12 };

/**
 * A scene entering with its planned transition (ShotScene.transition). The
 * previous scene stays underneath for ENTER_FRAMES (the sequences overlap),
 * so a fade or a whip never shows black.
 */
export function Enter({ type, children }: { type: Transition; children: ReactNode }) {
  const frame = useCurrentFrame();
  const n = ENTER_FRAMES[type] || 1;
  const t = interpolate(frame, [0, n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - (1 - t) ** 3;
  let style: CSSProperties = {};
  let overlay: ReactNode = null;
  if (type === "zoom") style = { transform: `scale(${1.35 - 0.35 * ease})`, opacity: Math.min(1, t * 2.2) };
  else if (type === "whip") style = { transform: `translateX(${(1 - ease) * 105}%)`, filter: t < 1 ? `blur(${(1 - t) * 26}px)` : undefined };
  else if (type === "slide") style = { transform: `translateY(${(1 - ease) * 100}%)` };
  else if (type === "fade") style = { opacity: t };
  else if (type === "flash") overlay = <AbsoluteFill style={{ background: "#fff", opacity: 1 - t }} />;
  else if (type === "glitch" && t < 1) {
    const jitter = (random(`glitch-${frame}`) - 0.5) * 60;
    style = { transform: `translateX(${jitter}px)`, filter: `hue-rotate(${Math.round(jitter * 3)}deg) saturate(1.8)` };
    overlay = (
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.6 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: `${random(`gy-${frame}`) * 80}%`, height: 90, background: "rgba(255,0,90,0.45)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: `${random(`gz-${frame}`) * 80}%`, height: 50, background: "rgba(0,220,255,0.45)" }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={style}>{children}</AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
}

/**
 * Each part of the timeline as a sequence that overlaps the next one by its
 * transition, the render function getting the part, its index and length.
 */
export function Parts({
  timeline,
  children,
}: {
  timeline: ProductionTimeline;
  children: (part: ProductionPart, index: number, duration: number) => ReactNode;
}) {
  return (
    <>
      {timeline.parts.map((part, index) => {
        const from = timeline.starts[index];
        const duration = Math.max(1, partEnd(timeline, index) - from);
        const next = timeline.parts[index + 1];
        const overlap = next?.scene ? ENTER_FRAMES[next.scene.transition] ?? 0 : 0;
        return (
          <Sequence key={part.part} from={from} durationInFrames={duration + overlap} layout="none">
            <AbsoluteFill>{children(part, index, duration)}</AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
}

/** The captions in the production's style: bold word boxes, editorial sentences, or minimal lower-third words. */
export function StyledCaptions({ words, style, pal, safe }: { words: CaptionWord[]; style: CaptionStyle; pal: Palette; safe: DirectionProps["safe"] }) {
  if (!words.length) return null;
  if (style === "editorial") return <EditorialCaptions words={words} safe={safe} />;
  if (style === "minimal") return <MinimalCaptions words={words} pal={pal} safe={safe} />;
  return <Captions words={words} pal={{ ...pal, captionBox: "#ffffff", captionInk: "#0f0f14" }} />;
}

type Line = { words: CaptionWord[]; startMs: number; endMs: number };

/** Sentence-sized lines (up to ~7 words, broken at punctuation and pauses). */
export function sentenceLines(words: CaptionWord[], maxWords = 7, maxChars = 38): Line[] {
  const lines: Line[] = [];
  let current: CaptionWord[] = [];
  const flush = () => {
    if (current.length) lines.push({ words: current, startMs: current[0].startMs, endMs: current[current.length - 1].endMs });
    current = [];
  };
  for (const word of words) {
    const text = word.text.trim();
    if (!text) continue;
    const previous = current[current.length - 1];
    const chars = current.reduce((n, w) => n + w.text.length + 1, 0) + text.length;
    if (previous && (current.length >= maxWords || chars > maxChars || word.startMs - previous.endMs > 450 || /[.!?;:]$/.test(previous.text))) flush();
    current.push({ ...word, text });
  }
  flush();
  return lines;
}

function useLine(lines: Line[], hold = 500): { line: Line; index: number; ms: number } | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const index = lines.findIndex((line, i) => {
    const next = lines[i + 1];
    const until = next ? Math.min(next.startMs, line.endMs + hold) : line.endMs + hold;
    return ms >= line.startMs - 60 && ms < until;
  });
  return index < 0 ? null : { line: lines[index], index, ms };
}

/** Clean subtitles: the whole sentence, the word being said brightest, on a soft dark band. */
function EditorialCaptions({ words, safe }: { words: CaptionWord[]; safe: DirectionProps["safe"] }) {
  const lines = useMemo(() => sentenceLines(words), [words]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const current = useLine(lines);
  if (!current) return null;
  const { line, index, ms } = current;
  const text = line.words.map((w) => w.text).join(" ");
  const size = fitFontSize(text, safe.right - safe.left - 80, 2, 58, 46, 0.55);
  const enter = spring({ frame: frame - (line.startMs / 1000) * fps + 2, fps, config: { damping: 200, stiffness: 160 } });
  return (
    <div style={{ position: "absolute", left: safe.left, width: safe.right - safe.left, top: safe.bottom - 260, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        key={index}
        style={{
          padding: "18px 30px 22px",
          borderRadius: 18,
          background: "rgba(8,8,12,0.62)",
          textAlign: "center",
          fontFamily: FONT,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.22,
          letterSpacing: "-0.01em",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 18}px)`,
        }}
      >
        {line.words.map((word, i) => (
          <span key={i} style={{ color: ms >= word.startMs - 40 ? "#ffffff" : "rgba(255,255,255,0.55)" }}>
            {word.text}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Small lower-third words, left aligned, the brand colour under the spoken one. */
function MinimalCaptions({ words, pal, safe }: { words: CaptionWord[]; pal: Palette; safe: DirectionProps["safe"] }) {
  const lines = useMemo(() => groupWords(words), [words]);
  const current = useLine(lines, 350);
  if (!current) return null;
  const { line, index, ms } = current;
  return (
    <div
      key={index}
      style={{
        position: "absolute",
        left: safe.left,
        width: safe.right - safe.left - 60,
        top: safe.bottom - 170,
        fontFamily: FONT,
        fontSize: 46,
        fontWeight: 700,
        lineHeight: 1.2,
        color: "#fff",
        textShadow: "0 3px 14px rgba(0,0,0,0.7)",
      }}
    >
      {line.words.map((word, i) => {
        const said = ms >= word.startMs - 40;
        const next = line.words[i + 1];
        const active = said && (next ? ms < next.startMs : ms < word.endMs + 200);
        return (
          <span key={i} style={{ opacity: said ? 1 : 0.35, borderBottom: active ? `5px solid ${pal.accent}` : "5px solid transparent", marginRight: 12 }}>
            {word.text}
          </span>
        );
      })}
    </div>
  );
}

/** The brand, small, at the top: who made the video, without an ad's banner. */
export function BrandTag({ name, pal, top, left = 80 }: { name: string; pal: Palette; top: number; left?: number }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top, left, display: "flex", alignItems: "center", gap: 12, opacity: enter * 0.9, fontFamily: FONT }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: pal.accent, boxShadow: `0 0 18px ${alpha(pal.accent, 0.8)}` }} />
      <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.6)", maxWidth: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </span>
    </div>
  );
}
