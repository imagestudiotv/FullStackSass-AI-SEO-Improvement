import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { FONT } from "../fonts";
import { partEnd, type ProductionPart } from "../production";
import { CtaScene } from "../scenes/Cta";
import { fitFontSize } from "../text";
import { alpha } from "../theme";
import { Enter, FilmTexture, IllustrativeLabel, LegibilityShade, Parts, SceneVisual, StyledCaptions, mediaFor, type DirectionProps } from "./common";

/**
 * Storytelling: situation -> development -> turn -> resolution. Chapter
 * beats at the top (I, II, III...), slow push-ins, editorial words, and a
 * "turn" moment - the picture drains to black and white and snaps back in
 * colour with a flash - on the scene where the story changes (the proof,
 * else the last point).
 */

type Act = "situation" | "development" | "turn" | "resolution";

function actOf(part: ProductionPart, turnPart: number): Act {
  if (part.role === "hook") return "situation";
  if (part.part === turnPart) return "turn";
  if (part.role === "cta" || (part.role === "proof" && part.part !== turnPart)) return "resolution";
  return "development";
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export function StorytellingProduction(props: DirectionProps) {
  const { timeline, pal, safe, brand, production, plan } = props;
  const captionStyle = production?.captionStyle ?? plan?.captionStyle ?? "editorial";
  const proof = timeline.parts.find((part) => part.role === "proof");
  const points = timeline.parts.filter((part) => part.role === "point");
  const turnPart = proof?.part ?? points[points.length - 1]?.part ?? -1;
  return (
    <>
      <Parts timeline={timeline}>
        {(part, index, duration) => (
          <Enter type={part.scene?.transition ?? "fade"}>
            {part.role === "cta" ? (
              <AbsoluteFill>
                <SceneVisual media={mediaFor(props, part)} duration={duration} motion="pull" seed={index} pal={pal} concept={props.concept} />
                <AbsoluteFill style={{ background: "rgba(5,5,8,0.76)" }} />
                <CtaScene brand={brand} cta={part.title} pal={pal} />
              </AbsoluteFill>
            ) : (
              <StoryScene {...props} part={part} index={index} duration={duration} act={actOf(part, turnPart)} />
            )}
          </Enter>
        )}
      </Parts>
      <FilmTexture strength={0.6} />
      <Chapters {...props} />
      <StyledCaptions words={timeline.words} style={captionStyle} pal={pal} safe={safe} />
    </>
  );
}

function StoryScene(props: DirectionProps & { part: ProductionPart; index: number; duration: number; act: Act }) {
  const { part, index, duration, act, pal, safe } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const media = mediaFor(props, part);
  const turnAt = Math.min(Math.round(duration * 0.35), 30);
  const grey = act === "turn" ? interpolate(frame, [0, turnAt - 2, turnAt], [0.2, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const flash = act === "turn" ? interpolate(frame, [turnAt, turnAt + 7], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const title = spring({ frame: frame - 3, fps, config: { damping: 200, stiffness: 90 } });
  const size = fitFontSize(part.title, 860, 4, part.role === "hook" ? 92 : 74, 50, 0.55);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <SceneVisual
        media={media}
        duration={duration}
        motion={act === "turn" ? "pull" : "push"}
        seed={index}
        pal={pal}
        concept={props.concept}
        query={part.scene?.visual.query}
        style={{ filter: `grayscale(${grey}) contrast(${1 + grey * 0.15})` }}
      />
      <LegibilityShade strength={1} top={0.55} />
      {flash > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: flash }} /> : null}
      <div
        style={{
          position: "absolute",
          left: 80,
          width: 860,
          top: safe.top + 150,
          fontFamily: FONT,
          fontSize: size,
          fontWeight: part.role === "hook" ? 800 : 700,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          color: "#fff",
          textShadow: "0 4px 26px rgba(0,0,0,0.6)",
          opacity: title,
          transform: `translateY(${(1 - title) * 26}px)`,
        }}
      >
        {act === "turn" ? (
          <div style={{ width: 120 * Math.min(1, frame / 12), height: 8, borderRadius: 4, background: pal.accent, marginBottom: 26 }} />
        ) : null}
        {part.title}
      </div>
      {media?.illustrative ? <IllustrativeLabel language={props.language} top={safe.top + 60} /> : null}
    </AbsoluteFill>
  );
}

/** The chapter beats: one segment per scene, numbered, the current one filling. */
function Chapters({ timeline, pal, safe }: DirectionProps) {
  const frame = useCurrentFrame();
  const parts = timeline.parts;
  let current = 0;
  timeline.starts.forEach((start, i) => {
    if (frame >= start) current = i;
  });
  const progress = interpolate(frame, [timeline.starts[current], partEnd(timeline, current)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: safe.top, left: 80, right: 140, display: "flex", gap: 12, fontFamily: FONT }}>
      {parts.map((part, i) => (
        <div key={part.part} style={{ flex: 1 }}>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(i < current ? 1 : i === current ? progress : 0) * 100}%`, background: i === current ? pal.accent : "#fff" }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 26, fontWeight: 800, color: i === current ? "#fff" : alpha("#ffffff", 0.45), letterSpacing: "0.08em" }}>{ROMAN[i] ?? i + 1}</div>
        </div>
      ))}
    </div>
  );
}
