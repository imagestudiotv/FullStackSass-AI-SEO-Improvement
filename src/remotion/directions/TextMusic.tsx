import type { CSSProperties } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { FONT } from "../fonts";
import type { ProductionPart } from "../production";
import { CtaScene } from "../scenes/Cta";
import { emphasis, fitFontSize, splitWords } from "../text";
import { alpha } from "../theme";
import { Enter, IllustrativeLabel, Parts, SceneVisual, mediaFor, type DirectionProps } from "./common";

/**
 * Text + Music: no narration - fast animated typography over the visuals,
 * cut on the beat. Each scene uses another type layout (a word stack that
 * snaps in, lines sliding, a mask reveal, highlighter boxes), so the video
 * never settles into one pattern. The words stay up long enough to read
 * (production.ts readingTiming: about 2.5-3 words a second).
 */

type Layout = "stack" | "slide" | "mask" | "boxes";
const LAYOUTS: Layout[] = ["stack", "slide", "mask", "boxes"];

export function TextMusicProduction(props: DirectionProps) {
  const { timeline, pal, brand } = props;
  return (
    <Parts timeline={timeline}>
      {(part, index, duration) => (
        <Enter type={part.scene?.transition ?? "zoom"}>
          {part.role === "cta" ? (
            <AbsoluteFill>
              <SceneVisual media={mediaFor(props, part)} duration={duration} motion="pull" seed={index} pal={pal} concept={props.concept} />
              <AbsoluteFill style={{ background: "rgba(5,5,8,0.78)" }} />
              <CtaScene brand={brand} cta={part.title} pal={pal} />
            </AbsoluteFill>
          ) : (
            <TypeScene {...props} part={part} index={index} duration={duration} layout={part.role === "hook" ? "stack" : LAYOUTS[index % LAYOUTS.length]} />
          )}
        </Enter>
      )}
    </Parts>
  );
}

function TypeScene(props: DirectionProps & { part: ProductionPart; index: number; duration: number; layout: Layout }) {
  const { part, index, duration, layout, pal, safe } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const media = mediaFor(props, part);
  const words = splitWords(part.title);
  const strong = emphasis(words);
  // Reveal the title within the first ~40% of the scene, a word per beat, the hook at once.
  const reveal = part.role === "hook" ? 2 : Math.max(2, Math.min(6, Math.floor((duration * 0.4) / Math.max(1, words.length))));
  const size = fitFontSize(part.title, 880, layout === "stack" ? 5 : 4, layout === "stack" ? 128 : 100, 56);
  // Beat pulses on the background, on each word's arrival.
  const lastBeat = Math.floor(Math.max(0, frame - 1) / reveal) * reveal;
  const pulse = frame < words.length * reveal + 2 ? interpolate(frame - lastBeat, [0, 5], [1.04, 1], { extrapolateRight: "clamp" }) : 1;
  const detailAt = words.length * reveal + 8;
  const detail = spring({ frame: frame - detailAt, fps, config: { damping: 200, stiffness: 120 } });

  const wordStyle = (i: number): CSSProperties => {
    const s = spring({ frame: frame - 1 - i * reveal, fps, config: { damping: 12, stiffness: 260, mass: 0.55 } });
    const on = frame >= 1 + i * reveal;
    const base: CSSProperties = { display: "inline-block", marginRight: size * 0.2, opacity: on ? 1 : 0 };
    if (layout === "stack") return { ...base, transform: `scale(${1.7 - 0.7 * s})`, transformOrigin: "50% 60%" };
    if (layout === "slide") return { ...base, transform: `translateX(${(1 - s) * (i % 2 ? 160 : -160)}px)` };
    if (layout === "mask") return { ...base, clipPath: `inset(${(1 - s) * 100}% 0 0 0)`, transform: `translateY(${(1 - s) * 30}px)` };
    return { ...base, transform: `scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * (i % 2 ? 8 : -8)}deg)` };
  };

  return (
    <AbsoluteFill style={{ background: "#07070b", fontFamily: FONT }}>
      <AbsoluteFill style={{ transform: `scale(${pulse})` }}>
        <SceneVisual media={media} duration={duration} motion="drift" seed={index} pal={pal} concept={props.concept} query={part.scene?.visual.query} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: media ? "rgba(6,6,10,0.58)" : alpha(pal.primary, 0.12) }} />
      <div
        style={{
          position: "absolute",
          left: 80,
          width: 880,
          top: safe.top + 120,
          bottom: 1920 - safe.bottom + 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: layout === "stack" ? "center" : "flex-start",
          alignItems: layout === "stack" ? "center" : "flex-start",
          textAlign: layout === "stack" ? "center" : "left",
        }}
      >
        <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.04em", color: "#fff", textTransform: layout === "boxes" ? "none" : undefined }}>
          {words.map((word, i) => (
            <span key={i} style={wordStyle(i)}>
              <span
                style={{
                  color: strong.has(i) ? (layout === "boxes" ? pal.onAccent : pal.accent) : "#fff",
                  background: layout === "boxes" && strong.has(i) ? pal.accent : undefined,
                  padding: layout === "boxes" && strong.has(i) ? `0 ${size * 0.12}px` : undefined,
                  borderRadius: size * 0.1,
                }}
              >
                {word}
              </span>
            </span>
          ))}
        </div>
        {part.detail ? (
          <div
            style={{
              marginTop: 44,
              maxWidth: 860,
              fontSize: fitFontSize(part.detail, 860, 4, 54, 44, 0.55),
              fontWeight: 600,
              lineHeight: 1.25,
              color: "rgba(255,255,255,0.9)",
              opacity: detail,
              transform: `translateY(${(1 - detail) * 24}px)`,
            }}
          >
            {part.detail}
          </div>
        ) : null}
      </div>
      {media?.illustrative ? <IllustrativeLabel language={props.language} top={safe.top} /> : null}
    </AbsoluteFill>
  );
}
